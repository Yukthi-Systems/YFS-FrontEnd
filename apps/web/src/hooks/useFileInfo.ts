import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { tokenAtom } from "../atoms/auth";
import { getFileInfo } from "@yfs/service";

export const useFileInfo = (fileId: string | null, enabled = true) => {
  const token = useAtomValue(tokenAtom);
  
  return useQuery({
    queryKey: ["fileInfo", fileId],
    queryFn: () => {
      if (!token || !fileId) throw new Error("Missing token or fileId");
      return getFileInfo(token, fileId);
    },
    enabled: !!token && !!fileId && enabled,
    // We don't have the exact shape of the response yet as the backend endpoint is commented out.
    // It returns `unknown` from the service.
  });
};
