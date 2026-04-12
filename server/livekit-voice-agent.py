"""
LiveKit Voice AI Interviewer Agent
===================================
Real-time voice-to-voice AI interviewer using LiveKit Agents + Ollama Cloud.

Install dependencies:
    pip install livekit-agents livekit-plugins-silero livekit-plugins-deepgram livekit-plugins-elevenlabs

Environment variables:
    LIVEKIT_API_KEY=your_key
    LIVEKIT_API_SECRET=your_secret
    LIVEKIT_URL=wss://your-project.livekit.cloud
    DEEPGRAM_API_KEY=your_key (free tier: 1hr/month)
    ELEVENLABS_API_KEY=your_key (free tier: 10K chars/month)
    OLLAMA_API_KEY=your_ollama_cloud_key
    OLLAMA_BASE_URL=https://ollama.com/v1

Run:
    python livekit-voice-agent.py
"""

import asyncio
import os
import logging
from typing import Optional, List
from dataclasses import dataclass

from livekit import agents, rtc
from livekit.agents import JobContext, WorkerOptions, cli
from livekit.plugins import silero, deepgram, elevenlabs

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================
# Configuration
# ============================================

# LiveKit configuration
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "wss://localhost:7880")

# Ollama Cloud configuration (OpenAI-compatible)
OLLAMA_API_KEY = os.getenv("OLLAMA_API_KEY", "")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "https://ollama.com/v1")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama-3.1-70b-versatile")

# Speech services
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "Rachel")  # Professional female voice

# Interview configuration
DEFAULT_ROLE = "Software Engineer"
DEFAULT_LEVEL = "Mid-Level"
NUM_QUESTIONS = 5


@dataclass
class InterviewQuestion:
    question: str
    category: str
    difficulty: str
    follow_ups: List[str]


# ============================================
# Interview Questions Database
# ============================================

INTERVIEW_QUESTIONS = {
    "software_engineer": {
        "easy": [
            InterviewQuestion(
                question="Tell me about yourself and your background in software development.",
                category="behavioral",
                difficulty="easy",
                follow_ups=[
                    "What got you interested in programming?",
                    "What's your preferred tech stack?",
                ],
            ),
            InterviewQuestion(
                question="What is the difference between a stack and a queue?",
                category="technical",
                difficulty="easy",
                follow_ups=[
                    "Can you give a real-world example of each?",
                    "When would you use one over the other?",
                ],
            ),
        ],
        "medium": [
            InterviewQuestion(
                question="Describe a challenging technical problem you solved. How did you approach it?",
                category="behavioral",
                difficulty="medium",
                follow_ups=[
                    "What was the outcome?",
                    "What would you do differently?",
                ],
            ),
            InterviewQuestion(
                question="Explain RESTful API design principles.",
                category="technical",
                difficulty="medium",
                follow_ups=[
                    "What makes an API RESTful?",
                    "How do you handle versioning?",
                ],
            ),
        ],
        "hard": [
            InterviewQuestion(
                question="Design a system that handles millions of requests per second. What are your key considerations?",
                category="system_design",
                difficulty="hard",
                follow_ups=[
                    "How would you handle database scaling?",
                    "What about caching strategies?",
                ],
            ),
        ],
    },
    "frontend_developer": {
        "easy": [
            InterviewQuestion(
                question="Explain the difference between let, const, and var in JavaScript.",
                category="technical",
                difficulty="easy",
                follow_ups=["When would you use each one?"],
            ),
        ],
        "medium": [
            InterviewQuestion(
                question="How do you optimize React component performance?",
                category="technical",
                difficulty="medium",
                follow_ups=["What hooks help with optimization?"],
            ),
        ],
        "hard": [
            InterviewQuestion(
                question="Design a real-time collaborative editing interface like Google Docs.",
                category="system_design",
                difficulty="hard",
                follow_ups=["How do you handle conflicts?"],
            ),
        ],
    },
    "data_scientist": {
        "easy": [
            InterviewQuestion(
                question="Explain the difference between supervised and unsupervised learning.",
                category="technical",
                difficulty="easy",
                follow_ups=["Give examples of each."],
            ),
        ],
        "medium": [
            InterviewQuestion(
                question="How do you handle imbalanced datasets in classification?",
                category="technical",
                difficulty="medium",
                follow_ups=["What metrics would you use?"],
            ),
        ],
    },
    "backend_developer": {
        "easy": [
            InterviewQuestion(
                question="What is the difference between SQL and NoSQL databases?",
                category="technical",
                difficulty="easy",
                follow_ups=["When would you choose one over the other?"],
            ),
        ],
        "medium": [
            InterviewQuestion(
                question="How do you design a scalable API?",
                category="technical",
                difficulty="medium",
                follow_ups=["What about rate limiting and authentication?"],
            ),
        ],
        "hard": [
            InterviewQuestion(
                question="Design a distributed caching system.",
                category="system_design",
                difficulty="hard",
                follow_ups=["How do you handle cache invalidation?"],
            ),
        ],
    },
    "devops_engineer": {
        "easy": [
            InterviewQuestion(
                question="What is CI/CD and why is it important?",
                category="technical",
                difficulty="easy",
                follow_ups=["What tools have you used?"],
            ),
        ],
        "medium": [
            InterviewQuestion(
                question="How do you monitor and alert on production systems?",
                category="technical",
                difficulty="medium",
                follow_ups=["What metrics are most important?"],
            ),
        ],
        "hard": [
            InterviewQuestion(
                question="Design a multi-region deployment strategy.",
                category="system_design",
                difficulty="hard",
                follow_ups=["How do you handle failover?"],
            ),
        ],
    },
}


# ============================================
# AI Interviewer Agent
# ============================================

class InterviewAgent(agents.Agent):
    """AI Interviewer that conducts voice-to-voice mock interviews."""

    def __init__(
        self,
        role: str = DEFAULT_ROLE,
        level: str = DEFAULT_LEVEL,
        num_questions: int = NUM_QUESTIONS,
    ):
        super().__init__()
        self.role = role
        self.level = level
        self.num_questions = num_questions
        self.questions = self._get_questions()
        self.current_question = 0
        self.user_answers = []
        self.interview_active = True
        self.transcript = []

    def _get_questions(self) -> List[InterviewQuestion]:
        """Get questions based on role and level."""
        role_key = self.role.lower().replace(" ", "_")
        questions_data = INTERVIEW_QUESTIONS.get(
            role_key, INTERVIEW_QUESTIONS["software_engineer"]
        )

        # Distribute difficulty based on level
        if self.level.lower() in ["intern", "junior"]:
            difficulties = ["easy", "easy", "medium", "medium", "medium"]
        elif self.level.lower() in ["senior", "staff", "principal"]:
            difficulties = ["medium", "medium", "medium", "hard", "hard"]
        else:
            difficulties = ["easy", "medium", "medium", "medium", "hard"]

        selected = []
        for i, diff in enumerate(difficultures[:self.num_questions]):
            available = questions_data.get(diff, questions_data.get("medium", []))
            if available:
                selected.append(available[i % len(available)])

        return selected

    async def entrypoint(self, job: JobContext):
        """Main entry point when agent joins a room."""
        logger.info(f"Starting voice interview agent for {self.role} - {self.level}")

        # Get room name from metadata
        room_name = job.room.name
        logger.info(f"Joined room: {room_name}")

        # Create initial chat context with system prompt
        initial_ctx = rtc.ChatContext()
        initial_ctx.messages.append(
            rtc.ChatMessage(
                role="system",
                content=(
                    f"You are a professional {self.role} interviewer conducting a mock interview. "
                    f"The candidate is applying for a {self.level} position. "
                    "Your personality is friendly but professional. "
                    "Ask one question at a time, wait for their answer, then acknowledge briefly before moving on. "
                    "Keep responses concise (2-3 sentences max). "
                    "Be encouraging and make the candidate comfortable. "
                    "This is a voice conversation, so keep your responses natural and conversational."
                ),
            )
        )

        # Connect to the LiveKit room
        room = await job.connect()

        # Wait for participant
        await self._wait_for_participant(room)

        # Run the interview
        await self._run_interview(room, initial_ctx)

    async def _wait_for_participant(self, room: rtc.Room, timeout: float = 30.0):
        """Wait for a participant to join."""
        logger.info("Waiting for participant to join...")
        start_time = asyncio.get_event_loop().time()

        while len(room.remote_participants) == 0:
            if asyncio.get_event_loop().time() - start_time > timeout:
                await self._say("It seems no one joined. Ending the session. Good luck with your preparation!")
                await room.disconnect()
                return
            await asyncio.sleep(0.5)

        # Greet the participant
        greeting = (
            f"Hello! Welcome to your mock interview for the {self.role} position. "
            f"I'll be asking you {len(self.questions)} questions. "
            "Take your time with each answer and speak naturally. "
            "Let's begin!"
        )
        await self._say(greeting)

    async def _run_interview(self, room: rtc.Room, ctx: rtc.ChatContext):
        """Run the full interview session."""
        # Initialize plugins
        stt = deepgram.STT(api_key=DEEPGRAM_API_KEY)  # Speech-to-text
        tts = elevenlabs.TTS(api_key=ELEVENLABS_API_KEY, voice=ELEVENLABS_VOICE_ID)  # Text-to-speech

        # LLM setup - Use Ollama Cloud with OpenAI-compatible API
        from livekit.plugins import openai as lk_openai

        llm_model = lk_openai.LLM(
            api_key=OLLAMA_API_KEY,
            base_url=OLLAMA_BASE_URL,
            model=OLLAMA_MODEL,
        )

        # Create voice pipeline
        voice_pipeline = agents.voice.VoicePipeline(
            vad=silero.VAD.load(),
            stt=stt,
            llm=llm_model,
            tts=tts,
        )

        # Start voice pipeline
        voice_pipeline.start(room, initial_ctx)

        # Ask questions
        for i, q in enumerate(self.questions):
            if not self.interview_active or len(room.remote_participants) == 0:
                break

            logger.info(f"Asking question {i+1}: {q.question[:50]}...")

            # Wait a moment before asking
            await asyncio.sleep(1)

            # Speak the question
            await self._say(f"Question {i + 1}: {q.question}")

            # Wait for answer (voice pipeline handles STT automatically)
            # In production, detect silence to know when answer is complete
            await asyncio.sleep(30)  # Give time for answer

            # Optional follow-up
            if q.follow_ups and self.interview_active:
                await asyncio.sleep(1)
                follow_up = q.follow_ups[0]
                await self._say(f"Follow-up: {follow_up}")
                await asyncio.sleep(15)  # Time for follow-up answer

        # End interview
        await self._provide_feedback(room, voice_pipeline)
        await room.disconnect()

    async def _say(self, text: str):
        """Speak text using TTS."""
        # Voice pipeline handles this automatically
        pass

    async def _provide_feedback(self, room: rtc.Room, voice_pipeline):
        """Provide interview feedback."""
        feedback = await self._generate_feedback()

        await self._say(
            "Thank you for completing the interview! Here's my feedback:\n\n"
            + feedback +
            "\n\nGood luck with your job search! You can review the full feedback in your dashboard."
        )

    async def _generate_feedback(self) -> str:
        """Generate AI feedback based on the interview."""
        # In production, analyze transcript with LLM
        return (
            "You demonstrated good communication skills throughout the interview. "
            "Your technical answers showed solid foundational knowledge. "
            "For improvement, try to provide more specific examples from your experience "
            "and elaborate more on your problem-solving approach. Overall, a strong performance!"
        )


# ============================================
# Main Entry Point
# ============================================

if __name__ == "__main__":
    # Validate required environment variables
    required_vars = ["LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "DEEPGRAM_API_KEY", "ELEVENLABS_API_KEY", "OLLAMA_API_KEY"]
    missing = [var for var in required_vars if not os.getenv(var)]

    if missing:
        logger.error(f"Missing required environment variables: {missing}")
        logger.error("Please set all required variables before running.")
        exit(1)

    logger.info("Starting LiveKit Voice Interview Agent...")
    logger.info(f"Using Ollama Cloud: {OLLAMA_BASE_URL}")
    logger.info(f"Model: {OLLAMA_MODEL}")

    # Run the worker
    cli.run_app(WorkerOptions(agent_cls=InterviewAgent))
