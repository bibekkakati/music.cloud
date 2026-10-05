# ==============================================================================
# Production Dockerfile for Music Cloud API Server
# Includes: Python 3.14, UV package manager, FFmpeg & FFprobe
# ==============================================================================

FROM python:3.14-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DEBIAN_FRONTEND=noninteractive \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# Install ffmpeg, ffprobe, and network utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Verify ffmpeg and ffprobe are available in system PATH
RUN ffmpeg -version && ffprobe -version

# Copy prebuilt uv binary from official Astral image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy dependency specifications first to leverage Docker layer caching
COPY pyproject.toml uv.lock ./

# Install project dependencies into virtual environment (.venv)
RUN uv sync --frozen --no-dev --no-install-project

# Copy application source code and configuration
COPY app/ ./app/
COPY README.md ./

# Sync the project itself
RUN uv sync --frozen --no-dev

# Place virtual environment binaries in system PATH
ENV PATH="/app/.venv/bin:$PATH"

# Prepare temporary scratch directory for audio transcoding operations
RUN mkdir -p /app/tmp && chmod 777 /app/tmp

# Expose default HTTP API port
EXPOSE 8000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start the FastAPI server using uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
