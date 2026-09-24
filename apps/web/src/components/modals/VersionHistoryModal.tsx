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

import { Download, History, Loader2, Trash2 } from "lucide-react";
import type { FileItem, InternalSharePermissions } from "../../types/file";
import { formatBytes, formatDate } from "../../utils/format";
import { ModalShell } from "./ModalShell";

export function VersionHistoryModal({
  item,
  latestVersion,
  olderVersions,
  loading,
  onClose,
  onDownloadVersion,
  onDeleteVersion,
  permissions = null,
}: {
  item: FileItem;
  latestVersion: number;
  olderVersions: number[];
  loading: boolean;
  onClose: () => void;
  onDownloadVersion: (version: number) => void;
  onDeleteVersion: (version: number) => void;
  permissions?: InternalSharePermissions | null;
}) {
  const canDelete = !permissions || permissions.can_delete;
  // With no older versions, deleting the current one deletes the file.
  const isOnlyVersion = !loading && olderVersions.length === 0;
  return (
    <ModalShell onClose={onClose}>
      <h3 className="modal-title flex items-center gap-2">
        <History className="w-4 h-4" /> Version History
      </h3>
      <p className="modal-description break-all">{item.name}</p>

      <div className="max-h-80 overflow-y-auto flex flex-col gap-2 mb-5">
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-accent-border bg-accent-bg">
          <div>
            <div className="text-xs font-semibold text-accent">Current version (v{latestVersion})</div>
            <div className="text-[11px] text-text-main">
              {formatDate(item.modifiedAt)} · {formatBytes(item.size)}
            </div>
          </div>
          {!loading && canDelete && (
            <button
              onClick={() => onDeleteVersion(latestVersion)}
              className="border-none bg-transparent p-1.5 rounded-full text-red-500 hover:bg-red-500/10 cursor-pointer transition"
              title={isOnlyVersion ? "Delete this file (it's the only version)" : "Delete this version"}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 text-xs text-text-main py-6">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading versions…
          </div>
        ) : olderVersions.length === 0 ? (
          <div className="text-xs text-text-main text-center py-6">No earlier versions yet — replacing this file creates one.</div>
        ) : (
          olderVersions.map((v) => {
            // The server never allows deleting version 1 on its own.
            const isFirstVersion = v === 1;
            return (
              <div key={v} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border-main">
                <div className="text-xs font-semibold text-text-heading">Version {v}</div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => onDownloadVersion(v)}
                    className="border-none bg-transparent p-1.5 rounded-full text-text-main hover:bg-code-bg cursor-pointer transition"
                    title="Download this version"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => !isFirstVersion && onDeleteVersion(v)}
                      disabled={isFirstVersion}
                      className="border-none bg-transparent p-1.5 rounded-full text-red-500 hover:bg-red-500/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer transition"
                      title={
                        isFirstVersion
                          ? "The first version can't be deleted on its own — delete the whole file instead if you want it gone"
                          : "Delete this version"
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="modal-actions">
        <button onClick={onClose} className="btn-outline">
          Close
        </button>
      </div>
    </ModalShell>
  );
}
