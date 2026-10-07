from app.models.song import SongProcessingStatus
from app.services.song_search import song_search
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.dependencies.auth import CurrentUser
from app.infra.database import DatabaseSession
from app.schemas.song import (
    SongPublicResponsePayload,
    StreamTokenResponsePayload,
)
from app.services.song import SongService
from app.utils.stream_token import generate_stream_token

router = APIRouter(prefix="/song")

@router.get(
    "/all",
    response_model=list[SongPublicResponsePayload],
    summary="Get all songs details",
    status_code=status.HTTP_200_OK,
)  
def get_all_songs(
    user: CurrentUser,
    db: DatabaseSession,
    cursor: Annotated[str | None, Query(title="Page cursor")] = None,
) -> list[SongPublicResponsePayload]:
    song_service = SongService(db)
    songs = song_service.get_all_songs(
        cursor, SongProcessingStatus.DONE, is_public=True
    )
    return [
        SongPublicResponsePayload(
            id=song.id,
            title=song.title,
            artist=song.artist,
            duration_sec=song.duration_sec,
            cover_art_url=song_service.get_cover_art_url(song.cover_art_key),
            stream_url=song_service.get_stream_url(song.master_aac_key, song.master_mp3_key),
        )
        for song in songs
    ]

@router.get(
    "/search/suggestions",
    response_model=list[SongPublicResponsePayload],
    summary="Song search autocomplete",
    status_code=status.HTTP_200_OK,
)
def search_song_suggestions(
    user: CurrentUser,
    q: Annotated[str, Query(..., title="Search query")],
    limit: Annotated[int, Query(ge=1, le=50, title="Result limit")] = 20,
) -> list[SongPublicResponsePayload]:
    clean_q = q.strip()
    if len(clean_q) <= 2:
        return []
    
    results = song_search.search_song(clean_q, limit=limit)
    return [
        SongPublicResponsePayload(
            id=s.id,
            title=s.title,
            artist=s.artist,
            duration_sec=s.duration_sec,
            cover_art_url=s.cover_art_url,
            stream_url=s.stream_url,
        )
        for s in results
    ]


@router.get(
    "/stream/token",
    response_model=StreamTokenResponsePayload,
    summary="Generate 4-hour edge streaming token",
    status_code=status.HTTP_200_OK,
)
async def get_stream_token(
    user: CurrentUser,
) -> StreamTokenResponsePayload:
    token, expires_at = generate_stream_token(str(user.id))
    return StreamTokenResponsePayload(
        token=token,
        token_type="bearer",
        expires_at=expires_at,
    )


@router.get(
    "/{song_id}",
    response_model=SongPublicResponsePayload,
    summary="Get single public song by id",
    status_code=status.HTTP_200_OK,
)
def get_song_by_id(
    song_id: str,
    db: DatabaseSession,
) -> SongPublicResponsePayload:
    song_service = SongService(db)
    try:
        song = song_service.get_song(song_id)
        if not song.is_public or song.status != SongProcessingStatus.DONE:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Song not found or not public",
            )
        return SongPublicResponsePayload(
            id=song.id,
            title=song.title,
            artist=song.artist,
            duration_sec=song.duration_sec,
            cover_art_url=song_service.get_cover_art_url(song.cover_art_key),
            stream_url=song_service.get_stream_url(song.master_aac_key, song.master_mp3_key),
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Song not found",
        )



