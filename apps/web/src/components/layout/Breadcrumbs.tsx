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

import { ArrowLeft } from "lucide-react";
import { Dropdown } from "../common/Dropdown";
import { useIsMobile } from "../../hooks/useIsMobile";

export interface BreadcrumbSegment {
  id: string | null;
  name: string;
}

export function Breadcrumbs({
  segments,
  onNavigate,
}: {
  segments: BreadcrumbSegment[];
  onNavigate: (index: number) => void;
}) {
  const isMobile = useIsMobile();
  // More than the root segment means we're inside a folder and can go up one level.
  const canGoBack = segments.length > 1;

  // Keep root + the last few folders; the middle collapses into a "…" menu.
  const tail = isMobile ? 1 : 2;
  const collapsed = segments.length > tail + 2 ? segments.slice(1, segments.length - tail) : [];
  const visible = collapsed.length
    ? [{ seg: segments[0], idx: 0 }, ...segments.slice(-tail).map((seg, i) => ({ seg, idx: segments.length - tail + i }))]
    : segments.map((seg, idx) => ({ seg, idx }));

  const separator = <span className="text-border-main px-1 text-sm shrink-0">/</span>;

  return (
    <div className="flex items-center flex-nowrap gap-1 min-w-0 text-sm font-medium text-text-main">
      {canGoBack && (
        <button
          onClick={() => onNavigate(segments.length - 3)}
          title="Back"
          aria-label="Back"
          className="mr-1 -ml-1 p-1.5 rounded-lg text-text-main hover:bg-code-bg hover:text-text-heading transition cursor-pointer border-none bg-transparent flex items-center shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      )}
      {visible.map(({ seg, idx }, pos) => {
        const isLast = idx === segments.length - 1;
        return (
          <span key={seg.id ?? "root"} className={`inline-flex items-center min-w-0 ${isLast ? "shrink" : "shrink-[2]"}`}>
            {pos > 0 && separator}
            {pos === 1 && collapsed.length > 0 && (
              <>
                <Dropdown
                  value={null}
                  placeholder="…"
                  options={collapsed.map((c, i) => ({ value: String(i + 1), label: c.name }))}
                  onChange={(v) => onNavigate(Number(v) - 1)}
                  triggerClassName="px-1.5 py-0.5 rounded-md text-text-main hover:bg-code-bg hover:text-text-heading cursor-pointer border-none bg-transparent inline-flex items-center gap-0.5 shrink-0"
                />
                {separator}
              </>
            )}
            <span
              onClick={() => !isLast && onNavigate(idx - 1)}
              title={seg.name}
              className={`truncate ${isMobile ? "max-w-[9rem]" : "max-w-[14rem]"} hover:text-accent cursor-pointer transition ${
                isLast ? "text-text-heading font-semibold cursor-default hover:text-text-heading!" : ""
              }`}
            >
              {seg.name}
            </span>
          </span>
        );
      })}
    </div>
  );
}
