import type { FileItem } from "../types/file";
import { isTextEditable } from "../utils/fileType";

const MAX_CHARS = 50_000;
const MAX_PDF_PAGES = 20;

// Keyed by storageKey, which changes on every real content edit/version-restore — so this
// cache invalidates itself for free, no manual bookkeeping needed.
const textCache = new Map<string, string>();

const extractPlainText = async (blobUrl: string): Promise<string> => {
  const res = await fetch(blobUrl);
  return res.text();
};

// xlsx is a large dependency — dynamically imported so it only loads into a bundle when a
// spreadsheet is actually being searched, matching the lazy-loading already used for the
// SpreadsheetViewer itself.
const extractSpreadsheetText = async (blobUrl: string): Promise<string> => {
  const XLSX = await import("xlsx");
  const res = await fetch(blobUrl);
  const buf = await res.arrayBuffer();
  const workbook = XLSX.read(buf, { type: "array" });
  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
    for (const row of rows) parts.push(row.join(" "));
  }
  return parts.join("\n");
};

const extractDocxText = async (blobUrl: string): Promise<string> => {
  const mammoth = await import("mammoth");
  const res = await fetch(blobUrl);
  const buf = await res.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return result.value;
};

// pdf.js is heavy — dynamically imported here too. Configures its own worker rather than
// relying on PdfViewer.tsx having done it already, since search can run before any PDF was
// ever opened; setting it twice is harmless (same underlying pdfjs module either way).
const extractPdfText = async (blobUrl: string): Promise<string> => {
  const { pdfjs } = await import("react-pdf");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

  const doc = await pdfjs.getDocument(blobUrl).promise;
  const pageCount = Math.min(doc.numPages, MAX_PDF_PAGES);
  const parts: string[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as Array<{ str?: string }>;
    parts.push(items.map((it) => it.str ?? "").join(" "));
  }
  return parts.join("\n");
};

// Extracts plain, searchable text from a file's content, dispatching to whichever parser
// this project already uses to preview that type (CodeEditor's fetch+text, SpreadsheetViewer's
// SheetJS, DocViewer's mammoth, PdfViewer's pdf.js) rather than reimplementing extraction.
// Returns "" for types with no text representation (image/audio/video/folder), items with no
// real content (seeded demo files), and legacy .doc (mammoth can't parse the binary OLE
// format — DocViewer.tsx has the same limitation).
export const extractSearchableText = async (item: FileItem): Promise<string> => {
  if (item.isFolder || !item.blobUrl) return "";

  const cacheKey = item.storageKey;
  if (cacheKey && textCache.has(cacheKey)) return textCache.get(cacheKey)!;

  let text = "";
  try {
    if (isTextEditable(item)) {
      text = await extractPlainText(item.blobUrl);
    } else if (item.type === "spreadsheet") {
      text = await extractSpreadsheetText(item.blobUrl);
    } else if (item.type === "document" && item.extension === "docx") {
      text = await extractDocxText(item.blobUrl);
    } else if (item.type === "pdf") {
      text = await extractPdfText(item.blobUrl);
    }
  } catch (err) {
    console.error("Failed to extract searchable text for", item.name, err);
    text = "";
  }

  text = text.slice(0, MAX_CHARS);
  if (cacheKey) textCache.set(cacheKey, text);
  return text;
};
