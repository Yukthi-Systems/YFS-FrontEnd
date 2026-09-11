import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { queryClient } from './lib/queryClient.ts'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { ThemeEffect } from './components/ThemeEffect.tsx'
import { AuthBridge } from './components/AuthBridge.tsx'
import { FileSystemBridge } from './components/FileSystemBridge.tsx'
import { SharedFileView } from './components/share/SharedFileView.tsx'
import { ShareEndedView } from './components/share/ShareEndedView.tsx'

// Shared-link view is a separate, unauthenticated tree — it deliberately skips
// AuthBridge/FileSystemBridge since a link visitor isn't logged in.
const path = window.location.pathname
const isSharedRoute = path.startsWith('/share/')
const isShareEnded = path === '/share-ended'

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeEffect />
        {isShareEnded ? (
          <ShareEndedView />
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
  // </StrictMode>
  ,
)
