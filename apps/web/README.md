# Music Cloud Web Client

Single-page web application for Music Cloud, built with React, TypeScript, and Vite.

---

## Purpose and Scope

The web application provides the user interface for Music Cloud:

- **Audio Streaming Experience**: Full-featured player with gapless HLS playback, volume memory, repeat/shuffle controls, persistent state preservation, and queue handling.
- **Collection Management**: Personal and system playlists, track likes, dynamic additions, and typo-tolerant search filtering.
- **Admin Studio**: Dedicated administration view for direct audio uploads (private by default), processing triggers, catalog curation, and track visibility toggling.

---

## HLS Playback and Token Lifecycle

Music Cloud streams protected audio via HTTP Live Streaming (HLS) using `hls.js` and short-lived edge JWT tokens:

```text
1. Play Action           --> User clicks play on a track
2. Token Verification   --> streamService checks local stream JWT validity in localStorage
3. Token Refresh (opt)   --> If token absent or expires in < 10 mins, fetch new 4-hour JWT from API
4. Master Request        --> hls.js requests master.m3u8 from Edge Worker with ?token=...
5. Variant Selection     --> Edge Worker returns AAC variants (256k / 320k)
6. Segment Streaming     --> hls.js streams 10-second audio segments (.ts) with ?token=... (0 CORS preflight)
7. Proactive Renewal     --> Background timer refreshes token 10 mins before expiry to avoid drops
```

### Key Playback Behaviors

- **Adaptive Bitrate Streaming**: `hls.js` dynamically adapts between 256 kbps and 320 kbps AAC renditions depending on network conditions.
- **Proactive Token Refresh**: Streaming tokens last 4 hours. A background timer automatically requests a new token when less than 10 minutes remain.
- **Zero Preflight URL Parameter Authentication**: Tokens are stored in `localStorage` and passed as URL query parameters (`?token=...`). This transforms segment requests into CORS Simple Requests, completely eliminating preflight (`OPTIONS`) round-trips and ensuring native players (Safari, iOS AVPlayer, Android ExoPlayer) stream without header or cookie limitations.
- **Session Protection**: When a user logs out or the session expires, the player immediately halts playback, purges streaming tokens, clears cached player data, and resets to an inactive state.
- **Local State Persistence**: Current track, playback progress, and volume settings are saved to `localStorage` to allow playback resumption across reloads.

---

## Development

Run the frontend from the monorepo root:

```bash
npm run dev:web
```

Or from `apps/web`:

```bash
npm run dev
```
