import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";

export function useFiles(currentPath: string[]) {
  return useQuery({
    queryKey: ["files", currentPath],
    queryFn: () => api.fetchFiles(currentPath),
  });
}

export function useFileDetails(id: string | null) {
  return useQuery({
    queryKey: ["file", id],
    queryFn: () => api.fetchFileDetails(id!),
    enabled: !!id,
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, path }: { name: string; path: string[] }) => api.createFolder(name, path),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["files", variables.path] });
    },
  });
}

export function useDeleteFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, path: _path }: { id: string; path: string[] }) => api.deleteFile(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["files", variables.path] });
    },
  });
}

export function useRenameFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newName, path: _path }: { id: string; newName: string; path: string[] }) =>
      api.renameFile(id, newName),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["files", variables.path] });
      queryClient.invalidateQueries({ queryKey: ["file", variables.id] });
    },
  });
}

export function useUploadFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      type,
      size,
      path,
    }: {
      name: string;
      type: any;
      size: number;
      path: string[];
    }) => api.uploadFile(name, type, size, path),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["files", variables.path] });
    },
  });
}
