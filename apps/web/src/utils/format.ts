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

import type { UserInfo } from "../atoms/auth";
import type { FileItem } from "../types/file";

// Size stays 0 until the Storage API's callback lands; past this, treat it as failed.
const PROCESSING_TIMEOUT_SECONDS = 65536;

type ProcessingCheckItem = { isFolder?: boolean; size?: number | null; createdAt?: string };

const isStuckAtZeroBytes = (item: ProcessingCheckItem): boolean => !item.isFolder && (!item.size || item.size <= 0);

const secondsSinceCreated = (item: ProcessingCheckItem): number | null =>
  item.createdAt ? (Date.now() - new Date(item.createdAt).getTime()) / 1000 : null;

export const isItemProcessing = (item: ProcessingCheckItem): boolean => {
  if (!isStuckAtZeroBytes(item)) return false;
  const elapsed = secondsSinceCreated(item);
  return elapsed === null || elapsed <= PROCESSING_TIMEOUT_SECONDS;
};

export const isItemFailed = (item: ProcessingCheckItem): boolean => {
  if (!isStuckAtZeroBytes(item)) return false;
  const elapsed = secondsSinceCreated(item);
  return elapsed !== null && elapsed > PROCESSING_TIMEOUT_SECONDS;
};

type LockCheckItem = {
  isFolder?: boolean;
  isLocked?: boolean;
  resourceInfo?: Record<string, unknown> | null;
};

export const isItemLocked = (
  item: LockCheckItem | null | undefined,
  fileInfo?: { is_locked?: boolean } | null
): boolean => {
  if (!item || item.isFolder) return false;
  if (item.isLocked) return true;
  if (fileInfo?.is_locked) return true;
  const raw = item.resourceInfo as Record<string, unknown> | undefined | null;
  if (raw?.is_locked === true) return true;
  return false;
};

// Shortens a long file/folder name for messages, keeping the extension: "quarterly_report_fin….xlsx".
export const shortName = (name: string, max = 28): string => {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 && name.length - dot <= 8 ? name.slice(dot) : "";
  return `${name.slice(0, Math.max(max - ext.length - 1, 8))}…${ext}`;
};

// Processing or failed files have no content to download yet; folders and locked files can be downloaded.
export const canDownloadItem = (item: ProcessingCheckItem): boolean =>
  !!item.isFolder || (!isItemProcessing(item) && !isItemFailed(item));

// Locked or still-processing files can't be renamed, moved, shared, trashed or deleted.
export const itemBusyReason = (
  item: (LockCheckItem & ProcessingCheckItem) | null | undefined,
  fileInfo?: { is_locked?: boolean } | null
): "locked" | "still processing" | null => {
  if (!item) return null;
  if (isItemLocked(item, fileInfo)) return "locked";
  if (isItemProcessing(item)) return "still processing";
  return null;
};

export const busyMessage = (item: { name: string } & Parameters<typeof itemBusyReason>[0], action: string): string | null => {
  const reason = itemBusyReason(item);
  return reason ? `"${shortName(item.name)}" is ${reason} and can't be ${action}` : null;
};

export const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return "-";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

// Like formatBytes, but shows "0 B" instead of "-".
export const formatSize = (bytes: number): string => {
  if (!bytes || bytes < 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

// Quota values from the API are in GB.
export const GB = 1024 * 1024 * 1024;

export interface StorageQuota {
  usedBytes: number;
  totalBytes: number;
  percent: number; // 0–100, clamped
  usedLabel: string;
  totalLabel: string;
  hasQuota: boolean;
}

export const getStorageQuota = (
  quotaAllocatedGb: number | undefined | null,
  quotaUtilizedGb: number | undefined | null
): StorageQuota => {
  const totalBytes = Math.max(0, Number(quotaAllocatedGb) || 0) * GB;
  const usedBytes = Math.max(0, Number(quotaUtilizedGb) || 0) * GB;
  const hasQuota = totalBytes > 0;
  const percent = hasQuota ? Math.min(100, Math.max(0, (usedBytes / totalBytes) * 100)) : 0;
  return {
    usedBytes,
    totalBytes,
    percent,
    usedLabel: formatSize(usedBytes),
    totalLabel: hasQuota ? formatSize(totalBytes) : "Unlimited",
    hasQuota,
  };
};

export const formatDate = (isoString: string): string => {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const userDisplayName = (u: UserInfo | null | undefined) =>
  u?.username || [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.email || undefined;

// The Owner is whoever the item's drive/share belongs to — never the creator (see
// getCreatedByDisplay below for that). They can differ: a folder User A shares with User B stays
// owned by User A no matter who — A or B — creates things inside it. Own-drive items carry
// owner.name "me" as a placeholder, resolved here to your real display name.
export const getOwnerDisplay = (item: FileItem, me: UserInfo | null | undefined) => {
  const ownDrive = item.owner.name === "me";
  const name = ownDrive ? userDisplayName(me) || "me" : item.owner.name;
  const email = item.owner.email;
  const isMe = !!me?.email && (email ? email === me.email : ownDrive);
  return { label: isMe && name !== "me" ? `${name} (me)` : name, email };
};

// Who actually created this item — distinct from Owner, which for a shared item is whoever the
// share root belongs to, not necessarily who created this specific file/folder inside it.
// item.createdBy is the live-resolved name (resolveCreatedByNames); the JSON's creation_info.user_name
// is the point-in-time snapshot from creation, used as a fallback until/unless that resolves.
// `name` is undefined when neither is known yet — callers decide how to render that themselves.
export const getCreatedByDisplay = (item: FileItem): { name?: string; email?: string } => {
  const snapshotName = (item.resourceInfo as { creation_info?: { user_name?: string } } | undefined)?.creation_info
    ?.user_name;
  return { name: item.createdBy || snapshotName, email: item.createdByEmail };
};
