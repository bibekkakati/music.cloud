from __future__ import annotations

from sqlmodel import Session, select

from app.models.master import (
    SongGenreMaster,
    SongMoodMaster,
    SongLanguageMaster,
    SongGenre,
    SongMood,
    SongLanguage,
)
from app.services.cache import CacheService, cache


class MasterService:
    GENRES_CACHE_KEY = "master:genres"
    MOODS_CACHE_KEY = "master:moods"
    LANGUAGES_CACHE_KEY = "master:languages"

    def __init__(self, db: Session, cache_service: CacheService | None = None) -> None:
        self.db = db
        self.cache = cache_service or cache

    # =========================================================================
    # Genres
    # =========================================================================
    def add_genre(self, genre: str) -> SongGenreMaster:
        if genre not in SongGenre:
            raise ValueError(f"Invalid genre: {genre}. Must be one of {list(SongGenre)}")

        genre_master = SongGenreMaster(genre=SongGenre(genre))
        self.db.add(genre_master)
        self.db.commit()
        self.db.refresh(genre_master)

        # Invalidate full collection cache so next read fetches authoritative map
        self.cache.delete(self.GENRES_CACHE_KEY)
        return genre_master

    def get_all_genres(self) -> dict[int, str]:
        """
        Fetch all genres as a dictionary { id: genre_name }.
        Checks cache first. On cache miss, fetches full table from DB, caches it, and returns.
        """
        cached = self.cache.get_json(self.GENRES_CACHE_KEY)
        if cached is not None:
            # JSON keys are stored as strings (e.g., "1": "Pop"). Convert keys back to int.
            return {int(k): v for k, v in cached.items()}

        # Cache miss: fetch full table from DB
        statement = select(SongGenreMaster)
        rows = self.db.exec(statement).all()
        data = {
            row.id: (row.genre.value if hasattr(row.genre, "value") else str(row.genre))
            for row in rows
            if row.id is not None
        }
        self.cache.set_json(self.GENRES_CACHE_KEY, data)
        return data

    def get_genre_by_id(self, genre_id: int) -> str | None:
        """
        Fetch a genre by integer ID.
        Always resolves through get_all_genres() to ensure full collection is cached on miss.
        """
        return self.get_all_genres().get(genre_id)

    def get_genre_by_name(self, genre_name: str) -> tuple[int, str] | None:
        """Look up genre integer ID by its name (case-insensitive)."""
        target = genre_name.strip().lower()
        for gid, name in self.get_all_genres().items():
            if name.lower() == target:
                return (gid, name)
        return None

    # =========================================================================
    # Moods
    # =========================================================================
    def add_mood(self, mood: str) -> SongMoodMaster:
        if mood not in SongMood:
            raise ValueError(f"Invalid mood: {mood}. Must be one of {list(SongMood)}")

        mood_master = SongMoodMaster(mood=SongMood(mood))
        self.db.add(mood_master)
        self.db.commit()
        self.db.refresh(mood_master)

        # Invalidate full collection cache
        self.cache.delete(self.MOODS_CACHE_KEY)
        return mood_master

    def get_all_moods(self) -> dict[int, str]:
        """
        Fetch all moods as a dictionary { id: mood_name }.
        Checks cache first. On cache miss, fetches full table from DB, caches it, and returns.
        """
        cached = self.cache.get_json(self.MOODS_CACHE_KEY)
        if cached is not None:
            # Convert JSON string keys back to int
            return {int(k): v for k, v in cached.items()}

        # Cache miss: fetch full table from DB
        statement = select(SongMoodMaster)
        rows = self.db.exec(statement).all()
        data = {
            row.id: (row.mood.value if hasattr(row.mood, "value") else str(row.mood))
            for row in rows
            if row.id is not None
        }
        self.cache.set_json(self.MOODS_CACHE_KEY, data)
        return data

    def get_mood_by_id(self, mood_id: int) -> str | None:
        """
        Fetch a mood by integer ID.
        Always resolves through get_all_moods() to ensure full collection is cached on miss.
        """
        return self.get_all_moods().get(mood_id)

    def get_mood_by_name(self, mood_name: str) -> tuple[int, str] | None:
        """Look up mood integer ID by its name (case-insensitive)."""
        target = mood_name.strip().lower()
        for mid, name in self.get_all_moods().items():
            if name.lower() == target:
                return (mid, name)
        return None

    # =========================================================================
    # Languages
    # =========================================================================
    def add_language(self, language: str) -> SongLanguageMaster:
        if language not in SongLanguage:
            raise ValueError(f"Invalid language: {language}. Must be one of {list(SongLanguage)}")

        language_master = SongLanguageMaster(language=SongLanguage(language))
        self.db.add(language_master)
        self.db.commit()
        self.db.refresh(language_master)

        # Invalidate full collection cache
        self.cache.delete(self.LANGUAGES_CACHE_KEY)
        return language_master

    def get_all_languages(self) -> dict[int, str]:
        """
        Fetch all languages as a dictionary { id: language_name }.
        Checks cache first. On cache miss, fetches full table from DB, caches it, and returns.
        """
        cached = self.cache.get_json(self.LANGUAGES_CACHE_KEY)
        if cached is not None:
            # Convert JSON string keys back to int
            return {int(k): v for k, v in cached.items()}

        # Cache miss: fetch full table from DB
        statement = select(SongLanguageMaster)
        rows = self.db.exec(statement).all()
        data = {
            row.id: (row.language.value if hasattr(row.language, "value") else str(row.language))
            for row in rows
            if row.id is not None
        }
        self.cache.set_json(self.LANGUAGES_CACHE_KEY, data)
        return data

    def get_language_by_id(self, language_id: int) -> str | None:
        """
        Fetch a language by integer ID.
        Always resolves through get_all_languages() to ensure full collection is cached on miss.
        """
        return self.get_all_languages().get(language_id)

    def get_language_by_name(self, language_name: str) -> tuple[int, str] | None:
        """Look up language integer ID by its name (case-insensitive)."""
        target = language_name.strip().lower()
        for lid, name in self.get_all_languages().items():
            if name.lower() == target:
                return (lid, name)
        return None
