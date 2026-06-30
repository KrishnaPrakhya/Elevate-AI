from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
import datetime, uuid

Base = declarative_base()

class Document(Base):
    __tablename__ = 'documents'
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    userId = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)
