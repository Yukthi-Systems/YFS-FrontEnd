import {
  Folder,
  FolderHeart,
  FolderGit2,
  FolderKanban,
  FolderClock,
  FolderLock,
  Briefcase,
  Star,
  Music,
  Video,
  Image as ImageIcon,
  FileText,
  FileSpreadsheet,
  FileCode,
  File as FileIcon,
} from "lucide-react";
import type { FileItem } from "../../types/file";

// Folder icon choices (key stored in resource_info.ui.icon).
export const FOLDER_ICONS: { key: string; label: string; Icon: typeof Folder }[] = [
  { key: "folder", label: "Default", Icon: Folder },
  { key: "heart", label: "Heart", Icon: FolderHeart },
  { key: "star", label: "Star", Icon: Star },
  { key: "work", label: "Work", Icon: Briefcase },
  { key: "project", label: "Project", Icon: FolderKanban },
  { key: "code", label: "Code", Icon: FolderGit2 },
  { key: "recent", label: "Time", Icon: FolderClock },
  { key: "private", label: "Private", Icon: FolderLock },
];

const FOLDER_ICON_MAP: Record<string, typeof Folder> = Object.fromEntries(
  FOLDER_ICONS.map(({ key, Icon }) => [key, Icon])
);

// Folder colour swatches (value stored in resource_info.ui.color).
export const FOLDER_COLORS: string[] = [
  "#5f6368", "#ac725e", "#d06b64", "#f83a22", "#fa573c", "#ff7537", "#ffad46", "#eac364",
  "#42d692", "#16a765", "#7bd148", "#b3dc6c", "#4986e7", "#9fc6e7", "#9a9cff", "#b99aff",
  "#c2c2c2", "#cabdbf", "#cca6ac", "#f691b2", "#fbc8d9", "#a47ae2",
];

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

// Icon for a specific item — folders honour their custom colour/icon, everything
// else falls back to the type-based icon.
export function getItemIcon(item: Pick<FileItem, "isFolder" | "type" | "color" | "icon">, className = "w-5 h-5") {
  if (item.isFolder) {
    const Icon = (item.icon && FOLDER_ICON_MAP[item.icon]) || Folder;
    if (item.color) {
      return <Icon className={className} style={{ color: item.color }} fill={item.color} fillOpacity={0.25} />;
    }
    return <Icon className={`${className} text-yellow-400 fill-yellow-400/20`} />;
  }
  return getFileIcon(item.type, className);
}
