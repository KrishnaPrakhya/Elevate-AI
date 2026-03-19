from sqlalchemy import Column, String, Integer, DateTime, ARRAY
from sqlalchemy.ext.declarative import declarative_base
import datetime, uuid

Base = declarative_base()

class User(Base):
    __tablename__ = 'users' # Use plural table names
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    clerkUserId = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    name = Column(String)
    industry = Column(String)
    experience = Column(Integer)
    skills = Column(ARRAY(String))
    bio = Column(String)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)