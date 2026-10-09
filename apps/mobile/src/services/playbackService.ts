import TrackPlayer, { Event, State } from "react-native-track-player";

type RemoteHandler = () => Promise<void> | void;

let remoteNextHandler: RemoteHandler | null = null;
let remotePrevHandler: RemoteHandler | null = null;
let remotePlayHandler: RemoteHandler | null = null;
let remotePauseHandler: RemoteHandler | null = null;

export function registerRemoteHandlers(handlers: {
    onNext?: RemoteHandler | null;
    onPrev?: RemoteHandler | null;
    onPlay?: RemoteHandler | null;
    onPause?: RemoteHandler | null;
}) {
    if (handlers.onNext !== undefined) remoteNextHandler = handlers.onNext;
    if (handlers.onPrev !== undefined) remotePrevHandler = handlers.onPrev;
    if (handlers.onPlay !== undefined) remotePlayHandler = handlers.onPlay;
    if (handlers.onPause !== undefined) remotePauseHandler = handlers.onPause;
}

export async function PlaybackService() {
    TrackPlayer.addEventListener(Event.RemotePlay, async () => {
        if (remotePlayHandler) {
            await remotePlayHandler();
        } else {
            await TrackPlayer.play().catch(() => {});
        }
    });

    TrackPlayer.addEventListener(Event.RemotePause, async () => {
        if (remotePauseHandler) {
            await remotePauseHandler();
        } else {
            await TrackPlayer.pause().catch(() => {});
        }
    });

    TrackPlayer.addEventListener(Event.RemoteNext, async () => {
        if (remoteNextHandler) {
            await remoteNextHandler();
        } else {
            await TrackPlayer.skipToNext().catch(() => {});
        }
    });

    TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
        if (remotePrevHandler) {
            await remotePrevHandler();
        } else {
            await TrackPlayer.skipToPrevious().catch(() => {});
        }
    });

    TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
        TrackPlayer.seekTo(event.position);
    });

    TrackPlayer.addEventListener(Event.RemoteStop, () => {
        TrackPlayer.reset();
    });
}
