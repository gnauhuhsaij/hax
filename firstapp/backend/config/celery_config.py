from celery import Celery

celery = Celery(
    "memory_tasks",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0",
)