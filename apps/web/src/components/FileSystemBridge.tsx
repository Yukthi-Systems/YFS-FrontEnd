/*
 * Copyright (C) 2026 Yukthi Systems Private Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * version 3 along with this program. If not, see
 * <https://www.gnu.org/licenses/>.
 */

import { useEffect, useLayoutEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { userDisplayName } from "../utils/format";
import { bootFileSystem, resetFileSystem, setAuthSnapshot, setUserSnapshot } from "../services/fileSystemStore";

// Wires the session into fileSystemStore and runs boot/reset on login/logout.
export function FileSystemBridge() {
  const { isAuthenticated, token, userId, user, refreshAccessToken } = useAuth();

  // Before any effect in this commit reads the snapshot.
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
