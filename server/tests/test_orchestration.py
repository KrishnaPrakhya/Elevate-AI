import unittest

from orchestration import (
    build_recent_conversation_context,
    combine_agent_responses,
    detect_explicit_intent_names,
    resolve_referenced_email,
)


class MultiIntentDetectionTests(unittest.TestCase):
    def test_job_search_runs_before_email_draft(self) -> None:
        intents = detect_explicit_intent_names(
            "Find remote Python jobs matching my skills and draft an outreach email for the best one."
        )
        self.assertEqual(intents, ["job_search", "email_drafting"])

    def test_dependency_order_is_stable_when_user_mentions_email_first(self) -> None:
        intents = detect_explicit_intent_names(
            "Draft an email to the recruiter and find backend job openings in Bengaluru."
        )
        self.assertEqual(intents, ["job_search", "email_drafting"])

    def test_single_calendar_request_does_not_become_multi_agent(self) -> None:
        self.assertEqual(
            detect_explicit_intent_names("Schedule a mock interview on my calendar at 5pm"),
            [],
        )

    def test_three_explicit_tasks_are_detected(self) -> None:
        intents = detect_explicit_intent_names(
            "Review my resume, then find matching jobs, and draft an email to recruiter@example.com."
        )
        self.assertEqual(
            intents,
            ["document_improvement", "job_search", "email_drafting"],
        )

    def test_email_action_with_explicit_address_is_detected(self) -> None:
        intents = detect_explicit_intent_names(
            "Find product roles and email recruiter@example.com with the results."
        )
        self.assertEqual(intents, ["job_search", "email_drafting"])

    def test_make_email_wording_is_detected(self) -> None:
        intents = detect_explicit_intent_names(
            "Find remote Python jobs and make an email for the best one."
        )
        self.assertEqual(intents, ["job_search", "email_drafting"])


class SessionContextTests(unittest.TestCase):
    def test_current_message_is_excluded_but_previous_result_is_kept(self) -> None:
        messages = [
            {"role": "user", "content": "Find Python jobs"},
            {"role": "assistant", "content": "The best match is Acme Backend Engineer."},
            {"role": "user", "content": "Make an email to recruiter@example.com"},
        ]
        context = build_recent_conversation_context(
            messages,
            "Make an email to recruiter@example.com",
        )
        self.assertIn("Acme Backend Engineer", context)
        self.assertNotIn("recruiter@example.com", context)

    def test_context_window_keeps_newest_messages_and_respects_char_limit(self) -> None:
        messages = [
            {"role": "user", "content": f"old-{index}"}
            for index in range(12)
        ]
        context = build_recent_conversation_context(
            messages,
            "current",
            message_limit=3,
            char_limit=40,
        )
        self.assertIn("old-11", context)
        self.assertNotIn("old-1\n", context)
        self.assertLessEqual(len(context), 40)

    def test_referenced_email_is_resolved_when_unambiguous(self) -> None:
        self.assertEqual(
            resolve_referenced_email(
                "Make an email to that address",
                "Assistant: Contact the recruiter at recruiter@example.com.",
            ),
            "recruiter@example.com",
        )

    def test_referenced_email_is_not_guessed_when_context_has_multiple_addresses(self) -> None:
        self.assertIsNone(
            resolve_referenced_email(
                "Send it to that email",
                "Assistant: Options are one@example.com and two@example.com.",
            )
        )


class ResponseCombinationTests(unittest.TestCase):
    def test_multiple_outputs_are_labeled(self) -> None:
        response = combine_agent_responses(
            [
                {"agent": "job_searcher", "content": "Two matching roles."},
                {"agent": "email_drafter", "content": "Subject: Application"},
            ]
        )
        self.assertIn("## Job Search", response)
        self.assertIn("## Email Draft", response)

    def test_single_output_is_not_wrapped(self) -> None:
        self.assertEqual(
            combine_agent_responses([{"agent": "career_advisor", "content": "Keep learning."}]),
            "Keep learning.",
        )

    def test_empty_outputs_return_a_safe_failure_message(self) -> None:
        self.assertIn("couldn't complete", combine_agent_responses([]))


if __name__ == "__main__":
    unittest.main()
