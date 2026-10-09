# Music Cloud Edge Worker

Edge-deployed media streaming and static asset CDN powered by Cloudflare Workers and Cloudflare R2.

---

## Purpose

The Edge Worker serves as the edge proxy for media content delivery in the Music Cloud platform:

1. **Authenticated HLS Audio Streaming**: Verifies short-lived HMAC-SHA256 JWT tokens and delivers multi-bitrate HLS audio playlists (`.m3u8`) and audio segments (`.ts`, `.aac`, `.mp3`) directly from R2 storage.
2. **Static Asset Content Delivery**: Serves public assets such as track cover art (`cover_art/*`) with edge caching and immutable browser cache headers.

---

## Request Flow

```text
[Request]
   |
   +--> Validate method, path, key (403 if invalid)
   |
   +--> Image (cover_art/*, .jpg/.png/.webp/...)
   |       +--> No auth
   |       +--> Edge cache -> HIT: return | MISS: R2 -> cache -> return
   |
   +--> Playlist / Segment (.m3u8, .ts, .m4s, .aac, .mp3)
           +--> Verify JWT (path, Bearer header, or ?token=) -> 401 if invalid
           +--> Edge cache -> HIT: return (304 if ETag matches)
           +--> MISS: R2 -> stream to client + cache in background
           +--> Not found: 404, negative-cached for 60s
```

---

## Key Capabilities

### 1. Edge Caching

- **Edge cache:** `caches.default` caches playlists, segments, and cover art per Cloudflare data center.
- **Negative caching:** 404s are cached for 60s so repeat misses don't hit R2.

### 2. Cover Art

- **Tokenless:** image requests skip JWT checks, so they load directly in `<img>` tags.
- **Caching:** served with `Cache-Control: public, max-age=3600, s-maxage=86400`.
- **Conditional requests:** `If-None-Match` vs `ETag` returns `304 Not Modified`.

### 3. Security

- **JWT auth:** HS256 token verified against `AUTH_SECRET`, accepted via path (`/stream/<token>/...`), `Authorization: Bearer`, or `?token=`.
- **Source protection:** `originals/` is always denied.
- **Path traversal:** keys containing `..`, `//`, `\`, or a leading `.` or `/` return `403`.
- **Whitelist:** only `.m3u8`, `.ts`, `.m4s`, `.aac`, `.mp3`, and image types are served. Everything else returns `403`.

---

## Development and Deployment

Run from the monorepo root:

```bash
npm run dev:worker
```

Or from `apps/edge-worker`:

```bash
npx wrangler dev
```

### Deploying to Cloudflare

```bash
npx wrangler deploy
```
