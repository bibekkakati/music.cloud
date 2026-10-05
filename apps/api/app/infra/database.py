from collections.abc import Generator
from typing import Annotated

from fastapi import Depends
from sqlmodel import Session, SQLModel, create_engine, text

from app.core.config import settings
from app.models import *

engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,  # Maintains 10 persistent connections
    max_overflow=20,  # Can create 20 additional temporary connections
    pool_timeout=30,  # Wait 30 seconds for available connection
    pool_recycle=1800,  # Recycle connections after 30 minutes
)


def init_db() -> None:
    """Create database tables if they do not exist."""
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm;"))

    SQLModel.metadata.create_all(engine)


def get_db() -> Generator[Session, None, None]:
    """Dependency for providing a transactional database session."""
    with Session(engine) as session:
        yield session


def check_db_health() -> bool:
    """Check if the database is reachable."""
    try:
        with Session(engine) as session:
            session.exec(text("SELECT 1"))
        return True
    except Exception:  # noqa: BLE001
        return False


DatabaseSession = Annotated[Session, Depends(get_db)]
