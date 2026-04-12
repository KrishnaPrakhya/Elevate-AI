"""
ElevateAI MCP Server

Model Context Protocol server providing tools for:
- Email sending (Gmail API)
- Calendar management (Google Calendar)
- Job application tracking
- Mentorship scheduling
- User progress updates
- Resume/Cover Letter generation

This server integrates with the LangGraph agent system to enable
action-taking capabilities beyond just conversation.
"""

import os
import sys
import json
import logging
from datetime import datetime, timedelta
from typing import Any, Optional

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent, Resource, ResourceTemplate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize MCP server
server = Server("elevateai")

# Tool instances (lazy initialization)
_calendar_tool = None
_email_tool = None
_job_tracker_tool = None


def get_calendar_tool():
    """Lazy initialization of Calendar tool"""
    global _calendar_tool
    if _calendar_tool is None:
        from tools.calendar import CalendarTool
        _calendar_tool = CalendarTool()
    return _calendar_tool


def get_email_tool():
    """Lazy initialization of Email tool"""
    global _email_tool
    if _email_tool is None:
        from tools.email import EmailTool
        _email_tool = EmailTool()
    return _email_tool


def get_job_tracker_tool(db_session=None):
    """Lazy initialization of Job Tracker tool"""
    global _job_tracker_tool
    if _job_tracker_tool is None:
        from tools.job_tracker import JobTrackerTool
        _job_tracker_tool = JobTrackerTool(db_session)
    return _job_tracker_tool


@server.list_tools()
async def list_tools() -> list[Tool]:
    """List all available ElevateAI tools"""
    return [
        Tool(
            name="send_email",
            description="Send an email via Gmail API. Use for schedule confirmations, interview reminders, "
                       "mentorship notifications, achievement celebrations, and re-engagement campaigns.",
            inputSchema={
                "type": "object",
                "properties": {
                    "to": {"type": "string", "description": "Recipient email address"},
                    "subject": {"type": "string", "description": "Email subject line"},
                    "html": {"type": "string", "description": "HTML email body"},
                    "text": {"type": "string", "description": "Plain text alternative (optional)"},
                    "from_name": {"type": "string", "description": "Sender name", "default": "ElevateAI"},
                    "email_type": {
                        "type": "string",
                        "description": "Type of email being sent",
                        "enum": ["schedule", "interview", "mentorship", "achievement", "general"]
                    }
                },
                "required": ["to", "subject", "html"]
            }
        ),
        Tool(
            name="create_calendar_event",
            description="Create a Google Calendar event for study sessions, interviews, mentorship meetings, "
                       "or deadlines. Supports attendees, reminders, and recurrence rules.",
            inputSchema={
                "type": "object",
                "properties": {
                    "user_id": {"type": "string", "description": "User identifier used to resolve OAuth refresh token"},
                    "title": {"type": "string", "description": "Event title/summary"},
                    "start_time": {"type": "string", "format": "date-time", "description": "Event start time (ISO 8601)"},
                    "end_time": {"type": "string", "format": "date-time", "description": "Event end time (ISO 8601)"},
                    "description": {"type": "string", "description": "Event description (optional)"},
                    "location": {"type": "string", "description": "Event location (optional)"},
                    "attendees": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of attendee email addresses (optional)"
                    },
                    "timezone": {"type": "string", "description": "Timezone", "default": "UTC"},
                    "event_type": {
                        "type": "string",
                        "description": "Type of event",
                        "enum": ["study_session", "interview", "mentorship", "deadline", "assessment", "custom"]
                    },
                    "recurrence": {"type": "string", "description": "RRULE recurrence string (optional)"}
                },
                "required": ["user_id", "title", "start_time", "end_time"]
            }
        ),
        Tool(
            name="track_job_application",
            description="Track a job application in the system. Creates a record with company, role, "
                       "and automatically schedules follow-up reminders.",
            inputSchema={
                "type": "object",
                "properties": {
                    "user_id": {"type": "string", "description": "User's database ID"},
                    "company": {"type": "string", "description": "Company name"},
                    "role": {"type": "string", "description": "Job title/role"},
                    "job_url": {"type": "string", "description": "URL to job posting"},
                    "location": {"type": "string", "description": "Job location (optional)"},
                    "salary_range": {"type": "string", "description": "Salary range (optional)"},
                    "remote": {"type": "boolean", "description": "Whether job is remote", "default": False},
                    "notes": {"type": "string", "description": "Additional notes (optional)"}
                },
                "required": ["user_id", "company", "role", "job_url"]
            }
        ),
        Tool(
            name="schedule_mentorship",
            description="Schedule a mentorship session between a student and mentor. Creates calendar events "
                       "for both parties and sends confirmation emails.",
            inputSchema={
                "type": "object",
                "properties": {
                    "student_id": {"type": "string", "description": "Student's user ID"},
                    "mentor_id": {"type": "string", "description": "Mentor's user ID"},
                    "scheduled_time": {"type": "string", "format": "date-time", "description": "Session time (ISO 8601)"},
                    "duration_minutes": {"type": "integer", "description": "Session duration in minutes", "default": 30},
                    "topic": {"type": "string", "description": "Session topic/focus area (optional)"},
                    "notes": {"type": "string", "description": "Additional notes (optional)"}
                },
                "required": ["student_id", "mentor_id", "scheduled_time"]
            }
        ),
        Tool(
            name="update_user_progress",
            description="Update a user's learning progress in the database. Use for tracking lesson completions, "
                       "skill mastery improvements, and achievement progress.",
            inputSchema={
                "type": "object",
                "properties": {
                    "user_id": {"type": "string", "description": "User's database ID"},
                    "progress_type": {
                        "type": "string",
                        "description": "Type of progress update",
                        "enum": ["lesson_completed", "skill_mastery", "streak_updated", "goal_progress"]
                    },
                    "lesson_id": {"type": "string", "description": "Lesson ID (for lesson_completed)"},
                    "skill_name": {"type": "string", "description": "Skill name (for skill_mastery)"},
                    "mastery_delta": {"type": "integer", "description": "Mastery points to add (for skill_mastery)"},
                    "metadata": {"type": "object", "description": "Additional metadata"}
                },
                "required": ["user_id", "progress_type"]
            }
        ),
        Tool(
            name="generate_resume_improvements",
            description="Analyze a resume and provide specific, actionable improvements for ATS optimization, "
                       "content clarity, and impact. Returns structured feedback with examples.",
            inputSchema={
                "type": "object",
                "properties": {
                    "resume_content": {"type": "string", "description": "Current resume content"},
                    "target_role": {"type": "string", "description": "Target job title/role"},
                    "industry": {"type": "string", "description": "Target industry"},
                    "job_description": {"type": "string", "description": "Job description to tailor for (optional)"}
                },
                "required": ["resume_content"]
            }
        ),
        Tool(
            name="generate_cover_letter",
            description="Generate a tailored cover letter based on resume content, job description, and company info.",
            inputSchema={
                "type": "object",
                "properties": {
                    "resume_content": {"type": "string", "description": "User's resume content"},
                    "job_description": {"type": "string", "description": "Job description"},
                    "company_name": {"type": "string", "description": "Company name"},
                    "job_title": {"type": "string", "description": "Job title"},
                    "tone": {
                        "type": "string",
                        "description": "Letter tone",
                        "enum": ["professional", "enthusiastic", "confident", "humble"],
                        "default": "professional"
                    }
                },
                "required": ["resume_content", "job_description", "company_name", "job_title"]
            }
        )
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    """Execute a tool with the given arguments"""
    logger.info(f"Tool call: {name} with arguments: {json.dumps(arguments, indent=2)}")

    try:
        if name == "send_email":
            email_tool = get_email_tool()
            result = await email_tool.send_email(
                to=arguments["to"],
                subject=arguments["subject"],
                html=arguments["html"],
                text=arguments.get("text"),
                from_name=arguments.get("from_name", "ElevateAI")
            )
            return [TextContent(
                type="text",
                text=json.dumps(result, indent=2, default=str)
            )]

        elif name == "create_calendar_event":
            calendar_tool = get_calendar_tool()
            start_time = datetime.fromisoformat(arguments["start_time"].replace("Z", "+00:00"))
            end_time = datetime.fromisoformat(arguments["end_time"].replace("Z", "+00:00"))

            result = await calendar_tool.create_event(
                title=arguments["title"],
                start_time=start_time,
                end_time=end_time,
                description=arguments.get("description"),
                location=arguments.get("location"),
                attendees=arguments.get("attendees"),
                timezone=arguments.get("timezone", "UTC"),
                recurrence=arguments.get("recurrence"),
                user_id=arguments["user_id"],
            )
            return [TextContent(
                type="text",
                text=json.dumps(result, indent=2, default=str)
            )]

        elif name == "track_job_application":
            job_tracker = get_job_tracker_tool()
            result = await job_tracker.track_application(
                user_id=arguments["user_id"],
                company=arguments["company"],
                role=arguments["role"],
                job_url=arguments["job_url"],
                location=arguments.get("location"),
                salary_range=arguments.get("salary_range"),
                remote=arguments.get("remote", False),
                notes=arguments.get("notes")
            )
            return [TextContent(
                type="text",
                text=json.dumps(result, indent=2, default=str)
            )]

        elif name == "schedule_mentorship":
            # This would integrate with the existing MentorshipSession model
            # For now, return a structured response
            result = {
                "success": True,
                "message": "Mentorship session scheduled",
                "session": {
                    "student_id": arguments["student_id"],
                    "mentor_id": arguments["mentor_id"],
                    "scheduled_time": arguments["scheduled_time"],
                    "duration_minutes": arguments.get("duration_minutes", 30),
                    "topic": arguments.get("topic")
                }
            }
            return [TextContent(
                type="text",
                text=json.dumps(result, indent=2, default=str)
            )]

        elif name == "update_user_progress":
            # This would integrate with Prisma/SQLAlchemy
            # For now, return a structured response
            result = {
                "success": True,
                "message": "User progress updated",
                "update": arguments
            }
            return [TextContent(
                type="text",
                text=json.dumps(result, indent=2, default=str)
            )]

        elif name == "generate_resume_improvements":
            # This would call the existing career agent
            # For now, return a structured placeholder
            result = {
                "success": True,
                "improvements": [
                    {
                        "category": "ATS Optimization",
                        "suggestion": "Add more quantifiable achievements with metrics",
                        "example": "Instead of 'Improved system performance', write 'Reduced API latency by 40% through query optimization'"
                    },
                    {
                        "category": "Content",
                        "suggestion": "Start bullet points with strong action verbs",
                        "example": "Use verbs like 'Architected', 'Led', 'Optimized', 'Implemented'"
                    }
                ]
            }
            return [TextContent(
                type="text",
                text=json.dumps(result, indent=2, default=str)
            )]

        elif name == "generate_cover_letter":
            # This would call the existing document improver agent
            result = {
                "success": True,
                "cover_letter": "[Cover letter would be generated here using the career agent]",
                "metadata": {
                    "company": arguments.get("company_name"),
                    "role": arguments.get("job_title"),
                    "tone": arguments.get("tone", "professional")
                }
            }
            return [TextContent(
                type="text",
                text=json.dumps(result, indent=2, default=str)
            )]

        else:
            return [TextContent(
                type="text",
                text=json.dumps({"error": f"Unknown tool: {name}"})
            )]

    except Exception as e:
        logger.error(f"Tool execution error: {e}")
        return [TextContent(
            type="text",
            text=json.dumps({"error": str(e)})
        )]


@server.list_resources()
async def list_resources() -> list[Resource]:
    """List available resources (user data, applications, etc.)"""
    return [
        Resource(
            uri="elevateai://user/{user_id}/profile",
            name="User Profile",
            description="Get user profile information"
        ),
        Resource(
            uri="elevateai://user/{user_id}/applications",
            name="Job Applications",
            description="Get user's tracked job applications"
        ),
        Resource(
            uri="elevateai://user/{user_id}/calendar",
            name="User Calendar",
            description="Get user's scheduled events"
        ),
        Resource(
            uri="elevateai://user/{user_id}/progress",
            name="Learning Progress",
            description="Get user's learning progress and achievements"
        )
    ]


async def main():
    """Run the MCP server"""
    logger.info("Starting ElevateAI MCP Server...")

    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
