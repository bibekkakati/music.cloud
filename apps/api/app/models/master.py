from datetime import datetime, timezone
from enum import Enum

from sqlmodel import SQLModel, Field

class SongGenre(str, Enum):
    POP = "Pop"
    ROCK = "Rock"
    HIP_HOP = "Hip-Hop"
    ELECTRONIC = "Electronic"
    JAZZ = "Jazz"
    CLASSICAL = "Classical"
    FOLK = "Folk"
    FUSION = "Fusion"

class SongMood(str, Enum):
    HAPPY = "Happy"
    RELAX = "Relax"
    CHILL = "Chill"
    WORKOUT = "Workout"
    FOCUS = "Focus"
    ROMANTIC = "Romantic"
    DANCE = "Dance"
    SAD = "Sad"

class SongLanguage(str, Enum):
    ENGLISH = "English"
    HINDI = "Hindi"
    ASSAMESE = "Assamese"
    BENGALI = "Bengali"
    MARATHI = "Marathi"
    TAMIL = "Tamil"
    TELUGU = "Telugu"
    KANNADA = "Kannada"
    MALAYALAM = "Malayalam"
    PUNJABI = "Punjabi"

class SongGenreMaster(SQLModel, table=True):
    __tablename__ = "song_genre_master"
    
    id: int | None = Field(default=None, primary_key=True)
    genre: SongGenre = Field(nullable=False, unique=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
        schema_extra={"sa_type": "TIMESTAMPTZ"} 
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
        schema_extra={"sa_type": "TIMESTAMPTZ"}
    )

class SongMoodMaster(SQLModel, table=True):
    __tablename__ = "song_mood_master"
    
    id: int | None = Field(default=None, primary_key=True)
    mood: SongMood = Field(nullable=False, unique=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
        schema_extra={"sa_type": "TIMESTAMPTZ"} 
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
        schema_extra={"sa_type": "TIMESTAMPTZ"}
    )

class SongLanguageMaster(SQLModel, table=True):
    __tablename__ = "song_language_master"
    
    id: int | None = Field(default=None, primary_key=True)
    language: SongLanguage = Field(nullable=False, unique=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
        schema_extra={"sa_type": "TIMESTAMPTZ"} 
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
        schema_extra={"sa_type": "TIMESTAMPTZ"}
    )