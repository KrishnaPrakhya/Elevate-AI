"""
LiveKit AI Interviewer Agent
============================
This agent connects to LiveKit rooms and conducts mock interviews.
It uses Ollama or Google Gemini for AI responses.

Requirements:
    pip install livekit livekit-agents livekit-plugins-av

Usage:
    python livekit-agent.py
"""

import asyncio
import os
import json
from typing import Optional

from livekit import agents, rtc
from livekit.agents import JobContext, WorkerOptions, cli

# Configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:latest")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Interview questions database
INTERVIEW_QUESTIONS = {
    "software_engineer": {
        "easy": [
            "Tell me about yourself and your background in software development.",
            "What is your favorite programming language and why?",
            "Explain the difference between stack and queue.",
        ],
        "medium": [
            "Describe a challenging project you worked on. How did you overcome obstacles?",
            "How do you handle conflicting priorities in a team environment?",
            "Explain RESTful API design principles.",
        ],
        "hard": [
            "Design a system that handles millions of requests per second. What are your considerations?",
            "How would you debug a production issue that only occurs intermittently?",
            "Explain microservices architecture and when you would use it.",
        ],
    },
    "data_scientist": {
        "easy": ["Explain the difference between supervised and unsupervised learning."],
        "medium": ["How do you handle imbalanced datasets in classification problems?"],
        "hard": ["Design a recommendation system for a streaming platform."],
    },
    "frontend_developer": {
        "easy": ["Explain the difference between let, const, and var in JavaScript."],
        "medium": ["How do you optimize React component performance?"],
        "hard": ["Design a real-time collaborative editing interface."],
    },
}


class InterviewAgent(agents.Agent):
    """AI Interviewer Agent that conducts mock interviews via voice/video."""

    def __init__(
        self,
        role: str = "Software Engineer",
        level: str = "Mid-Level",
        questions: Optional[list] = None,
    ):
        super().__init__()
        self.role = role
        self.level = level
        self.questions = questions or self._get_questions_for_role(role, level)
        self.current_question_index = 0
        self.transcript = []
        self.user_answers = []

    def _get_questions_for_role(self, role: str, level: str) -> list:
        """Get appropriate questions based on role and level."""
        role_key = role.lower().replace(" ", "_")
        questions_data = INTERVIEW_QUESTIONS.get(
            role_key, INTERVIEW_QUESTIONS["software_engineer"]
        )

        # Select difficulty based on level
        if level.lower() in ["intern", "junior"]:
            difficulty = "easy"
        elif level.lower() in ["senior", "staff"]:
            difficulty = "hard"
        else:
            difficulty = "medium"

        return questions_data.get(difficulty, questions_data.get("medium", []))

    async def entrypoint(self, job: JobContext):
        """Main entry point for the agent."""
        initial_ctx = rtc.ChatContext()
        initial_ctx.messages.append(
            rtc.ChatMessage(
                role="system",
                content=(
                    f"You are a professional {self.role} interviewer conducting a mock interview. "
                    f"The candidate is applying for a {self.level} position. "
                    "Be friendly but professional. Ask one question at a time and wait for their answer. "
                    "After they answer, acknowledge their response briefly and ask follow-up questions if needed. "
                    "Keep the conversation natural and encouraging."
                ),
            )
        )

        # Connect to the room
        room = await job.connect()

        # Wait for participant to join
        await self._wait_for_participant(room)

        # Start the interview
        await self._conduct_interview(room, initial_ctx)

    async def _wait_for_participant(self, room: rtc.Room, timeout: float = 30.0):
        """Wait for a participant to join the room."""
        start_time = asyncio.get_event_loop().time()

        while len(room.remote_participants) == 0:
            if asyncio.get_event_loop().time() - start_time > timeout:
                await self.say("It seems no one joined the interview. Ending session.")
                await room.disconnect()
                return
            await asyncio.sleep(0.5)

        # Greet the participant
        await self.say(
            "Hello! Welcome to your mock interview. "
            f"I'll be conducting your interview for the {self.role} position. "
            "Let's get started!"
        )

    async def _conduct_interview(self, room: rtc.Room, ctx: rtc.ChatContext):
        """Conduct the interview session."""
        from livekit.plugins import silero, deepgram, ollama

        # Initialize speech-to-text
        stt = deepgram.STT()

        # Initialize text-to-llm
        llm = ollama.LLM(model=OLLAMA_MODEL)

        # Initialize LLM with interview context
        interview_ctx = ctx.copy()
        interview_ctx.messages.append(
            rtc.ChatMessage(
                role="system",
                content=(
                    "You are conducting a mock interview. "
                    "Keep responses concise and conversational. "
                    "After the candidate answers, provide brief acknowledgment and move to the next question."
                ),
            )
        )

        for i, question in enumerate(self.questions):
            if len(room.remote_participants) == 0:
                break

            # Ask the question
            await self.say(f"Question {i + 1}: {question}")

            # Listen for response (simplified - in production use proper VAD)
            user_response = await self._listen_for_response(stt, room, timeout=120)

            if user_response:
                self.user_answers.append({
                    "question": question,
                    "answer": user_response,
                    "question_index": i,
                })

                # Generate AI follow-up
                follow_up = await self._generate_follow_up(
                    llm, question, user_response, interview_ctx
                )

                if follow_up:
                    await self.say(follow_up)
                    # Listen for follow-up response
                    follow_up_response = await self._listen_for_response(
                        stt, room, timeout=60
                    )
                    if follow_up_response:
                        self.user_answers[-1]["follow_up"] = follow_up_response

            await asyncio.sleep(1)  # Brief pause between questions

        # End the interview
        await self._provide_feedback(room)
        await room.disconnect()

    async def _listen_for_response(
        self, stt, room: rtc.Room, timeout: float = 60.0
    ) -> Optional[str]:
        """Listen for user's spoken response."""
        # Simplified implementation
        # In production, use LiveKit's VoicePipelineAgent for proper VAD
        await asyncio.sleep(timeout)  # Wait for response
        return None  # Placeholder - implement proper speech recognition

    async def _generate_follow_up(self, llm, question: str, answer: str, ctx):
        """Generate AI follow-up question based on the answer."""
        prompt = f"""
        Interview Question: {question}
        Candidate Answer: {answer}

        Generate a brief, natural follow-up question or acknowledgment.
        Keep it conversational and under 2 sentences.
        """

        chat_ctx = ctx.copy()
        chat_ctx.messages.append(rtc.ChatMessage(role="user", content=prompt))

        response = await llm.chat(chat_ctx)
        return response.content

    async def _provide_feedback(self, room: rtc.Room):
        """Provide interview feedback."""
        feedback = self._generate_feedback()

        await self.say(
            "Thank you for completing the interview! Here's my feedback:\n\n"
            + feedback
            + "\n\nGood luck with your job search!"
        )

    def _generate_feedback(self) -> str:
        """Generate feedback based on answers."""
        # In production, use LLM to analyze answers
        return (
            "You demonstrated good communication skills. "
            "Consider providing more specific examples in your answers. "
            "Your technical knowledge appears solid for the level."
        )

    async def say(self, text: str):
        """Speak text using TTS."""
        from livekit.plugins import elevenlabs

        tts = elevenlabs.TTS()

        async for chunk in tts.synthesize(text):
            # Send audio frames to room
            pass


if __name__ == "__main__":
    cli.run_app(WorkerOptions(agent_cls=InterviewAgent))
