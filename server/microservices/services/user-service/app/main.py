from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
import os
from . import models

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

app = FastAPI(title="User Service")

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

@app.get("/users/{clerk_user_id}")
async def get_user_by_clerk_id(clerk_user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.User).where(models.User.clerkUserId == clerk_user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user