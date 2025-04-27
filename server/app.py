from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import logging
from dotenv import load_dotenv
import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_community.tools.tavily_search import TavilySearchResults
import google.generativeai as genai
from langgraph.graph import StateGraph, END
from typing import TypedDict, Literal, Any
from pydantic import BaseModel, Field
import datetime
import uuid
from sqlalchemy import inspect

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()
app = Flask(__name__)
CORS(app)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Database Models (Unchanged)
class User(db.Model):
    __tablename__ = 'User'
    id = db.Column(db.String, primary_key=True, default=lambda: str(uuid.uuid4()))
    clerkUserId = db.Column(db.String, unique=True, nullable=False)
    email = db.Column(db.String, unique=True, nullable=False)
    name = db.Column(db.String)
    industry = db.Column(db.String)
    experience = db.Column(db.Integer)
    skills = db.Column(db.ARRAY(db.String))
    bio = db.Column(db.String)
    createdAt = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updatedAt = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    Resumes = db.relationship('Resume', backref='user', uselist=False)
    CoverLetters = db.relationship('CoverLetter', backref='user')
    chat_history = db.relationship('ChatHistory', backref='user')

class Resume(db.Model):
    __tablename__ = 'Resume'
    id = db.Column(db.String, primary_key=True, default=lambda: str(uuid.uuid4()))
    userId = db.Column(db.String, db.ForeignKey('User.id'), unique=True)
    content = db.Column(db.Text, nullable=False)
    createdAt = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updatedAt = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class CoverLetter(db.Model):
    __tablename__ = 'CoverLetter'
    id = db.Column(db.String, primary_key=True, default=lambda: str(uuid.uuid4()))
    userId = db.Column(db.String, db.ForeignKey('User.id'))
    content = db.Column(db.Text, nullable=False)
    jobTitle = db.Column(db.String)
    createdAt = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updatedAt = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class IndustryInsight(db.Model):
    __tablename__ = 'IndustryInsight'
    id = db.Column(db.String, primary_key=True, default=lambda: str(uuid.uuid4()))
    chat_messages = db.relationship('ChatHistory', backref='industry_insight')

class ChatHistory(db.Model):
    __tablename__ = 'ChatMessage'
    messageId = db.Column(db.String, primary_key=True, default=lambda: str(uuid.uuid4()))
    userId = db.Column(db.String, db.ForeignKey('User.id'))
    industryInsightId = db.Column(db.String, db.ForeignKey('IndustryInsight.id'), nullable=True)
    content = db.Column(db.Text, nullable=False)
    createdAt = db.Column(db.DateTime, default=datetime.datetime.utcnow)

# Initialize Database
def init_db():
    with app.app_context():
        inspector = inspect(db.engine)
        existing_tables = inspector.get_table_names()
        logger.info(f"Existing tables: {existing_tables}")
        
        if 'User' in existing_tables:
            columns = [col['name'] for col in inspector.get_columns('User')]
            logger.info(f"Columns in 'User': {columns}")
            if 'clerkUserId' not in columns:
                logger.warning("Column 'clerkUserId' missing in 'User' table.")
            else:
                logger.info("Verified 'clerkUserId' column.")
        logger.info("Skipping table creation to preserve camelCase schema.")

# Initialize LLM
secret_key = os.getenv("GEMINI_API_KEY")
if not secret_key:
    logger.error("GEMINI_API_KEY not found.")
    llm = None
else:
    genai.configure(api_key=secret_key)
    try:
        llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=secret_key)
        logger.info("Google Generative AI initialized.")
    except Exception as e:
        logger.error(f"Failed to initialize Google Generative AI: {e}")
        llm = None

# Input Models (Unchanged)
class DocumentInput(BaseModel):
    content: str = Field(description="Document content")
    target_role: str | None = Field(None, description="Target role")
    industry: str | None = Field(None, description="User's industry")
    job_description: str | None = Field(None, description="Job description")
    company_name: str | None = Field(None, description="Company name")

class JobSearchInput(BaseModel):
    keywords: list[str] = Field(description="Job title or skill keywords")
    location: str | None = Field(None, description="Preferred job location")
    industry: str | None = Field(None, description="Preferred industry")
    remote: bool | None = Field(None, description="Whether looking for remote positions")

class CareerAdviceInput(BaseModel):
    current_role: str | None = Field(None, description="User's current role")
    target_role: str | None = Field(None, description="User's target role")
    industry: str | None = Field(None, description="User's industry")
    skills: list[str] = Field(description="User's skills")
    experience_years: int | None = Field(None, description="Years of experience")
    career_goals: str | None = Field(None, description="User's career goals")

class PrepScheduleInput(BaseModel):
    target_role: str = Field(description="Target role")
    timeline_weeks: int | None = Field(None, description="Preparation timeline in weeks")
    current_skills: list[str] = Field(description="User's current skills")
    skills_to_develop: list[str] = Field(description="Skills to develop")
    has_resume: bool = Field(description="Whether user has a resume")
    has_cover_letter: bool = Field(description="Whether user has a cover letter")

class InterviewQuestionsInput(BaseModel):
    target_role: str = Field(description="Target role")
    industry: str | None = Field(None, description="User's industry")
    skills: list[str] = Field(description="User's skills")

def improve_document(input_data: DocumentInput, doc_type: str = "resume") -> str:
    try:
        prompt = ChatPromptTemplate.from_messages([
            ("system", f"""You are an expert {'resume' if doc_type == 'resume' else 'cover letter'} writer.
            Analyze the {'resume' if doc_type == 'resume' else 'cover letter'} and provide specific, actionable improvements.
            Focus on:
            1. Content improvements (achievements, metrics, action verbs)
            2. Structure and formatting
            3. {'ATS optimization' if doc_type == 'resume' else 'Job alignment'}
            4. Industry-specific best practices
            5. Tailoring for the target role or company
            Provide examples of how to rewrite or improve sections."""),
            ("user", f"""Content: {{content}}
            Target role: {{target_role}}
            Industry: {{industry}}
            {'Job description: {job_description}' if doc_type == 'cover_letter' else ''}
            {'Company: {company_name}' if doc_type == 'cover_letter' else ''}""")
        ])
        chain = prompt | llm | StrOutputParser()
        return chain.invoke({
            "content": input_data.content,
            "target_role": input_data.target_role or "Not specified",
            "industry": input_data.industry or "Not specified",
            "job_description": input_data.job_description or "Not provided" if doc_type == "cover_letter" else "",
            "company_name": input_data.company_name or "Not specified" if doc_type == "cover_letter" else ""
        })
    except Exception as e:
        logger.error(f"Error in improve_document ({doc_type}): {str(e)}")
        raise

def search_job_opportunities(input_data: JobSearchInput) -> str:
    try:
        query = " ".join(input_data.keywords)
        if input_data.industry:
            query += f" {input_data.industry}"
        if input_data.remote:
            query += " remote"
        if input_data.location:
            query += f" in {input_data.location}"
        
        search_tool = TavilySearchResults(max_results=5)
        search_results = search_tool.invoke({"query": f"job listings for {query}"})
        
        formatted_results = "Relevant job opportunities:\n\n"
        for i, result in enumerate(search_results, 1):
            formatted_results += f"{i}. Source: {result['url']}\n   Summary: {result['content'][:200]}...\n\n"
        
        return formatted_results
    except Exception as e:
        logger.error(f"Error in search_job_opportunities: {str(e)}")
        raise

def provide_career_advice(input_data: CareerAdviceInput) -> str:
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
        chain = prompt | llm | StrOutputParser()
        return chain.invoke({
            "current_role": input_data.current_role or "Not specified",
            "target_role": input_data.target_role or "Not specified",
            "industry": input_data.industry or "Not specified",
            "skills": ", ".join(input_data.skills),
            "experience_years": input_data.experience_years or "Not specified",
            "career_goals": input_data.career_goals or "Not specified"
        })
    except Exception as e:
        logger.error(f"Error in provide_career_advice: {str(e)}")
        raise

def generate_preparation_schedule(input_data: PrepScheduleInput) -> str:
    try:
        timeline_weeks = input_data.timeline_weeks or 4
        current_date = datetime.datetime.now()
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a career preparation expert.
            Create a detailed, week-by-week preparation schedule for the user.
            Include:
            1. Learning resources (courses, books, websites)
            2. Skill-building activities
            3. Resume and cover letter tasks
            4. Networking activities
            5. Interview preparation
            6. Application strategy
            Include dates starting from {current_date} for {timeline_weeks} weeks."""),
            ("user", """Target role: {target_role}
            Timeline: {timeline_weeks} weeks
            Current skills: {current_skills}
            Skills to develop: {skills_to_develop}
            Has resume: {has_resume}
            Has cover_letter: {has_cover_letter}""")
        ])
        chain = prompt | llm | StrOutputParser()
        return chain.invoke({
            "target_role": input_data.target_role,
            "timeline_weeks": timeline_weeks,
            "current_skills": ", ".join(input_data.current_skills),
            "skills_to_develop": ", ".join(input_data.skills_to_develop),
            "has_resume": "Yes" if input_data.has_resume else "No",
            "has_cover_letter": "Yes" if input_data.has_cover_letter else "No",
            "current_date": current_date.strftime("%Y-%m-%d")
        })
    except Exception as e:
        logger.error(f"Error in generate_preparation_schedule: {str(e)}")
        raise

def generate_interview_questions(input_data: InterviewQuestionsInput) -> str:
    try:
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert career coach.
            Generate 5-10 potential interview questions for the user's target role and industry.
            Include:
            1. Behavioral questions
            2. Technical questions (if applicable)
            3. Role-specific questions
            4. Industry-specific questions
            Provide brief guidance on answering each question."""),
            ("user", """Target role: {target_role}
            Industry: {industry}
            Skills: {skills}""")
        ])
        chain = prompt | llm | StrOutputParser()
        return chain.invoke({
            "target_role": input_data.target_role,
            "industry": input_data.industry or "Not specified",
            "skills": ", ".join(input_data.skills)
        })
    except Exception as e:
        logger.error(f"Error in generate_interview_questions: {str(e)}")
        raise

class AgentState(TypedDict):
    messages: list[dict[str, Any]]
    user_profile: dict[str, Any]
    next_agent: str | None  # Changed from current_agent to next_agent for clarity
    intent: str | None
    task_completed: bool

# Supervisor Agent
def supervisor_agent(state: AgentState) -> AgentState:
    try:
        latest_message = state["messages"][-1]["content"]
        intent = str(detect_intent(latest_message).lower().strip())
        intent_to_agent = {
            "document_improvement": "document_improver",
            "job_search": "job_searcher",
            "career_advice": "career_advisor",
            "preparation_schedule": "schedule_generator",
            "interview_preparation": "interview_preparer"
        }
        state["intent"] = intent
        state["next_agent"] = intent_to_agent.get(intent, "career_advisor")
        state["task_completed"] = False
        logger.info(f"Supervisor assigned intent: {intent}, routing to: {state['next_agent']}")
        return state
    except Exception as e:
        logger.error(f"Error in supervisor_agent: {str(e)}")
        state["messages"].append({"role": "assistant", "content": f"Error detecting intent: {str(e)}"})
        state["task_completed"] = True
        state["next_agent"] = None
        return state
# Agent Functions (Unchanged for brevity, but modularized)
def document_improver(state: AgentState) -> AgentState:
    try:
        user_profile = state.get("user_profile", {})
        latest_message = state["messages"][-1]["content"].lower()
        doc_type = "resume" if "resume" in latest_message else "cover_letter"
        
        content = user_profile.get("resume_content" if doc_type == "resume" else "cover_letter_content", "")
        if not content:
            state["messages"].append({"role": "assistant", "content": f"Please provide your {doc_type} content."})
            state["task_completed"] = True
            return state
        
        target_role = None
        if "target role" in latest_message:
            extract_prompt = ChatPromptTemplate.from_messages([
                ("system", "Extract the target role from the message. Return only the role name."),
                ("user", latest_message)
            ])
            extract_chain = extract_prompt | llm | StrOutputParser()
            target_role = extract_chain.invoke({})
        
        job_description = None
        company_name = None
        if doc_type == "cover_letter" and "job description" in latest_message:
            extract_prompt = ChatPromptTemplate.from_messages([
                ("system", "Extract the job description and company name. Return as JSON: {'job_description': str, 'company_name': str}"),
                ("user", latest_message)
            ])
            extract_chain = extract_prompt | llm | StrOutputParser()
            extracted = eval(extract_chain.invoke({}))
            job_description = extracted.get("job_description")
            company_name = extracted.get("company_name")
        
        result = improve_document(DocumentInput(
            content=content,
            target_role=target_role or user_profile.get("current_role"),
            industry=user_profile.get("industry"),
            job_description=job_description,
            company_name=company_name
        ), doc_type)
        
        state["messages"].append({"role": "assistant", "content": result})
        state["task_completed"] = True
        return state
    except Exception as e:
        logger.error(f"Error in document_improver: {str(e)}")
        state["messages"].append({"role": "assistant", "content": f"Error: {str(e)}"})
        state["task_completed"] = True
        return state

def job_searcher(state: AgentState) -> AgentState:
    try:
        user_profile = state.get("user_profile", {})
        latest_message = state["messages"][-1]["content"].lower()
        print("i am in job searcher")
        keywords = user_profile.get("skills", [])[:5]
        location = None
        if "in" in latest_message and any(city in latest_message for city in ["new york", "san francisco", "london", "hyderabad", "mumbai"]):
            location = latest_message.split("in")[-1].strip()
        
        result = search_job_opportunities(JobSearchInput(
            keywords=keywords,
            location=location,
            industry=user_profile.get("industry"),
            remote="remote" in latest_message
        ))
        
        state["messages"].append({"role": "assistant", "content": result})
        state["task_completed"] = True
        return state
    except Exception as e:
        logger.error(f"Error in job_searcher: {str(e)}")
        state["messages"].append({"role": "assistant", "content": f"Error: {str(e)}"})
        state["task_completed"] = True
        return state

def career_advisor(state: AgentState) -> AgentState:
    try:
        user_profile = state.get("user_profile", {})
        latest_message = state["messages"][-1]["content"]
        
        target_role = None
        career_goals = None
        if "target role" in latest_message.lower():
            extract_prompt = ChatPromptTemplate.from_messages([
                ("system", "Extract the target role and career goals. Return as JSON: {'target_role': str, 'career_goals': str}"),
                ("user", latest_message)
            ])
            extract_chain = extract_prompt | llm | StrOutputParser()
            extracted = eval(extract_chain.invoke({}))
            target_role = extracted.get("target_role")
            career_goals = extracted.get("career_goals")
        
        result = provide_career_advice(CareerAdviceInput(
            current_role=user_profile.get("current_role"),
            target_role=target_role,
            industry=user_profile.get("industry"),
            skills=user_profile.get("skills", []),
            experience_years=user_profile.get("experience_years", 0),
            career_goals=career_goals or latest_message if "goal" in latest_message.lower() else ""
        ))
        
        state["messages"].append({"role": "assistant", "content": result})
        state["task_completed"] = True
        return state
    except Exception as e:
        logger.error(f"Error in career_advisor: {str(e)}")
        state["messages"].append({"role": "assistant", "content": f"Error: {str(e)}"})
        state["task_completed"] = True
        return state

def schedule_generator(state: AgentState) -> AgentState:
    try:
        user_profile = state.get("user_profile", {})
        latest_message = state["messages"][-1]["content"].lower()
        
        target_role = user_profile.get("current_role", "Not specified")
        if "target role" in latest_message:
            extract_prompt = ChatPromptTemplate.from_messages([
                ("system", "Extract the target role. Return only the role name."),
                ("user", latest_message)
            ])
            extract_chain = extract_prompt | llm | StrOutputParser()
            target_role = extract_chain.invoke({})
        
        result = generate_preparation_schedule(PrepScheduleInput(
            target_role=target_role,
            timeline_weeks=4,
            current_skills=user_profile.get("skills", []),
            skills_to_develop=["Advanced " + s for s in user_profile.get("skills", [])[:3]],
            has_resume=bool(user_profile.get("resume_content")),
            has_cover_letter=bool(user_profile.get("cover_letter_content"))
        ))
        
        state["messages"].append({"role": "assistant", "content": result})
        state["task_completed"] = True
        return state
    except Exception as e:
        logger.error(f"Error in schedule_generator: {str(e)}")
        state["messages"].append({"role": "assistant", "content": f"Error: {str(e)}"})
        state["task_completed"] = True
        return state

def interview_preparer(state: AgentState) -> AgentState:
    try:
        user_profile = state.get("user_profile", {})
        latest_message = state["messages"][-1]["content"].lower()
        
        target_role = user_profile.get("current_role", "Not specified")
        if "target role" in latest_message:
            extract_prompt = ChatPromptTemplate.from_messages([
                ("system", "Extract the target role. Return only the role name."),
                ("user", latest_message)
            ])
            extract_chain = extract_prompt | llm | StrOutputParser()
            target_role = extract_chain.invoke({})
        
        result = generate_interview_questions(InterviewQuestionsInput(
            target_role=target_role,
            industry=user_profile.get("industry"),
            skills=user_profile.get("skills", [])
        ))
        
        state["messages"].append({"role": "assistant", "content": result})
        state["task_completed"] = True
        return state
    except Exception as e:
        logger.error(f"Error in interview_preparer: {str(e)}")
        state["messages"].append({"role": "assistant", "content": f"Error: {str(e)}"})
        state["task_completed"] = True
        return state

# Intent Detection
def detect_intent(user_message: str) -> str:
    prompt = ChatPromptTemplate.from_messages([
        ("system", """Classify the user's intent into one of:
        - document_improvement
        - job_search
        - career_advice
        - preparation_schedule
        - interview_preparation
        Return only the intent name."""),
        ("user", user_message)
    ])
    chain = prompt | llm | StrOutputParser()
    return chain.invoke({"user_message": user_message})

def router(state: AgentState) -> Literal["supervisor", "document_improver", "job_searcher", "career_advisor", "schedule_generator", "interview_preparer", "END"]:
    if state["task_completed"]:
        return "supervisor" if state["messages"][-1]["content"].startswith("Error") else "END"
    return state["next_agent"] or "supervisor"

# Create Workflow
def create_career_advisor_graph():
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("supervisor", supervisor_agent)
    workflow.add_node("document_improver", document_improver)
    workflow.add_node("job_searcher", job_searcher)
    workflow.add_node("career_advisor", career_advisor)
    workflow.add_node("schedule_generator", schedule_generator)
    workflow.add_node("interview_preparer", interview_preparer)
    
    # Set entry point to supervisor
    workflow.set_entry_point("supervisor")
    
    # Define conditional edges for supervisor
    workflow.add_conditional_edges(
        "supervisor",
        router,
        {
            "document_improver": "document_improver",
            "job_searcher": "job_searcher",
            "career_advisor": "career_advisor",
            "schedule_generator": "schedule_generator",
            "interview_preparer": "interview_preparer",
            "END": END
        }
    )
    
    # Define edges for agent nodes
    for node in ["document_improver", "job_searcher", "career_advisor", "schedule_generator", "interview_preparer"]:
        workflow.add_conditional_edges(
            node,
            router,
            {
                "supervisor": "supervisor",
                "document_improver": "document_improver",
                "job_searcher": "job_searcher",
                "career_advisor": "career_advisor",
                "schedule_generator": "schedule_generator",
                "interview_preparer": "interview_preparer",
                "END": END
            }
        )
    
    return workflow.compile()

# Initialize Graph Once
graph = create_career_advisor_graph()

# API Endpoint
@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        user_message = data.get('message', '')
        clerk_user_id = data.get('clerkUserId')
        
        if not clerk_user_id:
            return jsonify({'status': 'error', 'message': 'clerkUserId is required'}), 400
        
        user = User.query.filter_by(clerkUserId=clerk_user_id).first()
        if not user:
            return jsonify({'status': 'error', 'message': 'User not found'}), 404
        
        user_profile = {
            'clerkUserId': clerk_user_id,
            'resume_content': user.Resumes.content if user.Resumes else '',
            'cover_letter_content': user.CoverLetters[0].content if user.CoverLetters else '',
            'skills': user.skills or [],
            'industry': user.industry or '',
            'experience_years': user.experience or 0,
            'current_role': user.bio or ''
        }
        
        chat_history = [
            {"role": "user" if h.userId == user.id else "assistant", "content": h.content}
            for h in ChatHistory.query.filter_by(userId=user.id).order_by(ChatHistory.createdAt.desc()).limit(10).all()
        ]
        
        state = {
            "messages": chat_history,
            "user_profile": user_profile,
            "next_agent": None,
            "intent": None,
            "task_completed": False
        }
        state["messages"].append({"role": "user", "content": user_message})
        
        result = graph.invoke(state)
        
        db.session.add(ChatHistory(
            userId=user.id,
            industryInsightId=None,
            content=user_message
        ))
        db.session.add(ChatHistory(
            userId=user.id,
            industryInsightId=None,
            content=result["messages"][-1]["content"]
        ))
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'response': result["messages"][-1]["content"],
            'history': result["messages"]
        })
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)