// User & Auth
export interface User {
    id: string;
    email: string;
    created_at: string;
    updated_at: string;
    is_admin?: boolean;
}

export interface SessionResponse {
    access_token: string;
    token_type?: string;
    expires_at: string;
}

export interface StreamTokenResponse {
    token: string;
    token_type?: string;
    expires_at: string;
}

export interface LoginPayload {
    email: string;
    password: string;
}

export interface StreamTokenClaims {
    sub: string;
    user_id: string;
    exp: number;
    iat?: number;
    iss?: string;
    type?: "stream" | "session";
}

// Songs
export interface SongPublic {
    id: string;
    title: string;
    artist: string;
    duration_sec?: number;
    cover_art_url?: string | null;
    stream_url?: string | null;
}

export type SongMetadata = SongPublic;

export interface AdminSongDetail extends SongPublic {
    duration_sec: number;
    original_key: string;
    master_mp3_key?: string | null;
    master_aac_key?: string | null;
    cover_art_key?: string | null;
    source_bitrate_kbps?: number | null;
    created_at: string;
    updated_at: string;
    status?: string;
    is_public?: boolean;
}

export type SongDetail = AdminSongDetail;

export interface StreamSongResponse {
    id: string;
    title?: string | null;
    artist?: string | null;
    master_mp3_key?: string | null;
    master_aac_key?: string | null;
    cover_art_url?: string | null;
}

export interface SongUploadResponse {
    id: string;
    url: string;
    key: string;
}

export interface SongProcessPayload {
    song_id: string;
    trim_start_sec?: number;
}

export interface SongMetadataUpdatePayload {
    song_id: string;
    title: string;
    artist: string;
    is_public?: boolean;
    cover_art_key?: string | null;
}

export interface CoverArtUploadResponse {
    song_id: string;
    url: string;
    key: string;
}

export interface SongVisibilityUpdatePayload {
    song_id: string;
    is_public: boolean;
}

// Playlists
export interface PlaylistSummary {
    id: string;
    label: string;
    is_deletable?: boolean;
    songs_count?: number;
    contains_song?: boolean;
    created_at: string;
    updated_at: string;
}

export interface PlaylistSongItem extends SongMetadata {
    playlist_song_id: string;
    created_at: string;
}

export interface PlaylistDetail {
    id: string;
    label: string;
    is_deletable: boolean;
    songs_count?: number;
    songs: PlaylistSongItem[];
    created_at: string;
    updated_at: string;
}

export interface CreatePlaylistPayload {
    label: string;
}

export interface CreatePlaylistResponse {
    id: string;
    label: string;
    is_deletable: boolean;
}

export interface UpdatePlaylistPayload {
    id: string;
    label: string;
}

export interface UpdatePlaylistResponse {
    id: string;
    label: string;
    is_deletable: boolean;
}

export interface AddPlaylistSongPayload {
    playlist_id: string;
    song_id: string;
}

export interface RemovePlaylistSongPayload {
    id: string;
}

export interface RemovePlaylistPayload {
    id: string;
}
