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

import type { ReactNode } from "react";
import { Check, Download, RefreshCw, RotateCcw, Trash2, XCircle, X } from "lucide-react";
import { SORT_FIELD_OPTIONS } from "../../types/file";
import type { SidebarTab, SortField, SortOrder } from "../../types/file";
import { Dropdown } from "../common/Dropdown";
import { Breadcrumbs, type BreadcrumbSegment } from "../layout/Breadcrumbs";

export const pillActionClass =
  "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-text-heading hover:text-accent hover:bg-accent-bg rounded-full transition cursor-pointer border-none bg-transparent disabled:opacity-50 disabled:cursor-not-allowed";

export function SelectionPill({ count, label, onClear, children }: { count?: number; label?: ReactNode; onClear: () => void; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 bg-bg-main border border-accent-border/70 shadow-lg shadow-black/10 dark:shadow-black/40 backdrop-blur-md px-2 py-1 rounded-full transition-all duration-200">
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-accent-bg text-accent rounded-full text-xs font-semibold select-none">
        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
        <span>{label ?? `${(count ?? 0).toLocaleString()} selected`}</span>
      </div>

      {children && (
        <>
          <div className="h-4 w-px bg-border-main my-auto mx-0.5" />
          {children}
        </>
      )}

      <div className="h-4 w-px bg-border-main my-auto mx-0.5" />

      <button
        type="button"
        onClick={onClear}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-text-main hover:text-text-heading hover:bg-code-bg rounded-full transition cursor-pointer border-none bg-transparent disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        title="Clear selection"
        aria-label="Clear selection"
      >
        <X className="w-3.5 h-3.5" />
        <span className="max-[640px]:hidden">Clear</span>
      </button>
    </div>
  );
}

export function RefreshButton({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  return (
    <button
      onClick={onRefresh}
      disabled={refreshing}
      title="Refresh"
      aria-label="Refresh"
      className="p-1.5 bg-code-bg border border-border-main rounded-full text-text-main cursor-pointer hover:bg-border-main transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center shrink-0"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
    </button>
  );
}

// Shown in every view, list included — the table's column headers are a second way to sort.
export function SortControls({
  sortField,
  onSortFieldChange,
  sortOrder,
  onToggleSortOrder,
  onRefresh,
  refreshing,
}: {
  sortField: SortField;
  onSortFieldChange: (field: SortField) => void;
  sortOrder: SortOrder;
  onToggleSortOrder: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <RefreshButton onRefresh={onRefresh} refreshing={refreshing} />
      <Dropdown value={sortField} options={SORT_FIELD_OPTIONS} onChange={onSortFieldChange} align="end" />
      <button
        onClick={onToggleSortOrder}
        className="px-3 py-1.5 bg-code-bg border border-border-main rounded-full text-xs font-medium text-text-main cursor-pointer hover:bg-border-main transition"
        title="Toggle Sort Direction"
      >
        {sortOrder === "asc" ? "▲" : "▼"}
      </button>
    </div>
  );
}

export function FilterSortBar({
  breadcrumbSegments,
  onBreadcrumbNavigate,
  activeSidebarTab,
  checkedCount,
  sortField,
  onSortFieldChange,
  sortOrder,
  onToggleSortOrder,
  onRefresh,
  refreshing,
  onClearSelection,
  onBatchTrash,
  onBatchRestore,
  onBatchPermanentDelete,
  onBatchDownload,
  downloadBlockedReason,
  changeBlockedReason,
}: {
  breadcrumbSegments: BreadcrumbSegment[];
  onBreadcrumbNavigate: (index: number) => void;
  activeSidebarTab: SidebarTab;
  checkedCount: number;
  sortField: SortField;
  onSortFieldChange: (field: SortField) => void;
  sortOrder: SortOrder;
  onToggleSortOrder: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  onClearSelection: () => void;
  onBatchTrash: () => void;
  onBatchRestore: () => void;
  onBatchPermanentDelete: () => void;
  onBatchDownload: () => void;
  // Set when nothing in the selection can be downloaded / changed; shown as the button tooltip.
  downloadBlockedReason?: string | null;
  changeBlockedReason?: string | null;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap pb-2" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2 flex-1 min-w-0 max-[768px]:basis-full">
        <Breadcrumbs segments={breadcrumbSegments} onNavigate={onBreadcrumbNavigate} />
      </div>

      {checkedCount > 0 && (
        <SelectionPill count={checkedCount} onClear={onClearSelection}>
          {activeSidebarTab === "trash" ? (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onBatchRestore}
                disabled={!!changeBlockedReason}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-text-heading hover:text-accent hover:bg-accent-bg rounded-full transition cursor-pointer border-none bg-transparent disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                title={changeBlockedReason ?? "Restore selected items"}
              >
                <RotateCcw className="w-3.5 h-3.5 text-accent" />
                <span className="max-[640px]:hidden">Restore</span>
              </button>
              <button
                type="button"
                onClick={onBatchPermanentDelete}
                disabled={!!changeBlockedReason}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition cursor-pointer border-none bg-transparent disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                title={changeBlockedReason ?? "Permanently delete selected items"}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="max-[640px]:hidden">Delete</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onBatchDownload}
                disabled={!!downloadBlockedReason}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-text-heading hover:text-accent hover:bg-accent-bg rounded-full transition cursor-pointer border-none bg-transparent disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                title={downloadBlockedReason ?? "Download selected"}
              >
                <Download className="w-3.5 h-3.5 text-accent" />
                <span className="max-[640px]:hidden">Download</span>
              </button>
              <button
                type="button"
                onClick={onBatchTrash}
                disabled={!!changeBlockedReason}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition cursor-pointer border-none bg-transparent disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                title={changeBlockedReason ?? "Move selected to trash"}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="max-[640px]:hidden">Move to Trash</span>
              </button>
              {/* Skips Trash entirely, same as ItemContextMenu's single-item version. */}
              <button
                type="button"
                onClick={onBatchPermanentDelete}
                disabled={!!changeBlockedReason}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition cursor-pointer border-none bg-transparent disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                title={changeBlockedReason ?? "Permanently delete selected items"}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span className="max-[640px]:hidden">Delete</span>
              </button>
            </div>
          )}
        </SelectionPill>
      )}

      <SortControls
        sortField={sortField}
        onSortFieldChange={onSortFieldChange}
        sortOrder={sortOrder}
        onToggleSortOrder={onToggleSortOrder}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />
    </div>
  );
}
