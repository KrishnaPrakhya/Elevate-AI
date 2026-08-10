from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI
import os
import asyncio
groq_api_key = os.getenv("GROQ_API_KEY", "")
groq_base_url = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")

llm = ChatOpenAI(
    model=os.getenv("GROQ_MODEL", "openai/gpt-oss-20b"),
    openai_api_key=groq_api_key or "missing-groq-api-key",
    base_url=groq_base_url,
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
