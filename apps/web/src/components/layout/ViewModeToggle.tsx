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

import { LayoutGrid, LayoutList, List } from "lucide-react";
import type { GridSize, ViewMode } from "../../types/file";
import { Dropdown } from "../common/Dropdown";

const GRID_SIZE_OPTIONS: { value: GridSize; label: string }[] = [
  { value: "small", label: "Small icons" },
  { value: "medium", label: "Medium icons" },
  { value: "large", label: "Large icons" },
];

const MODES: { mode: ViewMode; label: string; Icon: typeof List }[] = [
  { mode: "list", label: "List view", Icon: List },
  { mode: "tiles", label: "Tiles view", Icon: LayoutList },
  { mode: "grid", label: "Grid view", Icon: LayoutGrid },
];

export function ViewModeToggle({
  viewMode,
  onViewModeChange,
  gridSize,
  onGridSizeChange,
}: {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  gridSize: GridSize;
  onGridSizeChange: (size: GridSize) => void;
}) {
  return (
    <div className="flex items-center gap-3 shrink-0">
      <div className="flex items-center gap-1 bg-code-bg border border-border-main rounded-full p-0.5">
        {MODES.map(({ mode, label, Icon }) => (
          <button
            key={mode}
            onClick={() => onViewModeChange(mode)}
            aria-pressed={viewMode === mode}
            className={`w-8 h-8 flex items-center justify-center rounded-full text-text-main hover:text-text-heading cursor-pointer transition ${
              viewMode === mode ? "bg-bg-main text-accent! shadow-sm" : ""
            }`}
            title={label}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
      </div>

      {viewMode === "grid" && (
        <Dropdown
          value={gridSize}
          options={GRID_SIZE_OPTIONS}
          onChange={onGridSizeChange}
          triggerClassName="px-3 h-9 bg-code-bg border border-border-main rounded-full text-xs font-medium text-text-main cursor-pointer hover:bg-border-main transition inline-flex items-center gap-1.5"
        />
      )}
    </div>
  );
}
