import asyncio
import datetime
import html as html_lib
import json
import logging
import os
import re
import datetime
import uuid
from typing import Any, Literal, TypedDict, List, Optional
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode # Added for URL manipulation
from datetime import timedelta
from zoneinfo import ZoneInfo

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import RedirectResponse
from itsdangerous import BadSignature, URLSafeSerializer
from collections.abc import AsyncGenerator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Google Calendar imports
try:
    from tools.calendar import CalendarTool, SCOPES
    from google_auth_oauthlib.flow import Flow
    GOOGLE_CALENDAR_AVAILABLE = True
except ImportError:
    GOOGLE_CALENDAR_AVAILABLE = False
    logger.warning("Google Calendar API not installed. Calendar features will be limited.")


def format_markdown_response(content: str) -> str:
    """
    Format AI response content for consistent markdown rendering.
    Ensures proper table formatting, spacing, and structure.
    """
    if not content:
        return content

    formatted = content

    # Ensure blank lines before and after tables
    formatted = re.sub(r'\n(\|[^|]+\|.*)\n(\|[-| ]+\|)', r'\n\n\1\n\2\n', formatted)

    # Ensure blank lines before headings
    formatted = re.sub(r'([^\n])\n(#{1,6}\s)', r'\1\n\n\2', formatted)

    # Ensure blank lines before code blocks
    formatted = re.sub(r'([^\n])\n(```)', r'\1\n\n\2', formatted)

    # Normalize multiple blank lines to single blank line
    formatted = re.sub(r'\n{3,}', '\n\n', formatted)

    return formatted.strip()


def _format_inline_markdown_for_email(text: str) -> str:
    """Convert inline markdown syntax to safe HTML for email rendering."""
    escaped = html_lib.escape(text or "", quote=True)

    # Links: [label](https://example.com)
    escaped = re.sub(
        r"\[([^\]]+)\]\((https?://[^\s)]+)\)",
        r'<a href="\2" style="color:#2563eb;text-decoration:underline;">\1</a>',
        escaped,
    )

    # Bold, emphasis and inline code.
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", escaped)
    escaped = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", r"<em>\1</em>", escaped)
    escaped = re.sub(
        r"`([^`]+)`",
        r"<code style=\"background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:Consolas,Monaco,monospace;font-size:0.9em;\">\1</code>",
        escaped,
    )

    return escaped


def _is_table_separator_line(line: str) -> bool:
    return bool(
        re.match(
            r"^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$",
            (line or "").strip(),
        )
    )


def _looks_like_table_line(line: str) -> bool:
    trimmed = (line or "").strip()
    if not trimmed:
        return False
    if _is_table_separator_line(trimmed):
        return True
    return trimmed.count("|") >= 2


def _parse_table_cells(line: str) -> list[str]:
    row = (line or "").strip()
    if not row:
        return []

    if not row.startswith("|"):
        row = f"| {row}"
    if not row.endswith("|"):
        row = f"{row} |"

    cells = [cell.strip() for cell in row.split("|")[1:-1]]
    while cells and cells[-1] == "":
        cells.pop()
    while cells and cells[0] == "":
        cells = cells[1:]
    return cells


def markdown_to_email_html(markdown_text: str) -> str:
    """Render a markdown-ish string into email-safe HTML with table support."""
    if not markdown_text:
        return "<p style=\"margin:0 0 12px 0;line-height:1.6;color:#111827;\">&nbsp;</p>"

    text = markdown_text.replace("\r\n", "\n").strip()

    fenced = re.match(r"^```(?:md|markdown|text)?\n([\s\S]*?)\n```$", text, re.IGNORECASE)
    if fenced and fenced.group(1):
        text = fenced.group(1).strip()

    # Expand compact rows like "|a|b||c|d" into separate lines.
    text = re.sub(r"\s*\|\|\s*", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    lines = text.split("\n")
    html_parts: list[str] = []
    in_ul = False
    in_ol = False

    def close_lists() -> None:
        nonlocal in_ul, in_ol
        if in_ul:
            html_parts.append("</ul>")
            in_ul = False
        if in_ol:
            html_parts.append("</ol>")
            in_ol = False

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        if not line:
            close_lists()
            i += 1
            continue

        if _looks_like_table_line(line):
            close_lists()
            table_lines: list[str] = []

            while i < len(lines) and _looks_like_table_line(lines[i].strip()):
                raw = lines[i].strip()
                for segment in re.split(r"\s*\|\|\s*", raw):
                    seg = segment.strip()
                    if seg:
                        table_lines.append(seg)
                i += 1

            rows: list[list[str]] = []
            for row_line in table_lines:
                if _is_table_separator_line(row_line):
                    continue
                cells = _parse_table_cells(row_line)
                non_empty_count = len([cell for cell in cells if cell])
                if non_empty_count >= 2:
                    rows.append(cells)

            if len(rows) >= 2:
                max_cols = max(len(r) for r in rows)
                normalized_rows = [r + [""] * (max_cols - len(r)) for r in rows]
                header = normalized_rows[0]
                body_rows = normalized_rows[1:]

                table_html = [
                    "<table style=\"width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;\">",
                    "<thead>",
                    "<tr>",
                ]
                for cell in header:
                    table_html.append(
                        "<th style=\"border:1px solid #d1d5db;background:#f3f4f6;padding:10px 12px;text-align:left;font-weight:600;color:#111827;\">"
                        + _format_inline_markdown_for_email(cell)
                        + "</th>"
                    )
                table_html.extend(["</tr>", "</thead>", "<tbody>"])

                for row in body_rows:
                    table_html.append("<tr>")
                    for cell in row:
                        table_html.append(
                            "<td style=\"border:1px solid #d1d5db;padding:10px 12px;vertical-align:top;color:#111827;\">"
                            + _format_inline_markdown_for_email(cell)
                            + "</td>"
                        )
                    table_html.append("</tr>")

                table_html.extend(["</tbody>", "</table>"])
                html_parts.append("".join(table_html))
                continue

            # Not a valid table block; fall back to paragraph rendering.
            for row_line in table_lines:
                html_parts.append(
                    f"<p style=\"margin:0 0 12px 0;line-height:1.6;color:#111827;\">{_format_inline_markdown_for_email(row_line)}</p>"
                )
            continue

        heading_match = re.match(r"^(#{1,6})\s+(.+)$", line)
        if heading_match:
            close_lists()
            level = min(len(heading_match.group(1)), 4)
            heading_text = _format_inline_markdown_for_email(heading_match.group(2).strip())
            size_map = {1: "28px", 2: "24px", 3: "20px", 4: "18px"}
            html_parts.append(
                f"<h{level} style=\"margin:18px 0 10px 0;line-height:1.3;color:#0f172a;font-size:{size_map[level]};font-weight:700;\">{heading_text}</h{level}>"
            )
            i += 1
            continue

        if re.match(r"^(-{3,}|\*{3,})$", line):
            close_lists()
            html_parts.append(
                "<hr style=\"border:none;border-top:1px solid #d1d5db;margin:16px 0;\"/>"
            )
            i += 1
            continue

        unordered_match = re.match(r"^[-*]\s+(.+)$", line)
        if unordered_match:
            if in_ol:
                html_parts.append("</ol>")
                in_ol = False
            if not in_ul:
                html_parts.append("<ul style=\"margin:8px 0 12px 20px;padding:0;color:#111827;\">")
                in_ul = True
            html_parts.append(
                f"<li style=\"margin:6px 0;line-height:1.6;\">{_format_inline_markdown_for_email(unordered_match.group(1).strip())}</li>"
            )
            i += 1
            continue

        ordered_match = re.match(r"^\d+[\.)]\s+(.+)$", line)
        if ordered_match:
            if in_ul:
                html_parts.append("</ul>")
                in_ul = False
            if not in_ol:
                html_parts.append("<ol style=\"margin:8px 0 12px 20px;padding:0;color:#111827;\">")
                in_ol = True
            html_parts.append(
                f"<li style=\"margin:6px 0;line-height:1.6;\">{_format_inline_markdown_for_email(ordered_match.group(1).strip())}</li>"
            )
            i += 1
            continue

        close_lists()
        html_parts.append(
            f"<p style=\"margin:0 0 12px 0;line-height:1.6;color:#111827;\">{_format_inline_markdown_for_email(line)}</p>"
        )
        i += 1

    close_lists()
    return "".join(html_parts)


def build_email_html_document(title: str, markdown_content: str) -> str:
    safe_title = html_lib.escape(title or "ElevateAI Update", quote=True)
    body_html = markdown_to_email_html(markdown_content)

    return (
        "<html><body style=\"margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;\">"
        "<div style=\"max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;\">"
        f"<h2 style=\"margin:0 0 16px 0;color:#0f172a;font-size:22px;line-height:1.3;\">{safe_title}</h2>"
        f"{body_html}"
        "</div></body></html>"
    )


def _resolve_timezone(
    tz_name: Optional[str],
    tz_offset_minutes: Optional[int] = None,
) -> tuple[str, datetime.tzinfo]:
    """
    Resolve user timezone safely.

    Resolution order:
    1) IANA timezone name (e.g. "Asia/Kolkata")
    2) Numeric offset in minutes (e.g. 330)
    3) UTC±HH:MM string
    4) UTC fallback
    """
    normalized_tz = (tz_name or "UTC").strip() or "UTC"

    try:
        return normalized_tz, ZoneInfo(normalized_tz)
    except Exception:
        pass

    if isinstance(tz_offset_minutes, int) and -14 * 60 <= tz_offset_minutes <= 14 * 60:
        offset = datetime.timedelta(minutes=tz_offset_minutes)
        sign = "+" if tz_offset_minutes >= 0 else "-"
        absolute_minutes = abs(tz_offset_minutes)
        hours = absolute_minutes // 60
        minutes = absolute_minutes % 60
        return f"UTC{sign}{hours:02d}:{minutes:02d}", datetime.timezone(offset)

    utc_offset_match = re.match(r"^UTC([+-])(\d{1,2})(?::?(\d{2}))?$", normalized_tz, re.IGNORECASE)
    if utc_offset_match:
        sign_char, hours_raw, minutes_raw = utc_offset_match.groups()
        hours = int(hours_raw)
        minutes = int(minutes_raw or 0)
        total_minutes = hours * 60 + minutes
        if sign_char == "-":
            total_minutes = -total_minutes
        if -14 * 60 <= total_minutes <= 14 * 60:
            offset = datetime.timedelta(minutes=total_minutes)
            sign = "+" if total_minutes >= 0 else "-"
            absolute_minutes = abs(total_minutes)
            return (
                f"UTC{sign}{absolute_minutes // 60:02d}:{absolute_minutes % 60:02d}",
                datetime.timezone(offset),
            )

    logger.warning("Invalid timezone '%s', defaulting to UTC", normalized_tz)
    return "UTC", datetime.timezone.utc


def infer_calendar_time_range_from_text(
    message: str,
    user_timezone: str = "UTC",
    timezone_offset_minutes: Optional[int] = None,
) -> tuple[Optional[datetime.datetime], Optional[datetime.datetime]]:
    """
    Infer start/end datetime from natural language calendar text.
    Returns naive UTC datetimes to match existing API payload convention where "Z" is appended.

    Priority:
    1. Explicit time (e.g., "6 pm", "18:00") - uses that exact time
    2. Relative time (e.g., "in 2 hours", "tomorrow at 3pm")
    3. Default to tomorrow +3 hours if no time specified
    """
    if not message:
        return None, None

    text = message.lower()
    _, tzinfo = _resolve_timezone(user_timezone, timezone_offset_minutes)
    now_local = datetime.datetime.now(tzinfo)
    target_date = now_local.date()
    has_explicit_date = False

    # Check for explicit date references
    if "day after tomorrow" in text:
        target_date = target_date + datetime.timedelta(days=2)
        has_explicit_date = True
    elif "tomorrow" in text:
        target_date = target_date + datetime.timedelta(days=1)
        has_explicit_date = True
    elif "today" in text:
        target_date = target_date
        has_explicit_date = True

    # Check for weekday names (e.g., "Monday", "next Monday")
    weekday_map = {
        "monday": 0,
        "tuesday": 1,
        "wednesday": 2,
        "thursday": 3,
        "friday": 4,
        "saturday": 5,
        "sunday": 6,
    }
    for day_name, day_index in weekday_map.items():
        if day_name in text:
            delta_days = (day_index - now_local.weekday()) % 7
            if delta_days == 0:
                # If today is Monday and user says "Monday", assume next Monday (7 days)
                delta_days = 7
            target_date = now_local.date() + datetime.timedelta(days=delta_days)
            has_explicit_date = True
            break

    hour = None
    minute = 0

    # Try to extract time - AM/PM format
    am_pm_match = re.search(r"\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b", text)
    if am_pm_match:
        hour = int(am_pm_match.group(1)) % 12
        minute = int(am_pm_match.group(2) or 0)
        if am_pm_match.group(3) == "pm":
            hour += 12
    else:
        # Try 24-hour format
        twenty_four_hour_match = re.search(r"\b([01]?\d|2[0-3]):([0-5]\d)\b", text)
        if twenty_four_hour_match:
            hour = int(twenty_four_hour_match.group(1))
            minute = int(twenty_four_hour_match.group(2))

    # If no explicit time found, use default
    if hour is None:
        # No time specified - return None to let downstream handle default
        return None, None

    start_local = datetime.datetime.combine(
        target_date,
        datetime.time(hour=hour, minute=minute),
        tzinfo=tzinfo,
    )

    # CRITICAL FIX: Only add a day if user said "today" AND the time is in the past
    # For other cases (tomorrow, weekday, etc.), trust the user's explicit date
    if has_explicit_date and "today" in text and start_local <= now_local:
        # User said "today" but time is past - move to tomorrow
        start_local = start_local + datetime.timedelta(days=1)
    # For "tomorrow" or weekday mentions, don't second-guess the user

    duration_minutes = 60
    duration_match = re.search(
        r"\bfor\s+(\d+)\s*(minute|min|minutes|hour|hours|hr|hrs)\b",
        text,
    )
    if duration_match:
        amount = int(duration_match.group(1))
        unit = duration_match.group(2)
        if unit in ["hour", "hours", "hr", "hrs"]:
            duration_minutes = amount * 60
        else:
            duration_minutes = amount

    end_local = start_local + datetime.timedelta(minutes=duration_minutes)

    start_utc = start_local.astimezone(datetime.timezone.utc).replace(tzinfo=None)
    end_utc = end_local.astimezone(datetime.timezone.utc).replace(tzinfo=None)
    return start_utc, end_utc


def extract_calendar_intent_params(
    message: str,
    user_timezone: str = "UTC",
    timezone_offset_minutes: Optional[int] = None,
) -> dict[str, Any]:
    """
    Deterministically extract calendar parameters from user text so common requests
    like "add a mock interview to my Google Calendar at 10:30 pm today" are reliable.
    """
    params: dict[str, Any] = {}
    if not message:
        return params

    lower_message = message.lower()

    # Title extraction for common phrasing patterns.
    title_match = re.search(
        r"add\s+(?:an?\s+)?(.+?)\s+to\s+(?:my\s+)?(?:google\s+)?calendar",
        lower_message,
    )
    if title_match:
        raw_title = title_match.group(1).strip()
        # Remove trailing schedule fragments from title.
        raw_title = re.split(r"\s+(?:at|on|for|today|tomorrow|next)\b", raw_title)[0].strip()
        if raw_title:
            params["title"] = raw_title.title()

    # Event type heuristic.
    if "interview" in lower_message:
        params["event_type"] = "interview"
    elif "mentor" in lower_message or "mentorship" in lower_message:
        params["event_type"] = "mentorship"
    elif "reminder" in lower_message:
        params["event_type"] = "reminder"
    else:
        params["event_type"] = "custom"

    resolved_tz_name, _ = _resolve_timezone(user_timezone, timezone_offset_minutes)

    inferred_start, inferred_end = infer_calendar_time_range_from_text(
        message,
        user_timezone=resolved_tz_name,
        timezone_offset_minutes=timezone_offset_minutes,
    )
    if inferred_start and inferred_end:
        params["start_time"] = inferred_start.isoformat() + "Z"
        params["end_time"] = inferred_end.isoformat() + "Z"

    display_timezone = (user_timezone or "").strip() or resolved_tz_name
    params["timezone"] = display_timezone

    # Default description based on title when available.
    if params.get("title"):
        params["description"] = f"Scheduled event: {params['title']}"

    return params


def parse_iso_datetime_to_utc_naive(
    value: Optional[str],
    assume_timezone: str = "UTC",
    timezone_offset_minutes: Optional[int] = None,
) -> Optional[datetime.datetime]:
    """Parse ISO datetime strings and return UTC-naive datetime for downstream consistency."""
    if not value or not isinstance(value, str):
        return None

    raw = value.strip()
    if not raw:
        return None

    parsed: Optional[datetime.datetime] = None

    # Try standard Z/+00:00 handling first.
    try:
        parsed = datetime.datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        try:
            parsed = datetime.datetime.fromisoformat(raw.replace("+00:00", "").replace("Z", ""))
        except (ValueError, TypeError):
            return None

    if parsed.tzinfo is None:
        _, tzinfo = _resolve_timezone(assume_timezone, timezone_offset_minutes)
        parsed = parsed.replace(tzinfo=tzinfo)

    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(datetime.timezone.utc).replace(tzinfo=None)

    return parsed

from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, ARRAY, inspect, create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker, Session, selectinload
from sqlalchemy.future import select

# LiveKit imports for voice interview
try:
    from livekit.api import AccessToken
    LIVEKIT_AVAILABLE = True
except ImportError:
    LIVEKIT_AVAILABLE = False
    logger.warning("LiveKit SDK not installed. Voice interview features will be limited.")

# Load env files explicitly so backend works whether started from repo root or server/.
_SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_SERVER_DIR)
for _env_file in (
    os.path.join(_PROJECT_ROOT, ".env"),
    os.path.join(_PROJECT_ROOT, ".env.local"),
    os.path.join(_SERVER_DIR, ".env"),
    os.path.join(_SERVER_DIR, ".env.local"),
):
    load_dotenv(_env_file, override=False)

# FastAPI App Initialization
app = FastAPI()

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for development, adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database Setup
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    logger.critical("DATABASE_URL not found in environment variables.")
    raise RuntimeError("Missing DATABASE_URL environment variable")

# Ensure DATABASE_URL for async engine uses an async dialect like asyncpg
if DATABASE_URL.startswith("postgresql://"):
    ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgres://"):
    ASYNC_DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1) 
else:
    ASYNC_DATABASE_URL = DATABASE_URL # Assume other dialects are already async or will raise appropriate errors
    if "postgresql" in ASYNC_DATABASE_URL and "asyncpg" not in ASYNC_DATABASE_URL:
        logger.warning(f"DATABASE_URL \"{DATABASE_URL}\" seems to be for PostgreSQL but does not specify an async driver like asyncpg. SQLAlchemy's async features might fail.")

# Handle sslmode for asyncpg: asyncpg expects 'ssl' in connect_args, not 'sslmode' as a direct kwarg.
# SQLAlchemy dialect might incorrectly pass 'sslmode' from URL query as a kwarg.
connect_args = {}
parsed_url = urlparse(ASYNC_DATABASE_URL)
query_params = parse_qs(parsed_url.query, keep_blank_values=True)

# Pop 'sslmode' from query_params if it exists
ssl_mode_values = query_params.pop('sslmode', [None])
ssl_mode = ssl_mode_values[0] if ssl_mode_values else None

ASYNC_DATABASE_URL_FOR_ENGINE = ASYNC_DATABASE_URL # Default to original if no sslmode was in query

if ssl_mode:
    logger.info(f"Found sslmode='{ssl_mode}' in DATABASE_URL. Processing for asyncpg.")
    if ssl_mode in ['allow', 'prefer', 'require', 'verify-ca', 'verify-full']:
        connect_args['ssl'] = True
        logger.info(
            f"Configuring asyncpg with connect_args['ssl'] = True due to sslmode='{ssl_mode}'. "
            f"Other SSL DSN parameters (e.g., sslrootcert) should remain in the URL for asyncpg to use."
        )
    elif ssl_mode == 'disable':
        # asyncpg default is no SSL if 'ssl' connect_arg is None and DSN doesn't force it.
        # Setting ssl=False explicitly disables it if DSN might otherwise enable it.
        connect_args['ssl'] = False
        logger.info("Configuring asyncpg with connect_args['ssl'] = False due to sslmode='disable'.")
    else:
        logger.warning(
            f"Unknown sslmode \"{ssl_mode}\" found in DATABASE_URL. "
            f"Proceeding without specific SSL connect_args override for asyncpg. sslmode parameter removed from DSN query."
        )
    
    # Reconstruct URL without the 'sslmode' query parameter, as we handle it via connect_args['ssl']
    # Other parameters (like sslrootcert) must remain for asyncpg to use them.
    new_query_string = urlencode(query_params, doseq=True)
    ASYNC_DATABASE_URL_FOR_ENGINE = urlunparse(parsed_url._replace(query=new_query_string))
    logger.info(f"URL for async_engine (sslmode query param removed): {ASYNC_DATABASE_URL_FOR_ENGINE}")
else:
    logger.info("No sslmode found in DATABASE_URL query string for asyncpg special handling.")


# For async operations
async_engine = create_async_engine(ASYNC_DATABASE_URL_FOR_ENGINE, connect_args=connect_args)
AsyncSessionLocal = sessionmaker(
    bind=async_engine, class_=AsyncSession, expire_on_commit=False
)

# For synchronous operations (like init_db inspection), use the original DATABASE_URL
# Ensure it does not use the asyncpg dialect if the sync operations don't support it directly.
# psycopg2 (default sync driver) is fine here.
sync_db_url = DATABASE_URL
if "+asyncpg" in sync_db_url:
    sync_db_url = sync_db_url.replace("+asyncpg", "")
sync_engine = create_engine(sync_db_url)
SyncSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sync_engine)

Base = declarative_base()

# Database Models
class User(Base):
    __tablename__ = 'User'
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    clerkUserId = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    name = Column(String)
    industry = Column(String)
    targetRole = Column(String)  # Centralized target role for career focus
    experience = Column(Integer)
    skills = Column(ARRAY(String)) # Assuming PostgreSQL ARRAY, adjust if different DB
    bio = Column(String)
    googleCalendarRefreshToken = Column(Text, nullable=True)
    googleCalendarConnectedAt = Column(DateTime, nullable=True)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    Resumes = relationship('Resume', back_populates='user', uselist=False, cascade="all, delete-orphan")
    CoverLetters = relationship('CoverLetter', back_populates='user', cascade="all, delete-orphan")
    chat_history = relationship('ChatHistory', back_populates='user', cascade="all, delete-orphan")

class Resume(Base):
    __tablename__ = 'Resume'
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    userId = Column(String, ForeignKey('User.id'), unique=True)
    content = Column(Text, nullable=False)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    user = relationship('User', back_populates='Resumes')

class CoverLetter(Base):
    __tablename__ = 'CoverLetter'
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    userId = Column(String, ForeignKey('User.id'))
    content = Column(Text, nullable=False)
    jobTitle = Column(String)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    user = relationship('User', back_populates='CoverLetters')

class IndustryInsight(Base):
    __tablename__ = 'IndustryInsight'
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    chat_messages = relationship('ChatHistory', back_populates='industry_insight_rel')

class ChatHistory(Base):
    __tablename__ = 'ChatMessage'
    messageId = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    userId = Column(String, ForeignKey('User.id'))
    industryInsightId = Column(String, ForeignKey('IndustryInsight.id'), nullable=True)
    content = Column(Text, nullable=False)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)
    user = relationship("User", back_populates="chat_history")
    industry_insight_rel = relationship("IndustryInsight", back_populates="chat_messages")


# Initialize Database (using synchronous engine for inspection)
def init_db():
    db_session = SyncSessionLocal()
    try:
        inspector = inspect(sync_engine)
        existing_tables = inspector.get_table_names()
        logger.info(f"Existing tables: {existing_tables}")

        if 'User' in existing_tables: # Note: SQLAlchemy might use lowercase 'user'
            columns = [col['name'] for col in inspector.get_columns('User')] # Case-sensitive table name
            logger.info(f"Columns in 'User': {columns}")
            if 'clerkUserId' not in columns:
                logger.warning("Column 'clerkUserId' missing in 'User' table.")
            else:
                logger.info("Verified 'clerkUserId' column.")
        logger.info("Database schema inspection complete. Skipping table creation to preserve existing schema if any.")
        # If you want to create tables if they don't exist based on Base metadata:
        # Base.metadata.create_all(bind=sync_engine)
        # logger.info("Ensured all tables are created based on models.")
    finally:
        db_session.close()


# Initialize LLM
ollama_api_key = os.getenv("OLLAMA_API_KEY", os.getenv("OPENAI_API_KEY", ""))
ollama_base_url = os.getenv("OLLAMA_BASE_URL", "https://ollama.com/v1")
if not ollama_api_key:
    logger.error("OLLAMA_API_KEY not found.")
    raise RuntimeError("Missing OLLAMA_API_KEY environment variable")

from langchain_openai import ChatOpenAI
llm = ChatOpenAI(
    model="gpt-oss:20b-cloud",
    openai_api_key=ollama_api_key,
    base_url=ollama_base_url,
)
logger.info(f"Ollama Cloud LLM initialized. Base URL: {ollama_base_url}, Key prefix: {ollama_api_key[:4]}...")

# Test the LLM connection
try:
    test_result = llm.invoke("Say 'hello' in one word")
    logger.info(f"LLM test successful: {test_result.content}")
except Exception as e:
    logger.error(f"LLM test failed: {e}")


async def invoke_sync(runnable: Any, payload: dict[str, Any]) -> Any:
    """Run sync LangChain/Tavily invocations in a worker thread to avoid asyncio loop conflicts."""
    return await asyncio.to_thread(runnable.invoke, payload)


async def invoke_prompt_template(prompt: ChatPromptTemplate, payload: dict[str, Any]) -> str:
    """Render a chat prompt template and call Ollama synchronously in a worker thread."""
    try:
        chain = prompt | llm | StrOutputParser()
        result = await invoke_sync(chain, payload)
        return str(result).strip()
    except Exception as e:
        logger.error(f"invoke_prompt_template error: {e}")
        raise


# Validate Tavily API Key
if not os.getenv("TAVILY_API_KEY"):
    logger.critical("❌ TAVILY_API_KEY required for search functionality")
    raise RuntimeError("Missing TAVILY_API_KEY environment variable")

# Pydantic Input Models (Unchanged)
class DocumentInput(BaseModel):
    content: str = Field(description="Document content")
    target_role: Optional[str] = Field(None, description="Target role")
    industry: Optional[str] = Field(None, description="User's industry")
    job_description: Optional[str] = Field(None, description="Job description")
    company_name: Optional[str] = Field(None, description="Company name")

class JobSearchInput(BaseModel):
    keywords: List[str] = Field(description="Job title or skill keywords")
    location: Optional[str] = Field(None, description="Preferred job location")
    industry: Optional[str] = Field(None, description="Preferred industry")
    remote: Optional[bool] = Field(None, description="Whether looking for remote positions")

class CareerAdviceInput(BaseModel):
    current_role: Optional[str] = Field(None, description="User's current role")
    target_role: Optional[str] = Field(None, description="User's target role")
    industry: Optional[str] = Field(None, description="User's industry")
    skills: List[str] = Field(description="User's skills")
    experience_years: Optional[int] = Field(None, description="Years of experience")
    career_goals: Optional[str] = Field(None, description="User's career goals")

class EmailDraftInput(BaseModel):
    request_text: str = Field(description="Original user request for drafting the email")
    recipient: Optional[str] = Field(None, description="Recipient email if provided")
    sender_name: Optional[str] = Field(None, description="Sender display name")
    sender_role: Optional[str] = Field(None, description="Sender current role")
    industry: Optional[str] = Field(None, description="Sender industry")
    tone: Optional[str] = Field("professional", description="Preferred tone for the email")

class PrepScheduleInput(BaseModel):
    target_role: str = Field(description="Target role")
    timeline_weeks: Optional[int] = Field(None, description="Preparation timeline in weeks")
    current_skills: List[str] = Field(description="User's current skills")
    skills_to_develop: List[str] = Field(description="Skills to develop")
    has_resume: bool = Field(description="Whether user has a resume")
    has_cover_letter: bool = Field(description="Whether user has a cover letter")

class InterviewQuestionsInput(BaseModel):
    target_role: str = Field(description="Target role")
    industry: Optional[str] = Field(None, description="User's industry")
    skills: List[str] = Field(description="User's skills")

# Voice Interview Pydantic Models
class VoiceInterviewRoomRequest(BaseModel):
    roomName: str
    role: Optional[str] = Field("Software Engineer", description="Target job role")
    level: Optional[str] = Field("Mid-Level", description="Experience level")

class VoiceInterviewStartRequest(BaseModel):
    role: str = Field(description="Target job role")
    level: str = Field(description="Experience level")
    numQuestions: Optional[int] = Field(5, description="Number of questions")


# ============================================
# Agentic AI - Action Execution Models
# ============================================

class SendEmailInput(BaseModel):
    to: str = Field(description="Recipient email address")
    subject: str = Field(description="Email subject")
    html: str = Field(description="HTML email body")
    text: Optional[str] = Field(None, description="Plain text alternative")
    from_name: str = Field("ElevateAI", description="Sender name")
    user_id: Optional[str] = Field(None, description="Optional user ID for OAuth token lookup")
    email_type: Optional[str] = Field("general", description="Type of email")
    user_name: Optional[str] = Field(None, description="Recipient name")
    schedule_title: Optional[str] = Field(None, description="Schedule title (for schedule emails)")
    schedule_details: Optional[str] = Field(None, description="Schedule details (for schedule emails)")
    role: Optional[str] = Field(None, description="Job role (for interview emails)")
    interview_time: Optional[str] = Field(None, description="Interview time (for interview emails)")
    mentor_name: Optional[str] = Field(None, description="Mentor name (for mentorship emails)")
    session_time: Optional[str] = Field(None, description="Session time (for mentorship emails)")
    achievement_title: Optional[str] = Field(None, description="Achievement title")
    achievement_description: Optional[str] = Field(None, description="Achievement description")
    points_earned: Optional[int] = Field(0, description="Points earned")

class CreateCalendarEventInput(BaseModel):
    user_id: str = Field(description="User ID for OAuth token lookup")
    title: str = Field(description="Event title")
    start_time: str = Field(description="Start time (ISO 8601)")
    end_time: str = Field(description="End time (ISO 8601)")
    description: Optional[str] = Field(None, description="Event description")
    location: Optional[str] = Field(None, description="Event location")
    attendees: Optional[List[str]] = Field(default=[], description="Attendee emails")
    timezone: str = Field("UTC", description="Timezone")
    event_type: Optional[str] = Field("custom", description="Event type")
    recurrence: Optional[str] = Field(None, description="Recurrence rule")

class TrackJobApplicationInput(BaseModel):
    user_id: str = Field(description="User ID")
    company: str = Field(description="Company name")
    role: str = Field(description="Job title")
    job_url: str = Field(description="Job posting URL")
    location: Optional[str] = Field(None, description="Job location")
    salary_range: Optional[str] = Field(None, description="Salary range")
    remote: bool = Field(False, description="Is remote position")
    notes: Optional[str] = Field(None, description="Additional notes")

class ScheduleMentorshipInput(BaseModel):
    student_id: str = Field(description="Student user ID")
    mentor_id: str = Field(description="Mentor user ID")
    scheduled_time: str = Field(description="Session time (ISO 8601)")
    duration_minutes: int = Field(30, description="Duration in minutes")
    topic: Optional[str] = Field(None, description="Session topic")
    notes: Optional[str] = Field(None, description="Additional notes")

class UpdateProgressInput(BaseModel):
    user_id: str = Field(description="User ID")
    progress_type: str = Field(description="Type of progress update")
    lesson_id: Optional[str] = Field(None, description="Lesson ID")
    skill_name: Optional[str] = Field(None, description="Skill name")
    mastery_delta: Optional[int] = Field(None, description="Mastery points to add")
    metadata: Optional[dict] = Field(default=None, description="Additional metadata")


# Core Logic Functions (Async)
async def improve_document(input_data: DocumentInput, doc_type: str = "resume") -> str:
    try:
        # Determine placeholder values based on doc_type and input_data
        doc_type_name_val = "resume" if doc_type == "resume" else "cover letter"
        analysis_target_val = doc_type_name_val
        primary_focus_val = "ATS optimization" if doc_type == "resume" else "Job alignment"

        job_context_info_val = ""
        if doc_type == "cover_letter":
            jd_text = input_data.job_description or "Not provided"
            company_text = input_data.company_name or "Not specified"
            # Ensure the f-string here is clean if these fields are empty.
            if input_data.job_description or input_data.company_name:
                 job_context_info_val = f"Job description: {jd_text}\nCompany: {company_text}"
            # If both are empty/None, job_context_info_val remains ""

        # Define template strings with simple placeholders
        system_template = """You are an expert {doc_type_name} writer.
        Analyze the {analysis_target} and provide specific, actionable improvements.
        Focus on:
        1. Content improvements (achievements, metrics, action verbs)
        2. Structure and formatting
        3. {primary_focus}
        4. Industry-specific best practices
        5. Tailoring for the target role or company
        Provide examples of how to rewrite or improve sections."""

        user_template = """Content: {content}
Target role: {target_role}
Industry: {industry}
{job_context_info}""" # job_context_info will be an empty string if not applicable, effectively removing it

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_template),
            ("user", user_template)
        ])
        return await invoke_prompt_template(prompt, {
            "doc_type_name": doc_type_name_val,
            "analysis_target": analysis_target_val,
            "primary_focus": primary_focus_val,
            "content": input_data.content,
            "target_role": input_data.target_role or "Not specified",
            "industry": input_data.industry or "Not specified",
            "job_context_info": job_context_info_val
        })
    except Exception as e:
        # Log the specific input_data and doc_type for better debugging
        logger.error(f"Error in improve_document (doc_type: {doc_type}, input_data: {input_data}): {str(e)}", exc_info=True)
        raise

async def search_job_opportunities(input_data: JobSearchInput) -> str:
    try:
        query = " ".join(input_data.keywords)
        if input_data.industry:
            query += f" {input_data.industry}"
        if input_data.remote:
            query += " remote"
        if input_data.location:
            query += f" in {input_data.location}"

        search_tool = TavilySearchResults(max_results=5)
        # Ensure the input to .ainvoke is a dictionary
        search_results = await invoke_sync(search_tool, {"query": f"active job listings for {query}"})

        curated_results: list[dict[str, str]] = []
        if isinstance(search_results, list):
            for i, result in enumerate(search_results, 1):
                if not isinstance(result, dict):
                    continue

                url = str(result.get("url") or "").strip()
                if not url:
                    continue

                title = str(result.get("title") or f"Opportunity {i}").strip()
                summary = str(result.get("content", "")).replace("\n", " ").strip()
                if len(summary) > 260:
                    summary = summary[:257].rstrip() + "..."

                curated_results.append({
                    "title": title,
                    "url": url,
                    "summary": summary,
                })

        if not curated_results:
            return (
                "## Matching Job Opportunities\n\n"
                "I could not find high-confidence job links right now. "
                "Try a more specific query like `Python ML engineer remote India`."
            )

        formatted_results = "## Matching Job Opportunities\n\n"
        for i, item in enumerate(curated_results, 1):
            formatted_results += f"{i}. [{item['title']}]({item['url']})\n"
            if item["summary"]:
                formatted_results += f"   - Why it matches: {item['summary']}\n"
            formatted_results += "\n"

        formatted_results += (
            "### Next Steps\n"
            "- Tailor your resume to the top 2 roles above using role-specific keywords.\n"
            "- Apply to 3-5 roles, then follow up within 5 business days."
        )
        return formatted_results
    except Exception as e:
        logger.error(f"Error in search_job_opportunities: {str(e)}")
        raise

async def provide_career_advice(input_data: CareerAdviceInput) -> str:
    try:
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert career advisor.
            Provide personalized, actionable career advice based on the user's profile.
            Include:
            1. Career path recommendations
            2. Skills to develop
            3. Potential roles to target
            4. Industry-specific advice
            5. Networking suggestions
            Be specific and practical."""),
            ("user", """Current role: {current_role}
            Target role: {target_role}
            Industry: {industry}
            Skills: {skills}
            Years of experience: {experience_years}
            Career goals: {career_goals}""")
        ])
        return await invoke_prompt_template(prompt, {
            "current_role": input_data.current_role or "Not specified",
            "target_role": input_data.target_role or "Not specified",
            "industry": input_data.industry or "Not specified",
            "skills": ", ".join(input_data.skills) if input_data.skills else "Not specified",
            "experience_years": input_data.experience_years if input_data.experience_years is not None else "Not specified",
            "career_goals": input_data.career_goals or "Not specified"
        })
    except Exception as e:
        logger.error(f"Error in provide_career_advice: {str(e)}")
        raise

async def generate_email_draft(input_data: EmailDraftInput) -> dict[str, str]:
    try:
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert executive communication assistant.
Draft a polished email based on the user's request.

Rules:
1. Write a complete email with greeting, concise body, and sign-off.
2. Keep tone professional and clear.
3. If this is a follow-up request, make the email politely action-oriented.
4. Do not add fake details; use only what is present in the request/context.
5. Do not use placeholders like [Insert tasks] or [TBD].
6. If the user provides a plan, organize it with clean headings, bullet points, and a readable weekly structure.
7. Never include onboarding bio/profile summary details unless the user explicitly asks to include them in this email.
8. Output MUST follow exactly this format:
Subject: <one-line subject>
Body:
<plain text email body>
"""),
            ("user", """Request: {request_text}
Recipient: {recipient}
Sender Name: {sender_name}
Sender Role: {sender_role}
Industry: {industry}
Tone: {tone}
""")
        ])

        raw = await invoke_prompt_template(prompt, {
            "request_text": input_data.request_text[:8000],
            "recipient": input_data.recipient or "Not provided",
            "sender_name": input_data.sender_name or "Not provided",
            "sender_role": input_data.sender_role or "Not provided",
            "industry": input_data.industry or "Not provided",
            "tone": input_data.tone or "professional",
        })

        subject_match = re.search(r"(?im)^subject\s*:\s*(.+)$", raw)
        subject = subject_match.group(1).strip() if subject_match else "Professional Follow-Up"

        body = raw
        if subject_match:
            body = re.sub(r"(?im)^subject\s*:\s*.+$", "", body).strip()
        body = re.sub(r"(?im)^body\s*:\s*", "", body).strip()

        if not body:
            recipient_name = input_data.recipient or "there"
            body = (
                f"Hello {recipient_name},\n\n"
                "I wanted to follow up and share a quick update. Please let me know if you would like me to send any additional details.\n\n"
                "Best regards"
            )

        html = build_email_html_document(subject, body)

        return {
            "subject": subject,
            "body": body,
            "html": html,
        }
    except Exception as e:
        logger.error(f"Error in generate_email_draft: {str(e)}")
        raise

async def generate_preparation_schedule(input_data: PrepScheduleInput) -> str:
    try:
        timeline_weeks = input_data.timeline_weeks or 4
        current_date = datetime.datetime.now()

        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a world-class career strategist and execution coach.
Create a realistic, high-detail plan that is practical for someone balancing normal life constraints.

Output requirements:
1. Return clean markdown only.
2. Be specific and actionable, not generic advice.
3. Use this exact structure:

## Career Plan Overview
- Target role
- Timeline
- Weekly workload assumption
- Primary success criteria

## Skill Gap Priorities
- 4-6 priority gaps and why they matter for the role

## Week-by-Week Execution Plan
For each week include:
- Objective
- 3-5 concrete tasks
- Deliverable for the week
- Time budget split
- Interview/application action

## Portfolio / Project Plan
- 1 major project and 1 mini project with milestones and expected outcomes

## Networking and Job Search Engine
- Weekly outreach targets
- Referral strategy
- Application quality checklist

## Interview Prep Track
- Technical prep
- Behavioral prep
- Mock interview cadence

## Metrics Dashboard
- Leading indicators (weekly)
- Lagging indicators (monthly)

## Risk Mitigation
- Top 3 likely blockers and contingency plans

## 48-Hour Kickoff
- Exact actions to take in the next 48 hours

Important:
- Keep recommendations realistic for the given timeline.
- If timeline is short, prioritize high-impact activities and clearly state trade-offs.
- When possible, include concrete examples and resource suggestions with links."""),
            ("user", """Target role: {target_role}
            Timeline: {timeline_weeks_val} weeks
            Current skills: {current_skills}
            Skills to develop: {skills_to_develop}
            Has resume: {has_resume}
            Has cover_letter: {has_cover_letter}
            Current date: {current_date_str}""")
        ])
        return await invoke_prompt_template(prompt, {
            "target_role": input_data.target_role,
            "timeline_weeks_val": timeline_weeks, # Use renamed var
            "current_skills": ", ".join(input_data.current_skills) if input_data.current_skills else "Not specified",
            "skills_to_develop": ", ".join(input_data.skills_to_develop) if input_data.skills_to_develop else "Not specified",
            "has_resume": "Yes" if input_data.has_resume else "No",
            "has_cover_letter": "Yes" if input_data.has_cover_letter else "No",
            "current_date_str": current_date.strftime("%Y-%m-%d") # Use renamed var
        })
    except Exception as e:
        logger.error(f"Error in generate_preparation_schedule: {str(e)}")
        raise

async def generate_interview_questions(input_data: InterviewQuestionsInput) -> str:
    try:
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert career coach. Generate interview questions for the candidate.

IMPORTANT FORMAT REQUIREMENTS:
- Each question MUST end with a question mark (?)
- Number each question like: 1. Question text?
- Include a mix of behavioral and technical questions
- Keep questions clear and concise
- Do NOT include advice, tips, or explanations - just the questions

Generate 5-10 interview questions for the specified role."""),
            ("user", """Target role: {target_role}
Industry: {industry}
Skills: {skills}

Please provide numbered interview questions, each ending with a question mark.""")
        ])
        return await invoke_prompt_template(prompt, {
            "target_role": input_data.target_role,
            "industry": input_data.industry or "Not specified",
            "skills": ", ".join(input_data.skills) if input_data.skills else "Not specified"
        })
    except Exception as e:
        logger.error(f"Error in generate_interview_questions: {str(e)}")
        raise

# Agent State with pending actions support
class AgentState(TypedDict):
    messages: list[dict[str, Any]]
    user_profile: dict[str, Any]
    next_agent: str | None
    intent: str | None
    intent_params: dict[str, Any]  # Parameters extracted by intent detection
    task_completed: bool
    pending_actions: List[dict[str, Any]]  # Actions awaiting user confirmation


def extract_email_recipient(message: str) -> Optional[str]:
    if not message:
        return None
    email_match = re.search(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", message)
    if not email_match:
        return None
    return email_match.group().strip()

# Intent Detection (Async) - Hybrid: Deterministic + LLM for ambiguous cases
async def detect_intent(
    user_message: str,
    user_timezone: str = "UTC",
    user_timezone_offset_minutes: Optional[int] = None,
) -> dict:
    """
    Hybrid intent detection:
    1. First try deterministic keyword/regex matching (100% accurate for clear cases)
    2. Fall back to LLM for ambiguous cases
    Returns: {"intent": str, "confidence": float, "params": {}}
    """
    import re
    message = user_message.lower().strip()

    # === PRIORITY 1: Calendar Events (HIGHEST - must check first) ===
    # Check for ANY calendar-related intent first (including "add to calendar", "google calendar", etc.)
    calendar_patterns = [
        r"add.*to (my )?calendar", r"add (my )?.*to calendar",
        r"create (an? )?event", r"schedule.*calendar",
        r"put.*on calendar", r"on my calendar", r"to (my )?(google )?calendar",
        r"google calendar", r"add.*calendar", r"calendar event"
    ]
    for pattern in calendar_patterns:
        if re.search(pattern, message):
            return {
                "intent": "calendar_event",
                "confidence": 0.95,
                "params": extract_calendar_intent_params(
                    user_message,
                    user_timezone=user_timezone,
                    timezone_offset_minutes=user_timezone_offset_minutes,
                ),
            }

    # Special case: If message mentions BOTH interview AND calendar/event/schedule,
    # it's a calendar request (user wants to schedule, not get questions)
    has_interview = "interview" in message
    has_calendar_action = any(k in message for k in ["calendar", "schedule", "add event", "create event"])
    if has_interview and has_calendar_action:
        return {
            "intent": "calendar_event",
            "confidence": 0.98,
            "params": extract_calendar_intent_params(
                user_message,
                user_timezone=user_timezone,
                timezone_offset_minutes=user_timezone_offset_minutes,
            ),
        }

    # === PRIORITY 2: Job Search ===
    job_patterns = [
        r"search (for )?jobs", r"find (me )?jobs", r"job openings",
        r"job opportunities", r"hiring", r"job search", r"looking for jobs",
        r"find (a )?job", r"new job", r"job listings", r"jobs match.*skills"
    ]
    for pattern in job_patterns:
        if re.search(pattern, message):
            return {"intent": "job_search", "confidence": 0.95, "params": {}}

    # === PRIORITY 2b: Job Application Tracking (check before generic job search) ===
    if any(k in message for k in ["track application", "log application", "save application", "application for me"]):
        return {"intent": "job_search", "confidence": 0.85, "params": {"action": "track_application"}}

    # === PRIORITY 3: Mentorship Scheduling → Route to calendar_event_creator ===
    # Must check BEFORE preparation_schedule (since "schedule" + "week" would match that)
    if any(k in message for k in ["mentorship session", "mentor session", "schedule mentor", "book mentor", "find a mentor"]):
        return {
            "intent": "calendar_event",
            "confidence": 0.85,
            "params": {
                **extract_calendar_intent_params(
                    user_message,
                    user_timezone=user_timezone,
                    timezone_offset_minutes=user_timezone_offset_minutes,
                ),
                "action": "mentorship",
            },
        }

    # === PRIORITY 3b: Follow-up Reminders → Route to Calendar ===
    if any(k in message for k in ["follow-up reminder", "follow up reminder", "remind me to follow"]):
        return {
            "intent": "calendar_event",
            "confidence": 0.9,
            "params": {
                **extract_calendar_intent_params(
                    user_message,
                    user_timezone=user_timezone,
                    timezone_offset_minutes=user_timezone_offset_minutes,
                ),
                "action": "reminder",
            },
        }

    # === PRIORITY 4: Email Drafting (must run before schedule detection) ===
    # Use word boundaries so domains like "gmail.com" do not count as explicit "mail" intent.
    has_email_word = bool(re.search(r"\b(email|mail)\b", message))
    has_email_verb = bool(
        re.search(
            r"\b(draft|write|compose|create|prepare|send)\b.*\b(email|mail)\b|\b(email|mail)\b.*\b(draft|write|compose|create|prepare|send)\b",
            message,
        )
    )
    recipient = extract_email_recipient(user_message)

    # If user explicitly asks for an email draft or includes a recipient with email intent,
    # route to email drafter even when the message contains words like "plan" or "week".
    if has_email_word and (has_email_verb or recipient):
        return {
            "intent": "email_drafting",
            "confidence": 0.99,
            "params": {
                "action": "draft_email",
                "recipient": recipient,
            },
        }

    # === PRIORITY 5: Preparation Schedule ===
    has_schedule = any(k in message for k in ["schedule", "plan", "roadmap", "timeline"])
    has_timeframe = any(k in message for k in ["week", "month", "day", "30", "60", "90"])
    has_prep = any(k in message for k in ["prep", "preparation", "study", "learn"])
    if has_schedule and (has_timeframe or has_prep):
        return {"intent": "preparation_schedule", "confidence": 0.9, "params": {}}

    # === PRIORITY 6: Document Improvement ===
    doc_patterns = [
        r"improve (my )?resume", r"fix (my )?resume", r"resume review",
        r"cover letter", r"cv review", r"ats score", r"resume feedback",
        r"resume help", r"resume tips"
    ]
    for pattern in doc_patterns:
        if re.search(pattern, message):
            return {"intent": "document_improvement", "confidence": 0.95, "params": {}}

    # === PRIORITY 7: Interview Preparation ===
    interview_patterns = [
        r"interview questions", r"mock interview", r"interview prep",
        r"prepare for interview", r"interview practice", r"interview tips",
        r"common interview", r"behavioral interview", r"technical interview"
    ]
    for pattern in interview_patterns:
        if re.search(pattern, message):
            return {"intent": "interview_preparation", "confidence": 0.95, "params": {}}

    # === PRIORITY 8: Career Advice (catch-all for career-related) ===
    career_patterns = [
        r"career advice", r"career guidance", r"career path",
        r"career change", r"career growth", r"career development",
        r"how to advance", r"salary negotiation", r"promot"
    ]
    for pattern in career_patterns:
        if re.search(pattern, message):
            return {"intent": "career_advice", "confidence": 0.85, "params": {}}

    # === FALLBACK: LLM for ambiguous cases ===
    try:
        prompt = ChatPromptTemplate.from_messages([
            ("system", """Classify the user request into ONE intent:
- calendar_event: Add/create calendar events
- job_search: Find jobs, job opportunities
- preparation_schedule: Study plans, learning schedules
- interview_preparation: Interview questions, mock interviews
- document_improvement: Resume/CV/cover letter help
- email_drafting: Draft or compose an email
- career_advice: General career guidance

Return JSON: {"intent": "intent_name", "confidence": 0.8, "params": {}}"""),
            ("user", "{message}")
        ])

        result = await invoke_prompt_template(prompt, {"message": user_message})
        result_str = str(result).strip()

        # Clean markdown code blocks
        if result_str.startswith("```json"):
            result_str = result_str[7:]
        elif result_str.startswith("```"):
            result_str = result_str[3:]
        if result_str.endswith("```"):
            result_str = result_str[:-3]
        result_str = result_str.strip()

        parsed = json.loads(result_str)
        return parsed

    except Exception as e:
        logger.error(f"LLM intent detection failed: {str(e)}")
        # Ultimate fallback based on strongest signal
        if "calendar" in message:
            return {
                "intent": "calendar_event",
                "confidence": 0.5,
                "params": extract_calendar_intent_params(
                    user_message,
                    user_timezone=user_timezone,
                    timezone_offset_minutes=user_timezone_offset_minutes,
                ),
            }
        if "job" in message or "hiring" in message:
            return {"intent": "job_search", "confidence": 0.5, "params": {}}
        if "interview" in message:
            return {"intent": "interview_preparation", "confidence": 0.5, "params": {}}
        if "resume" in message or "cover" in message:
            return {"intent": "document_improvement", "confidence": 0.5, "params": {}}
        if "email" in message:
            return {
                "intent": "email_drafting",
                "confidence": 0.5,
                "params": {
                    "action": "draft_email",
                    "recipient": extract_email_recipient(user_message),
                },
            }
        if "schedule" in message or "plan" in message:
            return {"intent": "preparation_schedule", "confidence": 0.5, "params": {}}

        return {"intent": "career_advice", "confidence": 0.3, "params": {}}

# Supervisor Agent (Async)
async def supervisor_agent(state: AgentState) -> AgentState:
    try:
        latest_message_content = state["messages"][-1]["content"]
        user_timezone = state.get("user_profile", {}).get("timezone", "UTC")
        user_timezone_offset_minutes = state.get("user_profile", {}).get("timezone_offset_minutes")
        intent_result = await detect_intent(
            latest_message_content,
            user_timezone=user_timezone,
            user_timezone_offset_minutes=user_timezone_offset_minutes,
        )

        # intent_result is now a dict: {"intent": "...", "confidence": X, "params": {...}}
        intent_name = intent_result.get("intent", "career_advice")
        extracted_params = intent_result.get("params", {})

        intent_to_agent = {
            "document_improvement": "document_improver",
            "job_search": "job_searcher",
            "email_drafting": "email_drafter",
            "career_advice": "career_advisor",
            "preparation_schedule": "schedule_generator",
            "interview_preparation": "interview_preparer",
            "calendar_event": "calendar_event_creator"
        }
        state["intent"] = intent_name
        state["intent_params"] = extracted_params  # Store extracted params for downstream agents
        state["next_agent"] = intent_to_agent.get(intent_name, "career_advisor")
        state["task_completed"] = False
        logger.info(f"Supervisor assigned intent: {intent_name} (confidence: {intent_result.get('confidence', 0):.2f}), routing to: {state['next_agent']}, params: {extracted_params}")
        return state
    except Exception as e:
        logger.error(f"Error in supervisor_agent: {str(e)}")
        state["messages"].append({"role": "assistant", "content": f"Sorry, I had trouble understanding your request. Error: {str(e)}"})
        state["task_completed"] = True
        state["next_agent"] = None
        return state
        return state

# Agent Functions (Async)
async def document_improver(state: AgentState) -> AgentState:
    try:
        user_profile = state.get("user_profile", {})
        latest_message_content = state["messages"][-1]["content"]
        latest_message_lower = latest_message_content.lower()
        doc_type = "resume" if "resume" in latest_message_lower else "cover_letter"

        content_key = "resume_content" if doc_type == "resume" else "cover_letter_content"
        content = user_profile.get(content_key, "")
        if not content:
            state["messages"].append({"role": "assistant", "content": f"It seems I don't have your {doc_type} content. Please provide it first."})
            state["task_completed"] = True
            return state

        target_role = None
        job_description = None
        company_name = None

        # LLM call to extract structured info from the latest message
        if "target role" in latest_message_lower or "job description" in latest_message_lower or "company" in latest_message_lower:
            extraction_prompt_text = """From the user's message, extract the following if available:
            - target_role: The job role the user is aiming for.
            - job_description: The job description text.
            - company_name: The name of the company.
            Return this as a JSON string. If a field is not mentioned, use null for its value.
            User message: {user_query_for_extraction}"""
            
            extract_prompt = ChatPromptTemplate.from_template(extraction_prompt_text)
            extracted_str = await invoke_prompt_template(extract_prompt, {"user_query_for_extraction": latest_message_content})
            
            try:
                extracted_data = json.loads(extracted_str)
                target_role = extracted_data.get("target_role")
                job_description = extracted_data.get("job_description")
                company_name = extracted_data.get("company_name")
            except json.JSONDecodeError:
                logger.warning(f"Could not parse JSON for document details: {extracted_str}")


        result = await improve_document(DocumentInput(
            content=content,
            target_role=target_role or user_profile.get("current_role"), # Fallback to profile
            industry=user_profile.get("industry"),
            job_description=job_description,
            company_name=company_name
        ), doc_type)

        state["messages"].append({"role": "assistant", "content": format_markdown_response(result)})
        state["task_completed"] = True
        return state
    except Exception as e:
        logger.error(f"Error in document_improver: {str(e)}")
        state["messages"].append({"role": "assistant", "content": f"Sorry, I encountered an error while trying to improve your document: {str(e)}"})
        state["task_completed"] = True
        return state

async def job_searcher(state: AgentState) -> AgentState:
    try:
        user_profile = state.get("user_profile", {})
        latest_message_content = state["messages"][-1]["content"]
        latest_message_lower = latest_message_content.lower()
        
        extracted_keywords = []
        extracted_location = None
        extracted_industry = None
        search_remote = "remote" in latest_message_lower

        # Lightweight parser for common patterns without depending on LLM extraction.
        if "find jobs for" in latest_message_lower:
            kw_part = latest_message_lower.split("find jobs for", 1)[-1].split(" in ")[0]
            extracted_keywords = [kw.strip() for kw in kw_part.split(",") if kw.strip()]

        if " in " in latest_message_lower:
            extracted_location = latest_message_content.split(" in ", 1)[-1].strip()

        for token in ["python", "tensorflow", "pytorch", "ml", "ai", "data science", "backend", "full stack"]:
            if token in latest_message_lower and token not in extracted_keywords:
                extracted_keywords.append(token)


        final_keywords = extracted_keywords if extracted_keywords else user_profile.get("skills", [])[:5]
        if not final_keywords and "keywords" not in latest_message_lower : # if no keywords and user didnt specify it
             state["messages"].append({"role": "assistant", "content": "Please specify some keywords for your job search (e.g., 'software engineer', 'marketing manager')."})
             state["task_completed"] = True
             return state


        result = await search_job_opportunities(JobSearchInput(
            keywords=final_keywords,
            location=extracted_location, # Use LLM extracted or None
            industry=extracted_industry or user_profile.get("industry"), # Use LLM extracted or profile
            remote=search_remote
        ))

        state["messages"].append({"role": "assistant", "content": format_markdown_response(result)})
        state["task_completed"] = True
        return state
    except Exception as e:
        logger.error(f"Error in job_searcher: {str(e)}")
        state["messages"].append({"role": "assistant", "content": f"Sorry, I encountered an error while searching for jobs: {str(e)}"})
        state["task_completed"] = True
        return state

async def email_drafter(state: AgentState) -> AgentState:
    try:
        user_profile = state.get("user_profile", {})
        latest_message_content = state["messages"][-1]["content"]
        intent_params = state.get("intent_params", {}) or {}

        recipient = intent_params.get("recipient") or extract_email_recipient(latest_message_content)
        draft = await generate_email_draft(EmailDraftInput(
            request_text=latest_message_content,
            recipient=recipient,
            sender_name=user_profile.get("name"),
            sender_role=user_profile.get("targetRole") or user_profile.get("current_role"),
            industry=user_profile.get("industry"),
            tone="professional",
        ))

        assistant_message = (
            "I've drafted a professional email for you.\n\n"
            f"**Subject:** {draft['subject']}\n\n"
            f"{draft['body']}"
        )

        if recipient:
            assistant_message += f"\n\nI also prepared a send action to **{recipient}**. Please confirm it in the UI to send."
        else:
            assistant_message += "\n\nI can also queue this for sending if you share the recipient email address."

        state["messages"].append({"role": "assistant", "content": assistant_message})

        if "pending_actions" not in state:
            state["pending_actions"] = []

        if recipient:
            state["pending_actions"].append({
                "type": "SEND_EMAIL",
                "title": "Send Drafted Email",
                "description": f"Send drafted email to {recipient}",
                "params": {
                    "to": recipient,
                    "subject": draft["subject"],
                    "html": draft["html"],
                    "text": draft["body"],
                    "from_name": "ElevateAI",
                    "email_type": "draft",
                    "user_name": user_profile.get("name", "User"),
                },
                "metadata": {
                    "priority": "high",
                    "icon": "mail",
                }
            })
            logger.info(f"Created pending drafted-email action to {recipient}")

        state["task_completed"] = True
        return state
    except Exception as e:
        logger.error(f"Error in email_drafter: {str(e)}")
        state["messages"].append({"role": "assistant", "content": f"Sorry, I encountered an error while drafting the email: {str(e)}"})
        state["task_completed"] = True
        return state

async def career_advisor(state: AgentState) -> AgentState:
    try:
        user_profile = state.get("user_profile", {})
        latest_message_content = state["messages"][-1]["content"]
        latest_message_lower = latest_message_content.lower()
        intent_params = state.get("intent_params", {}) or {}

        # Backward compatibility: if upstream still routes draft email to career_advisor,
        # delegate to dedicated email_drafter flow.
        if intent_params.get("action") == "draft_email":
            return await email_drafter(state)

        target_role = None
        career_goals = None

        # Detect email sending requests
        wants_email = any(k in latest_message_lower for k in ["email it", "email me", "send email", "send to email", "send an email"])
        email_recipient = None

        # Extract email recipient if mentioned
        email_recipient = extract_email_recipient(latest_message_content)

        # LLM call to extract structured info
        if "target role" in latest_message_lower or "career goal" in latest_message_lower or "advice on" in latest_message_lower:
            extraction_prompt_text = """From the user's message, extract the following for career advice:
            - target_role: The job role the user is aiming for.
            - career_goals: The user's stated career goals.
            Return this as a JSON string. If a field is not mentioned, use null.
            User message: {user_query_for_extraction}"""

            extract_prompt = ChatPromptTemplate.from_template(extraction_prompt_text)
            extracted_str = await invoke_prompt_template(extract_prompt, {"user_query_for_extraction": latest_message_content})

            try:
                extracted_data = json.loads(extracted_str)
                target_role = extracted_data.get("target_role")
                career_goals = extracted_data.get("career_goals")
            except json.JSONDecodeError:
                logger.warning(f"Could not parse JSON for career advice details: {extracted_str}")

        # Fallback for career_goals if not extracted by LLM but "goal" is in message
        if not career_goals and "goal" in latest_message_lower:
            career_goals = latest_message_content # Use the full message as potential goal statement

        result = await provide_career_advice(CareerAdviceInput(
            current_role=user_profile.get("current_role"),
            target_role=target_role, # Use LLM extracted or None
            industry=user_profile.get("industry"),
            skills=user_profile.get("skills", []),
            experience_years=user_profile.get("experience_years"), # Can be None
            career_goals=career_goals # Use LLM extracted/fallback or None
        ))

        state["messages"].append({"role": "assistant", "content": format_markdown_response(result)})

        # Initialize pending_actions if not exists
        if "pending_actions" not in state:
            state["pending_actions"] = []

        # Create pending email action if requested
        if wants_email and email_recipient:
            state["pending_actions"].append({
                "type": "SEND_EMAIL",
                "title": "Send Career Advice via Email",
                "description": f"Email the career advice to {email_recipient}",
                "params": {
                    "to": email_recipient,
                    "subject": "Your Career Advice from ElevateAI",
                    "html": build_email_html_document("Career Advice", result),
                    "text": result,
                    "from_name": "ElevateAI",
                    "email_type": "career_advice",
                    "user_name": user_profile.get("name", "User")
                },
                "metadata": {
                    "priority": "medium",
                    "icon": "mail"
                }
            })
            logger.info(f"Created pending email action to {email_recipient}")

        state["task_completed"] = True
        return state
    except Exception as e:
        logger.error(f"Error in career_advisor: {str(e)}")
        state["messages"].append({"role": "assistant", "content": f"Sorry, I encountered an error while providing career advice: {str(e)}"})
        state["task_completed"] = True
        return state

async def schedule_generator(state: AgentState) -> AgentState:
    try:
        user_profile = state.get("user_profile", {})
        latest_message_content = state["messages"][-1]["content"]
        latest_message_lower = latest_message_content.lower()

        target_role = user_profile.get("current_role", "your target role") # Default
        timeline_weeks = 4 # Default

        # Detect action requests (email, calendar)
        wants_calendar = any(k in latest_message_lower for k in ["add to calendar", "calendar event", "google calendar", "schedule in calendar"])

        # Extract email recipient if mentioned, then infer email intent.
        email_recipient = extract_email_recipient(latest_message_content)
        wants_email_phrase = any(
            k in latest_message_lower
            for k in ["email it", "email me", "send email", "send to email", "send an email", "email of"]
        )
        wants_email = wants_email_phrase or (
            email_recipient is not None and any(k in latest_message_lower for k in ["send", "mail", "share"])
        )

        # LLM call to extract structured info
        if "target role" in latest_message_lower or "timeline" in latest_message_lower or "schedule for" in latest_message_lower:
            extraction_prompt_text = """From the user's message, extract the following for generating a schedule:
            - target_role: The job role the user is aiming for.
            - timeline_weeks: The preparation timeline in weeks (as an integer).
            Return this as a JSON string. If a field is not mentioned, use null for target_role and a default (e.g. 4) for timeline_weeks.
            User message: {user_query_for_extraction}"""

            extract_prompt = ChatPromptTemplate.from_template(extraction_prompt_text)
            extracted_str = await invoke_prompt_template(extract_prompt, {"user_query_for_extraction": latest_message_content})

            try:
                extracted_data = json.loads(extracted_str)
                if extracted_data.get("target_role"):
                    target_role = extracted_data.get("target_role")
                if extracted_data.get("timeline_weeks") is not None:
                    timeline_weeks = int(extracted_data.get("timeline_weeks"))
            except (json.JSONDecodeError, ValueError): # Catch parsing or int conversion errors
                logger.warning(f"Could not parse JSON or timeline_weeks for schedule details: {extracted_str}")

        if target_role == "your target role" and "target role" not in latest_message_lower: # if default and user didnt specify it
             state["messages"].append({"role": "assistant", "content": "Please specify the target role for which you want a preparation schedule."})
             state["task_completed"] = True
             return state


        result = await generate_preparation_schedule(PrepScheduleInput(
            target_role=target_role,
            timeline_weeks=timeline_weeks,
            current_skills=user_profile.get("skills", []),
            skills_to_develop=["Advanced " + s for s in user_profile.get("skills", [])[:3] if s], # Ensure s is not empty
            has_resume=bool(user_profile.get("resume_content")),
            has_cover_letter=bool(user_profile.get("cover_letter_content"))
        ))

        state["messages"].append({"role": "assistant", "content": format_markdown_response(result)})

        # Initialize pending_actions if not exists
        if "pending_actions" not in state:
            state["pending_actions"] = []

        # Create pending action for email
        if wants_email:
            email_to = email_recipient or user_profile.get("email", "user@example.com")
            user_name = user_profile.get("name", "User")
            schedule_markdown = (
                f"Hi {user_name},\n\n"
                f"Here is your personalized {timeline_weeks}-week preparation schedule for {target_role}.\n\n"
                f"{result}"
            )
            state["pending_actions"].append({
                "type": "SEND_EMAIL",
                "title": "Send Schedule via Email",
                "description": f"Email the {target_role} preparation schedule to {email_to}",
                "params": {
                    "to": email_to,
                    "subject": f"{target_role} Preparation Schedule - ElevateAI",
                    "html": build_email_html_document(
                        f"{target_role} Preparation Schedule",
                        schedule_markdown,
                    ),
                    "email_type": "schedule",
                    "schedule_title": f"{target_role} Prep Schedule",
                    "schedule_details": result,
                    "user_name": user_name
                },
                "metadata": {
                    "priority": "high",
                    "icon": "mail"
                }
            })
            logger.info(f"Created pending email action for schedule to {email_to}")

        # Create pending action for calendar (create multiple events)
        if wants_calendar:
            user_timezone = user_profile.get("timezone", "UTC")
            user_timezone_offset_minutes = user_profile.get("timezone_offset_minutes")
            resolved_tz_name, _ = _resolve_timezone(user_timezone, user_timezone_offset_minutes)
            display_timezone = (user_timezone or "").strip() or resolved_tz_name
            # Extract time from user's message if specified
            inferred_start, inferred_end = infer_calendar_time_range_from_text(
                latest_message_content,
                user_timezone=resolved_tz_name,
                timezone_offset_minutes=user_timezone_offset_minutes,
            )

            if inferred_start and inferred_end:
                start_time = inferred_start
                end_time = inferred_end
            else:
                # Fallback: tomorrow +3 hours if no time specified
                start_time = datetime.datetime.utcnow() + datetime.timedelta(days=1, hours=3)
                end_time = start_time + datetime.timedelta(hours=1)

            state["pending_actions"].append({
                "type": "CREATE_CALENDAR_EVENT",
                "title": "Add Study Session to Calendar",
                "description": f"Create calendar event for {target_role} study session",
                "params": {
                    "user_id": user_profile.get("clerkUserId"),
                    "title": f"{target_role} Study Session",
                    "start_time": start_time.isoformat() + "Z",
                    "end_time": end_time.isoformat() + "Z",
                    "description": f"Study session for {target_role} preparation. Timeline: {timeline_weeks} weeks.",
                    "event_type": "study_session",
                    "timezone": display_timezone,
                },
                "metadata": {
                    "priority": "medium",
                    "icon": "calendar"
                }
            })
            logger.info(f"Created pending calendar action for schedule at {start_time.isoformat()}Z")

        state["task_completed"] = True
        return state
    except Exception as e:
        logger.error(f"Error in schedule_generator: {str(e)}")
        state["messages"].append({"role": "assistant", "content": f"Sorry, I encountered an error while generating the schedule: {str(e)}"})
        state["task_completed"] = True
        return state

async def interview_preparer(state: AgentState) -> AgentState:
    try:
        user_profile = state.get("user_profile", {})
        latest_message_content = state["messages"][-1]["content"]
        latest_message_lower = latest_message_content.lower()

        target_role = user_profile.get("current_role", "your target role") # Default

        # LLM call to extract structured info
        if "target role" in latest_message_lower or "interview questions for" in latest_message_lower:
            extraction_prompt_text = """From the user's message, extract the target_role for interview preparation.
            Return this as a JSON string with a single key "target_role". If not mentioned, use null.
            User message: {user_query_for_extraction}"""

            extract_prompt = ChatPromptTemplate.from_template(extraction_prompt_text)
            extracted_str = await invoke_prompt_template(extract_prompt, {"user_query_for_extraction": latest_message_content})

            try:
                extracted_data = json.loads(extracted_str)
                if extracted_data.get("target_role"):
                    target_role = extracted_data.get("target_role")
            except json.JSONDecodeError:
                logger.warning(f"Could not parse JSON for interview prep details: {extracted_str}")

        if target_role == "your target role" and "target role" not in latest_message_lower: # if default and user didnt specify it
             state["messages"].append({"role": "assistant", "content": "Please specify the target role for which you need interview questions."})
             state["task_completed"] = True
             return state

        result = await generate_interview_questions(InterviewQuestionsInput(
            target_role=target_role,
            industry=user_profile.get("industry"),
            skills=user_profile.get("skills", [])
        ))

        state["messages"].append({"role": "assistant", "content": format_markdown_response(result)})
        state["task_completed"] = True
        return state
    except Exception as e:
        logger.error(f"Error in interview_preparer: {str(e)}")
        state["messages"].append({"role": "assistant", "content": f"Sorry, I encountered an error while preparing interview questions: {str(e)}"})
        state["task_completed"] = True
        return state

async def calendar_event_creator(state: AgentState) -> AgentState:
    """
    Creates a single calendar event based on user request.
    Uses pre-extracted params from intent detection for accurate time parsing.
    """
    try:
        user_profile = state.get("user_profile", {})
        user_timezone = user_profile.get("timezone", "UTC")
        user_timezone_offset_minutes = user_profile.get("timezone_offset_minutes")
        resolved_tz_name, resolved_tzinfo = _resolve_timezone(
            user_timezone,
            user_timezone_offset_minutes,
        )
        display_timezone = (user_timezone or "").strip() or resolved_tz_name
        intent_params = state.get("intent_params", {})
        latest_message = state["messages"][-1]["content"] if state.get("messages") else ""
        message_params = extract_calendar_intent_params(
            latest_message,
            user_timezone=resolved_tz_name,
            timezone_offset_minutes=user_timezone_offset_minutes,
        )

        # Resolve params with deterministic user-text extraction taking precedence for reliability.
        title = message_params.get("title") or intent_params.get("title") or "Calendar Event"

        intent_description = (intent_params.get("description") or "").strip()
        if not intent_description or intent_description.lower() == "scheduled event":
            description = message_params.get("description") or "Scheduled event"
        else:
            description = intent_description

        start_time_str = message_params.get("start_time") or intent_params.get("start_time")
        end_time_str = message_params.get("end_time") or intent_params.get("end_time")
        event_type = message_params.get("event_type") or intent_params.get("event_type") or "custom"

        inferred_start_time, inferred_end_time = infer_calendar_time_range_from_text(
            latest_message,
            user_timezone=resolved_tz_name,
            timezone_offset_minutes=user_timezone_offset_minutes,
        )

        # Parse times from extracted strings; explicit user phrasing should win.
        try:
            parsed_start_time = parse_iso_datetime_to_utc_naive(
                start_time_str,
                assume_timezone=resolved_tz_name,
                timezone_offset_minutes=user_timezone_offset_minutes,
            )
            parsed_end_time = parse_iso_datetime_to_utc_naive(
                end_time_str,
                assume_timezone=resolved_tz_name,
                timezone_offset_minutes=user_timezone_offset_minutes,
            )

            if parsed_start_time:
                start_time = parsed_start_time
            elif inferred_start_time:
                start_time = inferred_start_time
            else:
                start_time = datetime.datetime.utcnow() + datetime.timedelta(days=1, hours=3)

            if parsed_end_time:
                end_time = parsed_end_time
            elif inferred_end_time:
                end_time = inferred_end_time
            else:
                end_time = start_time + datetime.timedelta(hours=1)

            if end_time <= start_time:
                end_time = start_time + datetime.timedelta(hours=1)
        except (ValueError, TypeError) as e:
            logger.warning(f"Time parsing failed: {e}, using default")
            if inferred_start_time and inferred_end_time:
                start_time = inferred_start_time
                end_time = inferred_end_time
            else:
                start_time = datetime.datetime.utcnow() + datetime.timedelta(days=1, hours=3)
                end_time = start_time + datetime.timedelta(hours=1)

        logger.info(
            "Calendar event resolved params | title=%s | start=%s | end=%s | from_intent=%s | from_message=%s",
            title,
            start_time.isoformat(),
            end_time.isoformat(),
            intent_params,
            message_params,
        )

        # Create pending calendar action
        if "pending_actions" not in state:
            state["pending_actions"] = []

        state["pending_actions"].append({
            "type": "CREATE_CALENDAR_EVENT",
            "title": f"Add {title} to Calendar",
            "description": f"Create calendar event: {title}",
            "params": {
                "user_id": user_profile.get("clerkUserId"),
                "title": title,
                "start_time": start_time.isoformat() + "Z",
                "end_time": end_time.isoformat() + "Z",
                "description": description,
                "event_type": event_type,
                "timezone": display_timezone,
            },
            "metadata": {
                "priority": "medium",
                "icon": "calendar"
            }
        })

        logger.info(f"Created pending calendar event action: {title}")

        display_start = start_time.replace(tzinfo=datetime.timezone.utc).astimezone(resolved_tzinfo)
        display_end = end_time.replace(tzinfo=datetime.timezone.utc).astimezone(resolved_tzinfo)

        state["messages"].append({
            "role": "assistant",
            "content": f"I've created a calendar event for **{title}**.\n\n**Event Details:**\n- **Time:** {display_start.strftime('%B %d, %Y at %I:%M %p')} to {display_end.strftime('%I:%M %p')} ({display_timezone})\n- **Description:** {description}\n\nPlease confirm the action below to add this to your Google Calendar."
        })

        state["task_completed"] = True
        return state
    except Exception as e:
        logger.error(f"Error in calendar_event_creator: {str(e)}")
        state["messages"].append({"role": "assistant", "content": f"Sorry, I encountered an error while creating the calendar event: {str(e)}"})
        state["task_completed"] = True
        return state


# Router: Decides the next step in the graph
def router_logic(state: AgentState) -> Literal[
    "supervisor", "document_improver", "job_searcher",
    "career_advisor", "email_drafter", "schedule_generator", "interview_preparer",
    "calendar_event_creator", "__end__"
]:
    if state.get("task_completed"): # If any agent marked task as completed (or errored out)
        return "__end__"
    if state.get("next_agent"): # If supervisor set a next agent
        return state["next_agent"]
    return "supervisor" # Default back to supervisor if no clear next step (should be rare)


# Create Workflow
def create_career_advisor_graph():
    try:
        logger.info("Creating career advisor graph")
        workflow = StateGraph(AgentState)

        # Define nodes
        workflow.add_node("supervisor", supervisor_agent)
        workflow.add_node("document_improver", document_improver)
        workflow.add_node("job_searcher", job_searcher)
        workflow.add_node("career_advisor", career_advisor)
        workflow.add_node("email_drafter", email_drafter)
        workflow.add_node("schedule_generator", schedule_generator)
        workflow.add_node("interview_preparer", interview_preparer)
        workflow.add_node("calendar_event_creator", calendar_event_creator)

        logger.info("Nodes added to workflow.")

        # Set entry point
        workflow.set_entry_point("supervisor")
        logger.info("Set entry point to supervisor")

        # Define edges
        # Supervisor routes to one of the agents or ends the process
        agent_nodes_map = {
            "document_improver": "document_improver",
            "job_searcher": "job_searcher",
            "career_advisor": "career_advisor",
            "email_drafter": "email_drafter",
            "schedule_generator": "schedule_generator",
            "interview_preparer": "interview_preparer",
            "calendar_event_creator": "calendar_event_creator",
            "__end__": "__end__" # Ensure supervisor can also route to end
        }
        workflow.add_conditional_edges(
            "supervisor",
            router_logic, # router_logic will check state["next_agent"] set by supervisor
            agent_nodes_map
        )
        logger.info("Added supervisor conditional edges.")

        # After each agent runs, it goes to the router_logic, which decides if it should end or go back to supervisor
        # (typically, agents set task_completed=True, so router_logic sends to "__end__")
        agent_node_names = ["document_improver", "job_searcher", "career_advisor", "email_drafter", "schedule_generator", "interview_preparer", "calendar_event_creator"]
        for node_name in agent_node_names:
            workflow.add_conditional_edges(
                node_name,
                router_logic, # Router checks task_completed
                {
                    "__end__": "__end__", # If task_completed is True
                    "supervisor": "supervisor" # Should not happen if agent sets task_completed
                }
            )
            logger.info(f"Added conditional edges for {node_name}")

        logger.info("Compiling workflow...")
        career_graph = workflow.compile()
        logger.info("Workflow compiled successfully.")
        return career_graph
    except Exception as e:
        logger.error(f"Error creating career advisor graph: {str(e)}", exc_info=True)
        raise


# Initialize Graph Once
graph = create_career_advisor_graph()


# Pydantic model for chat request
class ChatRequest(BaseModel):
    message: str
    clerkUserId: str
    timezone: Optional[str] = "UTC"
    timezoneOffsetMinutes: Optional[int] = None

# FastAPI Dependency for DB Session
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        async with session.begin(): # Optional: Use begin for auto-rollback on error within session block
            yield session

@app.post('/api/chat', response_model=dict) # Added response_model for clarity
async def chat_endpoint(
    request_data: ChatRequest,
    db: AsyncSession = Depends(get_db_session)
):
    try:
        user_message_content = request_data.message
        clerk_user_id = request_data.clerkUserId
        request_timezone = (request_data.timezone or "UTC").strip() or "UTC"
        request_timezone_offset = request_data.timezoneOffsetMinutes

        if not clerk_user_id:
            raise HTTPException(status_code=400, detail="clerkUserId is required")

        # Fetch user
        stmt_user = (
            select(User)
            .where(User.clerkUserId == clerk_user_id)
            .options(
                selectinload(User.Resumes), # Use selectinload for eager loading
                selectinload(User.CoverLetters) # Use selectinload for eager loading
            )
        )
        result_user = await db.execute(stmt_user)
        user = result_user.scalar_one_or_none()


        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        user_resume_content = user.Resumes.content if user.Resumes else ''
        user_cover_letter_content = user.CoverLetters[0].content if user.CoverLetters and len(user.CoverLetters) > 0 else ''


        user_profile = {
            'clerkUserId': clerk_user_id,
            'email': user.email,
            'name': user.name or user.email.split('@')[0],
            'resume_content': user_resume_content,
            'cover_letter_content': user_cover_letter_content,
            'skills': user.skills or [],
            'industry': user.industry or '',
            'targetRole': user.targetRole or '',  # Centralized target role from DB
            'experience_years': user.experience if user.experience is not None else 0,
            'current_role': user.targetRole or '',
            'timezone': request_timezone,
            'timezone_offset_minutes': request_timezone_offset,
        }

        stmt_history = select(ChatHistory).where(ChatHistory.userId == user.id).order_by(ChatHistory.createdAt.asc()).limit(20) # Increased limit slightly
        result_history = await db.execute(stmt_history)
        chat_history_db_models = result_history.scalars().all()

        messages_for_graph = []
        if chat_history_db_models:
          
            for i, msg_model in enumerate(chat_history_db_models):
            
                messages_for_graph.append({"role": "user", "content": msg_model.content})


        # Add current user message
        messages_for_graph.append({"role": "user", "content": user_message_content})


        initial_state = AgentState(
            messages=messages_for_graph,
            user_profile=user_profile,
            next_agent=None, # Supervisor will determine this
            intent=None, # Supervisor will determine this
            task_completed=False,
            pending_actions=[]  # Initialize empty pending actions
        )
        print(user_profile)
        logger.info(f"Invoking graph with initial state. Messages count: {len(initial_state['messages'])}")
        
        final_state = await graph.ainvoke(initial_state, {"recursion_limit": 10}) # Added recursion limit
        logger.info(f"Graph invoked. Final state messages count: {len(final_state['messages'])}")

        assistant_response_content = "Could not get a response." # Default
        if final_state and final_state.get("messages"):
            # The last message SHOULD be from the assistant.
            last_message_in_state = final_state["messages"][-1]
            if last_message_in_state.get("role") == "assistant":
                assistant_response_content = last_message_in_state["content"]
            else:
                # If the last message isn't from assistant, it might be an error or unhandled state.
                # We'll send the content of the last message anyway.
                assistant_response_content = f"It seems I couldn't fully process that. The last internal message was: {last_message_in_state.get('content', 'No content found.')}"
                logger.warning(f"Last message in final_state was not from assistant: {last_message_in_state.get('role')}")
        else:
            logger.error("No messages found in final_state from graph.")


   
        try:
            # Save user's message
            user_msg_db = ChatHistory(
                userId=user.id,
                # role="user" #  <-- Would be ideal if schema supported it
                content=user_message_content,
                createdAt=datetime.datetime.now(datetime.UTC) # Ensure timestamp for ordering
            )
            db.add(user_msg_db)

            # Save assistant's response
            if assistant_response_content:
                assistant_msg_db = ChatHistory(
                    userId=user.id, # Still associating with user ID due to schema
                    content=assistant_response_content,
                    # role="assistant" # <-- Would be ideal
                    createdAt=datetime.datetime.now(datetime.UTC) # Ensure it's later or has distinct timestamp
                )
                db.add(assistant_msg_db)
            
            await db.commit() # Commit both
            logger.info("Chat messages (user and assistant) saved to DB.")
        except Exception as db_error:
            await db.rollback()
            logger.error(f"Error saving chat history to DB: {str(db_error)}", exc_info=True)
            # Don't let DB error stop the response to user, but they should know
            # assistant_response_content += " (Warning: Could not save this interaction to history)" # Optional warning

        # Get pending actions from final state
        pending_actions = final_state.get("pending_actions", [])

        return {
            'status': 'success',
            'response': format_markdown_response(assistant_response_content),
            'history': final_state["messages"], # Full history from the graph
            'pending_actions': pending_actions  # Return pending actions for UI confirmation
        }

    except HTTPException as he:
        logger.error(f"HTTPException in chat endpoint: {he.detail}", exc_info=True)
        raise he
    except Exception as e:
        logger.error(f"Unexpected error in chat endpoint: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected server error occurred: {str(e)}")


# ============================================
# LiveKit Voice Interview Endpoints
# ============================================

LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "")

class VoiceInterviewQuestion(BaseModel):
    id: str
    question: str
    category: str
    difficulty: str

@app.post("/api/livekit/token")
async def get_livekit_token(request_data: VoiceInterviewRoomRequest):
    """Generate a LiveKit room token for voice interview."""
    if not LIVEKIT_AVAILABLE:
        raise HTTPException(status_code=503, detail="LiveKit SDK not available")

    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        raise HTTPException(status_code=500, detail="LiveKit credentials not configured")

    try:
        from livekit.api import VideoGrants

        # Create access token with interview-specific permissions using builder pattern
        grants = VideoGrants(
            room_join=True,
            room_admin=True,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True,
            can_publish_sources=True,
        )
        grants.room = request_data.roomName  # Explicitly set room for room_join

        token = (AccessToken(api_key=LIVEKIT_API_KEY, api_secret=LIVEKIT_API_SECRET)
            .with_identity(f"interviewer-{request_data.roomName}")
            .with_name(f"Interview Agent - {request_data.role}")
            .with_metadata({
                "role": request_data.role,
                "level": request_data.level,
                "type": "voice-interview"
            })
            .with_grants(grants)
        )

        # Generate token
        token_str = token.to_jwt()

        return {
            "token": token_str,
            "roomName": request_data.roomName,
            "wsUrl": LIVEKIT_URL
        }
    except Exception as e:
        logger.error(f"Error generating LiveKit token: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate token: {str(e)}")


@app.post("/api/voice-interview/start")
async def start_voice_interview(request_data: VoiceInterviewStartRequest):
    """Start a voice interview session and generate questions."""
    try:
        # Generate interview questions using the existing interview_preparer logic
        questions_input = InterviewQuestionsInput(
            target_role=request_data.role,
            industry="",
            skills=[]
        )

        # Generate questions via LLM
        questions_text = await generate_interview_questions(questions_input)

        # Parse questions from LLM response - extract actual questions from markdown
        questions = parse_questions_from_llm_response(questions_text, request_data.role, request_data.numQuestions)

        return {
            "questions": [q.model_dump() for q in questions],
            "role": request_data.role,
            "level": request_data.level
        }
    except Exception as e:
        logger.error(f"Error starting voice interview: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start interview: {str(e)}")


def parse_questions_from_llm_response(llm_response: str, role: str, num_questions: int) -> List[VoiceInterviewQuestion]:
    """Parse LLM response to extract actual interview questions."""
    questions = []

    # Split by lines and look for numbered questions
    lines = llm_response.split('\n')
    # More robust patterns that capture questions ending with ?
    question_patterns = [
        r'^\d+[\.\)]\s*([^?]+[?])',  # "1. Question?" or "1) Question?"
        r'^\*\s+\d+[\.\)]\s*([^?]+[?])',  # "* 1. Question?"
        r'^-\s+\d+[\.\)]\s*([^?]+[?])',  # "- 1. Question?"
        r'^\d+\.\s*\*\*([^*]+)\*\*',  # "1. **Question text**"
    ]

    current_category = "behavioral"
    current_difficulty = "easy"
    difficulty_cycle = 0

    for line in lines:
        line = line.strip()
        if not line or line.startswith('#'):
            continue

        # Detect category from headings
        line_lower = line.lower()
        if "behavioral" in line_lower and ("question" in line_lower or "section" in line_lower):
            current_category = "behavioral"
            continue
        elif "technical" in line_lower and ("question" in line_lower or "section" in line_lower):
            current_category = "technical"
            continue
        elif "problem-solving" in line_lower or ("problem" in line_lower and "solving" in line_lower):
            current_category = "problem-solving"
            continue
        elif "system" in line_lower and "design" in line_lower:
            current_category = "system-design"
            continue

        # Check if line contains a question
        for pattern in question_patterns:
            match = re.match(pattern, line, re.IGNORECASE)
            if match:
                question_text = match.group(1).strip()
                # Clean up any markdown
                question_text = question_text.replace('**', '').strip()
                # Validate it looks like a real question
                if len(question_text) > 15 and '?' in question_text:
                    questions.append(VoiceInterviewQuestion(
                        id=f"q-{len(questions) + 1}",
                        question=question_text,
                        category=current_category,
                        difficulty=current_difficulty
                    ))
                    # Cycle difficulty
                    difficulty_cycle += 1
                    if difficulty_cycle % 3 == 0:
                        current_difficulty = "easy"
                    elif difficulty_cycle % 3 == 1:
                        current_difficulty = "medium"
                    else:
                        current_difficulty = "hard"
                break

        # Stop if we have enough questions
        if len(questions) >= num_questions:
            break

    # If parsing failed or got too few questions, create fallback questions
    if len(questions) < num_questions:
        fallback_templates = [
            f"Tell me about yourself and why you are interested in the {role} position.",
            "Describe a challenging technical problem you recently solved. What was your approach?",
            "How do you handle working under pressure or tight deadlines?",
            "Explain a time when you had to make a difficult technical decision. What trade-offs did you consider?",
            "What are your career goals and how does this role align with them?",
            "Describe a project where you had to work with a difficult team member. How did you handle it?",
            "What technical skills or technologies are you most excited about right now?",
            "Tell me about a time you failed at something. What did you learn?",
            "How do you stay current with new technologies and industry trends?",
            "Describe a situation where you had to explain a technical concept to a non-technical audience.",
        ]

        existing_count = len(questions)
        for i in range(min(num_questions - existing_count, len(fallback_templates))):
            fallback_idx = i % len(fallback_templates)
            # Avoid duplicates
            if any(q.question == fallback_templates[fallback_idx] for q in questions):
                continue
            questions.append(VoiceInterviewQuestion(
                id=f"q-{len(questions) + 1}",
                question=fallback_templates[fallback_idx],
                category="behavioral" if i % 2 == 0 else "technical",
                difficulty="easy" if i < 2 else "medium" if i < 5 else "hard"
            ))

    return questions[:num_questions]


@app.post("/api/voice-interview/finish")
async def finish_voice_interview(request_data: dict):
    """Finish voice interview and generate feedback."""
    try:
        responses = request_data.get("responses", [])
        duration = request_data.get("duration", 0)

        # Generate feedback using LLM
        feedback_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert interviewer providing constructive feedback.
            Analyze the candidate's performance and provide:
            1. Overall assessment
            2. Strengths demonstrated
            3. Areas for improvement
            4. Specific recommendations
            Be encouraging but honest."""),
            ("user", """Interview duration: {duration} minutes
            Questions asked and answers given:
            {responses}

            Provide detailed feedback on the candidate's performance.""")
        ])

        responses_text = "\n".join([
            f"Q: {r.get('question', 'N/A')}\nA: {r.get('answer', 'N/A')}"
            for r in responses
        ])

        feedback = await invoke_prompt_template(feedback_prompt, {
            "duration": str(duration),
            "responses": responses_text or "No transcript available"
        })

        return {
            "feedback": {
                "summary": feedback,
                "duration": duration
            }
        }
    except Exception as e:
        logger.error(f"Error finishing voice interview: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate feedback: {str(e)}")


# ============================================
# Agentic AI - Action Execution Endpoints
# ============================================

@app.post("/api/tools/send_email")
async def send_email_tool(input_data: SendEmailInput):
    """Send email via Gmail API. Used by AI agents for notifications."""
    try:
        from tools.email import EmailTool
        email_tool = EmailTool()

        html_payload = (input_data.html or "").strip()
        html_lower = html_payload.lower()

        looks_like_raw_markdown = bool(
            re.search(r"(?m)^\s*#{1,6}\s+", html_payload)
            or re.search(r"(?m)^\s*\|.+\|\s*$", html_payload)
            or "||" in html_payload
            or re.search(r"\*\*[^*]+\*\*", html_payload)
        )

        has_rich_html_tags = any(tag in html_lower for tag in ["<html", "<table", "<p", "<h1", "<h2", "<ul", "<ol"])

        if not has_rich_html_tags or looks_like_raw_markdown:
            source_markdown = input_data.text or html_payload or ""
            html_payload = build_email_html_document(input_data.subject, source_markdown)

        return await email_tool.send_email(
            to=input_data.to,
            subject=input_data.subject,
            html=html_payload,
            text=input_data.text,
            from_name=input_data.from_name,
            user_id=input_data.user_id,
        )
    except Exception as e:
        logger.error(f"Error sending email: {e}")
        return {"success": False, "error": str(e)}


def _google_oauth_redirect_uri() -> str:
    return os.getenv("GOOGLE_OAUTH_REDIRECT_URI", "https://elevate-ai-flask.onrender.com/api/google/callback")


def _google_state_serializer() -> URLSafeSerializer:
    secret = os.getenv("GOOGLE_OAUTH_STATE_SECRET") or os.getenv("CLERK_SECRET_KEY") or os.getenv("OLLAMA_API_KEY", "dev-secret")
    return URLSafeSerializer(secret_key=secret, salt="google-oauth-state")


def _google_oauth_client_config() -> Optional[dict[str, Any]]:
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")

    if client_id and client_secret:
        return {
            "web": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": os.getenv("GOOGLE_TOKEN_URI", "https://oauth2.googleapis.com/token"),
                "redirect_uris": [_google_oauth_redirect_uri()],
            }
        }

    credentials_file = os.getenv("GOOGLE_CREDENTIALS_FILE")
    if not credentials_file:
        return None

    if not os.path.exists(credentials_file):
        logger.warning("GOOGLE_CREDENTIALS_FILE not found: %s", credentials_file)
        return None

    try:
        with open(credentials_file, "r", encoding="utf-8") as f:
            config = json.load(f)

        if not isinstance(config, dict) or ("web" not in config and "installed" not in config):
            logger.warning("GOOGLE_CREDENTIALS_FILE must contain 'web' or 'installed' OAuth client config")
            return None

        return config
    except Exception as exc:
        logger.warning("Failed to parse GOOGLE_CREDENTIALS_FILE: %s", exc)
        return None


def _append_query_params(base_url: str, params: dict[str, str]) -> str:
    parsed = urlparse(base_url)
    existing = parse_qs(parsed.query)
    for key, value in params.items():
        existing[key] = [value]
    new_query = urlencode(existing, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


@app.get("/api/google/connect")
async def google_connect(
    clerk_user_id: str = Query(..., description="Clerk user id to bind Google OAuth connection"),
    next_url: Optional[str] = Query(None, description="Optional frontend URL to redirect to after callback"),
    auto_redirect: bool = Query(True, description="When true, immediately redirect browser to Google consent screen"),
):
    """Start Google OAuth consent flow for calendar access."""
    if not GOOGLE_CALENDAR_AVAILABLE:
        raise HTTPException(status_code=503, detail="Google OAuth dependencies are not installed")

    client_config = _google_oauth_client_config()
    if not client_config:
        raise HTTPException(
            status_code=500,
            detail="Google OAuth client configuration missing. Set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET or GOOGLE_CREDENTIALS_FILE.",
        )

    state_payload = {
        "clerk_user_id": clerk_user_id,
        "next_url": next_url or os.getenv("GOOGLE_OAUTH_SUCCESS_REDIRECT", "https://elevate-ai-snowy.vercel.app/profile?google_calendar=connected"),
    }
    state = _google_state_serializer().dumps(state_payload)

    flow = Flow.from_client_config(client_config, scopes=SCOPES, state=state)
    flow.redirect_uri = _google_oauth_redirect_uri()

    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )

    if auto_redirect:
        return RedirectResponse(url=auth_url)

    return {"success": True, "auth_url": auth_url}


@app.get("/api/google/callback")
async def google_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
):
    """Handle Google OAuth callback, exchange code, and persist refresh token to DB."""
    if error:
        failure_url = os.getenv("GOOGLE_OAUTH_FAILURE_REDIRECT", "https://elevate-ai-snowy.vercel.app/profile?google_calendar=failed")
        return RedirectResponse(url=_append_query_params(failure_url, {"reason": error}))

    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing OAuth code or state")

    try:
        state_data = _google_state_serializer().loads(state)
    except BadSignature:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    clerk_user_id = state_data.get("clerk_user_id") if isinstance(state_data, dict) else None
    next_url = state_data.get("next_url") if isinstance(state_data, dict) else None
    if not clerk_user_id:
        raise HTTPException(status_code=400, detail="Missing user context in OAuth state")

    client_config = _google_oauth_client_config()
    if not client_config:
        raise HTTPException(status_code=500, detail="Google OAuth client configuration is missing")

    flow = Flow.from_client_config(client_config, scopes=SCOPES, state=state)
    flow.redirect_uri = _google_oauth_redirect_uri()
    flow.fetch_token(code=code)

    credentials = flow.credentials
    if not credentials or not credentials.refresh_token:
        # This can happen if consent was previously granted without prompt=consent.
        failure_url = os.getenv("GOOGLE_OAUTH_FAILURE_REDIRECT", "https://elevate-ai-snowy.vercel.app/profile?google_calendar=failed")
        return RedirectResponse(
            url=_append_query_params(
                failure_url,
                {"reason": "no_refresh_token", "hint": "revoke_app_access_and_reconnect"},
            )
        )

    async with AsyncSessionLocal() as db:
        stmt = select(User).where(User.clerkUserId == clerk_user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="User not found for provided clerk_user_id")

        user.googleCalendarRefreshToken = credentials.refresh_token
        user.googleCalendarConnectedAt = datetime.datetime.utcnow()
        await db.commit()

    success_url = next_url or os.getenv("GOOGLE_OAUTH_SUCCESS_REDIRECT", "https://elevate-ai-snowy.vercel.app/profile?google_calendar=connected")
    return RedirectResponse(url=_append_query_params(success_url, {"google_calendar": "connected"}))


@app.post("/api/tools/create_calendar_event")
async def create_calendar_event_tool(input_data: CreateCalendarEventInput):
    """Create Google Calendar event. Used by AI agents for scheduling."""
    try:
        if not GOOGLE_CALENDAR_AVAILABLE:
            logger.warning("Google Calendar not configured, returning mock response")
            return {
                "success": True,
                "mock": True,
                "event": {
                    "title": input_data.title,
                    "start_time": input_data.start_time,
                    "end_time": input_data.end_time,
                    "description": input_data.description,
                    "attendees": input_data.attendees,
                }
            }

        calendar_tool = CalendarTool()
        start_time = datetime.datetime.fromisoformat(input_data.start_time.replace("Z", "+00:00"))
        end_time = datetime.datetime.fromisoformat(input_data.end_time.replace("Z", "+00:00"))

        result = await calendar_tool.create_event(
            title=input_data.title,
            start_time=start_time,
            end_time=end_time,
            description=input_data.description,
            location=input_data.location,
            attendees=input_data.attendees,
            timezone=input_data.timezone,
            recurrence=input_data.recurrence,
            user_id=input_data.user_id,
        )

        return result
    except Exception as e:
        logger.error(f"Error creating calendar event: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/tools/track_job_application")
async def track_job_application_tool(input_data: TrackJobApplicationInput):
    """Track a job application in the database."""
    try:
        async with AsyncSessionLocal() as db:
            async with db.begin():
                # Import the model
                from app import JobApplication, ApplicationStatus

                application = JobApplication(
                    userId=input_data.user_id,
                    company=input_data.company,
                    role=input_data.role,
                    jobUrl=input_data.job_url,
                    location=input_data.location,
                    salaryRange=input_data.salary_range,
                    remote=input_data.remote,
                    status=ApplicationStatus.TRACKING,
                    notes=input_data.notes,
                    followUpDate=datetime.datetime.utcnow() + timedelta(days=7)
                )

                db.add(application)
                await db.commit()
                await db.refresh(application)

                return {
                    "success": True,
                    "application_id": application.id,
                    "application": {
                        "id": application.id,
                        "company": input_data.company,
                        "role": input_data.role,
                        "status": "TRACKING",
                        "follow_up_date": application.followUpDate.isoformat() if application.followUpDate else None
                    }
                }
    except Exception as e:
        logger.error(f"Error tracking job application: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/tools/schedule_mentorship")
async def schedule_mentorship_tool(input_data: ScheduleMentorshipInput):
    """Schedule a mentorship session."""
    try:
        async with AsyncSessionLocal() as db:
            async with db.begin():
                from app import MentorshipSession, SessionStatus

                session = MentorshipSession(
                    mentorId=input_data.mentor_id,
                    studentId=input_data.student_id,
                    scheduledAt=datetime.datetime.fromisoformat(input_data.scheduled_time.replace("Z", "+00:00")),
                    durationMinutes=input_data.duration_minutes,
                    status=SessionStatus.SCHEDULED,
                    notes=input_data.notes
                )

                db.add(session)
                await db.commit()
                await db.refresh(session)

                return {
                    "success": True,
                    "session_id": session.id,
                    "session": {
                        "id": session.id,
                        "mentor_id": input_data.mentor_id,
                        "student_id": input_data.student_id,
                        "scheduled_at": session.scheduledAt.isoformat(),
                        "duration_minutes": input_data.duration_minutes
                    }
                }
    except Exception as e:
        logger.error(f"Error scheduling mentorship: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/tools/update_progress")
async def update_user_progress_tool(input_data: UpdateProgressInput):
    """Update user learning progress."""
    try:
        async with AsyncSessionLocal() as db:
            async with db.begin():
                from app import LessonProgress, Enrollment, UserSkillProgress, SkillNode, ProgressStatus

                result = {"success": True, "updates": []}

                # Handle lesson completion
                if input_data.progress_type == "lesson_completed" and input_data.lesson_id:
                    enrollment = await db.execute(
                        select(Enrollment).where(Enrollment.userId == input_data.user_id)
                    )
                    enrollment = enrollment.scalar_one_or_none()

                    if enrollment:
                        progress = await db.execute(
                            select(LessonProgress).where(
                                LessonProgress.enrollmentId == enrollment.id,
                                LessonProgress.lessonId == input_data.lesson_id
                            )
                        )
                        progress = progress.scalar_one_or_none()

                        if progress:
                            progress.status = ProgressStatus.COMPLETED
                            progress.completedAt = datetime.datetime.utcnow()
                        else:
                            progress = LessonProgress(
                                enrollmentId=enrollment.id,
                                lessonId=input_data.lesson_id,
                                status=ProgressStatus.COMPLETED,
                                completedAt=datetime.datetime.utcnow()
                            )
                            db.add(progress)

                        result["updates"].append({"type": "lesson_completed", "lesson_id": input_data.lesson_id})

                # Handle skill mastery update
                if input_data.progress_type == "skill_mastery" and input_data.skill_name and input_data.mastery_delta:
                    skill = await db.execute(
                        select(SkillNode).where(SkillNode.name == input_data.skill_name)
                    )
                    skill = skill.scalar_one_or_none()

                    if skill:
                        user_skill = await db.execute(
                            select(UserSkillProgress).where(
                                UserSkillProgress.userId == input_data.user_id,
                                UserSkillProgress.skillId == skill.id
                            )
                        )
                        user_skill = user_skill.scalar_one_or_none()

                        if user_skill:
                            user_skill.masteryLevel += input_data.mastery_delta
                            user_skill.lastPracticed = datetime.datetime.utcnow()
                        else:
                            user_skill = UserSkillProgress(
                                userId=input_data.user_id,
                                skillId=skill.id,
                                masteryLevel=input_data.mastery_delta,
                                lastPracticed=datetime.datetime.utcnow()
                            )
                            db.add(user_skill)

                        result["updates"].append({
                            "type": "skill_mastery",
                            "skill": input_data.skill_name,
                            "delta": input_data.mastery_delta
                        })

                await db.commit()
                return result
    except Exception as e:
        logger.error(f"Error updating progress: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/tools/list")
async def list_available_tools():
    """List all available agentic AI tools."""
    return {
        "tools": [
            {
                "name": "send_email",
                "endpoint": "/api/tools/send_email",
                "method": "POST",
                "description": "Send email notifications via Gmail API"
            },
            {
                "name": "create_calendar_event",
                "endpoint": "/api/tools/create_calendar_event",
                "method": "POST",
                "description": "Create Google Calendar events"
            },
            {
                "name": "track_job_application",
                "endpoint": "/api/tools/track_job_application",
                "method": "POST",
                "description": "Track job applications in the database"
            },
            {
                "name": "schedule_mentorship",
                "endpoint": "/api/tools/schedule_mentorship",
                "method": "POST",
                "description": "Schedule mentorship sessions"
            },
            {
                "name": "update_progress",
                "endpoint": "/api/tools/update_progress",
                "method": "POST",
                "description": "Update user learning progress"
            }
        ]
    }


# ============================================
# Simulation Endpoints
# ============================================

class SimulationInput(BaseModel):
    scenario_id: str = Field(description="Simulation scenario ID")
    user_response: str = Field(description="User's response to the scenario")
    context: Optional[dict] = Field(default=None, description="Additional context")

class SimulationResponse(BaseModel):
    feedback: str
    score: Optional[int] = None
    suggestions: List[str] = []
    next_prompt: Optional[str] = None

@app.post("/api/simulation/evaluate")
async def evaluate_simulation(input_data: SimulationInput):
    """Evaluate a simulation response and provide feedback."""
    try:
        # Generate AI feedback based on the scenario and response
        evaluation_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert evaluator for technical simulations.
            Analyze the user's response and provide:
            1. Constructive feedback on their approach
            2. A score from 0-100
            3. Specific suggestions for improvement
            4. A follow-up question to deepen the discussion

            Be encouraging but honest. Focus on practical engineering trade-offs."""),
            ("user", """Scenario: {scenario}
            User Response: {response}

            Provide detailed evaluation and feedback.""")
        ])

        # Get scenario details based on scenario_id
        scenarios = {
            "api-design": "Design a rate-limiter for a public API. Consider algorithms like Token Bucket or Leaky Bucket, and where to store state.",
            "system-design": "Design a URL shortening service like bit.ly. Consider scalability, database choices, and caching strategies.",
            "debugging": "Debug a production issue where API latency spikes randomly. Describe your debugging approach.",
            "negotiation": "Negotiate a technical decision with a stakeholder who wants to cut corners on testing.",
        }

        scenario = scenarios.get(input_data.scenario_id, input_data.scenario_id)

        feedback = await invoke_prompt_template(evaluation_prompt, {
            "scenario": scenario,
            "response": input_data.user_response
        })

        # Parse feedback to extract score and suggestions
        score = None
        suggestions = []
        next_prompt = None

        # Try to extract score from feedback
        score_match = re.search(r'score[:\s]+(\d+)', feedback.lower())
        if score_match:
            score = int(score_match.group(1))
        else:
            # Estimate score based on response quality (simple heuristic)
            if len(input_data.user_response) > 200:
                score = min(85, 60 + len(input_data.user_response) // 50)
            else:
                score = max(40, len(input_data.user_response) // 10)

        # Extract suggestions (look for numbered or bulleted lists)
        suggestion_patterns = [
            r'[\d\.]+\s+([A-Z][^.!?]+[.!?])',
            r'[-*•]\s+([A-Z][^.!?]+[.!?])',
        ]
        for pattern in suggestion_patterns:
            matches = re.findall(pattern, feedback)
            suggestions.extend(matches[:3])  # Limit to 3 suggestions

        # Extract next prompt (look for follow-up questions)
        question_matches = re.findall(r'[^.!?]+\?', feedback)
        if question_matches:
            next_prompt = question_matches[-1].strip()

        return {
            "feedback": feedback,
            "score": score,
            "suggestions": suggestions[:3],
            "next_prompt": next_prompt
        }
    except Exception as e:
        logger.error(f"Error evaluating simulation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to evaluate: {str(e)}")


@app.get("/api/simulation/scenarios")
async def list_simulation_scenarios():
    """List available simulation scenarios."""
    return {
        "scenarios": [
            {
                "id": "api-design",
                "title": "API Rate Limiter Design",
                "description": "Design a rate-limiter for a public API",
                "difficulty": "intermediate",
                "category": "system-design"
            },
            {
                "id": "system-design",
                "title": "URL Shortener Service",
                "description": "Design a scalable URL shortening service",
                "difficulty": "intermediate",
                "category": "system-design"
            },
            {
                "id": "debugging",
                "title": "Production Debugging",
                "description": "Debug random API latency spikes",
                "difficulty": "advanced",
                "category": "technical"
            },
            {
                "id": "negotiation",
                "title": "Technical Negotiation",
                "description": "Negotiate testing standards with stakeholders",
                "difficulty": "intermediate",
                "category": "soft-skill"
            }
        ]
    }


if __name__ == "__main__":
    init_db() 

    logger.info("Starting FastAPI server with Uvicorn.")
    port = int(os.getenv("PORT", "5000")) # Default to 5000 if not set
    uvicorn.run(app, host="0.0.0.0", port=port)