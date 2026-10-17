import json
import logging
from dataclasses import dataclass

from google import genai
from google.genai import types

from app.infra.aiclient import aiclient
from app.models.master import (
    SongGenre,
    SongLanguage,
    SongMood,
)

logger = logging.getLogger("uvicorn.error")

DEFAULT_AI_MODELS = [
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite",
]


@dataclass
class SongProperties:
    genre: SongGenre
    moods: list[SongMood]
    language: SongLanguage


class AiAgent:
    def __init__(self, client, models: list[str] | None = None) -> None:
        self.client = client
        self.models: list[str] = list(models) if models else list(DEFAULT_AI_MODELS)

    def get_song_properties(
        self, title: str, artist: str, album: str | None = None
    ) -> SongProperties | None:
        if not title or not title.strip():
            logger.warning("Cannot get song properties without a title.")
            return None

        clean_artist = artist.strip() if artist else "Unknown"
        clean_album = album.strip() if album else "N/A"

        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(
                        text=f"""Title: {title.strip()}, Artist: {clean_artist}, Album: {clean_album}"""
                    ),
                ],
            ),
        ]
        generate_content_config = types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(
                thinking_level="MINIMAL",
            ),
            response_mime_type="application/json",
            response_schema=genai.types.Schema(
                type=genai.types.Type.OBJECT,
                required=["genre", "moods", "language"],
                properties={
                    "genre": genai.types.Schema(
                        type=genai.types.Type.STRING,
                        enum=[e.value for e in SongGenre],
                    ),
                    "moods": genai.types.Schema(
                        type=genai.types.Type.ARRAY,
                        items=genai.types.Schema(
                            type=genai.types.Type.STRING,
                            enum=[e.value for e in SongMood],
                        ),
                    ),
                    "language": genai.types.Schema(
                        type=genai.types.Type.STRING,
                        enum=[e.value for e in SongLanguage],
                    ),
                },
            ),
            system_instruction=[
                types.Part.from_text(
                    text="""You are a expert musicologist.
                    You will be given song details and you have to identify the mood, genre and language from the given enum for the provided song details.
                    If exact match is not found then return the most appropriate one.
                    You are not allowed to use any other string apart from the ones given in the enum.
                    """
                ),
            ],
        )

        for model in self.models:
            try:
                response = self.client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=generate_content_config,
                )

                if not response or not response.text:
                    logger.warning(
                        "Empty response received from model '%s' for '%s'. Trying next model if available.",
                        model,
                        title,
                    )
                    continue

                data = json.loads(response.text)
                genre = SongGenre(data["genre"])
                moods = [
                    SongMood(m)
                    for m in data.get("moods", [])
                    if m in SongMood._value2member_map_
                ]
                language = SongLanguage(data["language"])

                logger.info(
                    "Successfully extracted song properties for '%s' using model '%s'",
                    title,
                    model,
                )
                return SongProperties(
                    genre=genre,
                    moods=moods,
                    language=language,
                )
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    "Model '%s' failed for '%s': %s. Retrying with next available model.",
                    model,
                    title,
                    e,
                )
                continue

        logger.error(
            "All models (%s) failed to extract properties for song '%s'",
            self.models,
            title,
        )
        return None


aiagent = AiAgent(aiclient)
