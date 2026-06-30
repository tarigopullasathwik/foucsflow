import logging
import uuid
from datetime import datetime, timedelta
import db_service

logger = logging.getLogger(__name__)

def get_events(user_id):
    """
    Get all calendar events for a user from the database.
    """
    # Fetch from database
    if db_service.USE_FIREBASE:
        events_ref = db_service.firebase_db.collection("calendar_events").where("user_id", "==", user_id)
        docs = events_ref.stream()
        events = [doc.to_dict() for doc in docs]
    else:
        conn = db_service.get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM calendar_events WHERE user_id = ? ORDER BY start_time ASC", (user_id,))
        events = [dict(r) for r in cursor.fetchall()]
        conn.close()
        
    # If no events exist, generate some demo events for a premium experience
    if not events:
        events = seed_demo_events(user_id)
        
    return events

def add_event(user_id, event_data):
    """
    Add a new calendar event.
    """
    event_id = event_data.get("event_id") or str(uuid.uuid4())
    title = event_data.get("title", "Unnamed Event")
    start_time = event_data.get("start_time")
    end_time = event_data.get("end_time")
    source = event_data.get("source", "local")
    
    event = {
        "id": event_id,
        "user_id": user_id,
        "event_id": event_id,
        "title": title,
        "start_time": start_time,
        "end_time": end_time,
        "source": source,
        "created_at": datetime.utcnow().isoformat()
    }
    
    if db_service.USE_FIREBASE:
        db_service.firebase_db.collection("calendar_events").document(event_id).set(event)
    else:
        conn = db_service.get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO calendar_events (id, user_id, event_id, title, start_time, end_time, source, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (event["id"], event["user_id"], event["event_id"], event["title"], event["start_time"], event["end_time"], event["source"], event["created_at"])
        )
        conn.commit()
        conn.close()
        
    return event

def delete_event(user_id, event_id):
    """
    Delete a calendar event.
    """
    if db_service.USE_FIREBASE:
        doc_ref = db_service.firebase_db.collection("calendar_events").document(event_id)
        doc = doc_ref.get()
        if doc.exists and doc.to_dict().get("user_id") == user_id:
            doc_ref.delete()
            return True
        return False
    else:
        conn = db_service.get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM calendar_events WHERE user_id = ? AND id = ?", (user_id, event_id))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return False
        cursor.execute("DELETE FROM calendar_events WHERE user_id = ? AND id = ?", (user_id, event_id))
        conn.commit()
        conn.close()
        return True

def import_google_calendar_events(user_id):
    """
    Simulates importing Google Calendar events for the demo.
    Generates realistic meetings and standups.
    """
    # Clear existing google events
    if db_service.USE_FIREBASE:
        docs = db_service.firebase_db.collection("calendar_events")\
            .where("user_id", "==", user_id)\
            .where("source", "==", "google")\
            .stream()
        for doc in docs:
            doc.reference.delete()
    else:
        conn = db_service.get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM calendar_events WHERE user_id = ? AND source = 'google'", (user_id,))
        conn.commit()
        conn.close()
        
    # Generate new demo events
    now = datetime.now()
    demo_events = [
        {
            "title": "Daily Standup Meeting",
            "offset_hours_start": 2, # 2 hours from now
            "duration_minutes": 30,
        },
        {
            "title": "Weekly Planning Sync",
            "offset_hours_start": 5, # 5 hours from now
            "duration_minutes": 60,
        },
        {
            "title": "Team Coffee Chat",
            "offset_hours_start": 25, # tomorrow
            "duration_minutes": 45,
        }
    ]
    
    imported = []
    for de in demo_events:
        start = now + timedelta(hours=de["offset_hours_start"])
        end = start + timedelta(minutes=de["duration_minutes"])
        
        event = add_event(user_id, {
            "title": de["title"],
            "start_time": start.isoformat() + "Z",
            "end_time": end.isoformat() + "Z",
            "source": "google"
        })
        imported.append(event)
        
    return imported

def export_schedule_to_calendar(user_id, schedule_tasks):
    """
    Export an AI-generated schedule into calendar events.
    """
    now_date = datetime.now().date()
    exported = []
    
    for task in schedule_tasks:
        # Ignore breaks/buffers if they are not core work
        if task.get("type") != "work":
            continue
            
        time_slot = task.get("time_slot", "")
        if not time_slot or " - " not in time_slot:
            continue
            
        start_str, end_str = time_slot.split(" - ")
        start_hour, start_min = map(int, start_str.split(":"))
        end_hour, end_min = map(int, end_str.split(":"))
        
        start_dt = datetime.combine(now_date, datetime.min.time().replace(hour=start_hour, minute=start_min))
        end_dt = datetime.combine(now_date, datetime.min.time().replace(hour=end_hour, minute=end_min))
        
        # Add to calendar
        event = add_event(user_id, {
            "title": f"Focus: {task.get('task_title')}",
            "start_time": start_dt.isoformat() + "Z",
            "end_time": end_dt.isoformat() + "Z",
            "source": "local"
        })
        exported.append(event)
        
    return exported

def seed_demo_events(user_id):
    """
    Seeds a few initial events so the calendar is not empty upon first load.
    """
    now = datetime.now()
    # Event 1: Today, 1 hour ago
    start1 = now - timedelta(hours=1)
    end1 = start1 + timedelta(minutes=60)
    
    # Event 2: Today, in 4 hours
    start2 = now + timedelta(hours=4)
    end2 = start2 + timedelta(minutes=45)
    
    e1 = add_event(user_id, {
        "title": "Review Marketing Strategy",
        "start_time": start1.isoformat() + "Z",
        "end_time": end1.isoformat() + "Z",
        "source": "local"
    })
    
    e2 = add_event(user_id, {
        "title": "Google AI Hackathon Pitch Prep",
        "start_time": start2.isoformat() + "Z",
        "end_time": end2.isoformat() + "Z",
        "source": "google"
    })
    
    return [e1, e2]
