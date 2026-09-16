import { RefreshCw } from "lucide-react";
import { SORT_FIELD_OPTIONS } from "../../types/file";
import type { SidebarTab, SortField, SortOrder } from "../../types/file";
import { Dropdown } from "../common/Dropdown";
import { Breadcrumbs, type BreadcrumbSegment } from "../layout/Breadcrumbs";

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
  onBatchStar,
  onBatchTrash,
  onBatchRestore,
  onBatchPermanentDelete,
  onBatchDownload,
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
  onBatchStar: () => void;
  onBatchTrash: () => void;
  onBatchRestore: () => void;
  onBatchPermanentDelete: () => void;
  onBatchDownload: () => void;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap  pb-4 mb-3" onClick={(e) => e.stopPropagation()}>
      <div className="flex-1 min-w-0">
        <Breadcrumbs segments={breadcrumbSegments} onNavigate={onBreadcrumbNavigate} />
      </div>

      {checkedCount > 0 && (
        <div className="flex items-center gap-3 bg-accent-bg border border-accent-border px-3.5 py-1.5 rounded-xl animate-fade-in">
          <span className="text-xs font-semibold text-accent">{checkedCount} selected</span>
          {activeSidebarTab === "trash" ? (
            <>
              <button onClick={onBatchRestore} className="text-xs bg-transparent border-none text-text-heading hover:bg-black/5 dark:hover:bg-white/5 py-1 px-2 rounded font-medium cursor-pointer transition">
                Restore
              </button>
              <button onClick={onBatchPermanentDelete} className="text-xs bg-transparent border-none text-red-500 hover:bg-red-500/10 py-1 px-2 rounded font-medium cursor-pointer transition">
                Delete Permanent
              </button>
            </>
          ) : (
            <>
              <button onClick={onBatchDownload} className="text-xs bg-transparent border-none text-text-heading hover:bg-black/5 dark:hover:bg-white/5 py-1 px-2 rounded font-medium cursor-pointer transition">
                ⬇ Download
              </button>
              <button onClick={onBatchStar} className="text-xs bg-transparent border-none text-text-heading hover:bg-black/5 dark:hover:bg-white/5 py-1 px-2 rounded font-medium cursor-pointer transition">
                ★ Star
              </button>
              <button onClick={onBatchTrash} className="text-xs bg-transparent border-none text-red-500 hover:bg-red-500/10 py-1 px-2 rounded font-medium cursor-pointer transition">
                🗑️ Move to Trash
              </button>
            </>
          )}
          <button onClick={onClearSelection} className="text-xs bg-transparent border-none text-text-heading hover:bg-black/5 dark:hover:bg-white/5 py-1 px-2 rounded font-medium cursor-pointer transition ml-2">
            ✕ Clear
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onRefresh}
          disabled={refreshing}
          title="Refresh"
          aria-label="Refresh"
          className="p-1.5 bg-code-bg border border-border-main rounded-full text-text-main cursor-pointer hover:bg-border-main transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
        <Dropdown value={sortField} options={SORT_FIELD_OPTIONS} onChange={onSortFieldChange} align="end" />
        <button
          onClick={onToggleSortOrder}
          className="px-3 py-1.5 bg-code-bg border border-border-main rounded-full text-xs font-medium text-text-main cursor-pointer hover:bg-border-main transition"
          title="Toggle Sort Direction"
        >
          {sortOrder === "asc" ? "▲" : "▼"}
        </button>
      </div>
    </div>
  );
}
