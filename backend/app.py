import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta

from config import Config
import db_service
import gemini_service
import calendar_service

# Logging Setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app) # Enable CORS for all routes (crucial for React client connectivity)

# Authentication Middleware Helper
def get_authenticated_user_id():
    """
    Identifies the user using either:
    1. Firebase ID Token (Authorization Header: Bearer <token>) if Firebase is active.
    2. Fallback X-User-Id header (useful for rapid demo/offline mode).
    3. Defaulting to 'demo_user' for immediate out-of-the-box operation.
    """
    auth_header = request.headers.get("Authorization")
    user_id_header = request.headers.get("X-User-Id")
    
    if auth_header and auth_header.startswith("Bearer "):
        id_token = auth_header.split("Bearer ")[1]
        if db_service.USE_FIREBASE:
            try:
                from firebase_admin import auth
                decoded_token = auth.verify_id_token(id_token)
                return decoded_token["uid"]
            except Exception as e:
                logger.warning(f"Failed to verify Firebase token: {e}. Falling back.")
                
    # Fallback to direct X-User-Id header
    if user_id_header:
        return user_id_header
        
    return "demo_user"

# AUTH ENDPOINTS

@app.route("/api/auth/sync-user", methods=["POST"])
def sync_user():
    user_id = get_authenticated_user_id()
    data = request.json or {}
    email = data.get("email", "demo@focusflow.ai")
    name = data.get("name", "Demo User")
    picture = data.get("picture", "")
    
    try:
        user = db_service.get_or_create_user(user_id, email, name, picture)
        # Create a welcome notification if brand new user
        notifs = db_service.get_notifications(user_id)
        if not notifs:
            db_service.create_notification(
                user_id,
                "Welcome to FocusFlow AI!",
                "I am your AI Coach. Click 'Plan My Day' or chat with me in the sidebar to get started!",
                "success"
            )
        return jsonify({"status": "success", "user": user})
    except Exception as e:
        logger.error(f"Error syncing user: {e}")
        return jsonify({"error": str(e)}), 500

# TASK CRUD ENDPOINTS

@app.route("/api/tasks", methods=["GET"])
def list_tasks():
    user_id = get_authenticated_user_id()
    try:
        tasks = db_service.get_tasks(user_id)
        return jsonify(tasks)
    except Exception as e:
        logger.error(f"Error fetching tasks: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/tasks/<task_id>", methods=["GET"])
def get_task(task_id):
    user_id = get_authenticated_user_id()
    try:
        task = db_service.get_task(user_id, task_id)
        if not task:
            return jsonify({"error": "Task not found"}), 404
        return jsonify(task)
    except Exception as e:
        logger.error(f"Error fetching task: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/tasks", methods=["POST"])
def add_task():
    user_id = get_authenticated_user_id()
    data = request.json or {}
    try:
        # Pre-calculate priority and risk for the new task immediately
        temp_task = {**data, "id": "temp"}
        priority_info = gemini_service.generate_local_priority(temp_task)
        risk_info = gemini_service.generate_local_risk(temp_task)
        
        data.update(priority_info)
        data.update(risk_info)
        
        task = db_service.create_task(user_id, data)
        
        # Create an intelligent notification if task has high risk
        if task.get("risk_percentage", 0) > 75:
            db_service.create_notification(
                user_id,
                "High Risk Task Added",
                f"'{task['title']}' has a deadline risk of {task['risk_percentage']}%. I recommend prioritizing it.",
                "warning"
            )
            
        return jsonify(task), 201
    except Exception as e:
        logger.error(f"Error creating task: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/tasks/<task_id>", methods=["PUT"])
def edit_task(task_id):
    user_id = get_authenticated_user_id()
    data = request.json or {}
    try:
        # Recompute priority and risk based on updates if deadline/importance/difficulty/progress changes
        task = db_service.get_task(user_id, task_id)
        if not task:
            return jsonify({"error": "Task not found"}), 404
            
        # Update values
        for k, v in data.items():
            task[k] = v
            
        # Re-run local priority and risk engine
        priority_info = gemini_service.generate_local_priority(task)
        risk_info = gemini_service.generate_local_risk(task)
        task.update(priority_info)
        task.update(risk_info)
        
        updated = db_service.update_task(user_id, task_id, task)
        return jsonify(updated)
    except Exception as e:
        logger.error(f"Error updating task: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/tasks/<task_id>", methods=["DELETE"])
def remove_task(task_id):
    user_id = get_authenticated_user_id()
    try:
        success = db_service.delete_task(user_id, task_id)
        if not success:
            return jsonify({"error": "Task not found or unauthorized"}), 404
        return jsonify({"status": "success"})
    except Exception as e:
        logger.error(f"Error deleting task: {e}")
        return jsonify({"error": str(e)}), 500

# AI ENDPOINTS

@app.route("/api/ai/schedule", methods=["POST"])
def get_ai_schedule():
    user_id = get_authenticated_user_id()
    try:
        data = request.get_json(silent=True) or {}
        today_str = datetime.now().strftime("%Y-%m-%d")
        
        # 1. If schedule is provided in the body, save it directly (manually updated plan)
        if "schedule" in data:
            schedule = data["schedule"]
            db_service.save_schedule(user_id, today_str, schedule)
            return jsonify({"date": today_str, "schedule": schedule})
            
        # 2. Check if a schedule already exists for today
        existing_schedule = db_service.get_latest_schedule(user_id, today_str)
        
        # 3. If regenerate is NOT requested and an existing schedule exists, return it
        if not data.get("regenerate", False) and existing_schedule:
            return jsonify({"date": today_str, "schedule": existing_schedule.get("tasks", [])})
            
        # 4. Otherwise, generate a new schedule
        tasks = db_service.get_tasks(user_id)
        prefs = db_service.get_user_preferences(user_id)
        events = calendar_service.get_events(user_id)
        
        # Call Smart Planner
        schedule = gemini_service.generate_ai_schedule_gemini(tasks, prefs, events)
        
        # Save Generated Schedule for today
        db_service.save_schedule(user_id, today_str, schedule)
        
        # Create Schedule notification
        db_service.create_notification(
            user_id,
            "Daily Schedule Generated",
            "Your AI Smart Plan is ready. View it on the planner timeline.",
            "success"
        )
        
        return jsonify({"date": today_str, "schedule": schedule})
    except Exception as e:
        logger.error(f"Error generating schedule: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/ai/prioritize", methods=["POST"])
def run_ai_prioritization():
    user_id = get_authenticated_user_id()
    try:
        tasks = db_service.get_tasks(user_id)
        incomplete = [t for t in tasks if t["status"] != "Completed"]
        
        if not incomplete:
            return jsonify({"status": "no_tasks", "tasks": []})
            
        # Generate new scores via Gemini
        priority_map = gemini_service.calculate_priority_gemini(incomplete)
        
        # Save back to database
        updated_tasks = []
        for t in incomplete:
            t_id = t["id"]
            if t_id in priority_map:
                update_data = {
                    "priority_score": int(priority_map[t_id].get("priority_score", t.get("priority_score", 50))),
                    "urgency_level": priority_map[t_id].get("urgency_level", t.get("urgency_level", "Medium")),
                    "priority_reason": priority_map[t_id].get("priority_reason", t.get("priority_reason", ""))
                }
                updated = db_service.update_task(user_id, t_id, update_data)
                updated_tasks.append(updated)
                
        return jsonify({"status": "success", "tasks": updated_tasks})
    except Exception as e:
        logger.error(f"Error prioritizing tasks: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/ai/risk-analysis", methods=["POST"])
def run_ai_risk_analysis():
    user_id = get_authenticated_user_id()
    try:
        tasks = db_service.get_tasks(user_id)
        incomplete = [t for t in tasks if t["status"] != "Completed"]
        
        if not incomplete:
            return jsonify({"status": "no_tasks", "tasks": []})
            
        # Run Risk Engine
        risk_map = gemini_service.predict_deadline_risks_gemini(incomplete)
        
        # Save back to database
        updated_tasks = []
        for t in incomplete:
            t_id = t["id"]
            if t_id in risk_map:
                update_data = {
                    "risk_percentage": int(risk_map[t_id].get("risk_percentage", t.get("risk_percentage", 0))),
                    "risk_color": risk_map[t_id].get("risk_color", t.get("risk_color", "emerald")),
                    "risk_reason": risk_map[t_id].get("risk_reason", t.get("risk_reason", "")),
                    "risk_recommendation": risk_map[t_id].get("risk_recommendation", t.get("risk_recommendation", ""))
                }
                updated = db_service.update_task(user_id, t_id, update_data)
                updated_tasks.append(updated)
                
        # Send alerts for any high risk tasks
        criticals = [t for t in updated_tasks if t.get("risk_percentage", 0) > 80]
        if criticals:
            titles = ", ".join([f"'{c['title']}'" for c in criticals[:2]])
            db_service.create_notification(
                user_id,
                "Critical Deadline Risk Alert",
                f"AI predicts deadline failures for {titles}. Begin immediately.",
                "warning"
            )
            
        return jsonify({"status": "success", "tasks": updated_tasks})
    except Exception as e:
        logger.error(f"Error predicting risk: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/ai/chat", methods=["POST"])
def chat_coach():
    user_id = get_authenticated_user_id()
    data = request.json or {}
    message = data.get("message", "")
    
    if not message:
        return jsonify({"error": "Empty message"}), 400
        
    try:
        # Save user message
        user_msg = db_service.save_chat_message(user_id, "user", message)
        
        # Fetch context
        tasks = db_service.get_tasks(user_id)
        prefs = db_service.get_user_preferences(user_id)
        events = calendar_service.get_events(user_id)
        today_str = datetime.now().strftime("%Y-%m-%d")
        schedule_data = db_service.get_latest_schedule(user_id, today_str)
        schedule = schedule_data.get("tasks", []) if schedule_data else []
        chat_history = db_service.get_chat_history(user_id)
        
        # Generate response
        reply_text = gemini_service.run_coach_chat_gemini(message, tasks, schedule, events, prefs, chat_history)
        
        # Save AI reply
        ai_reply = db_service.save_chat_message(user_id, "ai", reply_text)
        
        return jsonify({"user_message": user_msg, "ai_response": ai_reply})
    except Exception as e:
        logger.error(f"Error in chat coach endpoint: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/ai/chat/history", methods=["GET"])
def get_chat_history_api():
    user_id = get_authenticated_user_id()
    try:
        history = db_service.get_chat_history(user_id)
        return jsonify(history)
    except Exception as e:
        logger.error(f"Error loading chat history: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/ai/chat/history", methods=["DELETE"])
def clear_chat_history_api():
    user_id = get_authenticated_user_id()
    try:
        db_service.clear_chat_history(user_id)
        return jsonify({"status": "success"})
    except Exception as e:
        logger.error(f"Error clearing history: {e}")
        return jsonify({"error": str(e)}), 500

# CALENDAR SYNC ENDPOINTS

@app.route("/api/calendar/events", methods=["GET"])
def list_calendar_events():
    user_id = get_authenticated_user_id()
    try:
        events = calendar_service.get_events(user_id)
        return jsonify(events)
    except Exception as e:
        logger.error(f"Error getting calendar events: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/calendar/events", methods=["POST"])
def add_calendar_event():
    user_id = get_authenticated_user_id()
    data = request.json or {}
    try:
        event = calendar_service.add_event(user_id, data)
        return jsonify(event), 201
    except Exception as e:
        logger.error(f"Error adding event: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/calendar/events/<event_id>", methods=["DELETE"])
def delete_calendar_event(event_id):
    user_id = get_authenticated_user_id()
    try:
        success = calendar_service.delete_event(user_id, event_id)
        if not success:
            return jsonify({"error": "Event not found"}), 404
        return jsonify({"status": "success"})
    except Exception as e:
        logger.error(f"Error deleting event: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/calendar/import", methods=["POST"])
def import_google_cal():
    user_id = get_authenticated_user_id()
    try:
        imported = calendar_service.import_google_calendar_events(user_id)
        db_service.create_notification(
            user_id,
            "Google Calendar Synced",
            f"Successfully imported {len(imported)} upcoming meetings/events.",
            "success"
        )
        return jsonify({"status": "success", "events": imported})
    except Exception as e:
        logger.error(f"Error importing Google Calendar: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/calendar/export", methods=["POST"])
def export_cal():
    user_id = get_authenticated_user_id()
    try:
        today_str = datetime.now().strftime("%Y-%m-%d")
        schedule_data = db_service.get_latest_schedule(user_id, today_str)
        if not schedule_data:
            return jsonify({"error": "No AI schedule generated for today to export."}), 400
            
        schedule = schedule_data.get("tasks", [])
        exported = calendar_service.export_schedule_to_calendar(user_id, schedule)
        db_service.create_notification(
            user_id,
            "Schedule Exported",
            f"Successfully exported {len(exported)} AI-planned slots to Google Calendar.",
            "success"
        )
        return jsonify({"status": "success", "exported_count": len(exported)})
    except Exception as e:
        logger.error(f"Error exporting calendar: {e}")
        return jsonify({"error": str(e)}), 500

# ANALYTICS ENDPOINTS

@app.route("/api/analytics", methods=["GET"])
def get_productivity_analytics():
    user_id = get_authenticated_user_id()
    try:
        analytics = db_service.get_analytics(user_id)
        
        # If no analytics generated yet, build some beautiful mock history to populate dashboard charts!
        if not analytics:
            analytics = seed_mock_analytics(user_id)
            
        return jsonify(analytics)
    except Exception as e:
        logger.error(f"Error fetching analytics: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/analytics/snapshot", methods=["POST"])
def snapshot_productivity_analytics():
    user_id = get_authenticated_user_id()
    try:
        tasks = db_service.get_tasks(user_id)
        completed = [t for t in tasks if t["status"] == "Completed"]
        pending = [t for t in tasks if t["status"] != "Completed"]
        
        # Calculate daily productivity score (0 - 100)
        # Formula: completion progress, total tasks ratio, and high risk tasks averted.
        comp_count = len(completed)
        pend_count = len(pending)
        total = comp_count + pend_count
        
        score = 50 # base score
        if total > 0:
            score = int((comp_count / total) * 80)
            # Add bonus for progress of pending tasks
            avg_progress = sum(t.get("progress", 0) for t in pending) / pend_count if pend_count > 0 else 0
            score += int(avg_progress * 0.2)
            
        # Workload hours
        focus_hours = sum(t.get("estimated_duration", 60) for t in completed) / 60.0
        
        snapshot = {
            "score": min(100, max(0, score)),
            "completed_count": comp_count,
            "pending_count": pend_count,
            "workload_score": min(100, pend_count * 15),
            "focus_hours": focus_hours,
            "details": {
                "efficiency_rate": int((comp_count / total * 100)) if total > 0 else 100,
                "focus_blocks": len(completed),
                "completion_ratio": f"{comp_count}/{total}"
            }
        }
        
        today_str = datetime.now().strftime("%Y-%m-%d")
        saved = db_service.save_analytics_snapshot(user_id, today_str, snapshot)
        return jsonify(saved)
    except Exception as e:
        logger.error(f"Error saving analytics snapshot: {e}")
        return jsonify({"error": str(e)}), 500

def seed_mock_analytics(user_id):
    """
    Seeds a history of 7 days of productivity stats for beautiful dashboard visual charts.
    """
    today = datetime.now()
    seed_data = []
    
    # 7 days of performance history
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        date_str = day.strftime("%Y-%m-%d")
        
        # Varied stats for realistic charts
        score = 65 + (i * 4) % 35
        completed = 2 + (i % 3)
        pending = 1 + (i % 2)
        focus_hrs = completed * 1.5 - (i * 0.2)
        
        snapshot = {
            "score": score,
            "completed_count": completed,
            "pending_count": pending,
            "workload_score": pending * 15,
            "focus_hours": round(max(1.0, focus_hrs), 1),
            "details": {
                "efficiency_rate": int((completed / (completed + pending)) * 100),
                "focus_blocks": completed,
                "completion_ratio": f"{completed}/{completed + pending}"
            }
        }
        
        saved = db_service.save_analytics_snapshot(user_id, date_str, snapshot)
        seed_data.append(saved)
        
    return seed_data

# USER PREFERENCES ENDPOINTS

@app.route("/api/preferences", methods=["GET"])
def get_preferences():
    user_id = get_authenticated_user_id()
    try:
        prefs = db_service.get_user_preferences(user_id)
        return jsonify(prefs)
    except Exception as e:
        logger.error(f"Error loading preferences: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/preferences", methods=["PUT"])
def update_preferences():
    user_id = get_authenticated_user_id()
    data = request.json or {}
    try:
        updated = db_service.save_user_preferences(user_id, data)
        return jsonify(updated)
    except Exception as e:
        logger.error(f"Error saving preferences: {e}")
        return jsonify({"error": str(e)}), 500

# NOTIFICATION ENDPOINTS

@app.route("/api/notifications", methods=["GET"])
def list_notifications():
    user_id = get_authenticated_user_id()
    try:
        notifications = db_service.get_notifications(user_id)
        return jsonify(notifications)
    except Exception as e:
        logger.error(f"Error fetching notifications: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/notifications/read", methods=["POST"])
def read_all_notifications():
    user_id = get_authenticated_user_id()
    try:
        db_service.mark_notifications_read(user_id)
        return jsonify({"status": "success"})
    except Exception as e:
        logger.error(f"Error reading notifications: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    logger.info(f"Starting FocusFlow Flask backend on port {Config.PORT}")
    app.run(host="0.0.0.0", port=Config.PORT, debug=Config.DEBUG)
