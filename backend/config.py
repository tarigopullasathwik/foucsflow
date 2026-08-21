import os
from dotenv import load_dotenv

# Load variables from .env
load_dotenv()

class Config:
    PORT = int(os.environ.get("PORT", 5000))
    DEBUG = os.environ.get("DEBUG", "True").lower() in ("true", "1", "yes")
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

    # Path to firebase service account json key file
    FIREBASE_SERVICE_ACCOUNT = os.environ.get("FIREBASE_SERVICE_ACCOUNT", "")

    # Enable fallback to local SQLite DB if Firebase credentials aren't supplied
    USE_LOCAL_DB = os.environ.get("USE_LOCAL_DB", "true").lower() in ("true", "1", "yes")

    # Google Calendar credentials placeholder
    GOOGLE_CALENDAR_CLIENT_ID = os.environ.get("GOOGLE_CALENDAR_CLIENT_ID", "")
    GOOGLE_CALENDAR_CLIENT_SECRET = os.environ.get("GOOGLE_CALENDAR_CLIENT_SECRET", "")

    # ---- Real auth (email/password) settings ----
    # Number of wrong-password attempts before an account is temporarily locked.
    MAX_LOGIN_ATTEMPTS = int(os.environ.get("MAX_LOGIN_ATTEMPTS", 5))
    # How long a lockout lasts, in minutes.
    LOCKOUT_MINUTES = int(os.environ.get("LOCKOUT_MINUTES", 15))
    # Session token lifetime, in hours.
    SESSION_HOURS = int(os.environ.get("SESSION_HOURS", 24))

    # ---- Email settings ----
    # "console" = render emails to the backend terminal + store in DB (no SMTP needed).
    # "smtp"    = send real emails via the SMTP_* settings below.
    EMAIL_MODE = os.environ.get("EMAIL_MODE", "console").lower()
    SMTP_HOST = os.environ.get("SMTP_HOST", "")
    SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
    SMTP_USER = os.environ.get("SMTP_USER", "")
    SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
    EMAIL_FROM = os.environ.get("EMAIL_FROM", "FocusFlow AI <noreply@focusflow.ai>")
    # Public app URL used inside email templates (e.g. links back to the dashboard).
    APP_URL = os.environ.get("APP_URL", "http://localhost:5173")
