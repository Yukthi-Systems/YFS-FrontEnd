import { QueryClient } from '@tanstack/react-query'
import { HttpError } from '@yfs/service'

const MAX_API_RETRIES = 3;

// Every query/mutation in the app runs through this one QueryClient (including
// services/fileSystemStore.ts's fire-and-forget writes, which build mutations off
// it directly) — so this is the single global cap. Retries only on failure, and
// only for errors that might actually succeed on a retry (network blips, 5xx);
// a 4xx from the API means the request itself was rejected and won't succeed no
// matter how many more times we ask, so those fail immediately instead of
// retrying up to the cap for no reason.
const shouldRetry = (failureCount: number, error: unknown): boolean => {
  if (failureCount >= MAX_API_RETRIES) return false;
  if (error instanceof HttpError && error.status >= 400 && error.status < 500) return false;
  return true;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: shouldRetry },
    mutations: { retry: shouldRetry },
  },
})
