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

import { useState } from "react";
import { Archive, CheckCircle2, ChevronDown, ChevronUp, Download, Loader2, X, XCircle } from "lucide-react";
import { saveFromUrl, useFolderArchive } from "../../hooks/useDownload";
import type { ArchiveJob } from "../../atoms/archiveJobs";
import { formatBytes } from "../../utils/format";

const statusText = (job: ArchiveJob): string => {
  switch (job.status) {
    case "starting":
      return "Starting…";
    case "queued":
      return "Waiting in queue…";
    case "processing":
      return job.totalFiles
        ? `Preparing · ${job.processedFiles}/${job.totalFiles} files · ${formatBytes(job.processedBytes)} of ${formatBytes(job.totalBytes)}`
        : "Preparing…";
    case "ready":
      return "Download started";
    case "failed":
      return job.error ?? "Failed";
  }
};

const iconButton =
  "border-none bg-transparent p-1 rounded-full text-text-main hover:bg-code-bg cursor-pointer transition shrink-0";

export function DownloadTray() {
  const { jobs, dismissArchive } = useFolderArchive();
  const [collapsed, setCollapsed] = useState(false);

  if (jobs.length === 0) return null;

  const activeCount = jobs.filter((j) => j.status !== "ready" && j.status !== "failed").length;

  return (
    <div className="w-full bg-bg-main border border-border-main rounded-2xl shadow-lg overflow-hidden animate-scale-in">
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border-main cursor-pointer"
        onClick={() => setCollapsed((v) => !v)}
      >
        <span className="text-sm font-semibold text-text-heading flex items-center gap-2">
          <Archive className="w-4 h-4 text-accent" />
          {activeCount > 0 ? `Preparing ${activeCount} download${activeCount > 1 ? "s" : ""}…` : "Downloads ready"}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setCollapsed((v) => !v);
          }}
          className={iconButton}
        >
          {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="max-h-64 overflow-y-auto flex flex-col">
          {jobs.map((job) => {
            const pct = job.totalBytes ? Math.min(100, Math.round((job.processedBytes / job.totalBytes) * 100)) : 0;
            const canRedownload = job.status === "ready" && !!job.downloadUrl && (job.expiresAt ?? 0) > Date.now();
            return (
              <div key={job.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border-main last:border-b-0">
                {job.status === "ready" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                ) : job.status === "failed" ? (
                  <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                ) : (
                  <Loader2 className="w-4 h-4 text-accent shrink-0 animate-spin" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-text-heading truncate">{job.name}</div>
                  {job.status === "processing" && job.totalBytes > 0 && (
                    <div className="w-full h-1 bg-border-main rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-accent rounded-full transition-all duration-150" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                  <div className={`text-[11px] mt-0.5 truncate ${job.status === "failed" ? "text-red-500" : "text-text-main"}`} title={statusText(job)}>
                    {statusText(job)}
                  </div>
                </div>

                {canRedownload && (
                  <button onClick={() => saveFromUrl(job.downloadUrl!)} title="Download again" className={iconButton}>
                    <Download className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => dismissArchive(job.id)}
                  title={job.status === "ready" || job.status === "failed" ? "Dismiss" : "Stop watching"}
                  className={iconButton}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
