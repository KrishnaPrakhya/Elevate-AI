"""Pure helpers for routing compound chat requests through multiple agents."""

from __future__ import annotations

import re
from typing import Any


INTENT_TO_AGENT = {
    "greeting": "greeting_handler",
    "document_improvement": "document_improver",
    "job_search": "job_searcher",
    "email_drafting": "email_drafter",
    "career_advice": "career_advisor",
    "preparation_schedule": "schedule_generator",
    "interview_preparation": "interview_preparer",
    "calendar_event": "calendar_event_creator",
}

# Read-only/research agents run first. Agents that can prepare a side effect run
# last so they can use earlier results and still require the existing UI approval.
INTENT_EXECUTION_ORDER = (
    "document_improvement",
    "job_search",
    "career_advice",
    "interview_preparation",
    "preparation_schedule",
    "email_drafting",
    "calendar_event",
)

AGENT_LABELS = {
    "greeting_handler": "Greeting",
    "document_improver": "Document Review",
    "job_searcher": "Job Search",
    "career_advisor": "Career Advice",
    "email_drafter": "Email Draft",
    "schedule_generator": "Preparation Plan",
    "interview_preparer": "Interview Preparation",
    "calendar_event_creator": "Calendar Event",
}

SESSION_CONTEXT_MESSAGE_LIMIT = 8
SESSION_CONTEXT_CHAR_LIMIT = 6000
EMAIL_ADDRESS_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")


def resolve_referenced_email(current_request: str, conversation_context: str) -> str | None:
    """Resolve "this/that email" only when context contains one unambiguous address."""

    if not re.search(
        r"\b(this|that|previous|above|their|his|her)\s+(email|address)\b|\bemail\s+(him|her|them)\b",
        current_request or "",
        re.IGNORECASE,
    ):
        return None

    addresses = {
        match.group(0).lower()
        for match in EMAIL_ADDRESS_PATTERN.finditer(conversation_context or "")
    }
    return next(iter(addresses)) if len(addresses) == 1 else None


def build_recent_conversation_context(
    messages: list[dict[str, Any]],
    current_user_message: str,
    message_limit: int = SESSION_CONTEXT_MESSAGE_LIMIT,
    char_limit: int = SESSION_CONTEXT_CHAR_LIMIT,
) -> str:
    """Build a bounded transcript of turns preceding the current request."""

    prior_messages = list(messages)
    if prior_messages:
        last = prior_messages[-1]
        if (
            last.get("role") == "user"
            and str(last.get("content") or "").strip() == (current_user_message or "").strip()
        ):
            prior_messages.pop()

    context_lines: list[str] = []
    for message in prior_messages[-max(0, message_limit):]:
        content = str(message.get("content") or "").strip()
        if not content:
            continue
        role = "User" if message.get("role") == "user" else "Assistant"
        context_lines.append(f"{role}: {content}")

    context = "\n\n".join(context_lines)
    if len(context) <= char_limit:
        return context
    # Keep the newest part of the transcript because it is most likely to
    # contain the referent for words such as "this", "that", and "it".
    return context[-char_limit:].lstrip()


def detect_explicit_intent_names(message: str) -> list[str]:
    """Return deterministic intents found in an explicitly compound request.

    This helper intentionally does not turn every keyword collision into a
    multi-agent run. A connector such as "and", "then", or "also" must be
    present; otherwise the existing single-intent classifier remains the source
    of truth (for example, "schedule an interview at 5pm" is one calendar task).
    """

    normalized = (message or "").lower().strip().replace("calender", "calendar")
    if not normalized:
        return []

    has_task_connector = bool(
        re.search(
            r"(?:\band\b|\bthen\b|\balso\b|\bas well as\b|\bplus\b|[;\n]"
            r"|,\s*(?:then\s+)?(?:find|search|draft|write|compose|create|make|prepare|send|review|schedule|add)\b)",
            normalized,
        )
    )
    if not has_task_connector:
        return []

    candidates: set[str] = set()

    if re.search(
        r"\b(search|find|show|recommend|identify|look for)\b.{0,60}\b(jobs?|roles?|openings?|opportunities)\b"
        r"|\b(job search|job listings?|job openings?|jobs? matching)\b",
        normalized,
    ):
        candidates.add("job_search")

    if re.search(
        r"\b(draft|write|compose|create|make|prepare|send)\b.{0,50}\b(email|mail)\b"
        r"|\b(email|mail)\b.{0,50}\b(draft|write|compose|create|make|prepare|send)\b"
        r"|\b(email|mail)\s+(it|them|him|her|me|to|the recruiter|the hiring manager)\b"
        r"|\b(email|mail)\b.{0,40}\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
        normalized,
    ):
        candidates.add("email_drafting")

    if re.search(
        r"\b(improve|fix|review|rewrite|tailor|optimi[sz]e)\b.{0,40}\b(resume|cv|cover letter)\b"
        r"|\b(resume review|cv review|ats score|resume feedback)\b",
        normalized,
    ):
        candidates.add("document_improvement")

    if re.search(
        r"\b(interview questions?|mock interview|interview prep(?:aration)?|prepare me for (?:an? )?interview|interview tips?)\b",
        normalized,
    ):
        candidates.add("interview_preparation")

    has_specific_clock_time = bool(re.search(r"\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b", normalized))
    if re.search(
        r"\b(add|create|put|book|schedule|set up)\b.{0,60}\b(calendar|event)\b"
        r"|\badd\b.{0,60}\bto (?:my )?(?:google )?calendar\b",
        normalized,
    ) or (has_specific_clock_time and "calendar" in normalized):
        candidates.add("calendar_event")

    if (
        re.search(r"\b(study|learning|preparation|prep)\b.{0,40}\b(plan|roadmap|schedule|timeline)\b", normalized)
        or re.search(r"\b(plan|roadmap|timeline)\b.{0,40}\b(study|learn|prep|career)\b", normalized)
    ) and not has_specific_clock_time:
        candidates.add("preparation_schedule")

    if re.search(
        r"\b(career advice|career guidance|career path|career change|career growth|salary negotiation|how to advance)\b",
        normalized,
    ):
        candidates.add("career_advice")

    # A multi-agent request must contain at least two independently actionable
    # intents. Greetings are deliberately excluded from an action queue.
    if len(candidates) < 2:
        return []

    return [intent for intent in INTENT_EXECUTION_ORDER if intent in candidates]


def combine_agent_responses(results: list[dict[str, Any]]) -> str:
    """Create one readable response from the outputs of a multi-agent run."""

    usable = [
        result
        for result in results
        if isinstance(result, dict) and str(result.get("content", "")).strip()
    ]
    if not usable:
        return "I couldn't complete the requested tasks. Please try again."
    if len(usable) == 1:
        return str(usable[0]["content"]).strip()

    sections = []
    for result in usable:
        agent_name = str(result.get("agent", ""))
        label = AGENT_LABELS.get(agent_name, "Result")
        sections.append(f"## {label}\n\n{str(result['content']).strip()}")

    return "I handled each part of your request:\n\n" + "\n\n".join(sections)
