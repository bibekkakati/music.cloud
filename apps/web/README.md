# Music Cloud Web Client

Single-page web application for Music Cloud, built with React, TypeScript, and Vite.

---

## Purpose and Scope

The web application provides the user interface for Music Cloud:

- **Audio Streaming Experience**: Full-featured player with gapless HLS playback, volume memory, repeat/shuffle controls, persistent state preservation, and queue handling.
- **Collection Management**: Personal and system playlists, track likes, dynamic additions, and typo-tolerant search filtering.
- **Admin Studio**: Dedicated administration view for direct audio uploads (private by default), processing triggers, catalog curation, and track visibility toggling.

---

## Directory Structure

```text
apps/web/
├── src/
│   ├── api.ts                  # Axios HTTP client with authentication interceptors
│   ├── App.tsx                 # Root router and layout shell
│   ├── main.tsx                # Application entry point
│   ├── index.css               # Design system, theme variables, and global styles
│   │
│   ├── config/                 # Centralized frontend configuration
│   │   ├── appConfig.json      # Configurable player buffer sizes, margins, and UI keys
│   │   └── index.ts            # Typed configuration export (AppConfig)
│   │
│   ├── components/             # UI components
│   │   ├── Logo.tsx            # Vector logo component (cloud with headset)
│   │   ├── Navbar.tsx          # Top navigation, search bar, and profile status
│   │   ├── Player.tsx          # Audio player bar and playback controls
│   │   ├── Sidebar.tsx         # Navigation links, library shortcuts, and playlists
│   │   └── PlaylistModal.tsx   # Playlist creation and track assignment modal
│   │
│   ├── context/                # State management providers
│   │   ├── AuthContext.tsx     # Session state, passcode login, and logout handlers
│   │   ├── PlayerContext.tsx   # HLS player engine, queue state, and audio bindings
│   │   └── ToastContext.tsx    # Toast notifications
│   │
│   ├── pages/                  # Route views
│   │   ├── HomePage.tsx        # Overview, recently played, and featured tracks
│   │   ├── SearchPage.tsx      # Fuzzy search results view
│   │   ├── PlaylistPage.tsx    # Playlist detail and track lists
│   │   ├── LibraryPage.tsx     # Library catalog view
│   │   └── admin/              # Admin Studio for uploads and catalog visibility
│   │
│   ├── services/               # Backend API services
│   │   ├── authService.ts      # Authentication and session token persistence
│   │   ├── playlistService.ts  # Playlist management operations
│   │   ├── songService.ts      # Catalog retrieval and track operations
│   │   └── streamService.ts    # Stream JWT token retrieval and localStorage cache
│   │
│   └── types/
│       └── index.ts            # Type definitions re-exported from @music-cloud/types
│
├── public/                     # Static icons, favicons, and site manifest
└── package.json                # Workspace package configuration (@music-cloud/web)
```

---

## Configuration (`appConfig.json`)

Non-secret application behavior is configured via `src/config/appConfig.json`:

- **`streaming`**:
    - `token_refresh_margin_ms`: Time before token expiration to trigger automatic renewal (default: `600000` / 10 minutes).
    - `token_fallback_lifetime_ms`: Assumed token validity duration when expiration header is absent (default: `14400000` / 4 hours).
- **`player`**:
    - `default_volume`: Initial audio volume (default: `1.0`).
    - `max_buffer_ahead_segments`: Number of HLS segments to pre-buffer ahead of playhead (default: `5`).
    - `back_buffer_length_seconds`: Audio history retained in memory for seamless loop/repeat (default: `600`).
- **`ui`**:
    - `toast_auto_dismiss_ms`: Notification display duration (default: `4000`).
    - `search_debounce_ms`: Input debounce delay for search queries (default: `250`).
    - `localStorage_keys`: Keys used for browser persistence (`player_state`, `session_token`, `stream_token`).

---

## HLS Playback and Token Lifecycle

Music Cloud streams protected audio via HTTP Live Streaming (HLS) using `hls.js` and short-lived edge JWT tokens:

```text
1. Play Action           --> User clicks play on a track
2. Token Verification   --> streamService checks local stream JWT validity in localStorage
3. Token Refresh (opt)   --> If token absent or expires in < 10 mins, fetch new 4-hour JWT from API
4. Master Request        --> hls.js requests master.m3u8 from Edge Worker with Bearer header
5. Variant Selection     --> Edge Worker returns AAC variants (256k / 320k)
6. Segment Streaming     --> hls.js streams 10-second audio segments (.ts) with Bearer token
7. Proactive Renewal     --> Background timer refreshes token 10 mins before expiry to avoid drops
```

### Key Playback Behaviors

- **Adaptive Bitrate Streaming**: `hls.js` dynamically adapts between 256 kbps and 320 kbps AAC renditions depending on network conditions.
- **Proactive Token Refresh**: Streaming tokens last 4 hours. A background timer automatically requests a new token when less than 10 minutes remain.
- **Cookie-Free Authentication**: Tokens are stored in `localStorage` and passed via `Authorization` headers or URL parameters, ensuring native players (Safari, iOS AVPlayer, Android ExoPlayer) stream without cookie limitations.
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

The Vite development server runs at `http://localhost:5173`.
