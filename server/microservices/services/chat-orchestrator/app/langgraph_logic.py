from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI
import os
import asyncio

ollama_api_key = os.getenv("OLLAMA_API_KEY", os.getenv("OPENAI_API_KEY", ""))
ollama_base_url = os.getenv("OLLAMA_BASE_URL", "https://ollama.com/v1")

llm = ChatOpenAI(
    model="minimax-m2.7",
    openai_api_key=ollama_api_key,
    base_url=ollama_base_url,
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