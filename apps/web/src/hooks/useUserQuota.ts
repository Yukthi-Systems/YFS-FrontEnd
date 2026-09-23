import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyQuota, refreshMyQuota } from "@yfs/service";
import { useAuth } from "./useAuth";
import { withAuthRetry } from "../utils/authRetry";
import { useToast } from "../atoms/toast";

const QUOTA_QUERY_KEY = ["myQuota"] as const;

// GET /user/quota — the server's cached usage row. Fetched once per session (on
// load / page reload) so the storage bar reflects real usage instead of only the
// stale quota_utilized snapshot the SSO handed back at login. `refetchQuota` just
// re-reads that cached row: cheap, so it can be wired straight to a button with no
// confirmation, unlike the recalculation below.
export function useMyQuota() {
  const { token, refreshAccessToken, isAuthenticated } = useAuth();

  const query = useQuery({
    queryKey: QUOTA_QUERY_KEY,
    queryFn: () => withAuthRetry(token, refreshAccessToken, (tk) => getMyQuota(tk)),
    enabled: isAuthenticated,
    staleTime: Infinity, // never refetched on its own — only by refetchQuota or the recalculation
  });

  return {
    quota: query.data ?? null,
    quotaLoading: query.isPending,
    refetchQuota: query.refetch,
    refetching: query.isFetching && !query.isPending,
  };
}

// PATCH /user/quota/refresh recalculates usage by scanning every file the user
// owns — a real DB aggregate with no server-side lock or rate limit, so this must
// only ever fire from an explicit, user-confirmed click, never automatically. It
// lives in the profile modal for that reason; the sidebar's button is the plain
// GET refetch above.
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
