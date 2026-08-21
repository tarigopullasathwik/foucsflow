import os
import json
import sqlite3
import uuid
from datetime import datetime
import logging

from config import Config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Firebase initialization flag
firebase_db = None
USE_FIREBASE = False

# Try to initialize Firebase
if Config.FIREBASE_SERVICE_ACCOUNT:
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        # Check if already initialized to avoid exception
        if not firebase_admin._apps:
            if os.path.exists(Config.FIREBASE_SERVICE_ACCOUNT):
                cred = credentials.Certificate(Config.FIREBASE_SERVICE_ACCOUNT)
                firebase_admin.initialize_app(cred)
                logger.info("Firebase Admin initialized successfully using service account.")
            else:
                firebase_admin.initialize_app()
                logger.info("Firebase Admin initialized successfully using default credentials.")
                
        firebase_db = firestore.client()
        USE_FIREBASE = True
        logger.info("Connected to Firestore database.")
    except Exception as e:
        logger.warning(f"Failed to initialize Firebase Admin: {e}. Falling back to SQLite local database.")
        USE_FIREBASE = False
else:
    logger.info("No Firebase Service Account key provided. Using local SQLite database.")
    USE_FIREBASE = False

# Local SQLite Database Setup
LOCAL_DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "focusflow_local.db")

def get_sqlite_conn():
    conn = sqlite3.connect(LOCAL_DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_sqlite_db():
    if USE_FIREBASE:
        return
        
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    
    # Users
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        name TEXT,
        picture TEXT
    )
    """)
    
    # Tasks
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        title TEXT,
        description TEXT,
        deadline TEXT,
        estimated_duration INTEGER, -- in minutes
        difficulty TEXT,            -- Easy, Medium, Hard
        importance TEXT,            -- Low, Medium, High
        category TEXT,              -- Coding, Study, Work, Personal, etc.
        status TEXT,                -- Pending, Completed
        progress INTEGER DEFAULT 0,  -- 0 to 100
        tags TEXT,                  -- comma separated or JSON
        notes TEXT,
        priority_score INTEGER DEFAULT 50,
        urgency_level TEXT DEFAULT 'Medium',
        priority_reason TEXT,
        risk_percentage INTEGER DEFAULT 0,
        risk_color TEXT DEFAULT 'emerald',
        risk_reason TEXT,
        risk_recommendation TEXT,
        created_at TEXT
    )
    """)
    
    # Schedules
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        date TEXT,
        tasks_json TEXT,  -- JSON list of tasks scheduled with time blocks
        created_at TEXT
    )
    """)
    
    # Analytics
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS analytics (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        date TEXT,
        score INTEGER DEFAULT 0,
        completed_count INTEGER DEFAULT 0,
        pending_count INTEGER DEFAULT 0,
        workload_score INTEGER DEFAULT 0,
        focus_hours REAL DEFAULT 0.0,
        details_json TEXT,
        created_at TEXT
    )
    """)
    
    # Calendar Events
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS calendar_events (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        event_id TEXT,
        title TEXT,
        start_time TEXT,
        end_time TEXT,
        source TEXT, -- 'google' or 'local'
        created_at TEXT
    )
    """)
    
    # Chat History
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_history (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        sender TEXT, -- 'user' or 'ai'
        text TEXT,
        timestamp TEXT
    )
    """)
    
    # User Preferences
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY,
        dark_mode INTEGER DEFAULT 1,
        work_start_time TEXT DEFAULT '09:00',
        work_end_time TEXT DEFAULT '18:00',
        daily_break_duration INTEGER DEFAULT 15,
        sync_calendar INTEGER DEFAULT 0
    )
    """)
    
    # Notifications
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        title TEXT,
        message TEXT,
        type TEXT, -- 'warning', 'info', 'success'
        created_at TEXT,
        read INTEGER DEFAULT 0
    )
    """)

    # Auth sessions (server-issued bearer tokens for real email/password auth)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT,
        created_at TEXT,
        expires_at TEXT
    )
    """)

    # Sent emails (audit trail / outbox for console + smtp modes)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sent_emails (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        to_email TEXT,
        subject TEXT,
        body TEXT,
        mode TEXT,        -- 'console' or 'smtp'
        sent_at TEXT
    )
    """)

    # ---- Additive migration: extend users table for real auth ----
    # Safe ALTER TABLEs wrapped in try/except so they run once and never crash
    # an already-migrated database.
    auth_columns = {
        "password_hash": "TEXT",
        "provider": "TEXT DEFAULT 'password'",      # 'password' or 'google'
        "failed_attempts": "INTEGER DEFAULT 0",
        "locked_until": "TEXT",
        "created_at": "TEXT",
        "last_login": "TEXT",
    }
    # Read existing columns to avoid duplicate-alter errors
    cursor.execute("PRAGMA table_info(users)")
    existing_cols = {row[1] for row in cursor.fetchall()}
    for col, coltype in auth_columns.items():
        if col not in existing_cols:
            try:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {col} {coltype}")
                logger.info(f"Migrated users table: added column '{col}'.")
            except Exception as e:
                logger.warning(f"Could not add column '{col}' to users: {e}")

    conn.commit()
    conn.close()
    logger.info("SQLite local database tables initialized.")

# Initialize DB
init_sqlite_db()

# DB APIs

def get_or_create_user(user_id, email, name=None, picture=None):
    if USE_FIREBASE:
        user_ref = firebase_db.collection("users").document(user_id)
        doc = user_ref.get()
        if doc.exists:
            return doc.to_dict()
        user_data = {
            "id": user_id,
            "email": email,
            "name": name or email.split('@')[0],
            "picture": picture or ""
        }
        user_ref.set(user_data)
        return user_data
    else:
        conn = get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if row:
            conn.close()
            return dict(row)
            
        user_data = {
            "id": user_id,
            "email": email,
            "name": name or email.split('@')[0],
            "picture": picture or ""
        }
        cursor.execute(
            "INSERT INTO users (id, email, name, picture) VALUES (?, ?, ?, ?)",
            (user_data["id"], user_data["email"], user_data["name"], user_data["picture"])
        )
        conn.commit()
        conn.close()
        return user_data

# TASK CRUD

def get_tasks(user_id):
    if USE_FIREBASE:
        tasks_ref = firebase_db.collection("tasks").where("user_id", "==", user_id)
        docs = tasks_ref.stream()
        return [doc.to_dict() for doc in docs]
    else:
        conn = get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tasks WHERE user_id = ? ORDER BY priority_score DESC, deadline ASC", (user_id,))
        rows = cursor.fetchall()
        tasks = []
        for r in rows:
            t = dict(r)
            # handle lists/json fields
            if t.get("tags"):
                try:
                    t["tags"] = json.loads(t["tags"])
                except:
                    t["tags"] = [tag.strip() for tag in t["tags"].split(",") if tag.strip()]
            else:
                t["tags"] = []
            tasks.append(t)
        conn.close()
        return tasks

def get_task(user_id, task_id):
    if USE_FIREBASE:
        doc_ref = firebase_db.collection("tasks").document(task_id)
        doc = doc_ref.get()
        if doc.exists:
            data = doc.to_dict()
            if data.get("user_id") == user_id:
                return data
        return None
    else:
        conn = get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tasks WHERE user_id = ? AND id = ?", (user_id, task_id))
        row = cursor.fetchone()
        conn.close()
        if row:
            t = dict(row)
            if t.get("tags"):
                try:
                    t["tags"] = json.loads(t["tags"])
                except:
                    t["tags"] = [tag.strip() for tag in t["tags"].split(",") if tag.strip()]
            else:
                t["tags"] = []
            return t
        return None

def create_task(user_id, task_data):
    task_id = task_data.get("id") or str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    
    tags = task_data.get("tags", [])
    tags_str = json.dumps(tags) if isinstance(tags, list) else str(tags)
    
    full_task = {
        "id": task_id,
        "user_id": user_id,
        "title": task_data.get("title", "Untitled Task"),
        "description": task_data.get("description", ""),
        "deadline": task_data.get("deadline", ""),
        "estimated_duration": int(task_data.get("estimated_duration", 60)),
        "difficulty": task_data.get("difficulty", "Medium"),
        "importance": task_data.get("importance", "Medium"),
        "category": task_data.get("category", "Work"),
        "status": task_data.get("status", "Pending"),
        "progress": int(task_data.get("progress", 0)),
        "tags": tags,
        "notes": task_data.get("notes", ""),
        "priority_score": int(task_data.get("priority_score", 50)),
        "urgency_level": task_data.get("urgency_level", "Medium"),
        "priority_reason": task_data.get("priority_reason", ""),
        "risk_percentage": int(task_data.get("risk_percentage", 0)),
        "risk_color": task_data.get("risk_color", "emerald"),
        "risk_reason": task_data.get("risk_reason", ""),
        "risk_recommendation": task_data.get("risk_recommendation", ""),
        "created_at": now
    }
    
    if USE_FIREBASE:
        firebase_db.collection("tasks").document(task_id).set(full_task)
    else:
        conn = get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO tasks (
                id, user_id, title, description, deadline, estimated_duration, 
                difficulty, importance, category, status, progress, tags, notes, 
                priority_score, urgency_level, priority_reason, risk_percentage, 
                risk_color, risk_reason, risk_recommendation, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                full_task["id"], full_task["user_id"], full_task["title"], full_task["description"],
                full_task["deadline"], full_task["estimated_duration"], full_task["difficulty"],
                full_task["importance"], full_task["category"], full_task["status"], full_task["progress"],
                tags_str, full_task["notes"], full_task["priority_score"], full_task["urgency_level"],
                full_task["priority_reason"], full_task["risk_percentage"], full_task["risk_color"],
                full_task["risk_reason"], full_task["risk_recommendation"], full_task["created_at"]
            )
        )
        conn.commit()
        conn.close()
    return full_task

def update_task(user_id, task_id, task_data):
    # Retrieve current task to make sure it exists and belongs to the user
    current = get_task(user_id, task_id)
    if not current:
        return None
        
    for k, v in task_data.items():
        if k not in ["id", "user_id", "created_at"]:
            current[k] = v
            
    if USE_FIREBASE:
        firebase_db.collection("tasks").document(task_id).set(current)
    else:
        tags = current.get("tags", [])
        tags_str = json.dumps(tags) if isinstance(tags, list) else str(tags)
        
        conn = get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE tasks SET 
                title=?, description=?, deadline=?, estimated_duration=?, 
                difficulty=?, importance=?, category=?, status=?, progress=?, tags=?, notes=?, 
                priority_score=?, urgency_level=?, priority_reason=?, risk_percentage=?, 
                risk_color=?, risk_reason=?, risk_recommendation=?
            WHERE user_id=? AND id=?
            """,
            (
                current["title"], current["description"], current["deadline"], int(current["estimated_duration"]),
                current["difficulty"], current["importance"], current["category"], current["status"], int(current["progress"]),
                tags_str, current["notes"], int(current["priority_score"]), current["urgency_level"],
                current["priority_reason"], int(current["risk_percentage"]), current["risk_color"],
                current["risk_reason"], current["risk_recommendation"], user_id, task_id
            )
        )
        conn.commit()
        conn.close()
    return current

def delete_task(user_id, task_id):
    if USE_FIREBASE:
        doc_ref = firebase_db.collection("tasks").document(task_id)
        doc = doc_ref.get()
        if doc.exists and doc.to_dict().get("user_id") == user_id:
            doc_ref.delete()
            return True
        return False
    else:
        conn = get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM tasks WHERE user_id = ? AND id = ?", (user_id, task_id))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return False
        cursor.execute("DELETE FROM tasks WHERE user_id = ? AND id = ?", (user_id, task_id))
        conn.commit()
        conn.close()
        return True

# SCHEDULES

def get_latest_schedule(user_id, date):
    if USE_FIREBASE:
        docs = firebase_db.collection("schedules")\
            .where("user_id", "==", user_id)\
            .where("date", "==", date)\
            .order_by("created_at", direction=firestore.Query.DESCENDING)\
            .limit(1).get()
        if docs:
            return docs[0].to_dict()
        return None
    else:
        conn = get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM schedules WHERE user_id = ? AND date = ? ORDER BY created_at DESC LIMIT 1", (user_id, date))
        row = cursor.fetchone()
        conn.close()
        if row:
            res = dict(row)
            res["tasks"] = json.loads(res["tasks_json"])
            return res
        return None

def save_schedule(user_id, date, schedule_tasks):
    sched_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    
    if USE_FIREBASE:
        schedule_data = {
            "id": sched_id,
            "user_id": user_id,
            "date": date,
            "tasks": schedule_tasks,
            "created_at": now
        }
        firebase_db.collection("schedules").document(sched_id).set(schedule_data)
        return schedule_data
    else:
        tasks_json = json.dumps(schedule_tasks)
        conn = get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO schedules (id, user_id, date, tasks_json, created_at) VALUES (?, ?, ?, ?, ?)",
            (sched_id, user_id, date, tasks_json, now)
        )
        conn.commit()
        conn.close()
        return {
            "id": sched_id,
            "user_id": user_id,
            "date": date,
            "tasks": schedule_tasks,
            "created_at": now
        }

# USER PREFERENCES

def get_user_preferences(user_id):
    default_prefs = {
        "user_id": user_id,
        "dark_mode": 1,
        "work_start_time": "09:00",
        "work_end_time": "18:00",
        "daily_break_duration": 15,
        "sync_calendar": 0
    }
    if USE_FIREBASE:
        doc = firebase_db.collection("user_preferences").document(user_id).get()
        if doc.exists:
            return doc.to_dict()
        firebase_db.collection("user_preferences").document(user_id).set(default_prefs)
        return default_prefs
    else:
        conn = get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM user_preferences WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        if row:
            conn.close()
            return dict(row)
        cursor.execute(
            """
            INSERT INTO user_preferences (user_id, dark_mode, work_start_time, work_end_time, daily_break_duration, sync_calendar)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, 1, "09:00", "18:00", 15, 0)
        )
        conn.commit()
        conn.close()
        return default_prefs

def save_user_preferences(user_id, prefs_data):
    current = get_user_preferences(user_id)
    for k, v in prefs_data.items():
        if k != "user_id":
            current[k] = v
            
    if USE_FIREBASE:
        firebase_db.collection("user_preferences").document(user_id).set(current)
    else:
        conn = get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE user_preferences SET 
                dark_mode=?, work_start_time=?, work_end_time=?, daily_break_duration=?, sync_calendar=?
            WHERE user_id=?
            """,
            (
                int(current["dark_mode"]), current["work_start_time"], current["work_end_time"], 
                int(current["daily_break_duration"]), int(current["sync_calendar"]), user_id
            )
        )
        conn.commit()
        conn.close()
    return current

# CHAT HISTORY

def get_chat_history(user_id, limit=50):
    """Return the most recent `limit` messages in chronological order."""
    if USE_FIREBASE:
        docs = list(firebase_db.collection("chat_history")
                    .where("user_id", "==", user_id).stream())
        msgs = sorted((d.to_dict() for d in docs), key=lambda m: m.get("timestamp", ""))
        return msgs[-limit:]
    else:
        conn = get_sqlite_conn()
        cursor = conn.cursor()
        # Bug fix: previously fetched the OLDEST 50 messages (ASC LIMIT),
        # so long chats were frozen at their first 50 messages forever.
        cursor.execute(
            "SELECT * FROM chat_history WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?",
            (user_id, limit))
        rows = list(reversed(cursor.fetchall()))
        conn.close()
        return [dict(r) for r in rows]

def save_chat_message(user_id, sender, text):
    msg_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    
    msg = {
        "id": msg_id,
        "user_id": user_id,
        "sender": sender,
        "text": text,
        "timestamp": now
    }
    
    if USE_FIREBASE:
        firebase_db.collection("chat_history").document(msg_id).set(msg)
    else:
        conn = get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO chat_history (id, user_id, sender, text, timestamp) VALUES (?, ?, ?, ?, ?)",
            (msg_id, user_id, sender, text, now)
        )
        conn.commit()
        conn.close()
    return msg

def clear_chat_history(user_id):
    if USE_FIREBASE:
        docs = firebase_db.collection("chat_history").where("user_id", "==", user_id).stream()
        for doc in docs:
            doc.reference.delete()
        return True
    else:
        conn = get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM chat_history WHERE user_id = ?", (user_id,))
        conn.commit()
        conn.close()
        return True

# NOTIFICATIONS

def get_notifications(user_id, unread_only=False):
    if USE_FIREBASE:
        ref = firebase_db.collection("notifications").where("user_id", "==", user_id)
        if unread_only:
            ref = ref.where("read", "==", False)
        docs = ref.order_by("created_at", direction=firestore.Query.DESCENDING).get()
        return [doc.to_dict() for doc in docs]
    else:
        conn = get_sqlite_conn()
        cursor = conn.cursor()
        if unread_only:
            cursor.execute("SELECT * FROM notifications WHERE user_id = ? AND read = 0 ORDER BY created_at DESC", (user_id,))
        else:
            cursor.execute("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]

def create_notification(user_id, title, message, notif_type="info"):
    notif_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    
    notif = {
        "id": notif_id,
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": notif_type,
        "created_at": now,
        "read": 0
    }
    
    if USE_FIREBASE:
        notif["read"] = False
        firebase_db.collection("notifications").document(notif_id).set(notif)
    else:
        conn = get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO notifications (id, user_id, title, message, type, created_at, read) VALUES (?, ?, ?, ?, ?, ?, 0)",
            (notif_id, user_id, title, message, notif_type, now)
        )
        conn.commit()
        conn.close()
    return notif

def mark_notifications_read(user_id):
    if USE_FIREBASE:
        docs = firebase_db.collection("notifications").where("user_id", "==", user_id).where("read", "==", False).stream()
        for doc in docs:
            doc.reference.update({"read": True})
        return True
    else:
        conn = get_sqlite_conn()
        cursor = conn.cursor()
        # read=0 AND read=1: resettas any legacy truthy value (e.g. true/1 mixed schemes)
        cursor.execute("UPDATE notifications SET read = 1 WHERE user_id = ? AND read != 1", (user_id,))
        conn.commit()
        conn.close()
        return True

# ANALYTICS

def get_analytics(user_id):
    if USE_FIREBASE:
        docs = firebase_db.collection("analytics")\
            .where("user_id", "==", user_id)\
            .order_by("date", direction=firestore.Query.DESCENDING)\
            .limit(30).get()
        return [doc.to_dict() for doc in docs]
    else:
        conn = get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM analytics WHERE user_id = ? ORDER BY date DESC LIMIT 30", (user_id,))
        rows = cursor.fetchall()
        conn.close()
        analytics = []
        for r in rows:
            a = dict(r)
            if a.get("details_json"):
                a["details"] = json.loads(a["details_json"])
            analytics.append(a)
        return analytics

def save_analytics_snapshot(user_id, date, snapshot_data):
    anal_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    
    if USE_FIREBASE:
        snapshot_data["id"] = anal_id
        snapshot_data["user_id"] = user_id
        snapshot_data["date"] = date
        snapshot_data["created_at"] = now
        firebase_db.collection("analytics").document(anal_id).set(snapshot_data)
        return snapshot_data
    else:
        details_json = json.dumps(snapshot_data.get("details", {}))
        conn = get_sqlite_conn()
        cursor = conn.cursor()
        # check if date exists
        cursor.execute("SELECT id FROM analytics WHERE user_id = ? AND date = ?", (user_id, date))
        row = cursor.fetchone()
        
        if row:
            cursor.execute(
                """
                UPDATE analytics SET 
                    score=?, completed_count=?, pending_count=?, workload_score=?, focus_hours=?, details_json=?
                WHERE user_id=? AND date=?
                """,
                (
                    int(snapshot_data.get("score", 0)), int(snapshot_data.get("completed_count", 0)),
                    int(snapshot_data.get("pending_count", 0)), int(snapshot_data.get("workload_score", 0)),
                    float(snapshot_data.get("focus_hours", 0.0)), details_json, user_id, date
                )
            )
            snapshot_data["id"] = row[0]
        else:
            cursor.execute(
                """
                INSERT INTO analytics (
                    id, user_id, date, score, completed_count, pending_count, workload_score, focus_hours, details_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    anal_id, user_id, date, int(snapshot_data.get("score", 0)), int(snapshot_data.get("completed_count", 0)),
                    int(snapshot_data.get("pending_count", 0)), int(snapshot_data.get("workload_score", 0)),
                    float(snapshot_data.get("focus_hours", 0.0)), details_json, now
                )
            )
            snapshot_data["id"] = anal_id
        
        snapshot_data["user_id"] = user_id
        snapshot_data["date"] = date
        snapshot_data["created_at"] = now

        conn.commit()
        conn.close()
        return snapshot_data

# ============================================================
# AUTH / SESSION HELPERS (real email+password auth)
# All SQLite-only; Firebase path keeps using its own token model.
# ============================================================

def get_user_by_email(email):
    """Look up a user by email. Returns dict or None."""
    if USE_FIREBASE:
        docs = [d.to_dict() for d in firebase_db.collection("users").where("email", "==", email).stream()]
        return docs[0] if docs else None
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def create_auth_user(user_id, email, name, password_hash, picture=""):
    """Insert a brand new user row created via email/password registration."""
    now = datetime.utcnow().isoformat()
    if USE_FIREBASE:
        user_data = {
            "id": user_id, "email": email, "name": name or email.split("@")[0],
            "picture": picture, "password_hash": password_hash,
            "provider": "password", "failed_attempts": 0,
            "locked_until": None, "created_at": now, "last_login": None,
        }
        firebase_db.collection("users").document(user_id).set(user_data)
        return user_data
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO users (id, email, name, picture, password_hash, provider,
           failed_attempts, locked_until, created_at, last_login)
           VALUES (?, ?, ?, ?, ?, 'password', 0, NULL, ?, NULL)""",
        (user_id, email, name or email.split("@")[0], picture, password_hash, now),
    )
    conn.commit()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def update_failed_attempts(user_id, attempts, locked_until=None):
    """Persist the failed-attempt counter and optional lockout timestamp."""
    if USE_FIREBASE:
        firebase_db.collection("users").document(user_id).update(
            {"failed_attempts": attempts, "locked_until": locked_until})
        return
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?",
        (attempts, locked_until, user_id))
    conn.commit()
    conn.close()


def reset_failed_attempts(user_id):
    update_failed_attempts(user_id, 0, None)


def update_last_login(user_id):
    now = datetime.utcnow().isoformat()
    if USE_FIREBASE:
        firebase_db.collection("users").document(user_id).update({"last_login": now})
        return
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET last_login = ? WHERE id = ?", (now, user_id))
    conn.commit()
    conn.close()


def save_session_token(token, user_id, expires_at):
    if USE_FIREBASE:
        firebase_db.collection("sessions").document(token).set(
            {"user_id": user_id, "created_at": datetime.utcnow().isoformat(), "expires_at": expires_at})
        return
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
        (token, user_id, datetime.utcnow().isoformat(), expires_at))
    conn.commit()
    conn.close()


def get_user_by_token(token):
    """Validate a session token. Returns the user dict or None if invalid/expired."""
    if USE_FIREBASE:
        d = firebase_db.collection("sessions").document(token).get()
        if not d.exists:
            return None
        data = d.to_dict()
        if data.get("expires_at") and data["expires_at"] < datetime.utcnow().isoformat():
            return None
        u = firebase_db.collection("users").document(data["user_id"]).get()
        return u.to_dict() if u.exists else None
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sessions WHERE token = ?", (token,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    sess = dict(row)
    if sess.get("expires_at") and sess["expires_at"] < datetime.utcnow().isoformat():
        conn.close()
        return None
    cursor.execute("SELECT * FROM users WHERE id = ?", (sess["user_id"],))
    urow = cursor.fetchone()
    conn.close()
    return dict(urow) if urow else None


def delete_session_token(token):
    if USE_FIREBASE:
        firebase_db.collection("sessions").document(token).delete()
        return
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()


# ============================================================
# SENT EMAILS (audit / outbox)
# ============================================================

def save_sent_email(user_id, to_email, subject, body, mode):
    email_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    if USE_FIREBASE:
        firebase_db.collection("sent_emails").document(email_id).set(
            {"id": email_id, "user_id": user_id, "to_email": to_email,
             "subject": subject, "body": body, "mode": mode, "sent_at": now})
        return {"id": email_id, "user_id": user_id, "to_email": to_email,
                "subject": subject, "body": body, "mode": mode, "sent_at": now}
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO sent_emails (id, user_id, to_email, subject, body, mode, sent_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (email_id, user_id, to_email, subject, body, mode, now))
    conn.commit()
    conn.close()
    return {"id": email_id, "user_id": user_id, "to_email": to_email,
            "subject": subject, "body": body, "mode": mode, "sent_at": now}


def get_sent_emails(user_id, limit=20):
    if USE_FIREBASE:
        docs = [d.to_dict() for d in firebase_db.collection("sent_emails")
                .where("user_id", "==", user_id).stream()]
        return sorted(docs, key=lambda x: x.get("sent_at", ""), reverse=True)[:limit]
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM sent_emails WHERE user_id = ? ORDER BY sent_at DESC LIMIT ?",
        (user_id, limit))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows
