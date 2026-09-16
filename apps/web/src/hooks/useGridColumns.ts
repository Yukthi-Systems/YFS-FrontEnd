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
