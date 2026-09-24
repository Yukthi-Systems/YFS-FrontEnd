import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPublicFolder,
  createPublicSession,
  editPublicFolder,
  getPublicSession,
  listPublicFolderChildren,
  movePublicFolder,
  PAGE_SIZE,
  publicLogout,
  validatePublicSessionPassword,
} from "@yfs/service";

const folderKey = (token: string, folderId: string | null) => ["publicFolder", token, folderId] as const;

// Mints a new anonymous session server-side (not idempotent), so it's a mutation the
// caller fires once — a query could re-fire on focus and mint duplicate sessions.
export const useCreatePublicSession = () => useMutation({ mutationFn: (shareId: string) => createPublicSession(shareId) });

export const useValidatePublicPassword = () =>
  useMutation({
    mutationFn: (vars: { token: string; password: string }) => validatePublicSessionPassword(vars.token, vars.password),
  });

export const usePublicSessionInfo = (token: string, enabled: boolean) =>
  useQuery({
    queryKey: ["publicSessionInfo", token],
    queryFn: () => getPublicSession(token),
    enabled: enabled && !!token,
    staleTime: Infinity,
  });

export const usePublicFolderChildren = (token: string, folderId: string | null) =>
  useInfiniteQuery({
    queryKey: folderKey(token, folderId),
    queryFn: ({ pageParam }) => listPublicFolderChildren(token, folderId!, { limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined),
    enabled: !!token && !!folderId,
  });

const useInvalidatePublicFolders = (token: string) => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["publicFolder", token] });
};

export const useCreatePublicFolder = (token: string, shareId: string) => {
  const invalidate = useInvalidatePublicFolders(token);
  return useMutation({
    mutationFn: (vars: { parentFolderId: string; name: string }) =>
      createPublicFolder(token, { parentFolderId: vars.parentFolderId, folderName: vars.name.trim(), shareId }),
    onSuccess: invalidate,
  });
};

export const useRenamePublicFolder = (token: string) => {
  const invalidate = useInvalidatePublicFolders(token);
  return useMutation({
    mutationFn: (vars: { id: string; name: string }) => editPublicFolder(token, { folderId: vars.id, folderName: vars.name.trim() }),
    onSuccess: invalidate,
  });
};

export const useMovePublicFolder = (token: string) => {
  const invalidate = useInvalidatePublicFolders(token);
  return useMutation({
    mutationFn: (vars: { id: string; newParentId: string }) =>
      movePublicFolder(token, { folderId: vars.id, newParentFolderId: vars.newParentId }),
    onSuccess: invalidate,
  });
};

export const usePublicLogout = () => useMutation({ mutationFn: (token: string) => publicLogout(token) });
