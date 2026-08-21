"""
auth_service.py — Real email/password authentication for FocusFlow.

Responsibilities:
  * Hash & verify passwords with bcrypt.
  * Register new accounts (reject duplicate emails).
  * Log users in, detect wrong passwords, and lock accounts after too many
    failed attempts.
  * Issue and verify opaque session tokens (stored in the `sessions` table).

The returned dicts always carry a `status` code so app.py can map them to HTTP
responses and the frontend can show precise, realistic error messages.
"""
import uuid
import bcrypt
from datetime import datetime, timedelta

import db_service
from config import Config


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def _issue_token(user_id: str) -> tuple:
    token = uuid.uuid4().hex + uuid.uuid4().hex  # 64-char opaque token
    expires_at = (datetime.utcnow() + timedelta(hours=Config.SESSION_HOURS)).isoformat()
    db_service.save_session_token(token, user_id, expires_at)
    return token, expires_at


def verify_token(token: str):
    """Return the user dict for a valid token, else None."""
    if not token:
        return None
    return db_service.get_user_by_token(token)


def register_user(email: str, password: str, name: str):
    """
    Create a new account. Returns a dict like:
        {"status": "OK", "user": {...}, "token": "...", "is_new": True}
    or an error:
        {"status": "EMAIL_EXISTS" | "INVALID_INPUT"}
    """
    email = (email or "").strip().lower()
    if not email or not password or len(password) < 6:
        return {"status": "INVALID_INPUT"}

    if db_service.get_user_by_email(email):
        return {"status": "EMAIL_EXISTS"}

    user_id = str(uuid.uuid4())
    password_hash = _hash_password(password)
    display_name = name or email.split("@")[0]
    user = db_service.create_auth_user(user_id, email, display_name, password_hash)
    token, expires_at = _issue_token(user_id)
    return {"status": "OK", "user": user, "token": token,
            "expires_at": expires_at, "is_new": True}


def login_user(email: str, password: str):
    """
    Authenticate an existing user. Returns:
        {"status": "OK", "user": {...}, "token": "..."}
    or on failure:
        {"status": "INVALID_CREDENTIALS", "attempts": N, "max": M}
        {"status": "ACCOUNT_LOCKED", "retry_minutes": M}
        {"status": "INVALID_INPUT"}
    """
    email = (email or "").strip().lower()
    if not email or not password:
        return {"status": "INVALID_INPUT"}

    user = db_service.get_user_by_email(email)
    if not user:
        # Unknown email — do not reveal whether the email exists; return the
        # generic invalid-credentials shape so attackers can't enumerate.
        return {"status": "INVALID_CREDENTIALS",
                "attempts": 0, "max": Config.MAX_LOGIN_ATTEMPTS}

    # --- Lockout enforcement ---
    locked_until = user.get("locked_until")
    if locked_until:
        try:
            lock_dt = datetime.fromisoformat(locked_until)
        except Exception:
            lock_dt = None
        if lock_dt and lock_dt > datetime.utcnow():
            remaining = int((lock_dt - datetime.utcnow()).total_seconds() / 60) + 1
            return {"status": "ACCOUNT_LOCKED", "retry_minutes": remaining}

    # --- Password check ---
    if _verify_password(password, user.get("password_hash", "")):
        db_service.reset_failed_attempts(user["id"])
        db_service.update_last_login(user["id"])
        token, expires_at = _issue_token(user["id"])
        return {"status": "OK", "user": user, "token": token,
                "expires_at": expires_at}

    # Wrong password: increment counter, maybe lock.
    attempts = int(user.get("failed_attempts", 0)) + 1
    if attempts >= Config.MAX_LOGIN_ATTEMPTS:
        lock_dt = datetime.utcnow() + timedelta(minutes=Config.LOCKOUT_MINUTES)
        db_service.update_failed_attempts(user["id"], attempts, lock_dt.isoformat())
        return {"status": "ACCOUNT_LOCKED", "retry_minutes": Config.LOCKOUT_MINUTES}

    db_service.update_failed_attempts(user["id"], attempts)
    return {"status": "INVALID_CREDENTIALS",
            "attempts": attempts, "max": Config.MAX_LOGIN_ATTEMPTS}


def logout(token: str):
    if token:
        db_service.delete_session_token(token)
