from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy.ext.declarative import declarative_base
from services.task_utils import create_engine_from_secret

engine = create_engine_from_secret(["rds!db-e8ae5506-2142-4355-ab5d-3344b9eadce8", "doai/openai/1015"])
SessionLocal = scoped_session(sessionmaker(bind=engine))
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()