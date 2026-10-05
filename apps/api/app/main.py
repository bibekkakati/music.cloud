from app.services.song_search import song_search
from app.services.song import SongService
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any

from bullmq import Worker
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlmodel import Session

from app.infra.database import check_db_health, engine, init_db
from app.infra.mq import JOB_CONFIG, JOB_PROCESSING_QUEUE, queue
from app.routers import auth, user, song, playlist
from app.routers.admin import song as admin_song
from app.services.session import SessionService
from app.utils.worker import process_job

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        init_db()
        logger.info("Database initialized successfully.")
    except Exception as e:  # noqa: BLE001
        logger.warning("Could not connect to database on startup (%s).", e)

    # Initialize and start the worker inside the API event loop
    worker = Worker(JOB_PROCESSING_QUEUE, process_job, opts=JOB_CONFIG)

    # Initialize search service with all songs
    with Session(engine) as db:
        song_service = SongService(db)
        song_search.set_songs(song_service)

    # Yield control back to FastAPI to start accepting HTTP requests
    yield

    # --- SHUTDOWN PHASE ---
    try:
        await asyncio.wait_for(worker.close(force=True), timeout=1.0)
    except Exception:
        pass

    try:
        await asyncio.wait_for(queue.close(), timeout=1.0)
    except Exception:
        pass

    try:
        engine.dispose()
    except Exception:
        pass


app = FastAPI(
    title="Music Cloud API",
    description="Private music streaming service",
    version="0.1.0",
    lifespan=lifespan,
)

from app.core.config import settings

origins = settings.cors_origins_list

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(admin_song.router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(auth.router, prefix="/api/v1", tags=["Authentication"])
app.include_router(user.router, prefix="/api/v1", tags=["User"])
app.include_router(song.router, prefix="/api/v1", tags=["Song"])
app.include_router(playlist.router, prefix="/api/v1", tags=["Playlist"])


@app.get("/health", tags=["Health"])
def health_check() -> Any:
    """Production health check endpoint verifying app and database status."""
    is_db_healthy = check_db_health()
    active_sessions = 0
    if is_db_healthy:
        try:
            with Session(engine) as db:
                session_service = SessionService(db)
                active_sessions = session_service.count_active_sessions()
        except Exception as e:  # noqa: BLE001
            logger.error("Could not connect to database on health check (%s).", e)

    data = {
        "status": "healthy" if is_db_healthy else "degraded",
        "database": "connected" if is_db_healthy else "disconnected",
        "active_sessions": active_sessions,
    }
    status_code = (
        status.HTTP_200_OK if is_db_healthy else status.HTTP_503_SERVICE_UNAVAILABLE
    )
    return JSONResponse(status_code=status_code, content=data)


@app.get("/")
def read_root():
    return {"name": "Music Cloud API", "version": "0.1.0", "docs_url": "/docs"}
