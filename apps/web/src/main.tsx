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

import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import App from './App.tsx'
import { queryClient } from './lib/queryClient.ts'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { ThemeEffect } from './components/ThemeEffect.tsx'
import { AuthBridge } from './components/AuthBridge.tsx'
import { FileSystemBridge } from './components/FileSystemBridge.tsx'
import { SharedFileView } from './components/share/SharedFileView.tsx'
import { ShareEndedView } from './components/share/ShareEndedView.tsx'
import { CollaboraStandaloneView } from './components/viewers/CollaboraStandaloneView.tsx'

// Share and Collabora routes are unauthenticated, so they skip AuthBridge/FileSystemBridge.
const path = window.location.pathname
const isSharedRoute = path.startsWith('/share/')
const isShareEnded = path === '/share-ended'
const isCollaboraStandalone = path === '/collabora'

createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeEffect />
        {isShareEnded ? (
          <ShareEndedView />
        ) : isCollaboraStandalone ? (
          <CollaboraStandaloneView />
        ) : isSharedRoute ? (
          <SharedFileView />
        ) : (
          <>
            <AuthBridge />
            <FileSystemBridge />
            <App />
          </>
        )}
      </QueryClientProvider>
    </ErrorBoundary>
)
