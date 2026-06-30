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
