# Music Cloud API Server

Asynchronous REST API and audio processing backend for Music Cloud, built with FastAPI, SQLModel, PostgreSQL, BullMQ, and FFmpeg.

---

## Purpose and Scope

The API server provides the core backend services for the Music Cloud platform:

- **Audio Processing Pipeline**: Automatically analyzes source audio, extracts embedded metadata and artwork, transcodes streams to multiple bitrates using FFmpeg, packages HLS playlists, and uploads assets directly to Cloudflare R2 object storage.
- **Media Catalog and Discovery**: Manages track metadata, user playlists, favorites, and typo-tolerant search indexing with RapidFuzz.
- **Access Control and Authentication**: Manages passcode-authenticated user sessions with an in-memory cache and issues short-lived, signed JWT tokens for media playback.
- **Admin Control Plane**: Exposes administrative endpoints for presigned direct audio uploads, pipeline job scheduling, and track visibility toggling.

---

## Architecture

```text
               +---------------------------------------------+
               |             FastAPI Application             |
               +---------------------------------------------+
               |  Routers: /auth, /song, /playlist, /admin   |
               +----------------------+----------------------+
                                      |
         +----------------------------+----------------------------+
         |                            |                            |
         v                            v                            v
+------------------+         +------------------+         +------------------+
|    SQLModel      |         |   SessionCache   |         |   BullMQ / MQ    |
|   PostgreSQL     |         |    (In-Memory)   |         |  Async Processing|
+------------------+         +------------------+         +--------+---------+
                                                                   |
                                                                   v
                                                          +------------------+
                                                          |  AudioProcessor  |
                                                          |  FFmpeg/FFprobe  |
                                                          +--------+---------+
                                                                   |
                                                                   v
                                                          +------------------+
                                                          |  Cloudflare R2   |
                                                          |   (boto3 S3)     |
                                                          +------------------+
```

---

## Core Features

### 1. Audio Processing with FFmpeg and FFprobe

- **Source Inspection**: Uses `ffprobe` to determine duration, channel configuration, sample rate, source bitrate, and container tags.
- **Multi-Bitrate HLS Generation**: Uses `ffmpeg` to transcode input audio into AAC streams at multiple target bitrates (256 kbps, 320 kbps) packaged into 10-second MPEG-TS segments with `.m3u8` playlists.
- **Conservative Encoding**: Never upscales low-bitrate source files beyond their original quality profile.
- **Artwork Extraction**: Automatically extracts embedded album artwork from ID3, Vorbis, or MP4 containers into standardized JPEG assets.
- **Concurrent Uploads**: Batches and streams generated segments, playlists, and cover art directly to Cloudflare R2 using a throttled async connection pool.

### 2. Session Management and Security

- **SHA-256 Hashed Sessions**: Session tokens are hashed with SHA-256 before database persistence while providing plain bearer tokens to clients, protecting active sessions against database snapshot leaks.
- **In-Memory Session Caching**: An in-memory cache validates incoming session tokens with a 5-minute time-to-live, bypassing database lookups on frequent API requests.
- **Grace-Period Renewal**: Sessions approaching expiration or recently expired within an allowed window are automatically renewed without interrupting user workflows.
- **Sliding-Window Rate Limiting**: Built-in sliding-window IP rate limiter protects `/api/v1/auth/login` against brute-force attacks, returning HTTP 429 with standard `Retry-After` headers.
- **Stream Token Issuance**: Generates dedicated HMAC-SHA256 streaming JWTs with a 4-hour validity period returned in JSON response payloads, avoiding cookie restrictions for mobile and cross-platform clients.
- **Configurable CORS**: Dynamic origin whitelisting configured via comma-separated domain lists in `CORS_ORIGINS`.

### 3. Catalog and Discovery Engine

- **Fuzzy Search**: Implements rapid in-memory searching using RapidFuzz for high-speed query matching resilient to typos and partial titles.
- **Track Visibility**: Administrative flag allows toggling tracks between public and private status.

### 4. Edge-First Static Delivery

- Generates clean, deterministic URLs for artwork pointing directly to the edge worker, eliminating computationally expensive S3 presigned URL creation.

---

## Audio Pipeline Workflow

```text
1. Admin Upload Request   --> API issues presigned R2 PUT URL
2. Direct Storage Upload  --> Raw audio uploaded directly to storage
3. Pipeline Trigger       --> API enqueues job in BullMQ
4. Download to Scratch    --> File pulled to temporary scratch storage
5. Inspection             --> ffprobe extracts bitrate, sample rate, and tags
6. Artwork Extraction     --> ffmpeg extracts embedded cover image
7. Transcode & Segment    --> ffmpeg encodes AAC renditions & packages 10s HLS chunks
8. Master Playlist        --> master.m3u8 created referencing all bitrates
9. Concurrent Upload      --> Segments and playlists uploaded to R2
10. Database Update       --> Song record updated with duration, keys, status = READY
11. Cleanup               --> Local temporary scratch files purged
```

---

## Directory Structure

```text
apps/api/
├── app/
│   ├── core/                   # Application configuration, exceptions, and security
│   │   ├── config.py           # Pydantic Settings resolution, validation, and domain defaults
│   │   ├── exceptions.py       # Domain exception hierarchy
│   │   └── rate_limit.py       # Thread-safe sliding window rate limiter
│   ├── dependencies/           # FastAPI dependency injection (auth.py)
│   ├── infra/                  # Database session engine, S3 client, and BullMQ queue
│   │   ├── database.py         # SQLModel database engine and session generator
│   │   ├── mq.py               # BullMQ job queue interface
│   │   └── s3client.py         # Boto3 client for Cloudflare R2
│   ├── models/                 # SQLModel database entities
│   │   ├── playlist.py         # Playlist and PlaylistSong models
│   │   ├── session.py          # User session model
│   │   ├── song.py             # Song metadata and processing status models
│   │   └── user.py             # User model
│   ├── routers/                # REST API route controllers
│   │   ├── admin/              # Direct upload, transcode triggers, and catalog admin
│   │   ├── auth.py             # Login, logout, and session check
│   │   ├── playlist.py         # Playlist CRUD and song associations
│   │   ├── song.py             # Public catalog and streaming token issuance
│   │   └── user.py             # Current user profile
│   ├── schemas/                # Pydantic request and response payload schemas
│   │   ├── auth.py
│   │   ├── playlist.py
│   │   ├── song.py
│   │   └── user.py
│   ├── services/               # Core business logic services
│   │   ├── auth.py             # Passcode verification and token creation
│   │   ├── playlist.py         # Playlist queries, ordering, and mutations
│   │   ├── session.py          # Database session persistence, hashing, and expiry
│   │   ├── session_cache.py    # 5-minute in-memory session validation cache
│   │   ├── song.py             # Song catalog operations and CDN URL generation
│   │   ├── song_processor.py   # Audio pipeline job coordinator
│   │   ├── song_search.py      # RapidFuzz in-memory fuzzy search index
│   │   ├── storage.py          # S3/R2 upload and streaming helpers
│   │   └── user.py             # User retrieval operations
│   ├── utils/                  # Transcoding and background worker utilities
│   │   ├── audio.py            # FFmpeg transcoding and HLS packager
│   │   ├── stream_token.py     # JWT stream token generator
│   │   └── worker.py           # BullMQ worker process runner
│   └── main.py                 # FastAPI application entry point and lifespan handler
├── tmp/                        # Local scratch directory for temporary audio processing
├── .dockerignore               # Docker build context exclusions
├── Dockerfile                  # Production container definition (Python 3.14 + FFmpeg + uv)
├── package.json                # Workspace package configuration (@music-cloud/api)
├── pyproject.toml              # Python dependencies and project specifications
└── uv.lock                     # Locked dependency tree
```

---

## Configuration and Environment Variables

The API server initializes configuration using Pydantic's `BaseSettings` defined in `app/core/config.py`.

### How Configuration is Loaded

1. **Environment File & System Env**: Reads from `apps/api/.env` during local execution or container environment variables in production.
2. **Fail-Fast Startup Validation**: On startup, Pydantic verifies all required variables. If any variable is missing or empty, execution halts with a formatted error message outlining the exact missing keys.
3. **Structured Sub-Configs**: Operational parameters are grouped into typed Pydantic models attached to `settings.config`:
    - `auth`: Session lifetime, grace period, cache TTL, stream token expiry, and rate limit thresholds.
    - `audio_processing`: Target bitrates (`[256, 320]`), format (`["aac"]`), HLS segment duration (`10s`), FFmpeg timeouts, and S3 upload concurrency.
    - `search`: Fuzzy matching threshold and result limits.
    - `storage`: Presigned URL expiry and cover art folder names.

### Required Environment Keys

| Variable              | Description                                                                | Example                                                       |
| :-------------------- | :------------------------------------------------------------------------- | :------------------------------------------------------------ |
| `AUTH_SECRET`         | Secret key used to sign and verify HS256 streaming JWT tokens              | `your-secret-key-32-chars`                                    |
| `PASSCODE`            | Shared administrative passcode for user authentication (strictly required) | `your-secure-passcode`                                        |
| `DATABASE_URL`        | PostgreSQL connection URL                                                  | `postgresql+psycopg://user:pass@host:5432/db?sslmode=require` |
| `CORS_ORIGINS`        | Comma-separated list of allowed web origins                                | `http://localhost:5173,https://music.example.com`             |
| `SESSION_EXPIRY_DAYS` | Base validity period for created user sessions                             | `30`                                                          |
| `S3_REGION`           | Cloudflare R2 / S3 region                                                  | `auto`                                                        |
| `S3_TOKEN`            | S3 API bearer token (if applicable)                                        | `your-r2-api-token`                                           |
| `S3_KEY`              | Cloudflare R2 Access Key ID                                                | `your-r2-access-key-id`                                       |
| `S3_SECRET`           | Cloudflare R2 Secret Access Key                                            | `your-r2-secret-access-key`                                   |
| `S3_ENDPOINT`         | Cloudflare R2 S3 endpoint URL                                              | `https://<account-id>.r2.cloudflarestorage.com`               |
| `S3_BUCKET`           | Cloudflare R2 bucket name                                                  | `music-cloud`                                                 |
| `EDGE_WORKER_URL`     | Base public URL of the Cloudflare Edge Worker                              | `https://music-cloud-edge.<user>.workers.dev`                 |

---

## Requirements and Setup

### Prerequisites

- Python 3.14+
- uv package manager
- FFmpeg and FFprobe installed and available in `$PATH`

### Running Locally

Run from the monorepo root:

```bash
npm run dev:api
```

Or directly from `apps/api`:

```bash
uv run fastapi dev
```

Interactive Swagger documentation is available at `http://localhost:8000/docs`.

---

## Docker Deployment

The API server includes a self-contained production `Dockerfile` featuring a lightweight Debian base, native `ffmpeg` and `ffprobe` binaries, and the `uv` package manager for fast dependency synchronization.

### Image Features

- **Multi-tooling**: Installs `ffmpeg` and `ffprobe` for audio analysis and HLS packaging.
- **Fast uv Synchronization**: Caches Python virtual environments using `uv.lock`.
- **Preconfigured Scratch Directory**: Sets up `/app/tmp` with appropriate permissions for audio transcoding.
- **Healthcheck**: Periodically verifies container responsiveness against `http://localhost:8000/health`.

### Building and Running with Docker

#### From Monorepo Root:

```bash
# Build image
npm run docker:build:api

# Run container with environment configuration
npm run docker:run:api
```

#### Directly from `apps/api`:

```bash
# Build image
npm run docker:build

# Run container
npm run docker:run
```

#### Direct Docker CLI Command:

```bash
# Build
docker build -t music-cloud-api apps/api

# Run
docker run -d \
  -p 8000:8000 \
  --env-file apps/api/.env \
  --name music-cloud-api \
  music-cloud-api
```
