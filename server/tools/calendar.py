"""
Google Calendar Integration Tool for ElevateAI

This tool allows the AI agent to create, update, and manage Google Calendar events
for study sessions, interviews, mentorship meetings, and deadlines.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger(__name__)

# OAuth2 scopes for Google Calendar API
SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.settings.readonly'
]


class CalendarTool:
    """Tool for interacting with Google Calendar API"""

    def __init__(self, credentials_file: Optional[str] = None):
        """
        Initialize the Calendar tool.

        Args:
            credentials_file: Path to Google OAuth client credentials JSON file
        """
        self.credentials_file = credentials_file or os.getenv("GOOGLE_CREDENTIALS_FILE")
        self._service_by_user: Dict[str, Any] = {}
        self._credentials_by_user: Dict[str, Credentials] = {}
        self._sync_session_factory = self._create_sync_session_factory()

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
            logger.warning("Failed to initialize DB session factory for calendar tokens: %s", exc)
            return None

    def _normalize_user_key(self, user_id: str) -> str:
        return (user_id or "default_user").strip().replace("-", "_").replace(".", "_").upper()

    def _get_refresh_token_from_db(self, user_id: str) -> Optional[str]:
        """
        Retrieve OAuth refresh token from User table.

        Looks up by either internal user id or clerk user id.
        """
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
            logger.warning("Failed to read Google refresh token from DB for user %s: %s", user_id, exc)
            return None

    def _get_refresh_token_for_user(self, user_id: str) -> Optional[str]:
        """
        Resolve refresh token for a user from persistent storage.

        OAuth-only lookup order:
        1) Database User.googleCalendarRefreshToken
        """
        return self._get_refresh_token_from_db(user_id)

    def _get_oauth_client_config(self) -> tuple[Optional[str], Optional[str]]:
        """
        Resolve OAuth client id/secret.

        Lookup order:
        1) GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET
        2) GOOGLE_CREDENTIALS_FILE JSON (web/installed OAuth client config)
        """
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        client_secret = os.getenv("GOOGLE_CLIENT_SECRET")

        if client_id and client_secret:
            return client_id, client_secret

        if not self.credentials_file:
            return None, None

        if not os.path.exists(self.credentials_file):
            logger.warning("GOOGLE_CREDENTIALS_FILE not found: %s", self.credentials_file)
            return None, None

        try:
            with open(self.credentials_file, "r", encoding="utf-8") as f:
                raw = json.load(f)

            oauth_block = raw.get("web") or raw.get("installed") if isinstance(raw, dict) else None
            if not isinstance(oauth_block, dict):
                logger.warning("GOOGLE_CREDENTIALS_FILE does not contain OAuth client config")
                return None, None

            return oauth_block.get("client_id"), oauth_block.get("client_secret")
        except Exception as exc:
            logger.warning("Failed to parse GOOGLE_CREDENTIALS_FILE: %s", exc)
            return None, None

    def _get_oauth_credentials(self, user_id: str) -> Optional[Credentials]:
        client_id, client_secret = self._get_oauth_client_config()
        refresh_token = self._get_refresh_token_for_user(user_id)

        if not client_id or not client_secret or not refresh_token:
            return None

        token_uri = os.getenv("GOOGLE_TOKEN_URI", "https://oauth2.googleapis.com/token")

        credentials = Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri=token_uri,
            client_id=client_id,
            client_secret=client_secret,
            scopes=SCOPES,
        )

        try:
            credentials.refresh(Request())
            return credentials
        except Exception as exc:
            logger.warning("Failed to refresh OAuth credentials for user %s: %s", user_id, exc)
            return None

    def _get_credentials(self, user_id: str) -> Optional[Credentials]:
        """
        Get or refresh OAuth2 credentials for a user.

        In production, you would store and retrieve tokens from your database.
        For now, this is a simplified implementation.
        """
        if user_id in self._credentials_by_user:
            cached = self._credentials_by_user[user_id]
            if getattr(cached, "valid", False):
                return cached
            if getattr(cached, "expired", False) and getattr(cached, "refresh_token", None):
                try:
                    cached.refresh(Request())
                    return cached
                except Exception as exc:
                    logger.warning("Failed to refresh cached credentials for user %s: %s", user_id, exc)

        # OAuth-only per-user calendar access.
        oauth_credentials = self._get_oauth_credentials(user_id)
        if oauth_credentials:
            self._credentials_by_user[user_id] = oauth_credentials
            return oauth_credentials

        logger.warning(
            "No Google Calendar OAuth credentials available for user %s. Configure "
            "GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET (or GOOGLE_CREDENTIALS_FILE), then "
            "connect the user via /api/google/connect so a refresh token is stored in DB.",
            user_id,
        )
        return None

    def _get_service(self, user_id: str = "default_user") -> Optional[Any]:
        """Get the Google Calendar API service"""
        if user_id in self._service_by_user:
            return self._service_by_user[user_id]

        credentials = self._get_credentials(user_id)
        if not credentials:
            return None

        try:
            service = build('calendar', 'v3', credentials=credentials)
            self._service_by_user[user_id] = service
            return service
        except Exception as e:
            logger.error(f"Failed to build Calendar service: {e}")
            return None

    async def create_event(
        self,
        title: str,
        start_time: datetime,
        end_time: datetime,
        description: Optional[str] = None,
        location: Optional[str] = None,
        attendees: Optional[List[str]] = None,
        timezone: str = "UTC",
        reminders: Optional[Dict[str, Any]] = None,
        recurrence: Optional[str] = None,
        user_id: str = "default_user",
    ) -> Dict[str, Any]:
        """
        Create a new Google Calendar event.

        Args:
            title: Event title/summary
            start_time: Event start time
            end_time: Event end time
            description: Event description
            location: Event location (physical or virtual)
            attendees: List of attendee email addresses
            timezone: Timezone for the event (default: UTC)
            reminders: Custom reminder settings
            recurrence: Recurrence rule (RRULE format)

        Returns:
            Dict with event details including google_event_id
        """
        service = self._get_service(user_id)
        if not service:
            # Return mock event for development without credentials
            return {
                "success": False,
                "error": "Google Calendar not configured",
                "event": {
                    "title": title,
                    "start_time": start_time.isoformat(),
                    "end_time": end_time.isoformat(),
                    "description": description,
                    "location": location,
                    "attendees": attendees or [],
                    "timezone": timezone
                }
            }

        event = {
            'summary': title,
            'start': {
                'dateTime': start_time.isoformat(),
                'timeZone': timezone,
            },
            'end': {
                'dateTime': end_time.isoformat(),
                'timeZone': timezone,
            },
        }

        if description:
            event['description'] = description
        if location:
            event['location'] = location
        if attendees:
            event['attendees'] = [{'email': email} for email in attendees]
        if recurrence:
            event['recurrence'] = [recurrence]
        if reminders:
            event['reminders'] = reminders
        else:
            # Default reminders: email 24h before, popup 30min before
            event['reminders'] = {
                'useDefault': False,
                'overrides': [
                    {'method': 'email', 'minutes': 24 * 60},
                    {'method': 'popup', 'minutes': 30},
                ]
            }

        try:
            created_event = service.events().insert(
                calendarId='primary',
                body=event,
                sendUpdates='all'  # Send email to all attendees
            ).execute()

            return {
                "success": True,
                "google_event_id": created_event.get('id'),
                "html_link": created_event.get('htmlLink'),
                "event": created_event
            }
        except HttpError as e:
            logger.error(f"Failed to create calendar event: {e}")
            return {
                "success": False,
                "error": str(e),
                "event": event
            }

    async def delete_event(self, event_id: str, user_id: str = "default_user") -> Dict[str, Any]:
        """Delete a calendar event by ID"""
        service = self._get_service(user_id)
        if not service:
            return {"success": False, "error": "Google Calendar not configured"}

        try:
            service.events().delete(
                calendarId='primary',
                eventId=event_id,
                sendUpdates='all'
            ).execute()
            return {"success": True, "deleted_event_id": event_id}
        except HttpError as e:
            logger.error(f"Failed to delete calendar event: {e}")
            return {"success": False, "error": str(e)}

    async def list_events(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        max_results: int = 10,
        user_id: str = "default_user",
    ) -> Dict[str, Any]:
        """List upcoming calendar events"""
        service = self._get_service(user_id)
        if not service:
            return {"success": False, "error": "Google Calendar not configured", "events": []}

        now = start_date or datetime.utcnow()
        end = end_date or (now + timedelta(days=30))

        try:
            events_result = service.events().list(
                calendarId='primary',
                timeMin=now.isoformat() + 'Z',
                timeMax=end.isoformat() + 'Z',
                maxResults=max_results,
                singleEvents=True,
                orderBy='startTime'
            ).execute()

            events = events_result.get('items', [])
            return {
                "success": True,
                "events": [
                    {
                        "id": event.get('id'),
                        "summary": event.get('summary'),
                        "start": event.get('start', {}).get('dateTime', event.get('start', {}).get('date')),
                        "end": event.get('end', {}).get('dateTime', event.get('end', {}).get('date')),
                        "location": event.get('location'),
                        "attendees": [a.get('email') for a in event.get('attendees', [])]
                    }
                    for event in events
                ]
            }
        except HttpError as e:
            logger.error(f"Failed to list calendar events: {e}")
            return {"success": False, "error": str(e), "events": []}
