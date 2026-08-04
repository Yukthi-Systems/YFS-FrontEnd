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

export const categorizeFile = (file: File): { type: FileItem["type"]; extension: string } => {
  const mime = file.type.toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  let category: FileItem["type"] = "other";
  if (mime.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(ext)) {
    category = "audio";
  } else if (mime.startsWith("video/") || ["mp4", "webm", "ogg", "mov", "avi", "mkv"].includes(ext)) {
    category = "video";
  } else if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) {
    category = "image";
  } else if (mime === "application/pdf" || ext === "pdf") {
    category = "pdf";
  } else if (mime.includes("sheet") || mime.includes("excel") || ["xlsx", "xls", "csv"].includes(ext)) {
    category = "spreadsheet";
  } else if (mime.includes("word") || mime.includes("document") || ["docx", "doc", "txt", "rtf", "md"].includes(ext)) {
    category = "document";
  } else if (
    mime.includes("javascript") ||
    mime.includes("typescript") ||
    mime.includes("json") ||
    ["js", "ts", "jsx", "tsx", "html", "css", "json", "py", "go"].includes(ext)
  ) {
    category = "code";
  }

  return { type: category, extension: ext };
};

// Extensions that can be viewed/edited as plain text in the CodeEditor viewer.
const TEXT_EXTENSIONS = new Set([
  "js", "jsx", "ts", "tsx", "json", "html", "css", "py", "go", "md", "txt", "rtf",
  "yml", "yaml", "sh", "xml", "csv",
]);

export const isTextEditable = (item: Pick<FileItem, "type" | "extension">): boolean => {
  if (item.type === "code") return true;
  if (item.type === "document" && item.extension && TEXT_EXTENSIONS.has(item.extension)) return true;
  return false;
};
