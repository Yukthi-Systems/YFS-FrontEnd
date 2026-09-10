import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { FileSystemProvider } from './context/FileSystemContext.tsx'
import { ToastProvider } from './context/ToastContext.tsx'
import { UploadQueueProvider } from './context/UploadQueueContext.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'
import { UserSettingsProvider } from './context/UserSettingsContext.tsx'
import { SharedFileView } from './components/share/SharedFileView.tsx'
import { ShareEndedView } from './components/share/ShareEndedView.tsx'

// Shared-link view is a separate, unauthenticated tree — it deliberately skips
// AuthProvider/FileSystemProvider/UploadQueueProvider since a link visitor isn't logged in.
const path = window.location.pathname
const isSharedRoute = path.startsWith('/share/')
const isShareEnded = path === '/share-ended'

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
    <ThemeProvider>
      {isShareEnded ? (
        <ShareEndedView />
      ) : isSharedRoute ? (
        <ToastProvider>
          <SharedFileView />
        </ToastProvider>
      ) : (
        <AuthProvider>
          <UserSettingsProvider>
            <FileSystemProvider>
              <UploadQueueProvider>
                <ToastProvider>
                  <App />
                </ToastProvider>
              </UploadQueueProvider>
            </FileSystemProvider>
          </UserSettingsProvider>
        </AuthProvider>
      )}
    </ThemeProvider>
  // </StrictMode>
  ,
)
