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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyQuota, refreshMyQuota } from "@yfs/service";
import { useAuth } from "./useAuth";
import { withAuthRetry } from "../utils/authRetry";
import { useToast } from "../atoms/toast";

const QUOTA_QUERY_KEY = ["myQuota"] as const;

// GET /user/quota — cheap cached read, safe to refetch on demand.
export function useMyQuota() {
  const { token, refreshAccessToken, isAuthenticated } = useAuth();

  const query = useQuery({
    queryKey: QUOTA_QUERY_KEY,
    queryFn: () => withAuthRetry(token, refreshAccessToken, (tk) => getMyQuota(tk)),
    enabled: isAuthenticated,
    staleTime: Infinity,
  });

  return {
    quota: query.data ?? null,
    quotaLoading: query.isPending,
    refetchQuota: query.refetch,
    refetching: query.isFetching && !query.isPending,
  };
}

// PATCH /user/quota/refresh scans every file the user owns, so only fire it on a confirmed click.
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
