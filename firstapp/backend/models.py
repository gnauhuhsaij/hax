# models.py
from sqlalchemy import Column, String, Text, DateTime, Integer, Boolean
from db import Base
from datetime import datetime

class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(String, primary_key=True)                # Hash ID of the evidence
    userid = Column(String, nullable=False)              # User ID
    workflowid = Column(String, nullable=False)          # Workflow ID
    content = Column(Text, nullable=False)               # Evidence text content
    timestamp = Column(DateTime, default=datetime.utcnow) # When it was stored

    subtask_index = Column(Integer, nullable=True)       # Index of the subtask
    step_index = Column(Integer, nullable=True)          # Index of the step within the subtask
    query_name = Column(String, nullable=True)           # Optional descriptive query name
    issynthesis = Column(Boolean, nullable=True)
    source = Column(String, nullable=True)
    summary = Column(String, nullable=True)
