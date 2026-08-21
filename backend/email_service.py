"""
email_service.py — Real (or console) email delivery for FocusFlow.

Modes (Config.EMAIL_MODE):
  * "console" (default): renders the full HTML email, prints it to the backend
    terminal so you can SEE it working, and saves a copy in the `sent_emails`
    table (viewable via GET /api/emails/sent). Zero external setup required.
  * "smtp": actually delivers the message via SMTP using SMTP_HOST/PORT/USER/
    PASSWORD from the environment.

All emails are built from the render_* template helpers below so the content is
identical regardless of the delivery mode.
"""
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

import db_service
from config import Config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# Templates
# ------------------------------------------------------------------

def _layout(title: str, preheader: str, body_html: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>{title}</title></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#111827;border-radius:16px;overflow:hidden;border:1px solid #1f2937;">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;">FocusFlow AI</h1>
      <p style="color:#c7d2fe;margin:6px 0 0;font-size:13px;">{preheader}</p>
    </div>
    <div style="padding:28px 32px;color:#e5e7eb;font-size:15px;line-height:1.6;">
      {body_html}
    </div>
    <div style="padding:18px 32px;background:#0b1220;color:#64748b;font-size:12px;text-align:center;">
      &copy; {datetime.utcnow().year} FocusFlow AI &middot; This message was sent to you because an account action occurred.
    </div>
  </div>
</body>
</html>"""


def render_welcome(name: str) -> tuple:
    body = f"""
      <h2 style="color:#fff;margin-top:0;">Welcome aboard, {name}! 👋</h2>
      <p>Your FocusFlow AI account has been created successfully.</p>
      <p>Here's what you can do next:</p>
      <ul style="color:#cbd5e1;">
        <li>Add your tasks with deadlines, difficulty and importance.</li>
        <li>Hit <b>Plan My Day</b> to let the AI coach build a focused schedule.</li>
        <li>Track your real productivity score as you complete work.</li>
      </ul>
      <a href="{Config.APP_URL}/dashboard" style="display:inline-block;margin-top:12px;background:#6366f1;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;">Go to Dashboard</a>
      <p style="margin-top:24px;color:#94a3b8;font-size:13px;">If you did not create this account, you can safely ignore this email.</p>
    """
    return ("Welcome to FocusFlow AI 🎉",
            _layout("Welcome to FocusFlow AI",
                    "Your account is ready — start focusing smarter.",
                    body))


def render_new_login(name: str, email: str, when: str) -> tuple:
    body = f"""
      <h2 style="color:#fff;margin-top:0;">New login detected 🔐</h2>
      <p>Hi {name},</p>
      <p>Someone just signed in to your FocusFlow AI account.</p>
      <table style="width:100%;margin:16px 0;color:#cbd5e1;font-size:14px;">
        <tr><td style="padding:6px 0;color:#94a3b8;">Account</td><td>{email}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Time (UTC)</td><td>{when}</td></tr>
      </table>
      <p style="color:#94a3b8;font-size:13px;">If this was you, no action is needed. If you don't recognize this activity, please change your password.</p>
    """
    return ("New login to your FocusFlow account",
            _layout("New login",
                    "A recent sign-in to your account was recorded.",
                    body))


def render_failed_login(name: str, email: str, attempts: int, max_attempts: int, when: str) -> tuple:
    body = f"""
      <h2 style="color:#fff;margin-top:0;">⚠️ Suspicious login attempt</h2>
      <p>Hi {name},</p>
      <p>We detected a <b>failed sign-in attempt</b> for your FocusFlow AI account. Someone entered the wrong password.</p>
      <table style="width:100%;margin:16px 0;color:#cbd5e1;font-size:14px;">
        <tr><td style="padding:6px 0;color:#94a3b8;">Account</td><td>{email}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Failed attempts</td><td>{attempts} / {max_attempts}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Time (UTC)</td><td>{when}</td></tr>
      </table>
      <p>For your security, the account will be <b>temporarily locked</b> after {max_attempts} failed attempts.</p>
      <p style="color:#94a3b8;font-size:13px;">If this was you, please make sure you're using the correct password. If not, consider updating your password.</p>
    """
    return ("Security alert: failed login attempt",
            _layout("Failed login attempt",
                    "Someone entered the wrong password for your account.",
                    body))


def render_account_locked(name: str, email: str, retry_minutes: int, when: str) -> tuple:
    body = f"""
      <h2 style="color:#fff;margin-top:0;">🔒 Account temporarily locked</h2>
      <p>Hi {name},</p>
      <p>Due to multiple failed sign-in attempts, your FocusFlow AI account has been <b>temporarily locked</b>.</p>
      <table style="width:100%;margin:16px 0;color:#cbd5e1;font-size:14px;">
        <tr><td style="padding:6px 0;color:#94a3b8;">Account</td><td>{email}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Locked at (UTC)</td><td>{when}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Try again in</td><td>{retry_minutes} minutes</td></tr>
      </table>
      <p style="color:#94a3b8;font-size:13px;">If this wasn't you, rest assured your account is safe — no one gained access.</p>
    """
    return ("Account locked — FocusFlow AI",
            _layout("Account locked",
                    "Too many failed login attempts.",
                    body))


# ------------------------------------------------------------------
# Delivery
# ------------------------------------------------------------------

def send_email(user_id, to_email, subject, html_body):
    """
    Send (or render) an email. Always records a copy in `sent_emails`.
    Returns the stored record dict.
    """
    mode = Config.EMAIL_MODE
    record = db_service.save_sent_email(user_id, to_email, subject, html_body, mode)

    if mode == "smtp":
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = Config.EMAIL_FROM
            msg["To"] = to_email
            msg.attach(MIMEText(html_body, "html"))
            with smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT) as server:
                server.starttls()
                server.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
                server.sendmail(Config.EMAIL_FROM, [to_email], msg.as_string())
            logger.info(f"[smtp] Email sent to {to_email}: {subject}")
        except Exception as e:
            logger.error(f"[smtp] Failed to send to {to_email}: {e}")
    else:
        # Console mode: print the rendered email so it's clearly visible.
        sep = "=" * 78
        logger.info(f"\n{sep}\n[CONSOLE EMAIL → {to_email}]\nSubject: {subject}\n{sep}\n"
                    f"{html_body}\n{sep}\n[END EMAIL]\n")

    return record
