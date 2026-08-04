import { Search, Grid, List } from "lucide-react";
import type { ViewMode } from "../../types/file";

export function TopBar({
  isSystemView,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
}: {
  isSystemView: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  return (
    <header className="h-[70px] min-h-[70px] border-b border-border-main px-8 flex items-center justify-between gap-8 box-border max-[768px]:px-4">
      {!isSystemView ? (
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-main pointer-events-none" />
          <input
            type="text"
            placeholder="Search files and folders..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full py-2.5 pl-11 pr-4 rounded-full border border-border-main bg-code-bg text-text-heading text-sm transition focus:outline-none focus:border-accent focus:bg-bg-main focus:ring-4 focus:ring-accent-bg"
          />
        </div>
      ) : (
        <div className="font-semibold text-lg text-text-heading">System Dashboard</div>
      )}

      <div className="flex items-center gap-2">
        {!isSystemView && (
          <>
            <button
              onClick={() => onViewModeChange("list")}
              className={`w-9 h-9 flex items-center justify-center rounded-full text-text-main hover:bg-code-bg hover:text-text-heading cursor-pointer transition ${
                viewMode === "list" ? "bg-accent-bg text-accent! border border-accent-border!" : ""
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange("grid")}
              className={`w-9 h-9 flex items-center justify-center rounded-full text-text-main hover:bg-code-bg hover:text-text-heading cursor-pointer transition ${
                viewMode === "grid" ? "bg-accent-bg text-accent! border border-accent-border!" : ""
              }`}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
