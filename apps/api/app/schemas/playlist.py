from app.schemas.song import SongPublicResponsePayload
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

# Create playlist
class CreatePlaylistRequestPayload(BaseModel):
    label: str
    
class CreatePlaylistResponsePayload(BaseModel):
    id: UUID | str
    label: str
    is_deletable: bool
    songs_count: int
    created_at: datetime
    updated_at: datetime

# Update playlist
class UpdatePlaylistRequestPayload(BaseModel):
    id: UUID | str
    label: str
    
class UpdatePlaylistResponsePayload(BaseModel):
    id: UUID | str
    label: str
    is_deletable: bool
    songs_count: int
    created_at: datetime
    updated_at: datetime

# Remove playlist
class RemovePlaylistRequestPayload(BaseModel):
    id: UUID | str

# Get all playlist by user
class GetPlaylistsByUserResponsePayload(BaseModel):
    id: UUID | str
    label: str
    is_deletable: bool
    songs_count: int
    contains_song: bool = False
    created_at: datetime
    updated_at: datetime

# Add playlist song
class AddPlaylistSongRequestPayload(BaseModel):
    playlist_id: UUID | str
    song_id: UUID | str

class AddPlaylistSongResponsePayload(BaseModel):
    id: UUID | str
    playlist_id: UUID | str
    song_id: UUID | str
    created_at: datetime
    updated_at: datetime

# Remove playlist song
class RemovePlaylistSongBySongIdRequestPayload(BaseModel):
    playlist_id: UUID | str
    song_id: UUID | str

# Get playlist songs
class PlaylistSongResponse(SongPublicResponsePayload):
    playlist_song_id: UUID | str
    created_at: datetime
    
class GetPlaylistSongsResponsePayload(BaseModel):
    id: UUID | str
    label: str
    is_deletable: bool
    songs_count: int
    songs: list[PlaylistSongResponse]
    created_at: datetime
    updated_at: datetime

# Toggle like song
class ToggleLikeSongRequestPayload(BaseModel):
    song_id: UUID | str

class ToggleLikeSongResponsePayload(BaseModel):
    liked: bool
    playlist_id: UUID | str
    song_id: UUID | str

class SongLikedStatusResponsePayload(BaseModel):
    liked: bool
