from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.dialects.postgresql import Any

from app.dependencies.auth import CurrentUser, get_current_user
from app.infra.database import DatabaseSession
from app.models.playlist import Playlist, PlaylistSong
from app.schemas.playlist import (
    AddPlaylistSongRequestPayload,
    AddPlaylistSongResponsePayload,
    CategoryResponsePayload,
    CreatePlaylistRequestPayload,
    CreatePlaylistResponsePayload,
    GetCategorySongsResponsePayload,
    GetPlaylistsByUserResponsePayload,
    GetPlaylistSongsResponsePayload,
    MasterItem,
    RemovePlaylistRequestPayload,
    RemovePlaylistSongBySongIdRequestPayload,
    SongLikedStatusResponsePayload,
    ToggleLikeSongRequestPayload,
    ToggleLikeSongResponsePayload,
    UpdatePlaylistRequestPayload,
    UpdatePlaylistResponsePayload,
)
from app.services.master import MasterService
from app.services.playlist import PlaylistService
from app.services.song_search import song_search
from app.utils.stream_helper import get_cover_art_url, get_stream_url

router = APIRouter(prefix="/playlist", dependencies=[Depends(get_current_user)])

STATIC_CATEGORIES: list[MasterItem] = [
    MasterItem(id="made-for-you", label="Made for you"),
    MasterItem(id="new-releases", label="New Releases"),
]


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
        song_playlists_set = set(
            playlist_service.get_playlists_by_song(
                user_id=current_user.id, song_id=song_id
            )
        )
        for playlist in playlists:
            playlist["contains_song"] = playlist["id"] in song_playlists_set

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
    "/category/master",
    response_model=CategoryResponsePayload,
    summary="Get all catgories",
    status_code=status.HTTP_200_OK,
)
def get_category_master(
    current_user: CurrentUser,
    db: DatabaseSession,
) -> dict[str, Any]:
    """Retrieve available genres, moods and languages"""
    master_service = MasterService(db)
    genres = master_service.get_all_genres()
    moods = master_service.get_all_moods()
    languages = master_service.get_all_languages()

    return {
        "static": STATIC_CATEGORIES,
        "genres": [
            MasterItem(id=item_id, label=label) for item_id, label in genres.items()
        ],
        "moods": [
            MasterItem(id=item_id, label=label) for item_id, label in moods.items()
        ],
        "languages": [
            MasterItem(id=item_id, label=label) for item_id, label in languages.items()
        ],
    }


@router.get(
    "/category",
    response_model=GetCategorySongsResponsePayload,
    summary="Get songs for a category",
    status_code=status.HTTP_200_OK,
)
def get_category_songs(
    label: str,
    current_user: CurrentUser,
    db: DatabaseSession,
    page: int = 1,
    limit: int = 20,
) -> dict[str, Any]:
    """
    Retrieve songs for a category using the song_search index.
    Client sends the category label as shown in UI plus the raw master id.
    """
    # Enforce safe bounds: min 1, max 40
    safe_limit = max(1, min(limit, 40))
    clean_label = label.strip()

    static_cat = next(
        (
            s
            for s in STATIC_CATEGORIES
            if s.label.lower() == clean_label.lower()
            or str(s.id).lower() == clean_label.lower()
        ),
        None,
    )
    if static_cat:
        # Static categories: latest songs (e.g. "Made for you", "New Releases")
        id, label = static_cat.id, static_cat.label
        matched_songs, total_count = song_search.get_latest_songs(
            page=page, limit=safe_limit
        )
    else:
        master_service = MasterService(db)
        tables = (
            ("genre", master_service.get_genre_by_name),
            ("mood", master_service.get_mood_by_name),
            ("lang", master_service.get_language_by_name),
        )

        resolved = None
        for category_type, fetch in tables:
            res = fetch(clean_label)
            if res:
                id, label = res
                resolved = (id, category_type, label)
                break

        if resolved is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Category not found")

        id, category_type, label = resolved
        matched_songs, total_count = song_search.get_songs_by_category(
            category_type, id, page=page, limit=safe_limit
        )

    safe_page = max(1, page)
    next_page = safe_page + 1 if safe_page * safe_limit < total_count else None

    return {
        "id": str(id),
        "label": label,
        "songs_count": total_count,
        "next_page": next_page,
        "songs": [
            {
                "id": s.id,
                "title": s.title,
                "artist": s.artist,
                "duration_sec": s.duration_sec,
                "cover_art_url": get_cover_art_url(s.cover_art_key),
                "stream_url": get_stream_url(s.master_aac_key, s.master_mp3_key),
                "album": s.album,
                "year": s.year,
            }
            for s in matched_songs
        ],
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
    result = playlist_service.get_playlist_songs(playlist_id, current_user.id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist songs not found or access denied",
        )
    playlist, song_items = result
    songs_data = [
        {
            "id": song.id,
            "playlist_song_id": ps.id,
            "created_at": ps.created_at,
            "title": song.title,
            "artist": song.artist,
            "duration_sec": song.duration_sec,
            "cover_art_url": get_cover_art_url(song.cover_art_key),
            "stream_url": get_stream_url(song.master_aac_key, song.master_mp3_key),
            "album": song.album,
            "year": song.year,
        }
        for ps, song in song_items
    ]
    return {
        "id": playlist.id,
        "label": playlist.label,
        "is_deletable": playlist.is_deletable,
        "songs_count": playlist.count,
        "created_at": playlist.created_at,
        "updated_at": playlist.updated_at,
        "songs": songs_data,
    }
