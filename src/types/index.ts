export type FileType = "folder" | "file" | "image" | "pdf" | "audio" | "video" | "text" | "code";

export interface FileItem {
  id: string;
  name: string;
  type: FileType;
  size: number; // In bytes, 0 for folders
  updatedAt: string;
  mimeType?: string;
  path: string[]; // Path segments to the file
  owner?: string;
}

export interface BreadcrumbItem {
  name: string;
  path: string[];
}
