import { useEffect, useState } from "react";
import { Search, Grid, List, Menu, Clock } from "lucide-react";
import type { ViewMode } from "../../types/file";

// Countdown to the access-token expiry. Refreshes itself once a minute (every
// 10s in the last few minutes) so it never drifts far.
function SessionTimer({ expiresAt }: { expiresAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setNow(Date.now());
    const remaining = expiresAt - Date.now();
    const interval = remaining > 5 * 60_000 ? 60_000 : 10_000;
    const id = setInterval(tick, interval);
    return () => clearInterval(id);
  }, [expiresAt, now]);

  if (!expiresAt) return null;

  const ms = expiresAt - now;
  const expired = ms <= 0;
  const mins = Math.floor(ms / 60_000);
  const label = expired
    ? "Session expired"
    : mins >= 60
    ? `${Math.floor(mins / 60)}h ${mins % 60}m left`
    : mins >= 1
    ? `${mins}m left`
    : `${Math.max(0, Math.floor(ms / 1000))}s left`;

  const tone = expired || mins < 5 ? "text-red-500" : mins < 15 ? "text-amber-500" : "text-text-main";

  return (
    <span
      className={`hidden min-[600px]:flex items-center gap-1.5 text-xs font-medium shrink-0 ${tone}`}
      title={`Session expires ${new Date(expiresAt).toLocaleString()}`}
    >
      <Clock className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

export function TopBar({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onMenuClick,
  sessionExpiresAt = null,
}: {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onMenuClick?: () => void;
  sessionExpiresAt?: number | null;
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

      <div className="flex items-center gap-3 shrink-0">
        {/* <SessionTimer expiresAt={sessionExpiresAt} /> */}
        <div className="flex items-center gap-2">
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
        </div>
      </div>
    </header>
  );
}
