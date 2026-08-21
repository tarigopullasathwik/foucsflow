import os
import json
import logging
from datetime import datetime, timedelta
from config import Config

logger = logging.getLogger(__name__)

# Initialize Gemini if key is provided
GEMINI_AVAILABLE = False
if Config.GEMINI_API_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=Config.GEMINI_API_KEY)
        # Verify model initialization
        model = genai.GenerativeModel("gemini-2.5-flash")
        GEMINI_AVAILABLE = True
        logger.info("Google Gemini API initialized successfully.")
    except Exception as e:
        logger.warning(f"Failed to initialize Gemini API: {e}. Falling back to smart rules engine.")
        GEMINI_AVAILABLE = False
else:
    logger.info("No Gemini API Key provided. FocusFlow AI will run in local fallback mode (heuristics-based).")
    GEMINI_AVAILABLE = False

def parse_json_safely(text):
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Models sometimes wrap JSON in prose — slice out the outermost
        # object/array and retry once before giving up.
        starts = [i for i in (text.find("{"), text.find("[")) if i != -1]
        ends = [i for i in (text.rfind("}"), text.rfind("]")) if i != -1]
        if starts and ends:
            return json.loads(text[min(starts):max(ends) + 1])
        raise

def _deadline_to_local(deadline_str):
    """Parse an ISO deadline and convert it to naive local time for comparison.

    The frontend sends UTC ('...Z') strings; storing users' deadlines but
    comparing them against naive local time silently shifts urgency for
    anyone not in UTC. Returns None when unparseable.
    """
    if not deadline_str:
        return None
    try:
        parsed = datetime.fromisoformat(str(deadline_str).replace("Z", "+00:00"))
        if parsed.tzinfo is not None:
            parsed = parsed.astimezone().replace(tzinfo=None)
        return parsed
    except (ValueError, TypeError):
        return None


# MOCK/HEURISTIC GENERATION HELPERS

def generate_local_priority(task, workload_count=3):
    """
    Calculate priority score (1-100) locally based on:
    - proximity to deadline
    - task importance (High/Medium/Low)
    - difficulty (Hard/Medium/Easy)
    - estimated duration
    - progress
    """
    score = 50 # base score
    
    # Importance contribution (up to +25)
    imp = task.get("importance", "Medium").lower()
    if imp == "high":
        score += 25
    elif imp == "medium":
        score += 12
    else:
        score += 2
        
    # Difficulty contribution (up to +10)
    diff = task.get("difficulty", "Medium").lower()
    if diff == "hard":
        score += 10
    elif diff == "medium":
        score += 5
    else:
        score += 2
        
    # Progress contribution (reduces priority if nearly done)
    prog = int(task.get("progress", 0))
    score -= int(prog * 0.3)
    
    # Deadline proximity contribution (up to +40)
    deadline_str = task.get("deadline", "")
    reason = "Standard task weighting."
    
    if deadline_str:
        try:
            deadline = _deadline_to_local(deadline_str)
            if deadline is None:
                raise ValueError("unparseable deadline")
            now = datetime.now()
            time_left = deadline - now
            hours_left = time_left.total_seconds() / 3600.0
            
            if hours_left <= 0:
                score += 40
                urgency = "Critical"
                reason = "This task's deadline has already passed! Immediate action required."
            elif hours_left < 12:
                score += 38
                urgency = "Critical"
                reason = f"Due very soon (in {int(hours_left)} hours). High importance and quick action required."
            elif hours_left < 24:
                score += 30
                urgency = "High"
                reason = f"Due tomorrow. Estimated duration is {task.get('estimated_duration')} minutes. Prioritize to avoid late-night work."
            elif hours_left < 72:
                score += 18
                urgency = "Medium"
                reason = f"Due in {int(hours_left/24)} days. Standard workflow tracking."
            else:
                score += 5
                urgency = "Low"
                reason = "Plenty of time left. Work on urgent items first."
        except Exception as e:
            urgency = "Medium"
            reason = f"Based on category '{task.get('category')}' and general parameters."
    else:
        urgency = "Medium"
        reason = f"No hard deadline. Sorted by importance ({task.get('importance')}) and difficulty ({task.get('difficulty')})."

    # Clamp score between 1 and 100
    final_score = max(1, min(100, int(score)))
    
    # Overrides based on urgency
    if final_score > 85:
        urgency = "Critical"
    elif final_score > 70:
        urgency = "High"
    elif final_score > 40:
        urgency = "Medium"
    else:
        urgency = "Low"
        
    return {
        "priority_score": final_score,
        "urgency_level": urgency,
        "priority_reason": reason
    }

def generate_local_risk(task):
    """
    Predict deadline risk based on work effort, deadlines, and progress.
    """
    deadline_str = task.get("deadline", "")
    duration = int(task.get("estimated_duration", 60))
    progress = int(task.get("progress", 0))
    remaining_work_mins = duration * (1.0 - (progress / 100.0))
    
    if not deadline_str:
        return {
            "risk_percentage": 0,
            "risk_color": "emerald",
            "risk_reason": "No hard deadline specified. No immediate schedule risk.",
            "risk_recommendation": "Work at your own pace."
        }
        
    try:
        deadline = _deadline_to_local(deadline_str)
        if deadline is None:
            raise ValueError("unparseable deadline")
        now = datetime.now()
        time_left = deadline - now
        hours_left = time_left.total_seconds() / 3600.0
        
        if hours_left <= 0:
            return {
                "risk_percentage": 100,
                "risk_color": "rose",
                "risk_reason": "Deadline has already passed.",
                "risk_recommendation": "Submit/complete immediately and contact manager if necessary."
            }
            
        # Available hours is roughly 8 hours of productivity per day, or the hours remaining if < 24h
        # Let's say user can work at most 12 hours a day
        days_left = max(0.1, hours_left / 24.0)
        available_productive_hours = days_left * 8.0 # assume 8 hours/day max productivity
        
        # Adjust for hours left if due today
        if hours_left < 24:
            available_productive_hours = min(hours_left * 0.8, 12.0)
            
        required_hours = remaining_work_mins / 60.0
        
        ratio = required_hours / max(0.1, available_productive_hours)
        
        # Risk percentage calculations
        if ratio > 1.2:
            risk = min(99, int(80 + (ratio * 10)))
            color = "rose"
            reason = f"Estimated effort of {required_hours:.1f} hrs exceeds available time ({hours_left:.1f} clock hours left)."
            reco = "Focus exclusively on this task. Delay all other non-essential work. Break into smaller items."
        elif ratio > 0.7:
            risk = int(50 + (ratio * 20))
            color = "amber"
            reason = f"Tight schedule. Task requires {required_hours:.1f} hrs and you have {hours_left:.1f} hours left before deadline."
            reco = "Start this task today to ensure completion without stress."
        else:
            risk = max(5, int(ratio * 40))
            color = "emerald"
            reason = f"Comfortable timeline. Plenty of time ({hours_left:.1f} hours left) to complete {required_hours:.1f} hours of work."
            reco = "Maintain your current pace. Follow your daily schedule."
            
        return {
            "risk_percentage": risk,
            "risk_color": color,
            "risk_reason": reason,
            "risk_recommendation": reco
        }
        
    except Exception as e:
        return {
            "risk_percentage": 30,
            "risk_color": "emerald",
            "risk_reason": "Unable to calculate exact timezone differences. Default safe estimation.",
            "risk_recommendation": "Monitor task requirements."
        }

# GEMINI-POWERED API IMPLEMENTATIONS

def calculate_priority_gemini(tasks, user_history=None):
    if not GEMINI_AVAILABLE:
        return {t["id"]: generate_local_priority(t) for t in tasks}
        
    try:
        tasks_input = []
        for t in tasks:
            tasks_input.append({
                "id": t["id"],
                "title": t["title"],
                "description": t["description"],
                "deadline": t["deadline"],
                "duration": t["estimated_duration"],
                "difficulty": t["difficulty"],
                "importance": t["importance"],
                "category": t["category"],
                "progress": t["progress"]
            })
            
        prompt = f"""
        You are FocusFlow AI's core Priority Engine. Your goal is to intelligently rank the user's tasks.
        Calculate a priority score (1-100), urgency level ('Critical', 'High', 'Medium', 'Low'), and a concise, helpful reason for each task.
        
        Consider:
        - Proximity to deadline (current local time is {datetime.now().isoformat()}).
        - Importance (High/Medium/Low) & Difficulty (Hard/Medium/Easy).
        - Effort (duration) vs. current progress.
        - Prioritize urgent work but also consider high-importance long-term work so it isn't neglected.
        
        Input Tasks:
        {json.dumps(tasks_input, indent=2)}
        
        Output format: Return ONLY a valid JSON object where keys are the task IDs, and values are objects containing:
        - "priority_score" (integer 1-100)
        - "urgency_level" (string: "Critical", "High", "Medium", or "Low")
        - "priority_reason" (string, max 2 sentences, describing exactly why it is ranked this way)
        
        Example output format:
        {{
          "task_uuid_1": {{
            "priority_score": 96,
            "urgency_level": "Critical",
            "priority_reason": "High importance, interview tomorrow, estimated duration 2 hours. Start immediately."
          }}
        }}
        """
        
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        
        result = parse_json_safely(response.text)
        return result
    except Exception as e:
        logger.error(f"Gemini priority calculation failed: {e}. Using local fallback.")
        return {t["id"]: generate_local_priority(t) for t in tasks}

def predict_deadline_risks_gemini(tasks, calendar_events=None):
    if not GEMINI_AVAILABLE:
        return {t["id"]: generate_local_risk(t) for t in tasks}
        
    try:
        tasks_input = []
        for t in tasks:
            tasks_input.append({
                "id": t["id"],
                "title": t["title"],
                "deadline": t["deadline"],
                "duration": t["estimated_duration"],
                "progress": t["progress"],
                "importance": t["importance"]
            })
            
        prompt = f"""
        You are FocusFlow AI's Deadline Risk Predictor.
        Analyze the workload and upcoming deadlines (current local time is {datetime.now().isoformat()}).
        Estimate the percentage risk (0 to 100) that the user will fail to complete each task before its deadline.
        
        Assign:
        - "risk_percentage" (integer 0-100)
        - "risk_color" ("rose" for high risk >70%, "amber" for medium risk 35-70%, "emerald" for low risk <35%)
        - "risk_reason" (string explaining why - e.g., 'Requires 6 hours of work but only 3 hours remain before deadline')
        - "risk_recommendation" (string recommending action - e.g., 'Begin immediately; reschedule lower priority items')
        
        Input Tasks:
        {json.dumps(tasks_input, indent=2)}
        
        Output format: Return ONLY a valid JSON object where keys are the task IDs, and values are objects containing:
        - "risk_percentage" (integer 0-100)
        - "risk_color" (string: "rose", "amber", or "emerald")
        - "risk_reason" (string, max 2 sentences)
        - "risk_recommendation" (string, max 2 sentences)
        """
        
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        
        result = parse_json_safely(response.text)
        return result
    except Exception as e:
        logger.error(f"Gemini risk prediction failed: {e}. Using local fallback.")
        return {t["id"]: generate_local_risk(t) for t in tasks}

def generate_ai_schedule_gemini(tasks, preferences, calendar_events=None):
    """
    Plan the user's day:
    - Group similar tasks.
    - Start with high-urgency or high-priority items.
    - Insert short breaks.
    - Fit within preferences.work_start_time and work_end_time.
    """
    if not GEMINI_AVAILABLE:
        # Heuristic schedule builder
        return generate_local_schedule(tasks, preferences, calendar_events)
        
    try:
        tasks_input = []
        for t in tasks:
            if t.get("status") != "Completed":
                tasks_input.append({
                    "id": t["id"],
                    "title": t["title"],
                    "deadline": t["deadline"],
                    "duration": t["estimated_duration"],
                    "priority_score": t.get("priority_score", 50),
                    "difficulty": t["difficulty"],
                    "category": t["category"]
                })
                
        # Sort tasks by priority
        tasks_input = sorted(tasks_input, key=lambda x: x["priority_score"], reverse=True)
        
        calendar_info = []
        if calendar_events:
            for e in calendar_events:
                calendar_info.append({
                    "title": e.get("title"),
                    "start": e.get("start_time"),
                    "end": e.get("end_time")
                })
                
        prompt = f"""
        You are FocusFlow AI's flagships feature: The AI Smart Planner.
        Create an optimized daily schedule for today (current time is {datetime.now().isoformat()}).
        
        User Preferences:
        - Work day starts: {preferences.get('work_start_time', '09:00')}
        - Work day ends: {preferences.get('work_end_time', '18:00')}
        - Break duration: {preferences.get('daily_break_duration', 15)} minutes
        
        Existing Calendar Events (Do NOT schedule tasks during these slots):
        {json.dumps(calendar_info, indent=2)}
        
        Tasks to Schedule (Prioritized by AI ranking):
        {json.dumps(tasks_input, indent=2)}
        
        Rules:
        1. Prioritize higher priority_score tasks first.
        2. Break work into blocks (max 90 minutes per block).
        3. Insert {preferences.get('daily_break_duration', 15)} min breaks after major work sessions.
        4. Group similar task categories if possible to minimize context-switching.
        5. Do not schedule tasks before work_start_time or after work_end_time unless tasks are extremely urgent.
        6. Return a complete list of schedule blocks.
        
        Output format: Return ONLY a valid JSON list of objects containing:
        - "time_slot" (string, e.g., "09:00 - 10:30")
        - "task_id" (string, or "break" or "buffer")
        - "task_title" (string: the task's title, or "Rest Break", or "Flex/Buffer Slot")
        - "duration" (integer in minutes)
        - "type" (string: "work", "break", or "buffer")
        - "reason" (string explaining why this slot is scheduled here)
        
        Example output format:
        [
          {{
            "time_slot": "09:00 - 10:00",
            "task_id": "uuid-1234",
            "task_title": "Write Research Draft",
            "duration": 60,
            "type": "work",
            "reason": "Highest priority task with a deadline tomorrow. Best to tackle first."
          }},
          {{
            "time_slot": "10:00 - 10:15",
            "task_id": "break",
            "task_title": "Short Break",
            "duration": 15,
            "type": "break",
            "reason": "Rest eyes and hydrate."
          }}
        ]
        """
        
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        
        result = parse_json_safely(response.text)
        return result
    except Exception as e:
        logger.error(f"Gemini schedule generation failed: {e}. Using local fallback.")
        return generate_local_schedule(tasks, preferences, calendar_events)

def generate_local_schedule(tasks, preferences, calendar_events=None):
    """
    Creates an algorithmic schedule.
    """
    start_time_str = preferences.get("work_start_time", "09:00")
    end_time_str = preferences.get("work_end_time", "18:00")
    try:
        break_dur = int(preferences.get("daily_break_duration", 15))
    except (TypeError, ValueError):
        break_dur = 15

    # Parse start/end times defensively so a bad preference never 500s the planner
    try:
        start_h, start_m = str(start_time_str).split(":")[:2]
        start_hour, start_min = int(start_h), int(start_m)
    except (ValueError, AttributeError):
        start_hour, start_min = 9, 0
    try:
        end_h, end_m = str(end_time_str).split(":")[:2]
        end_hour, end_min = int(end_h), int(end_m)
    except (ValueError, AttributeError):
        end_hour, end_min = 18, 0

    now = datetime.now()
    start_dt = now.replace(hour=start_hour, minute=start_min, second=0, microsecond=0)
    end_time = now.replace(hour=end_hour, minute=end_min, second=0, microsecond=0)

    # Overnight work windows: an end time at or before the start means "next day".
    if end_time <= start_dt:
        end_time += timedelta(days=1)

    # Don't plan in the past: if today's window is already over, roll to tomorrow.
    if end_time <= now:
        start_dt += timedelta(days=1)
        end_time += timedelta(days=1)

    # Start from the later of work-start or right now (rounded to the next minute).
    current_time = max(start_dt, now.replace(second=0, microsecond=0))
    
    schedule = []

    # Filter incomplete tasks and expand into work blocks so multi-hour tasks
    # are split across consecutive 90-minute focus sessions instead of being
    # truncated to a single 90-minute block and dropping the remainder.
    task_queue = []  # list of [task, remaining_minutes]
    for t in tasks:
        if t.get("status") == "Completed":
            continue
        try:
            duration = int(t.get("estimated_duration", 60))
        except (TypeError, ValueError):
            duration = 60
        remaining = duration
        while remaining > 0:
            block = min(remaining, 90)
            task_queue.append((t, block))
            remaining -= block

    # Highest-priority work first
    task_queue.sort(key=lambda item: item[0].get("priority_score", 50), reverse=True)

    task_idx = 0
    work_since_break = 0 # tracks consecutive work minutes

    while current_time < end_time and task_idx < len(task_queue):
        # check if current time overlaps with any calendar events
        overlap = False
        if calendar_events:
            for e in calendar_events:
                if not e.get("start_time") or not e.get("end_time"):
                    continue
                try:
                    e_start = _deadline_to_local(e.get("start_time"))
                    e_end = _deadline_to_local(e.get("end_time"))
                    if e_start is None or e_end is None:
                        continue

                    # If current time is inside the event
                    if e_start <= current_time < e_end:
                        overlap = True
                        duration = int((e_end - current_time).total_seconds() / 60)
                        slot_end = current_time + timedelta(minutes=duration)
                        schedule.append({
                            "time_slot": f"{current_time.strftime('%H:%M')} - {slot_end.strftime('%H:%M')}",
                            "task_id": "calendar",
                            "task_title": f"Calendar: {e.get('title', 'Busy')}",
                            "duration": duration,
                            "type": "buffer",
                            "reason": "Imported Google Calendar event. Keep this slot clear."
                        })
                        current_time = slot_end
                        work_since_break = 0
                        break
                except Exception:
                    continue

        if overlap:
            continue
            
        # Need a break?
        if work_since_break >= 90:
            slot_end = current_time + timedelta(minutes=break_dur)
            schedule.append({
                "time_slot": f"{current_time.strftime('%H:%M')} - {slot_end.strftime('%H:%M')}",
                "task_id": "break",
                "task_title": "Rest Break",
                "duration": break_dur,
                "type": "break",
                "reason": f"Periodic {break_dur}-minute recharge to maintain cognitive focus."
            })
            current_time = slot_end
            work_since_break = 0
            continue
            
        # Schedule the next task
        task, block_duration = task_queue[task_idx]

        slot_end = current_time + timedelta(minutes=block_duration)
        if slot_end > end_time:
            # truncate block to fit within work hours
            block_duration = int((end_time - current_time).total_seconds() / 60)
            slot_end = end_time

        if block_duration > 15:
            schedule.append({
                "time_slot": f"{current_time.strftime('%H:%M')} - {slot_end.strftime('%H:%M')}",
                "task_id": task["id"],
                "task_title": task["title"],
                "duration": block_duration,
                "type": "work",
                "reason": f"High priority task ({task.get('priority_score')} score). Scheduled in peak focus hours."
            })
            work_since_break += block_duration

        current_time = slot_end
        task_idx += 1
        
    # If no tasks scheduled but we have time, add a buffer slot
    if not schedule and current_time < end_time:
        duration = int((end_time - current_time).total_seconds() / 60)
        schedule.append({
            "time_slot": f"{current_time.strftime('%H:%M')} - {end_time.strftime('%H:%M')}",
            "task_id": "buffer",
            "task_title": "Free Focus Time",
            "duration": duration,
            "type": "buffer",
            "reason": "No pending tasks for today. Excellent job! Use this time for planning or self-learning."
        })
        
    return schedule

def run_coach_chat_gemini(message, task_list, schedule, calendar_events, preferences, chat_history):
    """
    Gemini productivity coach chatbot.
    Passes full context: tasks, schedules, calendar, user habits, and history.
    """
    if not GEMINI_AVAILABLE:
        return generate_local_coach_response(message, task_list, schedule)
        
    try:
        # Prepare context summary
        task_summary = []
        for t in task_list:
            task_summary.append({
                "title": t["title"],
                "deadline": t["deadline"],
                "priority": t.get("priority_score", 50),
                "status": t["status"],
                "duration": t["estimated_duration"],
                "category": t["category"],
                "risk": t.get("risk_percentage", 0)
            })
            
        sched_summary = []
        if schedule:
            for s in schedule:
                sched_summary.append({
                    "time": s.get("time_slot"),
                    "title": s.get("task_title"),
                    "type": s.get("type")
                })
                
        history_summary = []
        for c in chat_history[-6:]: # send last 6 messages
            history_summary.append({
                "role": "user" if c["sender"] == "user" else "model",
                "parts": [c["text"]]
            })
            
        prompt = f"""
        You are 'FocusFlow Coach', a premium, highly supportive, proactive AI productivity coach.
        You are talking to a user who wants to manage their work and beat deadlines.
        
        Your character guidelines:
        - Act like a personal coach: supportive, strict when needed, and highly action-oriented.
        - Give clear, practical, concrete answers. Avoid fluff.
        - Use the USER's ACTUAL TASKS, DEADLINES, and SCHEDULE to answer.
        - If they ask "What should I do now?", analyze their schedule and tasks, identify the most critical pending items, and give a clear directive.
        - Refer to specific tasks by title.
        
        User Context:
        - Current local time: {datetime.now().isoformat()}
        - Tasks: {json.dumps(task_summary, indent=2)}
        - Today's Schedule: {json.dumps(sched_summary, indent=2)}
        - Preferences: {json.dumps(preferences, indent=2)}
        
        Last Chat Messages:
        {json.dumps(history_summary, indent=2)}
        
        User's Message: "{message}"
        
        Response: Provide a direct, highly customized answer (markdown allowed). Suggest concrete actions based on their task list. Limit to 3 short paragraphs.
        """
        
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        logger.error(f"Gemini Coach failed: {e}. Using local fallback.")
        return generate_local_coach_response(message, task_list, schedule)

def generate_local_coach_response(message, task_list, schedule):
    """
    Generates a localized coach response if Gemini is unavailable.
    """
    msg_lower = message.lower()
    active_tasks = [t for t in task_list if t.get("status") != "Completed"]
    active_tasks = sorted(active_tasks, key=lambda x: x.get("priority_score", 50), reverse=True)
    
    if "what should i do" in msg_lower or "what next" in msg_lower or "now" in msg_lower:
        if not active_tasks:
            return "You have no pending tasks! It's a perfect time to rest, read, or plan your next major milestone. Let me know if you want to brainstorm some goals!"
            
        top = active_tasks[0]
        rec = f"You should start working on **{top['title']}** immediately. It has a high priority score of **{top.get('priority_score', 50)}** and is estimated to take **{top.get('estimated_duration', 60)} minutes**. "
        if top.get("deadline"):
            rec += f"It's due on {top['deadline'][:10]}."
        
        if len(active_tasks) > 1:
            rec += f"\n\nAfter that, your next focus should be **{active_tasks[1]['title']}** ({active_tasks[1].get('category')}). Let's get to work!"
        return rec
        
    elif "plan" in msg_lower or "schedule" in msg_lower or "evening" in msg_lower:
        if not active_tasks:
            return "Since you have no pending tasks, I suggest planning a relaxing evening. How about dedicating 30 minutes to reading or journaling?"
        
        plan_str = "Based on your current load, here is a quick action plan for the rest of today:\n\n"
        for i, t in enumerate(active_tasks[:3]):
            plan_str += f"- **Task {i+1}**: {t['title']} ({t['estimated_duration']} min) - High priority ({t.get('priority_score')})\n"
        plan_str += "\nMake sure to insert a 10-15 minute break between these. You've got this!"
        return plan_str
        
    elif "finish" in msg_lower or "can i" in msg_lower or "deadline" in msg_lower:
        total_time = sum(t.get("estimated_duration", 60) for t in active_tasks)
        if total_time == 0:
            return "Yes, absolutely! You have no pending tasks today."
            
        hours = total_time / 60.0
        if hours > 8:
            return f"It looks extremely tight. You have **{len(active_tasks)} pending tasks** requiring about **{hours:.1f} hours** of focused attention. I recommend delaying lower priority tasks and starting on the highest priority items immediately."
        else:
            return f"Yes, you can finish everything. You have about **{hours:.1f} hours** of work left. Follow the schedule generated by the AI Smart Planner and you will be done before dinner."
            
    else:
        # Default response
        return "I am here as your FocusFlow AI productivity companion! I can help you plan your day, prioritize tasks, or break down large assignments. Try asking: *'What should I do now?'* or *'Can I finish my tasks today?'*"
