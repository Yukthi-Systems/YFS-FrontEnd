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

export function ListSkeleton() {
  return (
    <div className="w-full flex flex-col gap-2 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border-main">
          <div className="w-5 h-5 rounded bg-code-bg" />
          <div className="h-3.5 rounded bg-code-bg flex-1 max-w-xs" />
          <div className="h-3 rounded bg-code-bg w-24 hidden sm:block" />
          <div className="h-3 rounded bg-code-bg w-20 hidden sm:block" />
          <div className="h-3 rounded bg-code-bg w-14" />
        </div>
      ))}
    </div>
  );
}

export function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5 animate-pulse">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="bg-code-bg border border-border-main rounded-2xl p-4 h-32" />
      ))}
    </div>
  );
}

export function TilesSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-pulse">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 bg-code-bg border border-border-main rounded-xl p-3 h-16">
          <div className="w-10 h-10 rounded-lg bg-border-main shrink-0" />
          <div className="flex flex-col gap-1.5 flex-1">
            <div className="h-3 rounded bg-border-main w-2/3" />
            <div className="h-2.5 rounded bg-border-main w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
