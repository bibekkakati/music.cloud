from google import genai

from app.core.config import settings

aiclient = genai.Client(
    api_key=settings.GEMINI_API_KEY,
)
