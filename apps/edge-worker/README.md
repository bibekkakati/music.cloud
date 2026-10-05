# Music Cloud Edge Worker

Edge-deployed media streaming and static asset CDN powered by Cloudflare Workers and Cloudflare R2.

---

## Purpose

The Edge Worker serves as the edge proxy for media content delivery in the Music Cloud platform:
1. **Authenticated HLS Audio Streaming**: Verifies short-lived HMAC-SHA256 JWT tokens and delivers multi-bitrate HLS audio playlists (`.m3u8`) and audio segments (`.ts`, `.aac`, `.mp3`) directly from R2 storage.
2. **Static Asset Content Delivery**: Serves public assets such as track cover art (`cover_art/*`) with edge caching and immutable browser cache headers.

---

## Operations and Request Flow

```text
[Incoming Request]
       |
       +--> Public Asset (cover_art/*, .jpg, .png, .webp)?
       |        |
       |        +--> Skip Auth Token Check
       |        +--> Check Edge Cache (caches.default)
       |        +--> Cache Hit: Return 200 with immutable headers
       |        +--> Cache Miss: Pull from R2 (env.R2_BUCKET.get) -> Cache at Edge -> Return 200
       |
       +--> Audio Stream (.m3u8, .ts, .aac, .mp3)?
                |
                +--> Verify Stream JWT Token
                +--> Playlist (.m3u8)?
                |        +--> Check In-Memory RAM Cache (< 1ms)
                |        +--> Cache Hit: Return 200
                |        +--> Cache Miss: Pull from R2 -> Store in RAM & Edge -> Preload Next Segment
                |
                +--> Audio Segment (.ts, .aac, .m4s)?
                         +--> Check Edge Cache -> Serve Cached or Fetch from R2
```

---

## Key Capabilities

### 1. Multi-Tiered Audio Caching
- **RAM Playlist Cache**: Caches hot `.m3u8` playlists in the worker isolate memory for fast sub-millisecond retrieval.
- **Edge Cache Integration**: Uses `caches.default` to cache variant playlists, segments, and cover art across Cloudflare data centers.
- **Predictive Segment Preloading**: When a master playlist is requested, the worker automatically warms the first variant playlist and the initial segment (`seg_000.ts`) in the background via `ctx.waitUntil`.

### 2. Static Asset Delivery (Cover Art)
- **Tokenless Access**: Public cover art requests bypass JWT verification, allowing direct loading in browser elements without custom headers.
- **Immutable Browser Caching**: Assets are returned with `Cache-Control: public, max-age=31536000, s-maxage=31536000, immutable`.
- **Conditional Requests**: Supports `If-None-Match` vs `ETag` to return `304 Not Modified` on unchanged assets.

### 3. Stream Security and Bucket Protection
- **Token Verification**: Validates the HMAC-SHA256 streaming JWT against `AUTH_SECRET` (passed via `Authorization: Bearer <token>`, `?token=<token>` query parameter, or fallback cookie) before granting access to media.
- **Master Audio Protection**: Strictly denies direct client requests to `originals/` or `originals` to protect uncompressed source audio masters from unauthorized downloads.
- **Path Traversal Prevention**: Rejects malformed object paths containing `..`, `//`, or leading dots with `403 Forbidden`.
- **Resource Whitelisting**: Only serves verified media types (static assets like `cover_art/*`, HLS playlists `.m3u8`, or audio segments `.ts`, `.aac`, `.m4s`, `.mp3`), rejecting any unknown or internal storage keys.

---

## Development and Deployment

### Configuration (`wrangler.jsonc`)
- **Name**: `music-cloud-edge`
- **R2 Bucket Binding**: `R2_BUCKET` pointing to the `music-cloud` storage bucket

### Running Locally
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
