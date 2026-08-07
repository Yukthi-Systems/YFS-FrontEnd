import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Save } from "lucide-react";
import type { FileItem } from "../../types/file";

export function SpreadsheetViewer({
  item,
  onSave,
}: {
  item: FileItem;
  onSave: (blob: Blob) => void;
}) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setRows(null);
    setDirty(false);
    setLoadFailed(false);
    if (!item.blobUrl) return;

    let active = true;
    fetch(item.blobUrl)
      .then((res) => res.arrayBuffer())
      .then((buf) => {
        if (!active) return;
        const workbook = XLSX.read(buf, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
        setRows(data.map((row) => row.map((cell) => String(cell ?? ""))));
      })
      .catch(() => active && setLoadFailed(true));

    return () => {
      active = false;
    };
  }, [item.id, item.blobUrl]);

  const updateCell = (r: number, c: number, value: string) => {
    setRows((prev) => {
      if (!prev) return prev;
      const next = prev.map((row) => [...row]);
      next[r] = [...next[r]];
      next[r][c] = value;
      return next;
    });
    setDirty(true);
  };

  const handleSave = () => {
    if (!rows) return;
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    const out = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    onSave(blob);
    setDirty(false);
  };

  if (!item.blobUrl) {
    return (
      <div className="flex flex-col items-center gap-2 text-center text-text-main py-16">
        <FileSpreadsheet className="w-12 h-12 text-green-400" />
        <div className="text-sm font-medium">Seeded demo item — no spreadsheet content to open.</div>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="flex flex-col items-center gap-2 text-center text-text-main py-16">
        <FileSpreadsheet className="w-12 h-12 text-green-400" />
        <div className="text-sm font-medium">Could not parse this spreadsheet.</div>
      </div>
    );
  }

  if (!rows) {
    return <div className="text-sm text-text-main text-center py-16">Loading spreadsheet…</div>;
  }

  const colCount = Math.max(1, ...rows.map((r) => r.length));

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-main">{rows.length} rows × {colCount} columns</span>
        <button
          onClick={handleSave}
          disabled={!dirty}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-xs font-semibold rounded-full disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:opacity-90 transition"
        >
          <Save className="w-3.5 h-3.5" /> Save
        </button>
      </div>
      <div className="w-full overflow-auto border border-border-main rounded-lg">
        <table className="border-collapse text-xs font-mono">
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {Array.from({ length: colCount }).map((_, c) => (
                  <td key={c} className="border border-border-main p-0">
                    <input
                      value={row[c] ?? ""}
                      onChange={(e) => updateCell(r, c, e.target.value)}
                      className="w-24 px-2 py-1.5 bg-bg-main text-text-heading outline-none focus:bg-accent-bg"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
