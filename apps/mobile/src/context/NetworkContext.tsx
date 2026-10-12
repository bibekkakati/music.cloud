import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

interface NetworkContextValue {
    isConnected: boolean;
    isOffline: boolean;
    refreshConnection: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextValue | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    // Default to online until NetInfo reports otherwise
    const [isConnected, setIsConnected] = useState<boolean>(true);

    const updateState = useCallback((state: NetInfoState) => {
        // isConnected might be false or null (unknown). If false or explicitly not internet reachable:
        const online = Boolean(
            state.isConnected && (state.isInternetReachable ?? true),
        );
        setIsConnected(online);
    }, []);

    useEffect(() => {
        // Subscribe to network updates
        const unsubscribe = NetInfo.addEventListener(updateState);

        // Fetch initial state
        NetInfo.fetch().then(updateState);

        return () => {
            unsubscribe();
        };
    }, [updateState]);

    const refreshConnection = useCallback(async () => {
        const state = await NetInfo.fetch();
        updateState(state);
    }, [updateState]);

    return (
        <NetworkContext.Provider
            value={{
                isConnected,
                isOffline: !isConnected,
                refreshConnection,
            }}
        >
            {children}
        </NetworkContext.Provider>
    );
};

export const useNetwork = (): NetworkContextValue => {
    const context = useContext(NetworkContext);
    if (!context) {
        throw new Error("useNetwork must be used within a NetworkProvider");
    }
    return context;
};
