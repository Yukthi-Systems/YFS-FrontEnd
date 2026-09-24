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

import type { FileItem } from "../types/file";
import { isTextEditable } from "../utils/fileType";

const MAX_CHARS = 50_000;
const MAX_PDF_PAGES = 20;

// storageKey changes with content, so the cache invalidates itself.
const textCache = new Map<string, string>();

const extractPlainText = async (blobUrl: string): Promise<string> => {
  const res = await fetch(blobUrl);
  return res.text();
};

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

// Search can run before PdfViewer, so configure the worker here too.
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

// Reuses each viewer's parser. Returns "" for media, folders, content-less items and legacy .doc.
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
