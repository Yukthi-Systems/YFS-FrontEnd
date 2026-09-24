import type { UserInfo } from "../atoms/auth";
import type { FileItem } from "../types/file";

// A file's size comes back 0/unset until the Storage API's server-side callback
// confirms the upload to YFS-Main-API — that's "processing". If it's been stuck
// that way since longer than this ago, the callback almost certainly never landed
// (a dropped connection, a crashed worker, ...), so it's treated as failed instead
// of showing "Processing" forever.
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

export const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return "-";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

// Like formatBytes but renders a real "0 B" instead of "-" (used for storage totals
// where zero is a meaningful value, not "no file").
export const formatSize = (bytes: number): string => {
  if (!bytes || bytes < 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

// YFS-Main-API returns quota_allocated / quota_utilized in GB (from the SSO file
// service). This is the single source of truth for the storage widget — the client
// never sums file sizes itself (it only ever holds a partial view of the tree).
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

// Own-drive items carry owner.name "me" until the creator lookup resolves a real name.
export const getOwnerDisplay = (item: FileItem, me: UserInfo | null | undefined) => {
  const ownDrive = item.owner.name === "me";
  const email = item.createdByEmail || (item.createdBy ? "" : item.owner.email);
  const name = item.createdBy || (ownDrive ? userDisplayName(me) || "me" : item.owner.name);
  const isMe = !!me?.email && (email ? email === me.email : ownDrive);
  return { label: isMe && name !== "me" ? `${name} (me)` : name, email };
};
