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
  blobUrl?: string;
  size: number;
  savedAt: string; // when this version stopped being current
}

export interface ShareCollaborator {
  email: string;
  permission: "view" | "edit";
}

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
  blobUrl?: string;
  storageKey?: string; // IndexedDB key for cached bytes
  fileId?: string; // stable across versions
  version?: number; // defaults to 1 when unknown
  resourceInfo?: Record<string, unknown>; // folder_info / file_info
  color?: string; // folder colour (from resource_info.ui.color)
  icon?: string; // folder icon key (from resource_info.ui.icon)
  createdByEmail?: string;
  createdBy?: string;
  versions?: FileVersion[]; // newest first, excludes the current version
  share?: ShareSettings;
  sharedIn?: SharedInInfo; // set on folders in the "Shared with me" tab
  // "server" from YFS-Main-API, "local" client-only, "shared" from a share.
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
