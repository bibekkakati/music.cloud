from app.services.song_search import song_search
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query, status

from app.dependencies.auth import AdminUser, require_admin
from app.infra.database import DatabaseSession
from app.models.song import Song
from app.schemas.song import (
    AdminSongListResponsePayload,
    AdminSongResponsePayload,
    CoverArtUpdateRequestPayload,
    CoverArtUploadResponsePayload,
    SongMetaDataUpdateRequestPayload,
    SongProcessRequestPayload,
    SongUploadResponsePayload,
    SongVisibilityUpdateRequestPayload,
)
from app.services.song import SongService

router = APIRouter(
    prefix="/song", dependencies=[Depends(require_admin)]
)

SUPPORTED_CONTENT_TYPES = [
    "audio/mpeg",
    "audio/wav",
    "audio/aac",
    "audio/flac",
    "audio/ogg",
    "audio/webm",
]
SUPPORTED_FORMATS = ["mp3", "aac", "flac", "wav"]
SUPPORTED_COVER_ART_CONTENT_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
]
SUPPORTED_COVER_ART_FORMATS = ["jpg", "jpeg", "png", "webp"]


@router.get(
    "/upload/url",
    response_model=SongUploadResponsePayload,
    summary="Request for a song upload URL",
    status_code=status.HTTP_200_OK,
)
def get_upload_url(
    user: AdminUser,
    db: DatabaseSession,
    extension: Annotated[str, Query(..., title="File extension")],
    content_type: Annotated[str, Query(..., title="Content type")],
    title: Annotated[str, Query(..., title="Song title")],
    artist: Annotated[str, Query(..., title="Artist name")],
):
    """
    Returns a pre-signed URL for uploading the original song file.
    """
    # Validate content_type
    if content_type not in SUPPORTED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported content type")

    if extension not in SUPPORTED_FORMATS:
        raise HTTPException(status_code=400, detail="Unsupported file format")

    if not title.strip():
        raise HTTPException(status_code=400, detail="Title is required")

    if not artist.strip():
        raise HTTPException(status_code=400, detail="Artist is required")

    song_service = SongService(db)
    return song_service.get_upload_url(user, title, artist, extension, content_type)


@router.post(
    "/process",
    summary="Start processing the uploaded song",
    status_code=status.HTTP_200_OK,
)
async def process_uploaded_song(
    payload: Annotated[SongProcessRequestPayload, Body(..., embed=True)],
    user: AdminUser,
    db: DatabaseSession,
):
    if not payload.song_id:
        raise HTTPException(status_code=400, detail="Song ID is required")

    song_service = SongService(db)
    try:
        song = await song_service.process_song(
            user,
            payload.song_id,
            payload.trim_start_sec or 0.0,
        )
        return {"status": song.status, "song_id": str(song.id)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/process/status",
    summary="Fetch the song processing status",
    status_code=status.HTTP_200_OK,
)
def get_song_process_status(
    song_id: Annotated[str, Query(..., title="Song ID")],
    user: AdminUser,
    db: DatabaseSession,
):
    song_service = SongService(db)
    try:
        song = song_service.get_song(song_id)
        return {"status": song.status}
    except ValueError as e:
        raise HTTPException(status_code=404, detail="Song not found") from e


@router.get(
    "/all",
    response_model=AdminSongListResponsePayload,
    summary="Get all songs details",
    status_code=status.HTTP_200_OK,
)
def get_all_songs(
    user: AdminUser,
    db: DatabaseSession,
    cursor: Annotated[str | None, Query(title="Page cursor")] = None,
) -> AdminSongListResponsePayload:
    song_service = SongService(db)
    songs = song_service.get_all_songs(cursor, limit=21)
    has_next = len(songs) > 20
    page_songs = songs[:20] if has_next else songs
    next_cursor = str(page_songs[-1].id) if has_next and page_songs else None

    return AdminSongListResponsePayload(
        songs=[
            AdminSongResponsePayload(
                **song.model_dump(),
                cover_art_url=song_service.get_cover_art_url(song.cover_art_key),
            )
            for song in page_songs
        ],
        cursor=next_cursor,
    )


@router.get(
    "/{song_id}",
    response_model=AdminSongResponsePayload,
    summary="Get song details",
    status_code=status.HTTP_200_OK,
)
def get_song(
    song_id: Annotated[str, Path(..., title="Song ID")],
    user: AdminUser,
    db: DatabaseSession,
) -> AdminSongResponsePayload:
    song_service = SongService(db)
    try:
        song = song_service.get_song(song_id)
        return AdminSongResponsePayload(
            **song.model_dump(),
            cover_art_url=song_service.get_cover_art_url(song.cover_art_key),
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail="Song not found") from e


@router.put(
    "/visibility",
    response_model=AdminSongResponsePayload,
    summary="Update song visibility (public or private)",
    status_code=status.HTTP_200_OK,
)
def update_song_visibility(
    payload: Annotated[SongVisibilityUpdateRequestPayload, Body(..., embed=True)],
    user: AdminUser,
    db: DatabaseSession,
) -> AdminSongResponsePayload:
    if not payload.song_id:
        raise HTTPException(status_code=400, detail="Song ID is required")

    song_service = SongService(db)
    try:
        song = song_service.update_song_visibility(
            payload.song_id, payload.is_public
        )
        cover_art_url = song_service.get_cover_art_url(song.cover_art_key)
        if song.is_public:
            song_search.update_song(song, cover_art_url)
        else:
            song_search.remove_song(str(song.id))
        return AdminSongResponsePayload(
            **song.model_dump(),
            cover_art_url=cover_art_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.put(
    "/metadata",
    response_model=AdminSongResponsePayload,
    summary="Update song metadata",
    status_code=status.HTTP_200_OK,
)
def update_song_metadata(
    payload: Annotated[SongMetaDataUpdateRequestPayload, Body(..., embed=True)],
    user: AdminUser,
    db: DatabaseSession,
) -> AdminSongResponsePayload:
    if not payload.song_id:
        raise HTTPException(status_code=400, detail="Song ID is required")

    if not payload.title:
        raise HTTPException(status_code=400, detail="Title is required")

    song_service = SongService(db)
    try:
        song = song_service.update_song_metadata(
            payload.song_id,
            payload.title,
            payload.artist,
            payload.is_public,
            payload.cover_art_key,
        )
        cover_art_url = song_service.get_cover_art_url(song.cover_art_key)
        if song.is_public:
            song_search.update_song(song, cover_art_url)
        else:
            song_search.remove_song(str(song.id))
        return AdminSongResponsePayload(
            **song.model_dump(),
            cover_art_url=cover_art_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get(
    "/{song_id}/cover-art/upload-url",
    response_model=CoverArtUploadResponsePayload,
    summary="Request a presigned URL to upload song cover art",
    status_code=status.HTTP_200_OK,
)
def get_cover_art_upload_url(
    song_id: Annotated[str, Path(..., title="Song ID")],
    extension: Annotated[str, Query(..., title="File extension (jpg, png, webp)")],
    content_type: Annotated[str, Query(..., title="Content type (image/jpeg, etc.)")],
    user: AdminUser,
    db: DatabaseSession,
):
    """
    Returns a pre-signed S3/R2 URL for uploading song cover art.
    Key follows the format: cover_art/{song_id}.{extension}
    """
    norm_content_type = content_type.lower().strip()
    norm_ext = extension.lstrip(".").lower().strip()

    if norm_content_type not in SUPPORTED_COVER_ART_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported cover art content type. Allowed: {', '.join(SUPPORTED_COVER_ART_CONTENT_TYPES)}",
        )

    if norm_ext not in SUPPORTED_COVER_ART_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported cover art format. Allowed: {', '.join(SUPPORTED_COVER_ART_FORMATS)}",
        )

    song_service = SongService(db)
    try:
        return song_service.get_cover_art_upload_url(
            song_id, norm_ext, norm_content_type
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail="Song not found") from e


@router.get(
    "/cover-art/upload/url",
    response_model=CoverArtUploadResponsePayload,
    summary="Request a presigned URL to upload song cover art (query parameter)",
    status_code=status.HTTP_200_OK,
)
def get_cover_art_upload_url_by_query(
    song_id: Annotated[str, Query(..., title="Song ID")],
    extension: Annotated[str, Query(..., title="File extension (jpg, png, webp)")],
    content_type: Annotated[str, Query(..., title="Content type (image/jpeg, etc.)")],
    user: AdminUser,
    db: DatabaseSession,
):
    return get_cover_art_upload_url(song_id, extension, content_type, user, db)


@router.put(
    "/{song_id}/cover-art",
    response_model=AdminSongResponsePayload,
    summary="Update song cover art key directly",
    status_code=status.HTTP_200_OK,
)
def update_song_cover_art(
    song_id: Annotated[str, Path(..., title="Song ID")],
    payload: Annotated[CoverArtUpdateRequestPayload, Body(..., embed=True)],
    user: AdminUser,
    db: DatabaseSession,
) -> AdminSongResponsePayload:
    if not payload.cover_art_key:
        raise HTTPException(status_code=400, detail="cover_art_key is required")

    song_service = SongService(db)
    try:
        song = song_service.update_song_cover_art(song_id, payload.cover_art_key)
        cover_art_url = song_service.get_cover_art_url(song.cover_art_key)
        if song.is_public:
            song_search.update_song(song, cover_art_url)
        return AdminSongResponsePayload(
            **song.model_dump(),
            cover_art_url=cover_art_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e