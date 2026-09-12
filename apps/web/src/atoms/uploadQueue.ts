import { atom } from "jotai";

export interface UploadTask {
  id: string;
  fileName: string;
  progress: number;
  status: "pending" | "uploading" | "paused" | "done" | "error";
  error?: string;
}

export interface FileWithRelativePath {
  file: File;
  // e.g. "SubFolder/nested/file.txt" for a folder upload, or just "file.txt" for a flat one.
  relativePath: string;
}

export const uploadTasksAtom = atom<UploadTask[]>([]);
