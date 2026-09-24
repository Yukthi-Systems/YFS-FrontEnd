import type { InternalSharePermissions } from "@yfs/service";

export type { InternalSharePermissions };

// Synthetic parent id for folders shown in the "Shared with me" tab.
export const SHARED_ROOT_ID = "__shared_with_me__";

// A folder that appears in the "Shared with me" tab: who owns it and what I can do.
export interface SharedInInfo {
  ownerUserId: string;
  ownerEmail?: string;
  permissions: InternalSharePermissions;
}

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
  isDeleted: boolean; // true = sitting in the Trash folder
  type: "folder" | "audio" | "video" | "image" | "pdf" | "spreadsheet" | "document" | "code" | "other";
  extension?: string;
  blobUrl?: string; // Local Object URL for active previews (regenerated from storageKey on load)
  storageKey?: string; // IndexedDB key for the persisted bytes; absent for seeded demo items
  fileId?: string; // logical files.file_id from the upload backend (stable across versions)
  version?: number; // current file_versions.file_version; defaults to 1 when unknown
  resourceInfo?: Record<string, unknown>; // folders.folder_info / files.file_info (creation_info, trash_info, ui, …)
  color?: string; // folder colour (from resource_info.ui.color)
  icon?: string; // folder icon key (from resource_info.ui.icon)
  createdByEmail?: string;
  createdBy?: string; // resolved live from resource_info.creation_info.user_id (see resolveCreatedByNames in fileSystemStore.ts)
  versions?: FileVersion[]; // past content, newest first; does not include the current version
  share?: ShareSettings; // legacy client-only external link (SharedFileView demo route)
  sharedIn?: SharedInInfo; // set on folders in the "Shared with me" tab
  // "server" = came from YFS-Main-API (/folders/*), "local" = created client-side only
  // (uploaded files, offline-created folders). Absent on seeded/legacy items.
  origin?: "server" | "local" | "shared";
  isLocked?: boolean;
}

// "shared" = shared with me (in); "shared-out" = folders I've shared; "shared-links" = my public links.
export type SidebarTab =
  | "drive"
  | "projects"
  | "shared"
  | "shared-out"
  | "shared-links"
  | "recent"
  | "trash";
export type ViewMode = "list" | "tiles" | "grid";
export type GridSize = "small" | "medium" | "large";
export type SortField = "name" | "modifiedAt" | "size";
export type SortOrder = "asc" | "desc";

export const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: "name", label: "Sort by Name" },
  { value: "modifiedAt", label: "Sort by Modified" },
  { value: "size", label: "Sort by Size" },
];
