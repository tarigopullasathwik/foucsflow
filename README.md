# FocusFlow AI

An AI-assisted productivity app: track tasks, get priority scores and deadline-risk
predictions, and let the coach build a time-blocked daily schedule.

- **Backend** — Flask REST API (`backend/`)
- **Frontend** — React + TypeScript + Vite + Tailwind (`frontend/`)

It runs with **zero configuration**: no API keys, no cloud account, no database
server. Optional integrations (Gemini, Firebase, SMTP) each layer on top when you
supply credentials.

## Quick start

Two terminals. Backend first.

**1. Backend** (Python 3.12+)

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env      # optional — defaults work as-is
python app.py             # http://localhost:5000
```

**2. Frontend** (Node 20+)

```bash
cd frontend
npm install
cp .env.example .env      # optional — defaults work as-is
npm run dev               # http://localhost:5173
```

Open http://localhost:5173, create an account, and add a task.

## Default (zero-config) behavior

Out of the box, every external dependency has a working local fallback:

| Concern  | Default                        | Upgrade with                  |
| -------- | ------------------------------ | ----------------------------- |
| Database | SQLite (`focusflow_local.db`)  | `FIREBASE_SERVICE_ACCOUNT`    |
| AI coach | Local rules engine (heuristic) | `GEMINI_API_KEY`              |
| Email    | Rendered to terminal + stored  | `EMAIL_MODE=smtp` + `SMTP_*`  |
| Auth     | Server-verified email/password | Firebase keys in the frontend |

`GET /api/ai/status` reports which AI engine is actually live, so the UI never
claims Gemini is running when it isn't.

## Configuration

Both `.env` files are gitignored. Copy the tracked examples and edit:

- `backend/.env.example` → `backend/.env`
- `frontend/.env.example` → `frontend/.env`

### Enabling Firebase Auth (optional, adds Google sign-in)

Without Firebase keys the frontend uses the backend's own bcrypt-hashed
email/password auth. To switch to Firebase:

1. Paste your web config into `frontend/.env` (Firebase console → Project
   settings → Your apps → SDK setup).
2. Firebase console → **Authentication → Sign-in method**: enable
   **Email/Password** and **Google**.
3. Confirm `localhost` is listed under **Authentication → Settings → Authorized
   domains**.

The frontend detects a real `VITE_FIREBASE_API_KEY` and switches paths
automatically. `VITE_*` values are inlined into the public JS bundle — that is
expected for Firebase web config, but never put a service-account key there.

## Auth model

Email/password accounts are hashed with bcrypt and issued opaque 64-char session
tokens stored in the `sessions` table. Repeated wrong passwords lock the account
temporarily (`MAX_LOGIN_ATTEMPTS`, `LOCKOUT_MINUTES`). Sign-up, new logins,
failed attempts, and lockouts each trigger a notification email; in the default
`console` mode these render to the backend terminal and are also saved for the
`/api/emails/sent` audit trail.

## API reference

Auth-aware endpoints resolve the user from `Authorization: Bearer <token>`,
falling back to the `X-User-Id` header.

| Method           | Endpoint                     | Purpose                            |
| ---------------- | ---------------------------- | ---------------------------------- |
| POST             | `/api/auth/register`         | Create account, issue token        |
| POST             | `/api/auth/login`            | Sign in (lockout-aware)            |
| GET              | `/api/auth/me`               | Current user for a token           |
| POST             | `/api/auth/logout`           | Invalidate session token           |
| GET/POST         | `/api/tasks`                 | List / create tasks                |
| GET/PUT/DELETE   | `/api/tasks/<id>`            | Read / update / delete a task      |
| GET              | `/api/ai/status`             | Which AI engine is live            |
| POST             | `/api/ai/schedule`           | Generate or save today's plan      |
| POST             | `/api/ai/prioritize`         | Recompute priority scores          |
| POST             | `/api/ai/risk-analysis`      | Recompute deadline risk            |
| POST             | `/api/ai/chat`               | Message the coach                  |
| GET/DELETE       | `/api/ai/chat/history`       | Read / clear chat history          |
| GET              | `/api/analytics`             | Productivity history               |
| POST             | `/api/analytics/snapshot`    | Recompute today's snapshot         |
| GET/PUT          | `/api/preferences`           | Read / update work hours          |
| GET              | `/api/notifications`         | In-app notifications               |
| POST             | `/api/notifications/read`    | Mark all read                      |
| GET/POST         | `/api/calendar/events`       | List / add events                  |
| DELETE           | `/api/calendar/events/<id>`  | Remove an event                    |
| GET              | `/api/emails/sent`           | Sent-email audit trail             |

## Project layout

```
backend/
  app.py               Flask routes
  auth_service.py      bcrypt hashing, session tokens, lockout
  db_service.py        SQLite + optional Firestore
  gemini_service.py    Gemini calls + local heuristic fallback
  email_service.py     HTML templates, console/SMTP delivery
  calendar_service.py  Event storage and sync
  config.py            Env-driven settings

frontend/src/
  firebase.tsx         Auth context (Firebase or backend fallback)
  api.ts               Typed API client
  pages/               Dashboard, Tasks, Planner, Calendar, Analytics, …
  components/          Sidebar, TaskModal, AICoachDrawer, NotificationBell
  hooks/               useToast, useBreakpoints
```

## Notes

- `backend/focusflow_local.db` is gitignored — each clone starts with a fresh
  database, created automatically on first run.
- `google-generativeai` and `firebase-admin` are listed in
  `requirements.txt` but only imported when the matching env var is set.
