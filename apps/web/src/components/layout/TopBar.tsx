import { Search, Menu } from "lucide-react";
import type { GridSize, ViewMode } from "../../types/file";
import { ViewModeToggle } from "./ViewModeToggle";

export function TopBar({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  gridSize,
  onGridSizeChange,
  onMenuClick,
}: {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  gridSize: GridSize;
  onGridSizeChange: (size: GridSize) => void;
  onMenuClick?: () => void;
}) {
  return (
    <header className="h-14 min-h-14 border-b border-border-main px-5 flex items-center justify-between gap-3 md:gap-6 box-border max-[768px]:px-3">
      <button
        onClick={onMenuClick}
        className="hidden max-[768px]:flex shrink-0 w-9 h-9 items-center justify-center rounded-full text-text-main hover:bg-code-bg hover:text-text-heading border-none bg-transparent cursor-pointer transition"
        title="Menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="relative flex-1 min-w-0 max-w-xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-main pointer-events-none" />
        <input
          type="text"
          placeholder="Search files and folders..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full py-2.5 pl-11 pr-4 rounded-full border border-border-main bg-code-bg text-text-heading text-sm transition focus:outline-none focus:border-accent focus:bg-bg-main focus:ring-4 focus:ring-accent-bg"
        />
      </div>

      <ViewModeToggle
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        gridSize={gridSize}
        onGridSizeChange={onGridSizeChange}
      />
    </header>
  );
}
