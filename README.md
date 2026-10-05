# Music Cloud

> High-fidelity, self-hosted private music streaming platform and automated audio transcode pipeline.

[![Monorepo](https://img.shields.io/badge/monorepo-turborepo-blue.svg)](https://turbo.build/repo)
[![Backend](https://img.shields.io/badge/backend-FastAPI%20%7C%20Python-009688.svg)](https://fastapi.tiangolo.com/)
[![Frontend](https://img.shields.io/badge/frontend-React%20%7C%20Vite-61DAFB.svg)](https://react.dev/)
[![Streaming](https://img.shields.io/badge/streaming-HLS%20%7C%20Cloudflare%20R2-F38020.svg)](https://www.cloudflare.com/developer-platform/r2/)
[![Processing](https://img.shields.io/badge/audio-FFmpeg-007808.svg)](https://ffmpeg.org/)
[![License](https://img.shields.io/badge/license-Private-red.svg)](#)

---

## Overview

Music Cloud is a private audio streaming service engineered as a polyglot monorepo. It features an asynchronous FastAPI API server using FFmpeg for multi-bitrate HLS packaging, a React single-page client, and a globally distributed Cloudflare Edge Worker delivering protected audio streams and cached cover art directly from Cloudflare R2 object storage.

---

## Architecture and Structure

The codebase is organized as a workspace monorepo powered by Turborepo and npm workspaces:

```text
music-cloud/
├── apps/
│   ├── api/             # FastAPI backend, SQLModel ORM, BullMQ queue, and FFmpeg transcode pipeline
│   ├── web/             # React 19 single-page web client with hls.js audio player
│   └── edge-worker/     # Cloudflare Worker for edge HLS delivery, token validation, and static CDN
│
├── packages/
│   ├── types/           # Shared TypeScript models, API contracts, and JWT claims (@music-cloud/types)
│   └── tsconfig/        # Shared TypeScript compiler configuration presets (@music-cloud/tsconfig)
│
├── package.json         # Workspace manifests, task definitions, and devDependencies
├── turbo.json           # Turborepo task pipeline configuration
└── .env.example         # Central environment variable template
```

---

## Core Features

- **Adaptive Bitrate HLS Streaming**: Packages multi-bitrate AAC streams (256 kbps, 320 kbps) with segment preloading and sub-millisecond in-memory playlist caching.
- **Automated FFmpeg Transcode Pipeline**: Input tracks are inspected with `ffprobe`, embedded artwork is extracted to standardized JPEG files, and audio is segmented into 10-second chunks before concurrent upload to Cloudflare R2.
- **Edge CDN for Static Assets**: Cover art and images are served directly through the edge worker with immutable browser caching (`max-age=31536000`), avoiding slow presigned S3 URLs.
- **Secure Playback Token Authority**: Ephemeral 4-hour HMAC-SHA256 JWT tokens authorize audio playback at the edge without exposing raw storage keys.
- **Typo-Tolerant Search**: In-memory catalog indexing powered by RapidFuzz provides fast search results resilient to typos and partial keywords.
- **Session Cache with Grace Period**: A 5-minute in-memory session cache minimizes database load and automatically renews active user sessions.
- **Persistent Player State**: The web client preserves track selection, playback position, and volume across page reloads.

---

## Component Documentation

Detailed technical documentation for each application is available in its respective directory:

| Component       | Description                                                                         | Reference                                                                                          |
| :-------------- | :---------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------- |
| **API Server**  | FastAPI service, SQLModel database, BullMQ queue, and FFmpeg pipeline               | [apps/api/README.md](file:///Users/bibek/Documents/music-cloud/apps/api/README.md)                 |
| **Edge Worker** | Cloudflare Worker for token validation, HLS streaming, and static CDN caching       | [apps/edge-worker/README.md](file:///Users/bibek/Documents/music-cloud/apps/edge-worker/README.md) |
| **Web Client**  | React web application, `hls.js` integration, stream token manager, and admin studio | [apps/web/README.md](file:///Users/bibek/Documents/music-cloud/apps/web/README.md)                 |

---

## System Requirements

Ensure the following tools are available on the host machine:

- **Node.js**: 20.x or higher
- **npm**: 10.x or higher
- **Python**: 3.14.x or higher
- **uv**: 0.4.x or higher
- **FFmpeg & FFprobe**: 6.x or higher (installed and available on `$PATH`)

---

## Quick Start

### 1. Installation

Install all workspace dependencies and link internal packages:

```bash
git clone <repo-url> music-cloud
cd music-cloud
npm install
```

### 2. Environment Configuration

Copy the sample environment file to each target application:

```bash
cp .env.example apps/api/.env
```

Configure all required variables:

- `AUTH_SECRET`: Secret key for HMAC-SHA256 streaming tokens.
- `PASSCODE`: Non-empty authentication secret.
- `DATABASE_URL`: PostgreSQL connection URL.
- `CORS_ORIGINS`: Comma-separated list of allowed frontend domains (e.g. `http://localhost:5173,http://localhost:3000`).
- `S3_*`: Cloudflare R2 bucket credentials and endpoint.
- `EDGE_WORKER_URL`: Cloudflare Worker base streaming URL.

The API server validates required variables at startup and halts with a clear error list if any required key is omitted.

### 3. Running Development Services

Start the API server, web client, and edge worker simulator concurrently:

```bash
npm run dev
```

Target individual services during isolated development:

```bash
npm run dev:api      # Starts FastAPI on http://localhost:8000
npm run dev:web      # Starts Vite React client on http://localhost:5173
npm run dev:worker   # Starts Cloudflare Wrangler simulator on http://localhost:8787
```

### 4. Running the API Server with Docker

The API server can be built and run using the root workspace scripts:

```bash
# Build the production Docker image (Python 3.14, FFmpeg, FFprobe, uv)
npm run docker:build:api

# Run the container with apps/api/.env mounted
npm run docker:run:api
```

---

## Workspace Scripts

| Command                    | Description                                                                       |
| :------------------------- | :-------------------------------------------------------------------------------- |
| `npm run dev`              | Runs all applications concurrently (`api`, `web`, `edge-worker`) with prefix logs |
| `npm run dev:turbo`        | Starts development tasks across packages using Turborepo's terminal interface     |
| `npm run dev:api`          | Starts only the FastAPI backend development server                                |
| `npm run dev:web`          | Starts only the Vite React frontend client                                        |
| `npm run dev:worker`       | Starts only the Cloudflare Wrangler edge worker simulator                         |
| `npm run build`            | Builds all packages and web assets with Turborepo dependency caching              |
| `npm run lint`             | Runs linters across all workspace packages                                        |
| `npm run test`             | Executes test suites across all packages                                          |
| `npm run typecheck`        | Validates TypeScript types across workspaces                                      |
| `npm run clean`            | Purges `.turbo` caches and build artifacts                                        |
| `npm run docker:build:api` | Builds the production Docker image for the API server (`apps/api/Dockerfile`)     |
| `npm run docker:run:api`   | Runs the API container with `apps/api/.env` on port 8000                          |
