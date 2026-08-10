from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI
import os
import asyncio
groq_api_key = os.getenv("GROQ_API_KEY", "")
groq_fallback_api_key = os.getenv("GROQ_API_KEY_FALLBACK") or os.getenv("GROQ_FALLBACK_API_KEY", "")
groq_base_url = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")

llm = ChatOpenAI(
    model=os.getenv("GROQ_MODEL", "openai/gpt-oss-20b"),
    openai_api_key=groq_api_key or "missing-groq-api-key",
    base_url=groq_base_url,
)
fallback_llm = ChatOpenAI(
    model=os.getenv("GROQ_MODEL", "openai/gpt-oss-20b"),
    openai_api_key=groq_fallback_api_key,
    base_url=groq_base_url,
    max_retries=0,
) if groq_fallback_api_key else None


async def invoke_sync(runnable, payload):
    return await asyncio.to_thread(runnable.invoke, payload)

async def detect_intent(user_message: str) -> str:
    prompt = ChatPromptTemplate.from_messages([
        ("system", """Classify intent: document_improvement, job_search, career_advice.
        Return only the intent name."""),
        ("user", "{user_message}")
    ])
    chain = prompt | llm | StrOutputParser()
    try:
        result = await invoke_sync(chain, {"user_message": user_message})
    except Exception as exc:
        status_code = getattr(exc, "status_code", None)
        retryable = status_code in (401, 408, 429, 498, 500, 501, 502, 503, 504) or any(
            token in f"{type(exc).__name__} {exc}".lower()
            for token in ("timeout", "network", "connection")
        )
        if not fallback_llm or not retryable:
            raise
        fallback_chain = prompt | fallback_llm | StrOutputParser()
        result = await invoke_sync(fallback_chain, {"user_message": user_message})
    return str(result).lower().strip()
