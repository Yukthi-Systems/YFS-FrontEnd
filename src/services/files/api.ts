import type { FileItem } from "@/types";

let mockFiles: FileItem[] = [
  {
    id: "1",
    name: "Documents",
    type: "folder",
    size: 0,
    updatedAt: "2026-06-05T12:00:00Z",
    path: [],
  },
  {
    id: "2",
    name: "Pictures",
    type: "folder",
    size: 0,
    updatedAt: "2026-06-07T14:30:00Z",
    path: [],
  },
  {
    id: "3",
    name: "Projects",
    type: "folder",
    size: 0,
    updatedAt: "2026-06-08T09:15:00Z",
    path: [],
  },
  {
    id: "4",
    name: "resume.pdf",
    type: "pdf",
    size: 1048576,
    updatedAt: "2026-06-01T10:00:00Z",
    path: ["Documents"],
  },
  {
    id: "5",
    name: "taxes_2025.txt",
    type: "text",
    size: 2048,
    updatedAt: "2026-04-15T08:00:00Z",
    path: ["Documents"],
  },
  {
    id: "6",
    name: "avatar.png",
    type: "image",
    size: 512000,
    updatedAt: "2026-06-07T15:00:00Z",
    path: ["Pictures"],
  },
  {
    id: "7",
    name: "vacation.jpg",
    type: "image",
    size: 3145728,
    updatedAt: "2026-06-07T16:00:00Z",
    path: ["Pictures"],
  },
  {
    id: "8",
    name: "index.tsx",
    type: "code",
    size: 12000,
    updatedAt: "2026-06-08T11:00:00Z",
    path: ["Projects", "Y-Files"],
  },
  {
    id: "9",
    name: "package.json",
    type: "code",
    size: 800,
    updatedAt: "2026-06-08T11:05:00Z",
    path: ["Projects", "Y-Files"],
  },
  {
    id: "10",
    name: "Y-Files",
    type: "folder",
    size: 0,
    updatedAt: "2026-06-08T10:00:00Z",
    path: ["Projects"],
  },
  {
    id: "11",
    name: "podcast.mp3",
    type: "audio",
    size: 45000000,
    updatedAt: "2026-05-20T18:22:00Z",
    path: [],
  },
];

export async function fetchFiles(currentPath: string[]): Promise<FileItem[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return mockFiles.filter((file) => {
    if (file.path.length !== currentPath.length) return false;
    return file.path.every((seg, idx) => seg === currentPath[idx]);
  });
}

export async function fetchFileDetails(id: string): Promise<FileItem | null> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return mockFiles.find((f) => f.id === id) || null;
}

export async function createFolder(name: string, path: string[]): Promise<FileItem> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const newFolder: FileItem = {
    id: Date.now().toString(),
    name,
    type: "folder",
    size: 0,
    updatedAt: new Date().toISOString(),
    path,
  };
  mockFiles = [newFolder, ...mockFiles];
  return newFolder;
}

export async function deleteFile(id: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  mockFiles = mockFiles.filter((f) => f.id !== id);
  return id;
}

export async function renameFile(id: string, newName: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  mockFiles = mockFiles.map((f) => {
    if (f.id === id) {
      return { ...f, name: newName, updatedAt: new Date().toISOString() };
    }
    return f;
  });
  return id;
}

export async function uploadFile(
  name: string,
  type: any,
  size: number,
  path: string[],
): Promise<FileItem> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  const newFile: FileItem = {
    id: Date.now().toString(),
    name,
    type,
    size,
    updatedAt: new Date().toISOString(),
    path,
  };
  mockFiles = [newFile, ...mockFiles];
  return newFile;
}
