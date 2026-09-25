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

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPublicFolder,
  createPublicSession,
  editPublicFolder,
  generatePublicSessionOtp,
  getPublicSession,
  listPublicFolderChildren,
  movePublicFolder,
  PAGE_SIZE,
  publicLogout,
  validatePublicSessionOtp,
  validatePublicSessionPassword,
  type OtpType,
} from "@yfs/service";

const folderKey = (token: string, folderId: string | null) => ["publicFolder", token, folderId] as const;

// A mutation, not a query: each call mints a new session.
export const useCreatePublicSession = () => useMutation({ mutationFn: (shareId: string) => createPublicSession(shareId) });

export const useValidatePublicPassword = () =>
  useMutation({
    mutationFn: (vars: { token: string; password: string }) => validatePublicSessionPassword(vars.token, vars.password),
  });

export const useGeneratePublicOtp = () =>
  useMutation({
    mutationFn: (vars: { token: string; otpType: OtpType; phoneOrEmail: string }) =>
      generatePublicSessionOtp(vars.token, vars.otpType, vars.phoneOrEmail),
  });

export const useValidatePublicOtp = () =>
  useMutation({
    mutationFn: (vars: { token: string; otpType: OtpType; phoneOrEmail: string; otp: string }) =>
      validatePublicSessionOtp(vars.token, vars.otpType, vars.phoneOrEmail, vars.otp),
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
