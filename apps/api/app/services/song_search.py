from app.models.song import Song, SongProcessingStatus
from app.services.song import SongService
from dataclasses import dataclass
from rapidfuzz import fuzz

@dataclass
class SongSearchPayload:
    id: str
    title: str
    artist: str
    duration_sec: int | None = None
    cover_art_url: str | None = None
    stream_url: str | None = None

class SongSearchService:
    """
    In-memory song search service using rapidfuzz library.
    Supports fuzzy searching of songs by title and artist.

    Attributes:
        songs: List of songs to search from
    """
    def __init__(self):
        self.songs: list[SongSearchPayload] = []

    def set_songs(self, song_service: SongService):
        """
        Set all public completed songs from database to search service
        """
        songs = song_service.get_all_songs(
            status=SongProcessingStatus.DONE, is_public=True, limit=None
        )
        self.songs = [
            SongSearchPayload(
                id=str(song.id),
                title=song.title,
                artist=song.artist,
                duration_sec=song.duration_sec,
                cover_art_url=song_service.get_cover_art_url(song.cover_art_key),
                stream_url=song_service.get_stream_url(song.master_aac_key, song.master_mp3_key),
            )
            for song in songs
        ]

    def add_song(self, song: Song, cover_art_url: str | None = None, stream_url: str | None = None):
        """
        Add song to search service
        """
        if stream_url is None:
            from app.core.config import settings
            base_url = (settings.EDGE_WORKER_URL or "").rstrip("/")
            key = song.master_aac_key or song.master_mp3_key
            if key and base_url and not key.startswith("http"):
                stream_url = f"{base_url}/{key.lstrip('/')}"
            else:
                stream_url = key

        self.songs.append(
            SongSearchPayload(
                id=str(song.id),
                title=song.title,
                artist=song.artist,
                duration_sec=song.duration_sec,
                cover_art_url=cover_art_url,
                stream_url=stream_url,
            )
        )

    def remove_song(self, song_id: str):
        """
        Remove song from search service
        """
        self.songs = [song for song in self.songs if str(song.id) != str(song_id)]

    def update_song(self, song: Song, cover_art_url: str | None = None, stream_url: str | None = None):
        """
        Update song in search service
        """
        self.remove_song(str(song.id))
        if getattr(song, "is_public", True):
            self.add_song(song, cover_art_url, stream_url)

    def search_song(self, q: str, limit: int = 20) -> list[SongSearchPayload]:
        """
        Search songs by query using a hybrid ranking approach:
        1. Exact substring matches in title/artist (highest priority)
        2. Prefix matches on title or artist words
        3. Multi-token matches where all search tokens appear
        4. Fuzzy matches with strict score cutoff (>= 68) for typo tolerance
        """
        if not self.songs:
            return []

        q = q.strip().lower()
        if len(q) <= 2:
            return []

        tokens = [t for t in q.split() if t]
        scored_matches: list[tuple[float, SongSearchPayload]] = []

        for s in self.songs:
            title_lower = s.title.lower()
            artist_lower = (s.artist or "").lower()
            full_text = f"{title_lower} {artist_lower}"

            # 1. Exact match in title (top tier)
            if q == title_lower:
                scored_matches.append((200.0, s))
                continue
            if title_lower.startswith(q):
                scored_matches.append((160.0, s))
                continue
            if q in title_lower:
                scored_matches.append((140.0, s))
                continue

            # 2. Exact match in artist
            if q == artist_lower:
                scored_matches.append((130.0, s))
                continue
            if artist_lower.startswith(q):
                scored_matches.append((120.0, s))
                continue
            if q in artist_lower:
                scored_matches.append((110.0, s))
                continue

            # 3. Substring in combined text
            if q in full_text:
                scored_matches.append((100.0, s))
                continue

            # 4. Multi-token match: all search words appear in title or artist
            if len(tokens) > 1 and all(token in full_text for token in tokens):
                scored_matches.append((90.0, s))
                continue

            # 5. Fuzzy match for typo tolerance (only for queries >= 2 chars)
            if len(q) >= 2:
                from app.core.config import settings
                threshold = float(settings.config.search.fuzzy_similarity_threshold)
                fuzz_score = fuzz.WRatio(q, full_text)
                if fuzz_score >= threshold:
                    scored_matches.append((float(fuzz_score), s))

        # Sort descending by score
        scored_matches.sort(key=lambda x: x[0], reverse=True)
        return [match[1] for match in scored_matches[:limit]]


song_search = SongSearchService()