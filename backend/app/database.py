from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session
from .config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
)


class Base(DeclarativeBase):
    pass


def get_db():
    with Session(engine) as session:
        yield session
