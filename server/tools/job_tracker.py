"""
Job Application Tracker Tool for ElevateAI

This tool allows the AI agent to track job applications, set follow-up reminders,
and manage the job search pipeline.
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class JobTrackerTool:
    """Tool for tracking job applications"""

    def __init__(self, db_session=None):
        """
        Initialize the Job Tracker tool.

        Args:
            db_session: SQLAlchemy async session for database operations
        """
        self.db_session = db_session

    async def track_application(
        self,
        user_id: str,
        company: str,
        role: str,
        job_url: str,
        location: Optional[str] = None,
        salary_range: Optional[str] = None,
        remote: bool = False,
        notes: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Track a new job application.

        Args:
            user_id: User's database ID
            company: Company name
            role: Job title/role
            job_url: URL to the job posting
            location: Job location
            salary_range: Salary range if provided
            remote: Whether the job is remote
            notes: Additional notes
            metadata: Additional metadata

        Returns:
            Dict with application details and status
        """
        from sqlalchemy import select

        if not self.db_session:
            # Mock for development
            logger.info(f"[MOCK] Tracking application: {role} at {company}")
            return {
                "success": True,
                "mock": True,
                "application": {
                    "company": company,
                    "role": role,
                    "job_url": job_url,
                    "status": "TRACKING",
                    "created_at": datetime.utcnow().isoformat()
                }
            }

        try:
            # Import models
            import sys
            sys.path.append(os.path.dirname(os.path.dirname(__file__)))
            from app import JobApplication, ApplicationStatus

            # Create new application record
            application = JobApplication(
                userId=user_id,
                company=company,
                role=role,
                job_url=job_url,
                location=location,
                salaryRange=salary_range,
                remote=remote,
                status=ApplicationStatus.TRACKING,
                notes=notes,
                metadata=metadata or {}
            )

            self.db_session.add(application)
            await self.db_session.commit()
            await self.db_session.refresh(application)

            # Auto-schedule follow-up in 7 days
            follow_up_date = datetime.utcnow() + timedelta(days=7)
            application.followUpDate = follow_up_date
            await self.db_session.commit()

            return {
                "success": True,
                "application_id": application.id,
                "application": {
                    "id": application.id,
                    "company": company,
                    "role": role,
                    "status": "TRACKING",
                    "follow_up_date": follow_up_date.isoformat()
                }
            }
        except Exception as e:
            logger.error(f"Failed to track job application: {e}")
            return {
                "success": False,
                "error": str(e),
                "application": {
                    "company": company,
                    "role": role,
                    "status": "TRACKING"
                }
            }

    async def update_status(
        self,
        application_id: str,
        status: str,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update the status of a job application"""
        from sqlalchemy import select

        if not self.db_session:
            return {"success": True, "mock": True, "status": status}

        try:
            from app import JobApplication, ApplicationStatus

            result = await self.db_session.execute(
                select(JobApplication).where(JobApplication.id == application_id)
            )
            application = result.scalar_one_or_none()

            if not application:
                return {"success": False, "error": "Application not found"}

            # Map string status to enum
            status_map = {
                "TRACKING": ApplicationStatus.TRACKING,
                "APPLIED": ApplicationStatus.APPLIED,
                "INTERVIEWING": ApplicationStatus.INTERVIEWING,
                "OFFER": ApplicationStatus.OFFER,
                "REJECTED": ApplicationStatus.REJECTED,
                "WITHDRAWN": ApplicationStatus.WITHDRAWN,
            }

            application.status = status_map.get(status, ApplicationStatus.TRACKING)

            if status == "APPLIED":
                application.appliedAt = datetime.utcnow()
            elif status == "OFFER":
                application.responseDate = datetime.utcnow()
            elif status == "REJECTED":
                application.responseDate = datetime.utcnow()

            if notes:
                application.notes = f"{application.notes or ''}\n{datetime.utcnow().isoformat()}: {notes}"

            await self.db_session.commit()

            return {
                "success": True,
                "application_id": application_id,
                "new_status": status
            }
        except Exception as e:
            logger.error(f"Failed to update application status: {e}")
            return {"success": False, "error": str(e)}

    async def get_applications(
        self,
        user_id: str,
        status: Optional[str] = None,
        limit: int = 20
    ) -> Dict[str, Any]:
        """Get user's job applications"""
        from sqlalchemy import select

        if not self.db_session:
            return {"success": True, "mock": True, "applications": []}

        try:
            from app import JobApplication, ApplicationStatus

            query = select(JobApplication).where(JobApplication.userId == user_id)

            if status:
                status_enum = getattr(ApplicationStatus, status, None)
                if status_enum:
                    query = query.where(JobApplication.status == status_enum)

            query = query.order_by(JobApplication.createdAt.desc()).limit(limit)

            result = await self.db_session.execute(query)
            applications = result.scalars().all()

            return {
                "success": True,
                "applications": [
                    {
                        "id": app.id,
                        "company": app.company,
                        "role": app.role,
                        "status": app.status.value,
                        "location": app.location,
                        "remote": app.remote,
                        "applied_at": app.appliedAt.isoformat() if app.appliedAt else None,
                        "follow_up_date": app.followUpDate.isoformat() if app.followUpDate else None,
                    }
                    for app in applications
                ]
            }
        except Exception as e:
            logger.error(f"Failed to get applications: {e}")
            return {"success": False, "error": str(e), "applications": []}

    async def scrape_job_details(self, job_url: str) -> Dict[str, Any]:
        """
        Scrape job details from a URL.

        Args:
            job_url: URL to the job posting

        Returns:
            Dict with scraped job details
        """
        # This is a placeholder - in production you'd use Playwright or similar
        # to scrape job details from the URL
        parsed = urlparse(job_url)
        domain = parsed.netloc

        # Mock response for common job boards
        mock_data = {
            "company": "Unknown Company",
            "title": "Software Engineer",
            "location": "Remote",
            "description": "Job description would be scraped here...",
            "requirements": ["Python", "FastAPI", "PostgreSQL"],
            "salary_range": "$120k - $180k",
            "posted_date": datetime.utcnow().isoformat()
        }

        logger.info(f"[MOCK] Scraped job from {domain}")
        return mock_data
