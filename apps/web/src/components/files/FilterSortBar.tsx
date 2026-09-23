import { Check, Download, RefreshCw, RotateCcw, Trash2, XCircle, X } from "lucide-react";
import { SORT_FIELD_OPTIONS } from "../../types/file";
import type { SidebarTab, SortField, SortOrder, ViewMode } from "../../types/file";
import { Dropdown } from "../common/Dropdown";
import { Breadcrumbs, type BreadcrumbSegment } from "../layout/Breadcrumbs";

export function FilterSortBar({
  breadcrumbSegments,
  onBreadcrumbNavigate,
  activeSidebarTab,
  checkedCount,
  viewMode,
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
}: {
  breadcrumbSegments: BreadcrumbSegment[];
  onBreadcrumbNavigate: (index: number) => void;
  activeSidebarTab: SidebarTab;
  checkedCount: number;
  // The list view sorts via clickable column headers instead — this dropdown is
  // only needed as a sort trigger for grid/tiles views, which have no headers.
  viewMode: ViewMode;
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
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap pb-2" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Breadcrumbs segments={breadcrumbSegments} onNavigate={onBreadcrumbNavigate} />
        <button
          onClick={onRefresh}
          disabled={refreshing}
          title="Refresh"
          aria-label="Refresh"
          className="p-1.5 bg-code-bg border border-border-main rounded-full text-text-main cursor-pointer hover:bg-border-main transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {checkedCount > 0 && (
        <div className="flex items-center gap-1.5 bg-bg-main border border-accent-border/70 shadow-lg shadow-black/10 dark:shadow-black/40 backdrop-blur-md px-2 py-1 rounded-full transition-all duration-200">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-accent-bg text-accent rounded-full text-xs font-semibold select-none">
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{checkedCount.toLocaleString()} selected</span>
          </div>

          <div className="h-4 w-px bg-border-main my-auto mx-0.5" />

          {activeSidebarTab === "trash" ? (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onBatchRestore}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-text-heading hover:text-accent hover:bg-accent-bg rounded-full transition cursor-pointer border-none bg-transparent"
                title="Restore selected items"
              >
                <RotateCcw className="w-3.5 h-3.5 text-accent" />
                <span>Restore</span>
              </button>
              <button
                type="button"
                onClick={onBatchPermanentDelete}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition cursor-pointer border-none bg-transparent"
                title="Permanently delete selected items"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onBatchDownload}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-text-heading hover:text-accent hover:bg-accent-bg rounded-full transition cursor-pointer border-none bg-transparent"
                title="Download selected"
              >
                <Download className="w-3.5 h-3.5 text-accent" />
                <span>Download</span>
              </button>
              <button
                type="button"
                onClick={onBatchTrash}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition cursor-pointer border-none bg-transparent"
                title="Move selected to trash"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Move to Trash</span>
              </button>
              {/* Skips Trash entirely, same as ItemContextMenu's single-item version. */}
              <button
                type="button"
                onClick={onBatchPermanentDelete}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition cursor-pointer border-none bg-transparent"
                title="Permanently delete selected items"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          )}

          <div className="h-4 w-px bg-border-main my-auto mx-0.5" />

          <button
            type="button"
            onClick={onClearSelection}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-text-main hover:text-text-heading hover:bg-code-bg rounded-full transition cursor-pointer border-none bg-transparent"
            title="Clear selection"
            aria-label="Clear selection"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 shrink-0">
        {/* List view sorts via the table's column headers instead. */}
        {viewMode !== "list" && (
          <>
            <Dropdown value={sortField} options={SORT_FIELD_OPTIONS} onChange={onSortFieldChange} align="end" />
            <button
              onClick={onToggleSortOrder}
              className="px-3 py-1.5 bg-code-bg border border-border-main rounded-full text-xs font-medium text-text-main cursor-pointer hover:bg-border-main transition"
              title="Toggle Sort Direction"
            >
              {sortOrder === "asc" ? "▲" : "▼"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
