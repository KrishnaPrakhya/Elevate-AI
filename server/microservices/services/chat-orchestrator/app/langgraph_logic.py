from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI
import os
import asyncio
import base64
import httpx

ollama_api_key = os.getenv("OLLAMA_API_KEY", "ollama")
ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
ollama_basic_auth = os.getenv("OLLAMA_BASIC_AUTH", "")

def _make_http_client():
    if not ollama_basic_auth:
        return None
    encoded = base64.b64encode(ollama_basic_auth.encode()).decode()
    def _inject(req: httpx.Request) -> None:
        req.headers["authorization"] = f"Basic {encoded}"
    return httpx.Client(event_hooks={"request": [_inject]})

_http_client = _make_http_client()

llm = ChatOpenAI(
    model=os.getenv("OLLAMA_MODEL", "llama3.2:3b"),
    openai_api_key=ollama_api_key,
    base_url=ollama_base_url,
    **({"http_client": _http_client} if _http_client else {}),
)


async def invoke_sync(runnable, payload):
    return await asyncio.to_thread(runnable.invoke, payload)

async def detect_intent(user_message: str) -> str:
    prompt = ChatPromptTemplate.from_messages([
        ("system", """Classify intent: document_improvement, job_search, career_advice.
        Return only the intent name."""),
        ("user", "{user_message}")
    ])
    chain = prompt | llm | StrOutputParser()
    result = await invoke_sync(chain, {"user_message": user_message})
    return str(result).lower().strip()