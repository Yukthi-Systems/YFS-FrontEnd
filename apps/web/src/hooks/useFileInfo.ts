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

import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { tokenAtom } from "../atoms/auth";
import { getFileBasicInfo } from "@yfs/service";
import type { FileItem } from "../types/file";
import { useFileSystem } from "./useFileSystem";
import { useAuth } from "./useAuth";
import { withAuthRetry } from "../utils/authRetry";

export const useFileInfo = (item: FileItem | null, enabled = true) => {
  const token = useAtomValue(tokenAtom);
  const { refreshAccessToken } = useAuth();
  const { fileTypeGuess, setItemLocked } = useFileSystem();
  // Only own (non-shared) real files have a backend file_id/parent to look up.
  const canQuery = !!item && !item.isFolder && !!item.fileId && !!item.parentId && item.origin === "server";

  return useQuery({
    queryKey: ["fileInfo", item?.id],
    queryFn: async () => {
      if (!token || !item?.fileId || !item.parentId) throw new Error("Missing token or file");
      const data = await withAuthRetry(token, refreshAccessToken, (tk) =>
        getFileBasicInfo(tk, {
          folder_id: item.parentId!,
          file_id: item.fileId!,
          file_name: item.name,
          file_info: item.resourceInfo ?? {},
          file_type: fileTypeGuess(item),
          file_version: 1, // always exists once a file has been uploaded
          expected_file_size: item.size,
        })
      );
      if (data && typeof data.is_locked === "boolean") {
        setItemLocked(item.id, data.is_locked);
      }
      return data;
    },
    enabled: !!token && canQuery && enabled,
  });
};
