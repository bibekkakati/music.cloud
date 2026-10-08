import { streamService } from "@music-cloud/services";
import { appConfig } from "../config";

// Configure shared streamService with web's localStorage
streamService.setStorageAdapter(
    {
        getItem: (key) => localStorage.getItem(key),
        setItem: (key, val) => {
            try {
                localStorage.setItem(key, val);
            } catch {}
        },
        removeItem: (key) => {
            try {
                localStorage.removeItem(key);
            } catch {}
        },
    },
    appConfig.ui.localStorage_keys.stream_token
);

export { streamService, streamService as default };
