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

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const allowedHostsString = env.VITE_ALLOWED_HOSTS || "localhost";
  const allowedHosts = allowedHostsString.split(',').map(host => host.trim());

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    // Workspace packages ship raw TS; pre-bundling caches a stale export list.
    optimizeDeps: {
      exclude: ['@yfs/service', '@yfs/utils'],
    },
    server: {
      allowedHosts: allowedHosts,
    }
  };
})
