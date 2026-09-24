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

// Shift-click range selection: everything between the last anchor and the clicked id.
export function getRangeSelection(orderedIds: string[], anchorId: string | null, clickedId: string): string[] {
  const anchor = anchorId ?? clickedId;
  const start = orderedIds.indexOf(anchor);
  const end = orderedIds.indexOf(clickedId);
  if (start === -1 || end === -1) return [clickedId];
  const [from, to] = start < end ? [start, end] : [end, start];
  return orderedIds.slice(from, to + 1);
}
