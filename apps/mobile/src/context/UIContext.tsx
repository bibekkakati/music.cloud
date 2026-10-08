import React, { createContext, useContext, useState, useCallback } from 'react';

interface UIContextValue {
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;

  isCreatePlaylistOpen: boolean;
  openCreatePlaylist: () => void;
  closeCreatePlaylist: () => void;

  playlistRefreshTrigger: number;
  triggerPlaylistRefresh: () => void;
}

const UIContext = createContext<UIContextValue | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [playlistRefreshTrigger, setPlaylistRefreshTrigger] = useState(0);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);
  const toggleDrawer = useCallback(() => setIsDrawerOpen((prev) => !prev), []);

  const openCreatePlaylist = useCallback(() => setIsCreatePlaylistOpen(true), []);
  const closeCreatePlaylist = useCallback(() => setIsCreatePlaylistOpen(false), []);

  const triggerPlaylistRefresh = useCallback(() => {
    setPlaylistRefreshTrigger((prev) => prev + 1);
  }, []);

  return (
    <UIContext.Provider
      value={{
        isDrawerOpen,
        openDrawer,
        closeDrawer,
        toggleDrawer,
        isCreatePlaylistOpen,
        openCreatePlaylist,
        closeCreatePlaylist,
        playlistRefreshTrigger,
        triggerPlaylistRefresh,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

export const useUI = (): UIContextValue => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
