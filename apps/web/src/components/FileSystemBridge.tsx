import { useEffect, useLayoutEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { userDisplayName } from "../utils/format";
import { bootFileSystem, resetFileSystem, setAuthSnapshot, setUserSnapshot } from "../services/fileSystemStore";

// Wires the signed-in session into services/fileSystemStore.ts (a singleton store with
// no component of its own) and runs the boot-on-login / reset-on-logout sequence.
// Mounted once, alongside AuthBridge.
export function FileSystemBridge() {
  const { isAuthenticated, token, userId, user, refreshAccessToken } = useAuth();

  // Keep the store's auth/user snapshot fresh before any effect (here or in a
  // descendant) that might read it in this same commit.
  useLayoutEffect(() => {
    setAuthSnapshot({ token, userId, refreshAccessToken });
    setUserSnapshot(user?.email, userDisplayName(user));
  });

  useEffect(() => {
    if (!isAuthenticated) {
      resetFileSystem();
      return;
    }
    const signal = { cancelled: false };
    bootFileSystem(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [isAuthenticated]);

  return null;
}
