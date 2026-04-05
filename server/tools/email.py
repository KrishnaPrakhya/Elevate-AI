"""
Resend Email Integration Tool for ElevateAI

This tool allows the AI agent to send personalized emails for:
- Schedule confirmations
- Interview reminders
- Mentorship session notifications
- Achievement celebrations
- Re-engagement campaigns
"""

import os
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

try:
    from resend import Email, Emails
    RESEND_AVAILABLE = True
except ImportError:
    RESEND_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("Resend SDK not installed. Email features will be limited.")

logger = logging.getLogger(__name__)


class EmailTool:
    """Tool for sending emails via Resend"""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Email tool.

        Args:
            api_key: Resend API key (defaults to RESEND_API_KEY env var)
        """
        self.api_key = api_key or os.getenv("RESEND_API_KEY")

        if RESEND_AVAILABLE and self.api_key:
            import resend
            resend.api_key = self.api_key
            logger.info("Resend email tool initialized")
        else:
            logger.warning("Resend email tool not fully configured")

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
        tags: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Send an email via Resend.

        Args:
            to: Recipient email address
            subject: Email subject
            html: HTML email body
            text: Plain text alternative
            from_name: Sender name (default: ElevateAI)
            from_email: Sender email (default: from env)
            reply_to: Reply-to email address
            cc: CC recipients
            bcc: BCC recipients
            tags: Email tags for tracking

        Returns:
            Dict with send status and message ID
        """
        from_email = from_email or os.getenv("RESEND_FROM_EMAIL", "notifications@elevateai.com")

        if not RESEND_AVAILABLE or not self.api_key:
            # Mock send for development
            logger.info(f"[MOCK EMAIL] To: {to}, Subject: {subject}")
            return {
                "success": True,
                "mock": True,
                "message_id": f"mock_{os.urandom(8).hex()}",
                "to": to,
                "subject": subject
            }

        try:
            params = {
                "from": f"{from_name} <{from_email}>",
                "to": to,
                "subject": subject,
                "html": html,
            }

            if text:
                params["text"] = text
            if reply_to:
                params["reply_to"] = reply_to
            if cc:
                params["cc"] = cc
            if bcc:
                params["bcc"] = bcc
            if tags:
                params["tags"] = tags

            email = Emails.send(params)

            return {
                "success": True,
                "message_id": email.get("id") if isinstance(email, dict) else str(email),
                "to": to,
                "subject": subject
            }
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return {
                "success": False,
                "error": str(e),
                "to": to,
                "subject": subject
            }

    async def send_schedule_email(
        self,
        to: str,
        user_name: str,
        schedule_title: str,
        schedule_details: str,
        ics_attachment: Optional[bytes] = None
    ) -> Dict[str, Any]:
        """Send a schedule confirmation email"""
        html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #2563eb;">Your {schedule_title} Schedule</h2>
            <p>Hi {user_name},</p>
            <p>Your schedule has been created and added to your calendar.</p>

            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Schedule Details</h3>
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
            html=html
        )

    async def send_interview_confirmation(
        self,
        to: str,
        user_name: str,
        role: str,
        interview_time: datetime,
        interviewer_name: Optional[str] = None,
        meeting_link: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send an interview confirmation email"""
        from datetime import datetime

        html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #2563eb;">Interview Confirmation</h2>
            <p>Hi {user_name},</p>
            <p>Your mock interview for <strong>{role}</strong> has been scheduled.</p>

            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <table style="width: 100%;">
                    <tr>
                        <td style="padding: 8px 0;"><strong>Role:</strong></td>
                        <td>{role}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0;"><strong>Time:</strong></td>
                        <td>{interview_time.strftime('%B %d, %Y at %I:%M %p UTC')}</td>
                    </tr>
                    {f'<tr><td style="padding: 8px 0;"><strong>Interviewer:</strong></td><td>{interviewer_name}</td></tr>' if interviewer_name else ''}
                </table>
            </div>

            {f'<p><a href="{meeting_link}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Join Interview</a></p>' if meeting_link else ''}

            <p>Good luck with your preparation!</p>
            <p>Best regards,<br>The ElevateAI Team</p>
        </body>
        </html>
        """

        return await self.send_email(
            to=to,
            subject=f"Interview Scheduled: {role} - ElevateAI",
            html=html
        )

    async def send_mentorship_confirmation(
        self,
        to: str,
        user_name: str,
        mentor_name: str,
        session_time: datetime,
        topic: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send a mentorship session confirmation email"""
        from datetime import datetime

        html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #2563eb;">Mentorship Session Confirmed</h2>
            <p>Hi {user_name},</p>
            <p>Your mentorship session has been scheduled with <strong>{mentor_name}</strong>.</p>

            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <table style="width: 100%;">
                    <tr>
                        <td style="padding: 8px 0;"><strong>Mentor:</strong></td>
                        <td>{mentor_name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0;"><strong>Time:</strong></td>
                        <td>{session_time.strftime('%B %d, %Y at %I:%M %p UTC')}</td>
                    </tr>
                    {f'<tr><td style="padding: 8px 0;"><strong>Topic:</strong></td><td>{topic}</td></tr>' if topic else ''}
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
            html=html
        )

    async def send_achievement_email(
        self,
        to: str,
        user_name: str,
        achievement_title: str,
        achievement_description: str,
        points_earned: int = 0
    ) -> Dict[str, Any]:
        """Send an achievement unlocked email"""
        html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #059669;">🏆 Achievement Unlocked!</h2>
            <p>Congratulations {user_name}!</p>

            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 8px; margin: 20px 0; color: white;">
                <h3 style="margin-top: 0; color: white;">{achievement_title}</h3>
                <p>{achievement_description}</p>
                {f'<p style="font-size: 1.2em; margin-top: 16px;"><strong>+{points_earned} points</strong></p>' if points_earned > 0 else ''}
            </div>

            <p>Keep up the great work on your learning journey!</p>
            <p>Best regards,<br>The ElevateAI Team</p>
        </body>
        </html>
        """

        return await self.send_email(
            to=to,
            subject=f"🏆 Achievement Unlocked: {achievement_title} - ElevateAI",
            html=html
        )
