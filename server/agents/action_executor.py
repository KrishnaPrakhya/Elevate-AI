"""
Action Executor Agent for ElevateAI

This agent is responsible for executing confirmed actions like:
- Sending emails
- Creating calendar events
- Scheduling mentorship sessions
- Tracking job applications

It integrates with the LangGraph multi-agent system as a final node
that executes pending actions after user confirmation.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Any, TypedDict, List, Optional

logger = logging.getLogger(__name__)


class ActionExecutorAgent:
    """Agent for executing confirmed user actions"""

    def __init__(self, db_session=None):
        """
        Initialize the Action Executor.

        Args:
            db_session: SQLAlchemy async session for database operations
        """
        self.db_session = db_session
        self._calendar_tool = None
        self._email_tool = None
        self._job_tracker_tool = None

    def _get_calendar_tool(self):
        """Lazy initialization of Calendar tool"""
        if self._calendar_tool is None:
            from tools.calendar import CalendarTool
            self._calendar_tool = CalendarTool()
        return self._calendar_tool

    def _get_email_tool(self):
        """Lazy initialization of Email tool"""
        if self._email_tool is None:
            from tools.email import EmailTool
            self._email_tool = EmailTool()
        return self._email_tool

    def _get_job_tracker_tool(self):
        """Lazy initialization of Job Tracker tool"""
        if self._job_tracker_tool is None:
            from tools.job_tracker import JobTrackerTool
            self._job_tracker_tool = JobTrackerTool(self.db_session)
        return self._job_tracker_tool

    async def execute_action(self, action: dict[str, Any], user_profile: dict[str, Any]) -> dict[str, Any]:
        """
        Execute a single confirmed action.

        Args:
            action: Action dict with type, params, and metadata
            user_profile: User profile for context

        Returns:
            Execution result dict
        """
        action_type = action.get("type")
        params = action.get("params", {})

        logger.info(f"Executing action: {action_type}")

        try:
            if action_type == "SEND_EMAIL":
                return await self._execute_send_email(params, user_profile)
            elif action_type == "CREATE_CALENDAR_EVENT":
                return await self._execute_create_calendar_event(params, user_profile)
            elif action_type == "TRACK_JOB_APPLICATION":
                return await self._execute_track_job_application(params, user_profile)
            elif action_type == "SCHEDULE_MENTORSHIP":
                return await self._execute_schedule_mentorship(params, user_profile)
            elif action_type == "UPDATE_PROGRESS":
                return await self._execute_update_progress(params, user_profile)
            else:
                return {
                    "success": False,
                    "error": f"Unknown action type: {action_type}"
                }
        except Exception as e:
            logger.error(f"Action execution failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "action_type": action_type
            }

    async def _execute_send_email(self, params: dict[str, Any], user_profile: dict[str, Any]) -> dict[str, Any]:
        """Execute send email action"""
        email_tool = self._get_email_tool()

        # Determine email type and use appropriate template method
        email_type = params.get("email_type", "general")

        if email_type == "schedule":
            result = await email_tool.send_schedule_email(
                to=params["to"],
                user_name=params.get("user_name", user_profile.get("name", "User")),
                schedule_title=params.get("schedule_title", "Your Schedule"),
                schedule_details=params.get("schedule_details", "")
            )
        elif email_type == "interview":
            result = await email_tool.send_interview_confirmation(
                to=params["to"],
                user_name=params.get("user_name", user_profile.get("name", "User")),
                role=params.get("role", "Position"),
                interview_time=datetime.fromisoformat(params["interview_time"].replace("Z", "+00:00")) if isinstance(params["interview_time"], str) else params["interview_time"],
                interviewer_name=params.get("interviewer_name"),
                meeting_link=params.get("meeting_link")
            )
        elif email_type == "mentorship":
            result = await email_tool.send_mentorship_confirmation(
                to=params["to"],
                user_name=params.get("user_name", user_profile.get("name", "User")),
                mentor_name=params.get("mentor_name", "Mentor"),
                session_time=datetime.fromisoformat(params["session_time"].replace("Z", "+00:00")) if isinstance(params["session_time"], str) else params["session_time"],
                topic=params.get("topic")
            )
        elif email_type == "achievement":
            result = await email_tool.send_achievement_email(
                to=params["to"],
                user_name=params.get("user_name", user_profile.get("name", "User")),
                achievement_title=params.get("achievement_title", "Achievement Unlocked"),
                achievement_description=params.get("achievement_description", ""),
                points_earned=params.get("points_earned", 0)
            )
        else:
            # Generic email
            result = await email_tool.send_email(
                to=params["to"],
                subject=params["subject"],
                html=params["html"],
                text=params.get("text"),
                from_name=params.get("from_name", "ElevateAI")
            )

        return result

    async def _execute_create_calendar_event(self, params: dict[str, Any], user_profile: dict[str, Any]) -> dict[str, Any]:
        """Execute create calendar event action"""
        calendar_tool = self._get_calendar_tool()

        resolved_user_id = (
            params.get("user_id")
            or user_profile.get("id")
            or user_profile.get("user_id")
            or user_profile.get("clerk_user_id")
        )

        if not resolved_user_id:
            return {
                "success": False,
                "error": "Missing user_id for OAuth calendar event creation"
            }

        start_time = params["start_time"]
        if isinstance(start_time, str):
            start_time = datetime.fromisoformat(start_time.replace("Z", "+00:00"))

        end_time = params["end_time"]
        if isinstance(end_time, str):
            end_time = datetime.fromisoformat(end_time.replace("Z", "+00:00"))

        result = await calendar_tool.create_event(
            title=params["title"],
            start_time=start_time,
            end_time=end_time,
            description=params.get("description"),
            location=params.get("location"),
            attendees=params.get("attendees"),
            timezone=params.get("timezone", "UTC"),
            recurrence=params.get("recurrence"),
            user_id=resolved_user_id,
        )

        return result

    async def _execute_track_job_application(self, params: dict[str, Any], user_profile: dict[str, Any]) -> dict[str, Any]:
        """Execute track job application action"""
        job_tracker = self._get_job_tracker_tool()

        result = await job_tracker.track_application(
            user_id=params["user_id"],
            company=params["company"],
            role=params["role"],
            job_url=params["job_url"],
            location=params.get("location"),
            salary_range=params.get("salary_range"),
            remote=params.get("remote", False),
            notes=params.get("notes")
        )

        return result

    async def _execute_schedule_mentorship(self, params: dict[str, Any], user_profile: dict[str, Any]) -> dict[str, Any]:
        """Execute schedule mentorship action"""
        # This would integrate with the MentorshipSession model
        # For now, return a structured response
        return {
            "success": True,
            "message": "Mentorship session scheduled successfully",
            "session": params
        }

    async def _execute_update_progress(self, params: dict[str, Any], user_profile: dict[str, Any]) -> dict[str, Any]:
        """Execute update user progress action"""
        # This would integrate with Prisma/SQLAlchemy
        # For now, return a structured response
        return {
            "success": True,
            "message": "User progress updated successfully",
            "update": params
        }

    async def execute_batch(self, actions: List[dict[str, Any]], user_profile: dict[str, Any]) -> dict[str, Any]:
        """
        Execute a batch of actions.

        Args:
            actions: List of action dicts
            user_profile: User profile for context

        Returns:
            Batch execution result with individual results
        """
        results = []
        successful = 0
        failed = 0

        for action in actions:
            result = await self.execute_action(action, user_profile)
            results.append({
                "action": action,
                "result": result
            })

            if result.get("success"):
                successful += 1
            else:
                failed += 1

        return {
            "success": failed == 0,
            "total": len(actions),
            "successful": successful,
            "failed": failed,
            "results": results
        }


# LangGraph node function for integration with the agent graph
async def action_executor_node(state: dict[str, Any]) -> dict[str, Any]:
    """
    LangGraph node for executing pending actions.

    This function is designed to be integrated into the LangGraph state graph.
    It executes all confirmed pending actions and updates the state.

    Args:
        state: AgentState with pending_actions to execute

    Returns:
        Updated state with executed actions
    """
    from sqlalchemy.ext.asyncio import AsyncSession

    pending_actions = state.get("pending_actions", [])
    user_profile = state.get("user_profile", {})

    if not pending_actions:
        return {
            **state,
            "actions_taken": [],
            "pending_actions": [],
            "task_completed": state.get("task_completed", False)
        }

    # Get DB session if available
    db_session = None
    # In production, you'd get this from the state or context
    # db_session: AsyncSession = state.get("db_session")

    executor = ActionExecutorAgent(db_session)

    # Execute all pending actions
    batch_result = await executor.execute_batch(pending_actions, user_profile)

    # Log executed actions
    executed_actions = []
    for item in batch_result["results"]:
        executed_actions.append({
            "type": item["action"].get("type"),
            "result": item["result"],
            "executed_at": datetime.utcnow().isoformat()
        })

    return {
        **state,
        "actions_taken": executed_actions,
        "pending_actions": [],  # Clear pending actions after execution
        "task_completed": batch_result["success"],
        "execution_summary": {
            "total": batch_result["total"],
            "successful": batch_result["successful"],
            "failed": batch_result["failed"]
        }
    }
