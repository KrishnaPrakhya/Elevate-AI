"""
Gmail API Integration Tool for ElevateAI

This tool allows AI agents to send emails using Gmail API.
Intended usage in this project is a single sender mailbox:
- elevate.ai.careers@gmail.com

Required environment variables:
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GMAIL_SENDER_REFRESH_TOKEN
Optional:
- GMAIL_SENDER_EMAIL (defaults to elevate.ai.careers@gmail.com)
- GOOGLE_CREDENTIALS_FILE (fallback source for OAuth client config)
"""

import base64
import json
import logging
import os
from datetime import datetime
from email.message import EmailMessage
from typing import Any, Dict, List, Optional

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

try:
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    GMAIL_AVAILABLE = True
except ImportError:
    GMAIL_AVAILABLE = False

logger = logging.getLogger(__name__)

GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"]


class EmailTool:
    """Tool for sending emails via Gmail API"""

    def __init__(
        self,
        sender_email: Optional[str] = None,
        sender_refresh_token: Optional[str] = None,
    ):
        self.sender_email = (
            sender_email
            or os.getenv("GMAIL_SENDER_EMAIL")
            or "elevate.ai.careers@gmail.com"
        )
        self.sender_refresh_token = (
            sender_refresh_token
            or os.getenv("GMAIL_SENDER_REFRESH_TOKEN")
        )

        self._service = None
        self._sync_session_factory = self._create_sync_session_factory()

        if not GMAIL_AVAILABLE:
            logger.warning("Google API SDK not installed. Email features will be mocked.")
        else:
            logger.info("Gmail email tool initialized (sender=%s)", self.sender_email)

    def _create_sync_session_factory(self):
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            return None

        sync_db_url = database_url
        if "+asyncpg" in sync_db_url:
            sync_db_url = sync_db_url.replace("+asyncpg", "")

        try:
            engine = create_engine(sync_db_url)
            return sessionmaker(bind=engine, autocommit=False, autoflush=False)
        except Exception as exc:
            logger.warning("Failed to initialize DB session factory for email tokens: %s", exc)
            return None

    def _get_oauth_client_config(self) -> tuple[Optional[str], Optional[str]]:
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        client_secret = os.getenv("GOOGLE_CLIENT_SECRET")

        if client_id and client_secret:
            return client_id, client_secret

        credentials_file = os.getenv("GOOGLE_CREDENTIALS_FILE")
        if not credentials_file or not os.path.exists(credentials_file):
            return None, None

        try:
            with open(credentials_file, "r", encoding="utf-8") as f:
                raw = json.load(f)

            oauth_block = raw.get("web") or raw.get("installed") if isinstance(raw, dict) else None
            if not isinstance(oauth_block, dict):
                return None, None

            return oauth_block.get("client_id"), oauth_block.get("client_secret")
        except Exception as exc:
            logger.warning("Failed to parse GOOGLE_CREDENTIALS_FILE for email tool: %s", exc)
            return None, None

    def _get_refresh_token_from_db(self, user_id: str) -> Optional[str]:
        if not self._sync_session_factory:
            return None

        query = text(
            'SELECT "googleCalendarRefreshToken" '
            'FROM "User" '
            'WHERE id = :user_id OR "clerkUserId" = :user_id '
            'LIMIT 1'
        )

        try:
            with self._sync_session_factory() as session:
                result = session.execute(query, {"user_id": user_id}).first()
                if not result:
                    return None

                token = result[0]
                if isinstance(token, str) and token.strip():
                    return token.strip()
                return None
        except Exception as exc:
            logger.warning("Failed to read Gmail refresh token from DB for user %s: %s", user_id, exc)
            return None

    def _resolve_refresh_token(self, user_id: Optional[str] = None) -> Optional[str]:
        if self.sender_refresh_token:
            return self.sender_refresh_token

        if user_id:
            return self._get_refresh_token_from_db(user_id)

        return None

    def _build_service(self, user_id: Optional[str] = None):
        if self._service is not None:
            return self._service

        client_id, client_secret = self._get_oauth_client_config()
        refresh_token = self._resolve_refresh_token(user_id)

        if not client_id or not client_secret or not refresh_token:
            logger.warning(
                "Gmail sender not configured. Missing OAuth client config or refresh token. "
                "Expected GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET and GMAIL_SENDER_REFRESH_TOKEN."
            )
            return None

        try:
            credentials = Credentials(
                token=None,
                refresh_token=refresh_token,
                token_uri=os.getenv("GOOGLE_TOKEN_URI", "https://oauth2.googleapis.com/token"),
                client_id=client_id,
                client_secret=client_secret,
                scopes=GMAIL_SCOPES,
            )
            credentials.refresh(Request())
            self._service = build("gmail", "v1", credentials=credentials)
            return self._service
        except Exception as exc:
            logger.error("Failed to initialize Gmail service: %s", exc)
            return None

    async def send_email(
        self,
        to: str,
        subject: str,
        html: str,
        text: Optional[str] = None,
        from_name: str = "ElevateAI",
        from_email: Optional[str] = None,
        reply_to: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        tags: Optional[Dict[str, str]] = None,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        sender_email = from_email or self.sender_email

        if not GMAIL_AVAILABLE:
            logger.info("[MOCK EMAIL] To: %s Subject: %s", to, subject)
            return {
                "success": True,
                "mock": True,
                "message_id": f"mock_{os.urandom(8).hex()}",
                "to": to,
                "subject": subject,
            }

        service = self._build_service(user_id=user_id)
        if service is None:
            return {
                "success": False,
                "error": "Gmail sender is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GMAIL_SENDER_REFRESH_TOKEN.",
                "to": to,
                "subject": subject,
            }

        try:
            message = EmailMessage()
            message["To"] = to
            message["Subject"] = subject
            message["From"] = f"{from_name} <{sender_email}>"

            if reply_to:
                message["Reply-To"] = reply_to
            if cc:
                message["Cc"] = ", ".join(cc)
            if bcc:
                message["Bcc"] = ", ".join(bcc)

            if text:
                message.set_content(text)
            else:
                message.set_content("This email contains HTML content. Please use an HTML-compatible viewer.")

            message.add_alternative(html, subtype="html")

            raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")

            result = (
                service.users()
                .messages()
                .send(userId="me", body={"raw": raw})
                .execute()
            )

            return {
                "success": True,
                "message_id": result.get("id"),
                "to": to,
                "subject": subject,
                "provider": "gmail",
                "labels": result.get("labelIds", []),
                "tags": tags or {},
            }
        except Exception as exc:
            logger.error("Failed to send email via Gmail API: %s", exc)
            return {
                "success": False,
                "error": str(exc),
                "to": to,
                "subject": subject,
            }

    async def send_schedule_email(
        self,
        to: str,
        user_name: str,
        schedule_title: str,
        schedule_details: str,
        ics_attachment: Optional[bytes] = None,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        html = f"""
        <html>
        <body style=\"font-family: Arial, sans-serif; line-height: 1.6; color: #333;\">
            <h2 style=\"color: #2563eb;\">Your {schedule_title} Schedule</h2>
            <p>Hi {user_name},</p>
            <p>Your schedule has been created and added to your calendar.</p>

            <div style=\"background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;\">
                <h3 style=\"margin-top: 0;\">Schedule Details</h3>
                {schedule_details}
            </div>

            <p>You can view and manage your schedule from your ElevateAI dashboard.</p>

            <p>Best regards,<br>The ElevateAI Team</p>
        </body>
        </html>
        """

        return await self.send_email(
            to=to,
            subject=f"Your {schedule_title} Schedule - ElevateAI",
            html=html,
            user_id=user_id,
        )

    async def send_interview_confirmation(
        self,
        to: str,
        user_name: str,
        role: str,
        interview_time: datetime,
        interviewer_name: Optional[str] = None,
        meeting_link: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        html = f"""
        <html>
        <body style=\"font-family: Arial, sans-serif; line-height: 1.6; color: #333;\">
            <h2 style=\"color: #2563eb;\">Interview Confirmation</h2>
            <p>Hi {user_name},</p>
            <p>Your mock interview for <strong>{role}</strong> has been scheduled.</p>

            <div style=\"background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;\">
                <table style=\"width: 100%;\">
                    <tr>
                        <td style=\"padding: 8px 0;\"><strong>Role:</strong></td>
                        <td>{role}</td>
                    </tr>
                    <tr>
                        <td style=\"padding: 8px 0;\"><strong>Time:</strong></td>
                        <td>{interview_time.strftime('%B %d, %Y at %I:%M %p UTC')}</td>
                    </tr>
                    {f'<tr><td style=\"padding: 8px 0;\"><strong>Interviewer:</strong></td><td>{interviewer_name}</td></tr>' if interviewer_name else ''}
                </table>
            </div>

            {f'<p><a href=\"{meeting_link}\" style=\"background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;\">Join Interview</a></p>' if meeting_link else ''}

            <p>Good luck with your preparation!</p>
            <p>Best regards,<br>The ElevateAI Team</p>
        </body>
        </html>
        """

        return await self.send_email(
            to=to,
            subject=f"Interview Scheduled: {role} - ElevateAI",
            html=html,
            user_id=user_id,
        )

    async def send_mentorship_confirmation(
        self,
        to: str,
        user_name: str,
        mentor_name: str,
        session_time: datetime,
        topic: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        html = f"""
        <html>
        <body style=\"font-family: Arial, sans-serif; line-height: 1.6; color: #333;\">
            <h2 style=\"color: #2563eb;\">Mentorship Session Confirmed</h2>
            <p>Hi {user_name},</p>
            <p>Your mentorship session has been scheduled with <strong>{mentor_name}</strong>.</p>

            <div style=\"background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;\">
                <table style=\"width: 100%;\">
                    <tr>
                        <td style=\"padding: 8px 0;\"><strong>Mentor:</strong></td>
                        <td>{mentor_name}</td>
                    </tr>
                    <tr>
                        <td style=\"padding: 8px 0;\"><strong>Time:</strong></td>
                        <td>{session_time.strftime('%B %d, %Y at %I:%M %p UTC')}</td>
                    </tr>
                    {f'<tr><td style=\"padding: 8px 0;\"><strong>Topic:</strong></td><td>{topic}</td></tr>' if topic else ''}
                </table>
            </div>

            <p>A calendar invitation has been sent to your email.</p>
            <p>Best regards,<br>The ElevateAI Team</p>
        </body>
        </html>
        """

        return await self.send_email(
            to=to,
            subject=f"Mentorship Session with {mentor_name} - ElevateAI",
            html=html,
            user_id=user_id,
        )

    async def send_achievement_email(
        self,
        to: str,
        user_name: str,
        achievement_title: str,
        achievement_description: str,
        points_earned: int = 0,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        html = f"""
        <html>
        <body style=\"font-family: Arial, sans-serif; line-height: 1.6; color: #333;\">
            <h2 style=\"color: #059669;\">🏆 Achievement Unlocked!</h2>
            <p>Congratulations {user_name}!</p>

            <div style=\"background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 8px; margin: 20px 0; color: white;\">
                <h3 style=\"margin-top: 0; color: white;\">{achievement_title}</h3>
                <p>{achievement_description}</p>
                {f'<p style=\"font-size: 1.2em; margin-top: 16px;\"><strong>+{points_earned} points</strong></p>' if points_earned > 0 else ''}
            </div>

            <p>Keep up the great work on your learning journey!</p>
            <p>Best regards,<br>The ElevateAI Team</p>
        </body>
        </html>
        """

        return await self.send_email(
            to=to,
            subject=f"🏆 Achievement Unlocked: {achievement_title} - ElevateAI",
            html=html,
            user_id=user_id,
        )
