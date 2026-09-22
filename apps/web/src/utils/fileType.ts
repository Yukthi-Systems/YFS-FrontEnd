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
  // TODO(security): Prevent directory traversal in folder/file names
  return name.replace(/[\/\\]/g, "").replace(/\.\.+/g, "").trim();
};

// Office-suite formats Collabora opens (the extension list is taken from the live
// discovery.xml, minus images/PDF/plain-text formats that have dedicated npm viewers
// below). Everything here is rendered by Collabora — never by a client-side parser.
export const COLLABORA_EXTENSIONS = new Set([
  // text documents
  "doc", "docx", "docm", "dot", "dotx", "dotm", "odt", "ott", "odm", "fodt", "rtf",
  "sxw", "stw", "wps", "wpd", "wri", "abw", "fb2", "pages", "hwp", "602", "cwk", "lrf", "mw", "pdb", "sxg",
  // spreadsheets
  "xls", "xlsx", "xlsm", "xlsb", "xlt", "xltx", "xltm", "xla", "xlr", "ods", "ots", "fods", "sxc", "stc",
  "numbers", "gnumeric", "dif", "dbf", "slk", "wk1", "wks", "wb1", "wq1", "wq2", "qpw", "123",
  // presentations
  "ppt", "pptx", "pptm", "pot", "potx", "potm", "pps", "ppsx", "odp", "otp", "fodp", "sxi", "sti", "sxd", "std", "key",
  // drawings / publisher / diagrams
  "odg", "otg", "fodg", "sxm", "odf", "oth", "otm", "wpg", "cdr", "cgm", "fh", "pub", "vsd", "vsdx", "vss", "p65", "dxf",
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

// Collabora sets a `--doc-type: r,g,b` CSS variable on <html data-doctype="..."> that
// drives its own cursor/selection/annotation accents per document type — pulled
// straight from its compiled bundle.css (`[data-doctype='spreadsheet']{--doc-type:16,
// 104,2}` etc., 2026-09-22), not a generic Office-brand guess. There's no way to read
// this back live (the ribbon renders inside a cross-origin iframe, and it's set by
// Collabora's own JS at runtime, not exposed statically anywhere else), so if this
// Collabora build is ever upgraded these may need re-extracting the same way — open
// browser/<build-id>/bundle.css directly and grep for `--doc-type`.
export const getCollaboraAccentColor = (extension: string | undefined): string => {
  const ext = (extension ?? "").toLowerCase();
  if (SPREADSHEET_EXTENSIONS.has(ext)) return "#106802"; // spreadsheet (Calc)
  if (PRESENTATION_EXTENSIONS.has(ext)) return "#A33E03"; // presentation (Impress)
  if (DRAWING_EXTENSIONS.has(ext)) return "#876900"; // drawing (Draw)
  return "#0369A3"; // text (Writer) — word-processing and everything else
};

// Plain-text formats previewed in the CodeMirror viewer without a language grammar.
const PLAIN_TEXT_EXTENSIONS = new Set(["txt", "text", "log", "md", "markdown", "rst", "ini", "conf", "env", "gitignore"]);

// Source/config/data formats previewed in CodeMirror with syntax highlighting
// (@uiw/codemirror-extensions-langs resolves the grammar from the extension).
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

// Same categorization as categorizeFile, but from a bare filename (used for file
// listings that come back from the API without a File/blob attached).
export const categorizeByName = (name: string): { type: FileItem["type"]; extension: string } =>
  categorizeFile({ name, type: "" } as File);

// Anything CodeMirror can show: source/config/data files plus plain-text documents.
export const isTextEditable = (item: Pick<FileItem, "type" | "extension">): boolean => {
  if (item.type === "code") return true;
  return !!item.extension && (CODE_EXTENSIONS.has(item.extension) || PLAIN_TEXT_EXTENSIONS.has(item.extension));
};

// Office-suite files on the server go through Collabora. Local-only/seeded items have no
// server file for WOPI to point at, so they keep using the client-side viewers instead.
export const isCollaboraSupported = (item: Pick<FileItem, "extension" | "fileId" | "origin">): boolean =>
  !!item.extension &&
  COLLABORA_EXTENSIONS.has(item.extension) &&
  !!item.fileId &&
  (item.origin === "server" || item.origin === "shared");
