import type { SidebarTab, SortField, SortOrder } from "../../types/file";

export function FilterSortBar({
  activeSidebarTab,
  checkedCount,
  sortField,
  onSortFieldChange,
  sortOrder,
  onToggleSortOrder,
  onClearSelection,
  onBatchStar,
  onBatchTrash,
  onBatchRestore,
  onBatchPermanentDelete,
  onBatchDownload,
}: {
  activeSidebarTab: SidebarTab;
  checkedCount: number;
  sortField: SortField;
  onSortFieldChange: (field: SortField) => void;
  sortOrder: SortOrder;
  onToggleSortOrder: () => void;
  onClearSelection: () => void;
  onBatchStar: () => void;
  onBatchTrash: () => void;
  onBatchRestore: () => void;
  onBatchPermanentDelete: () => void;
  onBatchDownload: () => void;
}) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border-main pb-3" onClick={(e) => e.stopPropagation()}>
      {checkedCount > 0 ? (
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
      ) : (
        <div />
      )}

      <div className="flex gap-2">
        <select
          value={sortField}
          onChange={(e) => onSortFieldChange(e.target.value as SortField)}
          className="px-3 py-1.5 bg-code-bg border border-border-main rounded-full text-xs font-medium text-text-main cursor-pointer focus:outline-none"
        >
          <option value="name">Sort by Name</option>
          <option value="modifiedAt">Sort by Modified</option>
          <option value="size">Sort by Size</option>
        </select>
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
