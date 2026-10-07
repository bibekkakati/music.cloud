import uuid
from typing import Any
from sqlmodel import Session, select

from app.models.playlist import Playlist, PlaylistSong
from app.models.song import Song
from app.services.song import SongService


def _to_uuid(val: str | uuid.UUID) -> uuid.UUID:
    return val if isinstance(val, uuid.UUID) else uuid.UUID(str(val))


class PlaylistService:
    def __init__(self, db: Session):
        self.db = db

    def create_playlist(
        self, label: str, user_id: str | uuid.UUID, is_deletable: bool = True
    ) -> Playlist:
        owner_uuid = _to_uuid(user_id)
        playlist = Playlist(label=label, owner_id=owner_uuid, is_deletable=is_deletable)
        self.db.add(playlist)
        self.db.commit()
        self.db.refresh(playlist)
        return playlist

    def remove_playlist(
        self, playlist_id: str | uuid.UUID, user_id: str | uuid.UUID
    ) -> Playlist | None:
        p_uuid = _to_uuid(playlist_id)
        playlist = self.db.get(Playlist, p_uuid)
        if not playlist:
            return None
        if str(playlist.owner_id) != str(user_id):
            return None
        if not playlist.is_deletable:
            return None

        # Clear playlist songs
        playlist_songs = self.db.exec(
            select(PlaylistSong).where(PlaylistSong.playlist_id == p_uuid)
        ).all()
        for playlist_song in playlist_songs:
            self.db.delete(playlist_song)

        self.db.delete(playlist)
        self.db.commit()
        return playlist

    def update_playlist(
        self, playlist_id: str | uuid.UUID, label: str, user_id: str | uuid.UUID
    ) -> Playlist | None:
        p_uuid = _to_uuid(playlist_id)
        playlist = self.db.get(Playlist, p_uuid)
        if not playlist:
            return None
        if str(playlist.owner_id) != str(user_id):
            return None
        if not playlist.is_deletable:
            return None
        playlist.label = label
        self.db.commit()
        self.db.refresh(playlist)
        return playlist

    def get_playlists(
        self, user_id: str | uuid.UUID, song_id: str | uuid.UUID | None = None
    ) -> list[dict[str, Any]]:
        owner_uuid = _to_uuid(user_id)
        statement = (
            select(Playlist)
            .outerjoin(PlaylistSong, Playlist.id == PlaylistSong.playlist_id)
            .where(Playlist.owner_id == owner_uuid)
            .group_by(Playlist.id)
            .order_by(Playlist.created_at.desc())
        )
        results = self.db.exec(statement).all()

        return [
            {
                "id": playlist.id,
                "label": playlist.label,
                "is_deletable": playlist.is_deletable,
                "songs_count": playlist.count,
                "created_at": playlist.created_at,
                "updated_at": playlist.updated_at,
            }
            for playlist in results
        ]

    def get_playlists_by_song(
        self,
        song_id: str | uuid.UUID,
        user_id: str | uuid.UUID,
    ) -> list[uuid.UUID]:
        owner_uuid = _to_uuid(user_id)
        s_uuid = _to_uuid(song_id)
        
        statement = (
            select(Playlist.id)
            .join(PlaylistSong, PlaylistSong.song_id == s_uuid)
            .where(Playlist.owner_id == owner_uuid)
            .group_by(Playlist.id)
        )
        results = self.db.exec(statement).all()

        return results

    def add_playlist_song(
        self,
        playlist_id: str | uuid.UUID,
        song_id: str | uuid.UUID,
        user_id: str | uuid.UUID,
    ) -> PlaylistSong | None:
        p_uuid = _to_uuid(playlist_id)
        s_uuid = _to_uuid(song_id)
        playlist = self.db.get(Playlist, p_uuid)
        if not playlist:
            return None
        if str(playlist.owner_id) != str(user_id):
            return None

        # Prevent duplicate song in the same playlist
        existing = self.db.exec(
            select(PlaylistSong).where(
                PlaylistSong.playlist_id == p_uuid,
                PlaylistSong.song_id == s_uuid,
            )
        ).first()
        if existing:
            return existing

        playlist_song = PlaylistSong(playlist_id=p_uuid, song_id=s_uuid)
        self.db.add(playlist_song)

        # Update the count by 1 in playlist
        playlist.sqlmodel_update({ "count": playlist.count + 1 })
        self.db.add(playlist)

        self.db.commit()
        self.db.refresh(playlist_song)
        self.db.refresh(playlist)
        return playlist_song

    def remove_song_from_playlist_by_song_id(
        self,
        playlist_id: str | uuid.UUID,
        song_id: str | uuid.UUID,
        user_id: str | uuid.UUID,
    ) -> bool:
        p_uuid = _to_uuid(playlist_id)
        s_uuid = _to_uuid(song_id)
        playlist = self.db.get(Playlist, p_uuid)
        if not playlist or str(playlist.owner_id) != str(user_id):
            return False

        statement = select(PlaylistSong).where(
            PlaylistSong.playlist_id == p_uuid,
            PlaylistSong.song_id == s_uuid,
        )
        playlist_songs = self.db.exec(statement).all()
        if not playlist_songs:
            return False

        # Decrement count
        playlist.sqlmodel_update({ "count": playlist.count - len(playlist_songs) })
        self.db.add(playlist)

        for ps in playlist_songs:
            self.db.delete(ps)
        
        self.db.commit()
        self.db.refresh(playlist)
        return True

    def get_playlist_songs(
        self, playlist_id: str | uuid.UUID, user_id: str | uuid.UUID
    ) -> dict[str, Any] | None:
        p_uuid = _to_uuid(playlist_id)

        playlist = self.db.get(Playlist, p_uuid)
        if not playlist:
            return None
        if str(playlist.owner_id) != str(user_id):
            return None

        statement = (
            select(PlaylistSong, Song)
            .join(Song, PlaylistSong.song_id == Song.id)
            .where(PlaylistSong.playlist_id == p_uuid)
            .order_by(PlaylistSong.created_at.asc())
        )
        results = self.db.exec(statement).all()
        song_service = SongService(self.db)

        songs_data = []
        for ps, song in results:
            if not song or not getattr(song, "is_public", False):
                continue
            songs_data.append({
                "id": ps.song_id,
                "playlist_song_id": ps.id,
                "created_at": ps.created_at,
                "title": song.title if song else None,
                "artist": song.artist if song else None,
                "duration_sec": song.duration_sec if song else None,
                "cover_art_url": song_service.get_cover_art_url(song.cover_art_key) if song else None,
                "stream_url": song_service.get_stream_url(song.master_aac_key, song.master_mp3_key) if song else None,
            })

        return {
            "id": playlist.id,
            "label": playlist.label,
            "is_deletable": playlist.is_deletable,
            "songs_count": playlist.count,
            "created_at": playlist.created_at,
            "updated_at": playlist.updated_at,
            "songs": songs_data,
        }

    def get_or_create_liked_playlist(self, user_id: str | uuid.UUID) -> Playlist:
        """Find the user's Liked playlist or create it with is_deletable=False."""
        owner_uuid = _to_uuid(user_id)
        statement = select(Playlist).where(
            Playlist.owner_id == owner_uuid,
            Playlist.label == "Liked",
        )
        playlist = self.db.exec(statement).first()
        if not playlist:
            playlist = self.create_playlist(
                label="Liked", user_id=owner_uuid, is_deletable=False
            )
        return playlist

    def toggle_like_song(
        self, song_id: str | uuid.UUID, user_id: str | uuid.UUID
    ) -> dict[str, Any]:
        """Toggle like status for a song in the user's Liked playlist."""
        liked_playlist = self.get_or_create_liked_playlist(user_id)
        song_uuid = _to_uuid(song_id)

        # Check if song is already in "Liked" playlist
        statement = select(PlaylistSong).where(
            PlaylistSong.playlist_id == liked_playlist.id,
            PlaylistSong.song_id == song_uuid,
        )
        existing_song = self.db.exec(statement).first()

        if existing_song:
            self.db.delete(existing_song)
            self.db.commit()
            return {
                "liked": False,
                "playlist_id": str(liked_playlist.id),
                "song_id": str(song_uuid),
            }
        else:
            # Add to Liked playlist using add_playlist_song
            playlist_song = self.add_playlist_song(
                liked_playlist.id, song_uuid, user_id
            )
            if not playlist_song:
                raise ValueError("Could not add song to Liked playlist")
            return {
                "liked": True,
                "playlist_id": str(liked_playlist.id),
                "song_id": str(song_uuid),
            }

    def is_song_liked(
        self, song_id: str | uuid.UUID, user_id: str | uuid.UUID
    ) -> bool:
        """Check if a song exists in the user's Liked playlist."""
        owner_uuid = _to_uuid(user_id)
        statement = select(Playlist).where(
            Playlist.owner_id == owner_uuid,
            Playlist.label == "Liked",
        )
        liked_playlist = self.db.exec(statement).first()
        if not liked_playlist:
            return False

        song_uuid = _to_uuid(song_id)
        song_statement = select(PlaylistSong).where(
            PlaylistSong.playlist_id == liked_playlist.id,
            PlaylistSong.song_id == song_uuid,
        )
        return self.db.exec(song_statement).first() is not None