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

import { AudioLines, Code2, File, FileText, Image, LayoutGrid, Sheet, Video } from "lucide-react";
import type { FileItem } from "../types/file";

export const TYPE_FILTERS: { value: string; label: string; icon: typeof File }[] = [
  { value: "all", label: "All Types", icon: LayoutGrid },
  { value: "audio", label: "Audio", icon: AudioLines },
  { value: "video", label: "Video", icon: Video },
  { value: "image", label: "Images", icon: Image },
  { value: "pdf", label: "PDFs", icon: FileText },
  { value: "spreadsheet", label: "Sheets", icon: Sheet },
  { value: "document", label: "Documents", icon: FileText },
  { value: "code", label: "Code", icon: Code2 },
  { value: "other", label: "Other", icon: File },
];

export const sanitizeName = (name: string): string => {
  // Strip path separators and ".." so names can't traverse directories.
  return name.replace(/[\/\\]/g, "").replace(/\.\.+/g, "").trim();
};

// Everything Collabora opens, except images (ImageLightbox handles those better).
export const COLLABORA_EXTENSIONS = new Set([
  // text documents
  "doc", "docx", "docm", "dot", "dotx", "dotm", "odt", "ott", "odm", "fodt", "rtf",
  "sxw", "stw", "wps", "wpd", "wri", "abw", "fb2", "pages", "hwp", "602", "cwk", "lrf", "mw", "pdb", "sxg",
  // spreadsheets
  "xls", "xlsx", "xlsm", "xlsb", "xlt", "xltx", "xltm", "xla", "xlr", "ods", "ots", "fods", "sxc", "stc",
  "numbers", "gnumeric", "dif", "dbf", "slk", "wk1", "wks", "wb1", "wq1", "wq2", "qpw", "123", "csv", "tsv",
  // presentations
  "ppt", "pptx", "pptm", "pot", "potx", "potm", "pps", "ppsx", "odp", "otp", "fodp", "sxi", "sti", "sxd", "std", "key",
  // drawings / publisher / diagrams
  "odg", "otg", "fodg", "sxm", "odf", "oth", "otm", "wpg", "cdr", "cgm", "fh", "pub", "vsd", "vsdx", "vss", "p65", "dxf",
  // plain text / PDF
  "pdf", "txt", "md",
]);

const SPREADSHEET_EXTENSIONS = new Set([
  "xls", "xlsx", "xlsm", "xlsb", "xlt", "xltx", "xltm", "xla", "xlr", "ods", "ots", "fods", "sxc", "stc",
  "numbers", "gnumeric", "dif", "dbf", "slk", "wk1", "wks", "wb1", "wq1", "wq2", "qpw", "123", "csv", "tsv",
]);

const PRESENTATION_EXTENSIONS = new Set([
  "ppt", "pptx", "pptm", "pot", "potx", "potm", "pps", "ppsx", "odp", "otp", "fodp", "sxi", "sti", "sxd", "std", "key",
]);

const DRAWING_EXTENSIONS = new Set([
  "odg", "otg", "fodg", "sxm", "odf", "oth", "otm", "wpg", "cdr", "cgm", "fh", "pub", "vsd", "vsdx", "vss", "p65", "dxf",
]);

// Collabora's per-doc-type accent (`--doc-type` in its bundle.css); re-extract after a Collabora upgrade.
export const getCollaboraAccentColor = (extension: string | undefined): string => {
  const ext = (extension ?? "").toLowerCase();
  if (SPREADSHEET_EXTENSIONS.has(ext)) return "#106802"; // spreadsheet (Calc)
  if (PRESENTATION_EXTENSIONS.has(ext)) return "#A33E03"; // presentation (Impress)
  if (DRAWING_EXTENSIONS.has(ext)) return "#876900"; // drawing (Draw)
  return "#0369A3";
};

// Plain text shown in CodeMirror without a grammar. Server files in COLLABORA_EXTENSIONS go to Collabora instead.
const PLAIN_TEXT_EXTENSIONS = new Set(["txt", "text", "log", "md", "markdown", "rst", "ini", "conf", "env", "gitignore"]);

// Highlighted in CodeMirror; the grammar is resolved from the extension.
const CODE_EXTENSIONS = new Set([
  "js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts", "json", "jsonc", "json5", "jsonl", "ndjson", "geojson",
  "html", "htm", "xhtml", "css", "scss", "sass", "less", "styl", "vue", "svelte", "xml", "xsl", "xslt",
  "py", "pyw", "rb", "php", "pl", "pm", "lua", "r", "jl", "go", "rs", "java", "kt", "kts", "scala", "groovy",
  "gradle", "c", "h", "cc", "cpp", "cxx", "hpp", "hh", "cs", "fs", "vb", "swift", "m", "mm", "dart", "zig", "nim",
  "hs", "elm", "erl", "ex", "exs", "clj", "cljs", "lisp", "scm", "ml", "sql", "graphql", "gql", "proto", "sol",
  "sh", "bash", "zsh", "fish", "ps1", "bat", "cmd", "yml", "yaml", "toml", "properties", "cfg", "tf", "dockerfile",
  "makefile", "cmake", "diff", "patch", "tex", "vhd", "vhdl", "v", "sv", "asm", "s", "wat", "coffee",
]);

export const categorizeFile = (file: File): { type: FileItem["type"]; extension: string } => {
  const mime = file.type.toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  let category: FileItem["type"] = "other";
  if (mime.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(ext)) {
    category = "audio";
  } else if (mime.startsWith("video/") || ["mp4", "webm", "ogg", "mov", "avi", "mkv"].includes(ext)) {
    category = "video";
  } else if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "avif"].includes(ext)) {
    category = "image";
  } else if (mime === "application/pdf" || ext === "pdf") {
    category = "pdf";
  } else if (mime.includes("sheet") || mime.includes("excel") || SPREADSHEET_EXTENSIONS.has(ext)) {
    category = "spreadsheet";
  } else if (
    mime.includes("word") ||
    mime.includes("document") ||
    mime.includes("presentation") ||
    mime.includes("powerpoint") ||
    COLLABORA_EXTENSIONS.has(ext) ||
    PLAIN_TEXT_EXTENSIONS.has(ext)
  ) {
    category = "document";
  } else if (
    mime.includes("javascript") ||
    mime.includes("typescript") ||
    mime.includes("json") ||
    CODE_EXTENSIONS.has(ext)
  ) {
    category = "code";
  }

  return { type: category, extension: ext };
};

export const categorizeByName = (name: string): { type: FileItem["type"]; extension: string } =>
  categorizeFile({ name, type: "" } as File);

export const isTextEditable = (item: Pick<FileItem, "type" | "extension">): boolean => {
  if (item.type === "code") return true;
  return !!item.extension && (CODE_EXTENSIONS.has(item.extension) || PLAIN_TEXT_EXTENSIONS.has(item.extension));
};

// Local-only items have no server file for WOPI, so they use the client-side viewers.
export const isCollaboraSupported = (item: Pick<FileItem, "extension" | "fileId" | "origin">): boolean =>
  !!item.extension &&
  COLLABORA_EXTENSIONS.has(item.extension) &&
  !!item.fileId &&
  (item.origin === "server" || item.origin === "shared");
