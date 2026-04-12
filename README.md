# ElevateAI - Intelligent Career Development Platform

ElevateAI is a sophisticated career development platform that leverages AI agents and LangGraph to provide personalized career guidance, interview preparation, and document optimization.

## 🌟 Key Features

- **AI-Powered Career Guidance**: Get personalized career advice using intelligent agent-based conversations
- **Smart Document Processing**: Optimize resumes and cover letters with ATS-friendly suggestions
- **Interview Preparation**: Practice with role-specific questions and receive instant feedback
- **Job Search Assistance**: Get tailored job recommendations based on your profile
- **Career Planning**: Generate customized preparation schedules and development plans

## 🛠️ Technical Architecture

### Agent-Based System using LangGraph

The platform implements a sophisticated multi-agent system using LangGraph, featuring:

1. **Supervisor Agent**
   - Analyzes user intent and orchestrates workflow
   - Routes requests to specialized agents
   - Manages conversation state and context

2. **Specialized Agents**
   - `document_improver`: Optimizes resumes and cover letters
   - `job_searcher`: Finds relevant job opportunities
   - `career_advisor`: Provides personalized career guidance
   - `schedule_generator`: Creates custom preparation schedules
   - `interview_preparer`: Generates interview questions and feedback

### API Architecture

Built with FastAPI, featuring:

```python
# Main agent workflow setup
workflow = StateGraph(AgentState)

# Agent nodes configuration
workflow.add_node("supervisor", supervisor_agent)
workflow.add_node("document_improver", document_improver)
workflow.add_node("job_searcher", job_searcher)
workflow.add_node("career_advisor", career_advisor)
workflow.add_node("schedule_generator", schedule_generator)
workflow.add_node("interview_preparer", interview_preparer)
```

### Database Schema

Uses SQLAlchemy with async support for efficient data management:

- User profiles
- Resume and cover letter storage
- Chat history
- Industry insights
- Assessment tracking

## 🚀 Key Technologies

- **Backend**: FastAPI with async support
- **AI Framework**: LangGraph for agent orchestration
- **Database**: PostgreSQL with async drivers
- **ORM**: SQLAlchemy with async support
- **AI Models**: Google's Gemini-2.5-flash-lite
- **Search Integration**: Tavily API for job searches

## 💡 Intelligent Features

### Document Analysis

```python
async def improve_document(input_data: DocumentInput, doc_type: str = "resume"):
    # AI-powered document improvement
    # Focuses on ATS optimization, content improvements, and industry alignment
```

### Career Guidance

```python
async def provide_career_advice(input_data: CareerAdviceInput):
    # Personalized career path recommendations
    # Skill development suggestions
    # Industry-specific insights
```

## 🔧 Setup and Installation

1. Clone the repository
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Set up environment variables:

```bash
GEMINI_API_KEY=your_api_key
TAVILY_API_KEY=your_api_key
DATABASE_URL=your_db_url

# Google OAuth Calendar (per-user calendar access)
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
# Optional: use OAuth client JSON instead of client id/secret
GOOGLE_CREDENTIALS_FILE=/absolute/path/oauth-client.json

# Backend callback URL (must match Google Cloud OAuth redirect URI)
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:5000/api/google/callback

# Frontend redirects after OAuth callback
GOOGLE_OAUTH_SUCCESS_REDIRECT=http://localhost:3000/profile?google_calendar=connected
GOOGLE_OAUTH_FAILURE_REDIRECT=http://localhost:3000/profile?google_calendar=failed

# State signing secret for OAuth flow integrity
GOOGLE_OAUTH_STATE_SECRET=replace_with_long_random_secret
```

4. Apply schema update for Google refresh token storage:

```bash
npx prisma generate
npx prisma db push
```

5. Run the application:

```bash
python server/app.py
```

## Google Calendar OAuth Onboarding (Per User)

1. Add `GOOGLE_OAUTH_REDIRECT_URI` to your Google Cloud OAuth client redirect URIs.
2. When a user clicks "Connect Google Calendar", open:

```text
GET /api/google/connect?clerk_user_id=<CLERK_USER_ID>&next_url=<FRONTEND_URL>
```

3. User grants consent in Google.
4. Google redirects to `/api/google/callback`.
5. Backend exchanges code, stores refresh token in DB (`User.googleCalendarRefreshToken`), and redirects to success URL.
6. Calendar event creation uses the stored per-user refresh token, so events are created in that user's calendar.

## 🌐 API Endpoints

### Chat Endpoint

```python
@app.post('/api/chat')
async def chat_endpoint(request_data: ChatRequest):
    # Handles user interactions
    # Routes to appropriate agents
    # Returns AI-generated responses
```
