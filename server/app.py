import asyncio
import datetime
import json
import logging
import os
import re
import uuid
from typing import Any, Literal, TypedDict, List, Optional
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode # Added for URL manipulation

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool


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

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# LiveKit imports for voice interview
try:
    from livekit.api import AccessToken
    LIVEKIT_AVAILABLE = True
except ImportError:
    LIVEKIT_AVAILABLE = False
    logger.warning("LiveKit SDK not installed. Voice interview features will be limited.")

load_dotenv()

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
    experience = Column(Integer)
    skills = Column(ARRAY(String)) # Assuming PostgreSQL ARRAY, adjust if different DB
    bio = Column(String)
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

# Agent State (Unchanged)
class AgentState(TypedDict):
    messages: list[dict[str, Any]]
    user_profile: dict[str, Any]
    next_agent: str | None
    intent: str | None
    task_completed: bool

# Intent Detection (Async)
async def detect_intent(user_message: str) -> str:
    message = user_message.lower().strip()

    # Fast keyword routing avoids unnecessary LLM calls and works during model quota limits.
    if any(k in message for k in ["job", "jobs", "openings", "hiring", "opportunity"]):
        return "job_search"
    if any(k in message for k in ["interview", "questions", "mock interview"]):
        return "interview_preparation"
    if any(k in message for k in ["plan", "roadmap", "schedule", "timeline"]):
        return "preparation_schedule"
    if any(k in message for k in ["resume", "cv", "cover letter", "improve my resume"]):
        return "document_improvement"

    try:
        prompt = ChatPromptTemplate.from_messages([
            ("system", """Classify the user's intent into one of:
            - document_improvement
            - job_search
            - career_advice
            - preparation_schedule
            - interview_preparation
            Return only the intent name."""),
            ("user", "{user_message_val}") # Renamed for clarity
        ])
        # Ensure the output is stripped and lowercased
        result = await invoke_prompt_template(prompt, {"user_message_val": user_message})
        return str(result).lower().strip()
    except Exception as e:
        logger.error(f"Error in detect_intent: {str(e)}")
        return "career_advice"

# Supervisor Agent (Async)
async def supervisor_agent(state: AgentState) -> AgentState:
    try:
        latest_message_content = state["messages"][-1]["content"]
        intent_val = await detect_intent(latest_message_content)
        intent_to_agent = {
            "document_improvement": "document_improver",
            "job_search": "job_searcher",
            "career_advice": "career_advisor",
            "preparation_schedule": "schedule_generator",
            "interview_preparation": "interview_preparer"
        }
        state["intent"] = intent_val
        state["next_agent"] = intent_to_agent.get(intent_val, "career_advisor") # Default to career_advisor
        state["task_completed"] = False # This agent's task is to route, not complete the user's request
        logger.info(f"Supervisor assigned intent: {intent_val}, routing to: {state['next_agent']}")
        return state
    except Exception as e:
        logger.error(f"Error in supervisor_agent: {str(e)}")
        state["messages"].append({"role": "assistant", "content": f"Sorry, I had trouble understanding your request. Error: {str(e)}"})
        state["task_completed"] = True # Mark as completed to go to END
        state["next_agent"] = None # Ensure no further agent runs
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

async def career_advisor(state: AgentState) -> AgentState:
    try:
        user_profile = state.get("user_profile", {})
        latest_message_content = state["messages"][-1]["content"]
        latest_message_lower = latest_message_content.lower()

        target_role = None
        career_goals = None

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


# Router: Decides the next step in the graph
def router_logic(state: AgentState) -> Literal[
    "supervisor", "document_improver", "job_searcher", 
    "career_advisor", "schedule_generator", "interview_preparer", "__end__"
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
        workflow.add_node("schedule_generator", schedule_generator)
        workflow.add_node("interview_preparer", interview_preparer)
        
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
            "schedule_generator": "schedule_generator",
            "interview_preparer": "interview_preparer",
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
        agent_node_names = ["document_improver", "job_searcher", "career_advisor", "schedule_generator", "interview_preparer"]
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

# FastAPI Dependency for DB Session
async def get_db_session() -> AsyncSession: # Changed to async generator
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
            'resume_content': user_resume_content,
            'cover_letter_content': user_cover_letter_content,
            'skills': user.skills or [],
            'industry': user.industry or '',
            'experience_years': user.experience if user.experience is not None else 0,
            'current_role': user.bio or ''
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
            task_completed=False
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
                createdAt=datetime.datetime.utcnow() # Ensure timestamp for ordering
            )
            db.add(user_msg_db)

            # Save assistant's response
            if assistant_response_content:
                assistant_msg_db = ChatHistory(
                    userId=user.id, # Still associating with user ID due to schema
                    content=assistant_response_content,
                    # role="assistant" # <-- Would be ideal
                    createdAt=datetime.datetime.utcnow() # Ensure it's later or has distinct timestamp
                )
                db.add(assistant_msg_db)
            
            await db.commit() # Commit both
            logger.info("Chat messages (user and assistant) saved to DB.")
        except Exception as db_error:
            await db.rollback()
            logger.error(f"Error saving chat history to DB: {str(db_error)}", exc_info=True)
            # Don't let DB error stop the response to user, but they should know
            # assistant_response_content += " (Warning: Could not save this interaction to history)" # Optional warning

        return {
            'status': 'success',
            'response': format_markdown_response(assistant_response_content),
            'history': final_state["messages"] # Full history from the graph
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


if __name__ == "__main__":
    init_db() 

    logger.info("Starting FastAPI server with Uvicorn.")
    port = int(os.getenv("PORT", "5000")) # Default to 5000 if not set
    uvicorn.run(app, host="0.0.0.0", port=port)