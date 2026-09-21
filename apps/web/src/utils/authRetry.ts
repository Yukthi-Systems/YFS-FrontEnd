import { HttpError } from "@yfs/service";

// Runs `fn` with the current access token; on 401/400 (expired/invalid token)
// refreshes once via `refresh` and retries with the new token. Shared by every
// call site that hits YFS-Main-API/Files-Api with the logged-in user's token, so
// an expired access token gets silently replaced mid-session instead of the
// action just failing (see authStore.ts's own single-flight refreshAccessToken).
export async function withAuthRetry<T>(
  token: string | null | undefined,
  refresh: () => Promise<string | null>,
  fn: (token: string) => Promise<T>
): Promise<T> {
  try {
    return await fn(token ?? "");
  } catch (err) {
    if (!(err instanceof HttpError) || (err.status !== 401 && err.status !== 400)) throw err;
    const fresh = await refresh();
    if (!fresh) throw err;
    return fn(fresh);
  }
}
