import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal
from rapidfuzz import fuzz

from app.models.song import Song, SongProcessingStatus
from app.services.song import SongService
from app.core.config import settings

logger = logging.getLogger("uvicorn.error")

@dataclass
class SongSearchPayload:
    id: str
    title: str
    artist: str
    duration_sec: int | None = None
    cover_art_key: str | None = None
    master_aac_key: str | None = None
    master_mp3_key: str | None = None
    genre: int | None = None
    moods: list[int] = field(default_factory=list)
    language: int | None = None
    year: int | None = None
    album: str | None = None
    created_at: datetime | None = None


CategoryType = Literal["genre", "mood", "lang"]


class SongSearchService:
    """
    In-memory song search and category service.
    - Stores songs in a dict: {song_id: SongSearchPayload}
    - Maintains a category index: {prefix_category_id: list[song_id]}
    - Maintains a prefix character index by word initials of title and artist: {char: set[song_id]}
    - Supports hybrid fuzzy text search and paginated category lookups.
    """

    def __init__(self):
        # 1. Primary storage: {id: SongSearchPayload}
        self.songs_by_id: dict[str, SongSearchPayload] = {}

        # 2. Category index: "genre:1", "mood:3", "lang:2"
        self.songs_by_category: dict[str, list[str]] = defaultdict(list)

        # Song ids ordered newest first (serves static categories)
        self.latest_song_ids: list[str] = []

        # 3. Word-initial prefix index: 'm' -> {song_id, ...}
        self.songs_by_char: dict[str, set[str]] = defaultdict(set)

    @property
    def songs(self) -> list[SongSearchPayload]:
        """Backward-compatibility property returning all songs as a list."""
        return list(self.songs_by_id.values())

    def _extract_word_initials(self, title: str, artist: str) -> set[str]:
        """Extract first character of every word in title and artist (lowercase)."""
        chars = set()
        text = f"{title} {artist}".lower()
        for word in text.split():
            clean_word = word.strip("()[]\"'.,-!?:;~/\\|`#@*&^%$<>{}").strip()
            if clean_word:
                chars.add(clean_word[0])
        return chars

    def set_songs(self, song_service: SongService):
        """
        Populate search and category indices from all public completed songs.
        """
        songs = song_service.get_all_songs(
            status=SongProcessingStatus.DONE, is_public=True, limit=None
        )

        self.songs_by_id.clear()
        self.songs_by_category.clear()
        self.songs_by_char.clear()
        self.latest_song_ids.clear()

        # Sort songs by created_at descending (newest first)
        sorted_songs = sorted(
            songs,
            key=lambda s: getattr(s, "created_at", None) or datetime.min,
            reverse=True,
        )

        for song in sorted_songs:
            self._index_song(song)

        logger.info("Indexed %d songs", len(sorted_songs))

    def _index_song(
        self,
        song: Song,
        prepend: bool = False,
    ):
        """Internal helper to index a single song into all indices."""
        song_id = str(song.id)

        moods_list = song.moods if isinstance(song.moods, list) else []

        payload = SongSearchPayload(
            id=song_id,
            title=song.title,
            artist=song.artist,
            duration_sec=song.duration_sec,
            cover_art_key=song.cover_art_key,
            master_aac_key=song.master_aac_key,
            master_mp3_key=song.master_mp3_key,
            genre=song.genre,
            moods=moods_list,
            language=song.language,
            year=song.year,
            album=song.album,
            created_at=song.created_at,
        )

        # 1. Primary storage
        self.songs_by_id[song_id] = payload

        # 2. Category index
        if song.genre is not None:
            self.songs_by_category[f"genre:{song.genre}"].append(song_id)

        for mood_id in moods_list:
            self.songs_by_category[f"mood:{mood_id}"].append(song_id)

        if song.language is not None:
            self.songs_by_category[f"lang:{song.language}"].append(song_id)

        # Newest-first ordering
        if prepend:
            self.latest_song_ids.insert(0, song_id)
        else:
            self.latest_song_ids.append(song_id)

        # 3. Word-initial character index
        for char in self._extract_word_initials(song.title, song.artist):
            self.songs_by_char[char].add(song_id)

    def add_song(
        self,
        song: Song,
    ):
        """Add song to search service."""
        song_id = str(song.id)
        if song_id in self.songs_by_id:
            self.remove_song(song_id)

        self._index_song(song, prepend=True)

    def remove_song(self, song_id: str):
        """Remove song from search service and all indices."""
        song_id = str(song_id)
        payload = self.songs_by_id.pop(song_id, None)
        if not payload:
            return

        # Clean from category indices
        if payload.genre is not None:
            genre_key = f"genre:{payload.genre}"
            if genre_key in self.songs_by_category:
                self.songs_by_category[genre_key] = [
                    sid for sid in self.songs_by_category[genre_key] if sid != song_id
                ]

        for mood_id in payload.moods:
            mood_key = f"mood:{mood_id}"
            if mood_key in self.songs_by_category:
                self.songs_by_category[mood_key] = [
                    sid for sid in self.songs_by_category[mood_key] if sid != song_id
                ]

        if payload.language is not None:
            lang_key = f"lang:{payload.language}"
            if lang_key in self.songs_by_category:
                self.songs_by_category[lang_key] = [
                    sid for sid in self.songs_by_category[lang_key] if sid != song_id
                ]

        if song_id in self.latest_song_ids:
            self.latest_song_ids.remove(song_id)

        # Clean from character index
        for char in self._extract_word_initials(payload.title, payload.artist):
            if char in self.songs_by_char:
                self.songs_by_char[char].discard(song_id)
                if not self.songs_by_char[char]:
                    del self.songs_by_char[char]

    def update_song(
        self,
        song: Song,
    ):
        """Update song in search service."""
        self.remove_song(str(song.id))
        if getattr(song, "is_public", True):
            self.add_song(song)

    def _paginate(
        self, ids: list[str], page: int, limit: int
    ) -> tuple[list[SongSearchPayload], int]:
        """Slice an ordered id list into a page of payloads. Returns (songs, total)."""
        safe_limit = max(1, limit)
        start = (max(1, page) - 1) * safe_limit
        page_ids = ids[start : start + safe_limit]
        return [self.songs_by_id[sid] for sid in page_ids if sid in self.songs_by_id], len(ids)

    def get_songs_by_category(
        self,
        category_type: CategoryType,
        category_id: int,
        page: int = 1,
        limit: int = 20,
    ) -> tuple[list[SongSearchPayload], int]:
        """Get paginated songs for a master category, keyed as '{type}:{id}'."""
        ids = self.songs_by_category.get(f"{category_type}:{category_id}", [])
        return self._paginate(ids, page, limit)

    def get_latest_songs(
        self, page: int = 1, limit: int = 20
    ) -> tuple[list[SongSearchPayload], int]:
        """Get paginated songs ordered newest first."""
        return self._paginate(self.latest_song_ids, page, limit)

    def search_song(self, q: str, limit: int = 10) -> list[SongSearchPayload]:
        """
        Search songs by query using candidate pruning via word initials + hybrid ranking:
        1. Exact substring matches in title/artist (highest priority)
        2. Prefix matches on title or artist words
        3. Multi-token matches where all search tokens appear
        4. Fuzzy matches with strict score cutoff (>= 68) for typo tolerance
        5. Fallback to scanning songs_by_id.values() when query is broad or fuzzy
        """
        if not self.songs_by_id:
            return []

        q = q.strip().lower()
        if len(q) <= 2:
            return []

        tokens = [
            t.strip("()[]\"'.,-!?:;~/\\|`#@*&^%$<>{}").strip()
            for t in q.split()
        ]
        tokens = [t for t in tokens if t]
        if not tokens:
            return []

        # Collect initials of all query tokens
        token_initials = {t[0] for t in tokens if t}

        # Candidate pruning: narrow search space using word-initial character index
        candidate_ids: set[str] = set()
        for ch in token_initials:
            if ch in self.songs_by_char:
                candidate_ids.update(self.songs_by_char[ch])

        candidates = [
            self.songs_by_id[sid]
            for sid in candidate_ids
            if sid in self.songs_by_id
        ]

        scored_matches: list[tuple[float, SongSearchPayload]] = []
        tested_ids: set[str] = set()

        threshold = float(settings.config.search.fuzzy_similarity_threshold)

        def _score_song(s: SongSearchPayload) -> float | None:
            title_lower = s.title.lower()
            artist_lower = (s.artist or "").lower()
            full_text = f"{title_lower} {artist_lower}"

            # 1. Exact match in title (top tier)
            if q == title_lower:
                return 200.0
            if title_lower.startswith(q):
                return 160.0
            if q in title_lower:
                return 140.0

            # 2. Exact match in artist
            if q == artist_lower:
                return 130.0
            if artist_lower.startswith(q):
                return 120.0
            if q in artist_lower:
                return 110.0

            # 3. Substring in combined text
            if q in full_text:
                return 100.0

            # 4. Multi-token match: all search words appear in title or artist
            if len(tokens) > 1 and all(token in full_text for token in tokens):
                return 90.0

            # 5. Fuzzy match for typo tolerance
            fuzz_score = fuzz.WRatio(q, full_text)
            if fuzz_score >= threshold:
                return float(fuzz_score)

            return None

        # Pass 1: Score candidate subset pruned by word initials
        for s in candidates:
            tested_ids.add(s.id)
            score = _score_song(s)
            if score is not None:
                scored_matches.append((score, s))

        # Pass 2: Fallback to scanning songs_by_id.values() when query is broad or fuzzy
        # (e.g. candidates yielded fewer matches than limit, or typo on word initial occurred)
        if len(scored_matches) < limit and len(tested_ids) < len(self.songs_by_id):
            for sid, s in self.songs_by_id.items():
                if sid not in tested_ids:
                    score = _score_song(s)
                    if score is not None:
                        scored_matches.append((score, s))

        # Sort descending by score
        scored_matches.sort(key=lambda x: x[0], reverse=True)
        return [match[1] for match in scored_matches[:limit]]


song_search = SongSearchService()