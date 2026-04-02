from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_google_genai import ChatGoogleGenerativeAI
import os

llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash-lite", google_api_key=os.getenv("GEMINI_API_KEY"))

async def detect_intent(user_message: str) -> str:
    prompt = ChatPromptTemplate.from_messages([
        ("system", """Classify intent: document_improvement, job_search, career_advice.
        Return only the intent name."""),
        ("user", "{user_message}")
    ])
    chain = prompt | llm | StrOutputParser()
    result = await chain.ainvoke({"user_message": user_message})
    return str(result).lower().strip()