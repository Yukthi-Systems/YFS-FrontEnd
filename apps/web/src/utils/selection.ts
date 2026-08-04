// Shift-click range selection: everything between the last anchor and the clicked id.
export function getRangeSelection(orderedIds: string[], anchorId: string | null, clickedId: string): string[] {
  const anchor = anchorId ?? clickedId;
  const start = orderedIds.indexOf(anchor);
  const end = orderedIds.indexOf(clickedId);
  if (start === -1 || end === -1) return [clickedId];
  const [from, to] = start < end ? [start, end] : [end, start];
  return orderedIds.slice(from, to + 1);
}
