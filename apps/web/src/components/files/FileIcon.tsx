import {
  Folder,
  Music,
  Video,
  Image as ImageIcon,
  FileText,
  FileSpreadsheet,
  FileCode,
  File as FileIcon,
} from "lucide-react";
import type { FileItem } from "../../types/file";

export function getFileIcon(type: FileItem["type"], className = "w-5 h-5") {
  switch (type) {
    case "folder":
      return <Folder className={`${className} text-yellow-400 fill-yellow-400/20`} />;
    case "audio":
      return <Music className={`${className} text-sky-400`} />;
    case "video":
      return <Video className={`${className} text-rose-500`} />;
    case "image":
      return <ImageIcon className={`${className} text-emerald-500`} />;
    case "pdf":
      return <FileText className={`${className} text-red-500`} />;
    case "spreadsheet":
      return <FileSpreadsheet className={`${className} text-green-500`} />;
    case "document":
      return <FileText className={`${className} text-blue-500`} />;
    case "code":
      return <FileCode className={`${className} text-purple-500`} />;
    default:
      return <FileIcon className={`${className} text-gray-500`} />;
  }
}
