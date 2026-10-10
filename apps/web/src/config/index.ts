import rawConfig from "./appConfig.json";

export interface AppConfig {
    streaming: {
        token_refresh_margin_ms: number;
        token_fallback_lifetime_ms: number;
        token_refresh_check_interval_ms: number;
    };
    player: {
        default_volume: number;
        max_buffer_ahead_segments: number;
        back_buffer_length_seconds: number;
        default_target_duration_seconds: number;
        seek_step_seconds: number;
    };
    ui: {
        toast_auto_dismiss_ms: number;
        search_debounce_ms: number;
        infinite_scroll_page_size: number;
        localStorage_keys: {
            player_state: string;
            session_token: string;
            stream_token: string;
        };
    };
    songs_limit: number;
}

export const appConfig: AppConfig = rawConfig;
export default appConfig;
