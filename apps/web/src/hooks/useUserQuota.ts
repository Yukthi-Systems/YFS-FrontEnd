import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyQuota, refreshMyQuota } from "@yfs/service";
import { useAuth } from "./useAuth";
import { withAuthRetry } from "../utils/authRetry";
import { useToast } from "../atoms/toast";

const QUOTA_QUERY_KEY = ["myQuota"] as const;

// GET /user/quota — the server's cached usage row. Fetched once per session (on
// load / page reload) so the storage bar reflects real usage instead of only the
// stale quota_utilized snapshot the SSO handed back at login.
export function useMyQuota() {
  const { token, refreshAccessToken, isAuthenticated } = useAuth();

  const query = useQuery({
    queryKey: QUOTA_QUERY_KEY,
    queryFn: () => withAuthRetry(token, refreshAccessToken, (tk) => getMyQuota(tk)),
    enabled: isAuthenticated,
    staleTime: Infinity, // only ever updated by the explicit refresh mutation below
  });

  return { quota: query.data ?? null, quotaLoading: query.isPending };
}

// PATCH /user/quota/refresh recalculates usage by scanning every file the user
// owns — a real DB aggregate with no server-side lock or rate limit, so this must
// only ever fire from an explicit, user-confirmed click, never automatically.
export function useRefreshUserQuota() {
  const { token, refreshAccessToken } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => withAuthRetry(token, refreshAccessToken, (tk) => refreshMyQuota(tk)),
    onSuccess: (data) => queryClient.setQueryData(QUOTA_QUERY_KEY, data),
    onError: (err) => showToast(err instanceof Error ? err.message : "Couldn't refresh storage usage", "error"),
  });

  return {
    refreshQuota: mutation.mutateAsync,
    refreshing: mutation.isPending,
  };
}
