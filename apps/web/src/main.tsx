import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { Provider as JotaiProvider } from 'jotai'
import './index.css'
import App from './App.tsx'
import { queryClient } from './lib/queryClient.ts'
import { AuthProvider } from './context/AuthContext.tsx'
import { FileSystemProvider } from './context/FileSystemContext.tsx'
import { ThemeEffect } from './components/ThemeEffect.tsx'
import { SharedFileView } from './components/share/SharedFileView.tsx'
import { ShareEndedView } from './components/share/ShareEndedView.tsx'

// Shared-link view is a separate, unauthenticated tree — it deliberately skips
// AuthProvider/FileSystemProvider since a link visitor isn't logged in.
const path = window.location.pathname
const isSharedRoute = path.startsWith('/share/')
const isShareEnded = path === '/share-ended'

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
    <QueryClientProvider client={queryClient}>
      <JotaiProvider>
        <ThemeEffect />
        {isShareEnded ? (
          <ShareEndedView />
        ) : isSharedRoute ? (
          <SharedFileView />
        ) : (
          <AuthProvider>
            <FileSystemProvider>
              <App />
            </FileSystemProvider>
          </AuthProvider>
        )}
      </JotaiProvider>
    </QueryClientProvider>
  // </StrictMode>
  ,
)
