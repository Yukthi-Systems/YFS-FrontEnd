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

import { useEffect, useState } from "react";


const BREAKPOINTS: { query: string; columns: number }[] = [
  { query: "(min-width: 1024px)", columns: 5 },
  { query: "(min-width: 768px)", columns: 4 },
  { query: "(min-width: 640px)", columns: 3 },
];

const resolveColumns = () => {
  if (typeof window === "undefined") return 2;
  for (const bp of BREAKPOINTS) {
    if (window.matchMedia(bp.query).matches) return bp.columns;
  }
  return 2;
};

export function useGridColumns(): number {
  const [columns, setColumns] = useState(resolveColumns);

  useEffect(() => {
    const mqls = BREAKPOINTS.map((bp) => window.matchMedia(bp.query));
    const update = () => setColumns(resolveColumns());
    mqls.forEach((mql) => mql.addEventListener("change", update));
    update();
    return () => mqls.forEach((mql) => mql.removeEventListener("change", update));
  }, []);

  return columns;
}
