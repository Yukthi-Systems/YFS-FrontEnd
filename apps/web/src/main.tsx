import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { FileSystemProvider } from './context/FileSystemContext.tsx'
import { ToastProvider } from './context/ToastContext.tsx'
import { UploadQueueProvider } from './context/UploadQueueContext.tsx'
import { SharedFileView } from './components/share/SharedFileView.tsx'

// Shared-link view is a separate, unauthenticated tree — it deliberately skips
// AuthProvider/FileSystemProvider/UploadQueueProvider since a link visitor isn't logged in.
const isSharedRoute = window.location.pathname.startsWith('/share/')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSharedRoute ? (
      <ToastProvider>
        <SharedFileView />
      </ToastProvider>
    ) : (
      <AuthProvider>
        <FileSystemProvider>
          <UploadQueueProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </UploadQueueProvider>
        </FileSystemProvider>
      </AuthProvider>
    )}
  </StrictMode>,
)
