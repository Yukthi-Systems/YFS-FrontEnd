export interface FileVersion {
  id: string;
  storageKey: string;
  blobUrl?: string; // regenerated from storageKey on load, like FileItem.blobUrl
  size: number;
  savedAt: string; // ISO String — when this version stopped being current
}

export interface ShareCollaborator {
  email: string;
  permission: "view" | "edit";
}

// Demo-only link protection: there is no backend here to verify a password or OTP
// server-side, so this only gates the client-side SharedFileView UI. Never treat this as
// real access control for anything sensitive.
export interface ShareSettings {
  token: string;
  visibility: "restricted" | "anyone";
  linkPermission: "view" | "edit";
  password?: string;
  otpRequired?: boolean;
  expiresAt?: string | null; // ISO String
  collaborators: ShareCollaborator[];
}

export interface FileItem {
  id: string;
  name: string;
  isFolder: boolean;
  parentId: string | null;
  size: number; // in bytes
  owner: {
    name: string;
    email: string;
  };
  modifiedAt: string; // ISO String
  createdAt: string; // ISO String
  isStarred: boolean;
  isDeleted: boolean;
  type: "folder" | "audio" | "video" | "image" | "pdf" | "spreadsheet" | "document" | "code" | "other";
  extension?: string;
  blobUrl?: string; // Local Object URL for active previews (regenerated from storageKey on load)
  storageKey?: string; // IndexedDB key for the persisted bytes; absent for seeded demo items
  versions?: FileVersion[]; // past content, newest first; does not include the current version
  share?: ShareSettings;
}

export type SidebarTab = "drive" | "projects" | "shared" | "recent" | "starred" | "trash" | "system";
export type ViewMode = "list" | "grid";
export type SortField = "name" | "modifiedAt" | "size";
export type SortOrder = "asc" | "desc";
