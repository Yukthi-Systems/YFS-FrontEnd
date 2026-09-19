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
  const { fileTypeGuess } = useFileSystem();
  // Only own (non-shared) real files have a backend file_id/parent to look up.
  const canQuery = !!item && !item.isFolder && !!item.fileId && !!item.parentId && item.origin === "server";

  return useQuery({
    queryKey: ["fileInfo", item?.id],
    queryFn: () => {
      if (!token || !item?.fileId || !item.parentId) throw new Error("Missing token or file");
      return withAuthRetry(token, refreshAccessToken, (tk) =>
        getFileBasicInfo(tk, {
          folder_id: item.parentId!,
          file_id: item.fileId!,
          file_name: item.name,
          file_info: item.resourceInfo ?? {},
          file_type: fileTypeGuess(item),
          file_version: 1, // always valid once a file has a first version — see getFileBasicInfo
          expected_file_size: item.size,
        })
      );
    },
    enabled: !!token && canQuery && enabled,
  });
};
