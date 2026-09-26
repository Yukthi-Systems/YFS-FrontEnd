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

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Plain registration, no auto-reload: a new version takes over on the next load, never mid-upload.
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      manifest: {
        name: 'YFS',
        short_name: 'YFS',
        description: 'Store, share and edit your files.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#aa3bff',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Runtime config is written per container start (env.sh), so it must never be cached.
        globPatterns: ['**/*.{js,mjs,css,html,woff2,svg,png,webmanifest}'],
        globIgnores: ['**/env-config.js'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  // Workspace packages ship raw TS; pre-bundling caches a stale export list.
  optimizeDeps: {
    exclude: ['@yfs/service', '@yfs/utils'],
  },
  server: {
    allowedHosts: true,
  },
})
