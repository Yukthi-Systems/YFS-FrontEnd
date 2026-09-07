export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "-";
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

// YFS-Main-API returns quota_allocated / quota_utilized in MB (from the SSO file
// service). This is the single source of truth for the storage widget — the client
// never sums file sizes itself (it only ever holds a partial view of the tree).
const MB = 1024 * 1024;

export interface StorageQuota {
  usedBytes: number;
  totalBytes: number;
  percent: number; // 0–100, clamped
  usedLabel: string;
  totalLabel: string;
  hasQuota: boolean;
}

export const getStorageQuota = (
  quotaAllocatedMb: number | undefined | null,
  quotaUtilizedMb: number | undefined | null
): StorageQuota => {
  const totalBytes = Math.max(0, Number(quotaAllocatedMb) || 0) * MB;
  const usedBytes = Math.max(0, Number(quotaUtilizedMb) || 0) * MB;
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
