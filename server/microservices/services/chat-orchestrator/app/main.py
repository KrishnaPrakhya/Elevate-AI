from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from . import service_clients, langgraph_logic, message_queue

class ChatRequest(BaseModel):
    message: str
    clerkUserId: str

app = FastAPI(title="Chat Orchestrator")

@app.post("/api/chat")
async def chat_handler(request: ChatRequest):
    # 1. Get User Profile from User Service
    user_profile = await service_clients.get_user_profile(request.clerkUserId)
    if not user_profile:
        raise HTTPException(status_code=404, detail="User not found")

    # 2. Detect Intent using LangGraph/LLM logic
    intent = await langgraph_logic.detect_intent(request.message)

    # 3. Create a payload for the worker
    task_payload = {
        "user_profile": user_profile,
        "user_message": request.message,
        # In a real app, you'd fetch resume/cover letter content here too
        "documents": {"resume": "...", "cover_letter": "..."}
    }

    # 4. Publish the task to the message queue
    message_queue.publish_task(task_type=intent, payload=task_payload)

    # 5. Respond to the user immediately
    return {
        "status": "success",
        "message": "Your request is being processed. The agent will provide a response shortly.",
        "intent_detected": intent
    }
# NOTE: This is an async fire-and-forget pattern. The actual response would
# be delivered later, e.g., via WebSockets or another polling endpoint.