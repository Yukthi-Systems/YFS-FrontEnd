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

import { AlertCircle, FolderInput, FolderOpen, Info, Pencil, X, Loader2 } from "lucide-react";
import type { FileItem } from "../../types/file";
import { formatBytes, formatDate, isItemFailed, isItemProcessing } from "../../utils/format";
import { CompactPreview, InfoRow, KIND_LABEL } from "../files/DetailsDrawer";

// DetailsDrawer for public share visitors; there's no public preview, download or delete.
export function SharedDetailsPanel({
  item,
  canEdit,
  canMove,
  onClose,
  onOpenFolder,
  onRename,
  onMove,
}: {
  item: FileItem;
  canEdit: boolean;
  canMove: boolean;
  onClose: () => void;
  onOpenFolder: () => void;
  onRename: () => void;
  onMove: () => void;
}) {
  return (
    <aside
      className="w-80 min-w-80 border-l border-border-main bg-bg-main flex flex-col h-full overflow-y-auto box-border shrink-0 max-[1024px]:absolute max-[1024px]:right-0 max-[1024px]:top-0 max-[1024px]:bottom-0 max-[1024px]:z-40 max-[1024px]:shadow-xl max-[360px]:w-full max-[420px]:min-w-0 animate-slide-in-right"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-4 py-3 border-b border-border-main flex items-center justify-between">
        <h3 className="text-base font-bold text-text-heading">Details</h3>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-code-bg text-text-main hover:text-text-heading border-none bg-transparent cursor-pointer transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4 text-left">
        <div className="w-full rounded-xl bg-code-bg border border-border-main overflow-hidden flex flex-col items-center justify-center min-h-40 p-4 box-border">
          <CompactPreview item={item} openable={false} />
        </div>

        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-bold text-text-heading break-all leading-snug">{item.name}</h4>
          <span className="text-xs text-text-main">{KIND_LABEL[item.type]}</span>
        </div>

        <div className="flex flex-col gap-2.5">
          <InfoRow label="Kind">
            {item.isFolder ? "Folder" : `${item.extension ? item.extension.toUpperCase() + " · " : ""}${KIND_LABEL[item.type]}`}
          </InfoRow>
          <InfoRow label="Size">
            {item.isFolder ? (
              item.size > 0 ? formatBytes(item.size) : "0 B"
            ) : isItemFailed(item) ? (
              <span className="inline-flex items-center gap-1.5 text-red-500 font-medium text-xs">
                <AlertCircle className="w-3 h-3" />
                Failed
              </span>
            ) : isItemProcessing(item) ? (
              <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium text-xs">
                <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                Processing
              </span>
            ) : (
              formatBytes(item.size)
            )}
          </InfoRow>
          <InfoRow label="Modified">{formatDate(item.modifiedAt)}</InfoRow>
          <InfoRow label="Created">{formatDate(item.createdAt)}</InfoRow>
        </div>

        <div className="flex flex-col gap-2 mt-2">
          {item.isFolder && (
            <button
              onClick={onOpenFolder}
              className="flex items-center justify-center gap-2 w-full py-2 bg-accent text-white font-semibold rounded-xl hover:shadow-md cursor-pointer transition-all"
            >
              <FolderOpen className="w-4 h-4" /> Open
            </button>
          )}
          {item.isFolder && canEdit && (
            <button
              onClick={onRename}
              className="w-full py-2 bg-transparent border border-border-main text-text-heading font-semibold rounded-xl hover:bg-code-bg cursor-pointer transition text-xs flex items-center justify-center gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5" /> Rename
            </button>
          )}
          {item.isFolder && canMove && (
            <button
              onClick={onMove}
              className="w-full py-2 bg-transparent border border-border-main text-text-heading font-semibold rounded-xl hover:bg-code-bg cursor-pointer transition text-xs flex items-center justify-center gap-1.5"
            >
              <FolderInput className="w-3.5 h-3.5" /> Move…
            </button>
          )}
          {!item.isFolder && (
            <div className="flex gap-2 items-start bg-code-bg border border-border-main text-text-main p-2.5 rounded-xl text-[11px] leading-normal">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-60" />
              <span>Opening and downloading files from a shared link isn&apos;t available yet.</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
