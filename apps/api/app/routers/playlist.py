from datetime import datetime, timezone
from sqlalchemy.dialects.postgresql import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies.auth import CurrentUser, get_current_user
from app.infra.database import DatabaseSession
from app.models.playlist import Playlist, PlaylistSong
from app.schemas.playlist import (
    AddPlaylistSongRequestPayload,
    AddPlaylistSongResponsePayload,
    CreatePlaylistRequestPayload,
    CreatePlaylistResponsePayload,
    GetPlaylistSongsResponsePayload,
    GetPlaylistsByUserResponsePayload,
    RemovePlaylistRequestPayload,
    RemovePlaylistSongBySongIdRequestPayload,
    UpdatePlaylistRequestPayload,
    UpdatePlaylistResponsePayload,
    ToggleLikeSongRequestPayload,
    ToggleLikeSongResponsePayload,
    SongLikedStatusResponsePayload,
)
from app.services.playlist import PlaylistService

router = APIRouter(prefix="/playlist", dependencies=[Depends(get_current_user)])


# ============================================================================
# Playlist Endpoints
# ============================================================================


@router.get(
    "/all",
    response_model=list[GetPlaylistsByUserResponsePayload],
    summary="Get all playlists for the current user",
    status_code=status.HTTP_200_OK,
)
def get_playlists(
    current_user: CurrentUser,
    db: DatabaseSession,
    song_id: UUID | None = None,
) -> list[dict[str, Any]]:
    """Retrieve all playlists owned by the authenticated user."""
    playlist_service = PlaylistService(db)
    playlists: list[dict] = playlist_service.get_playlists(current_user.id)

    if song_id:
        song_playlists_set = set(playlist_service.get_playlists_by_song(user_id=current_user.id, song_id=song_id))
        for playlist in playlists:
            playlist['contains_song'] = playlist['id'] in song_playlists_set

    return playlists

@router.post(
    "",
    response_model=CreatePlaylistResponsePayload,
    summary="Create a new playlist",
    status_code=status.HTTP_201_CREATED,
)
def create_playlist(
    current_user: CurrentUser,
    db: DatabaseSession,
    payload: CreatePlaylistRequestPayload,
) -> Playlist:
    """Create a new playlist for the authenticated user."""
    label = payload.label.strip()
    if not label:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Playlist label cannot be empty",
        )

    playlist_service = PlaylistService(db)
    return playlist_service.create_playlist(label, current_user.id)


@router.put(
    "",
    response_model=UpdatePlaylistResponsePayload,
    summary="Update a playlist",
    status_code=status.HTTP_200_OK,
)
def update_playlist(
    current_user: CurrentUser,
    db: DatabaseSession,
    payload: UpdatePlaylistRequestPayload,
) -> Playlist:
    """Update a playlist's label."""
    label = payload.label.strip()
    if not label:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Playlist label cannot be empty",
        )

    playlist_service = PlaylistService(db)
    playlist = playlist_service.update_playlist(payload.id, label, current_user.id)
    if not playlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist not found, unauthorized, or not editable",
        )
    return playlist


@router.delete(
    "",
    status_code=status.HTTP_200_OK,
    summary="Remove a playlist",
)
def remove_playlist(
    current_user: CurrentUser,
    db: DatabaseSession,
    payload: RemovePlaylistRequestPayload,
):
    """Remove a playlist using the request payload."""
    playlist_service = PlaylistService(db)
    playlist = playlist_service.remove_playlist(payload.id, current_user.id)
    if not playlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist not found, unauthorized, or not deletable",
        )
    return {"message": "Playlist removed successfully", "id": str(playlist.id)}


# ============================================================================
# Playlist Song Endpoints
# ============================================================================


@router.post(
    "/song/add",
    response_model=AddPlaylistSongResponsePayload,
    summary="Add a song to a playlist",
    status_code=status.HTTP_201_CREATED,
)
def add_playlist_song(
    current_user: CurrentUser,
    db: DatabaseSession,
    payload: AddPlaylistSongRequestPayload,
) -> PlaylistSong:
    """Add a song to a playlist owned by the authenticated user."""
    playlist_service = PlaylistService(db)
    playlist_song = playlist_service.add_playlist_song(
        payload.playlist_id, payload.song_id, current_user.id
    )
    if not playlist_song:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist not found or access denied",
        )
    return playlist_song


@router.post(
    "/song/remove",
    status_code=status.HTTP_200_OK,
    summary="Remove a song from a playlist using playlist_id and song_id",
)
def remove_song_from_playlist_by_song_id(
    current_user: CurrentUser,
    db: DatabaseSession,
    payload: RemovePlaylistSongBySongIdRequestPayload,
):
    """Remove a song from a playlist using playlist_id and song_id."""
    playlist_service = PlaylistService(db)
    success = playlist_service.remove_song_from_playlist_by_song_id(
        payload.playlist_id, payload.song_id, current_user.id
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Song not found in playlist or access denied",
        )

    return {"message": "Song removed from playlist successfully"}


# ============================================================================
# Song Like Toggle & Status Endpoints
# ============================================================================


@router.post(
    "/like/toggle",
    response_model=ToggleLikeSongResponsePayload,
    summary="Toggle like status for a song",
    status_code=status.HTTP_200_OK,
)
def toggle_like_song(
    current_user: CurrentUser,
    db: DatabaseSession,
    payload: ToggleLikeSongRequestPayload,
) -> dict[str, Any]:
    """Toggle a song's presence in the user's Liked playlist."""
    playlist_service = PlaylistService(db)
    try:
        return playlist_service.toggle_like_song(str(payload.song_id), current_user.id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e


@router.get(
    "/like/status/{song_id}",
    response_model=SongLikedStatusResponsePayload,
    summary="Get like status for a song",
    status_code=status.HTTP_200_OK,
)
def get_song_liked_status(
    song_id: UUID,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> dict[str, bool]:
    """Check if a song is in the user's Liked playlist."""
    playlist_service = PlaylistService(db)
    is_liked = playlist_service.is_song_liked(str(song_id), current_user.id)
    return {"liked": is_liked}


# ============================================================================
# Playlist Details and Songs Retrieval Endpoints
# ============================================================================


@router.get(
    "/category",
    response_model=GetPlaylistSongsResponsePayload,
    summary="Get songs for a category",
    status_code=status.HTTP_200_OK,
)
def get_category_songs(
    category: str,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> dict[str, Any]:
    """Retrieve songs for a category (skeleton / placeholder)."""
    now = datetime.now(timezone.utc)
    return {
        "id": f"category-{category.lower().replace(' ', '-')}",
        "label": category,
        "is_deletable": False,
        "songs_count": 0,
        "songs": [],
        "created_at": now,
        "updated_at": now,
    }


@router.get(
    "/{playlist_id}/songs",
    response_model=GetPlaylistSongsResponsePayload,
    summary="Get all songs in a playlist",
    status_code=status.HTTP_200_OK,
)
def get_playlist_songs(
    playlist_id: UUID,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> dict[str, Any]:
    """Retrieve all songs in a specified playlist."""
    playlist_service = PlaylistService(db)
    playlist = playlist_service.get_playlist_songs(playlist_id, current_user.id)
    if not playlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist songs not found or access denied",
        )
    return playlist
