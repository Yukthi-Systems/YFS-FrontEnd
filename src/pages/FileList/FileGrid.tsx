import { useAtom } from "jotai";
import { FileText, Folder, RefreshCw, MoreVertical, FileImage, FileCode } from "lucide-react";
import type { FileItem } from "@/types";
import { Button } from "@/components/ui/button";
import {
  currentPathAtom,
  selectedFileIdAtom,
  detailsSidebarOpenAtom,
  searchQueryAtom,
  viewModeAtom,
} from "@/store/fileSystem";

interface FileGridProps {
  files: FileItem[];
  isLoading: boolean;
}

export function FileGrid({ files, isLoading }: FileGridProps) {
  const [currentPath, setCurrentPath] = useAtom(currentPathAtom);
  const [selectedFileId, setSelectedFileId] = useAtom(selectedFileIdAtom) as [
    string | null,
    (update: string | null) => void,
  ];
  const [, setSidebarOpen] = useAtom(detailsSidebarOpenAtom);
  const [searchQuery] = useAtom(searchQueryAtom);
  const [viewMode] = useAtom(viewModeAtom);

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleItemClick = (file: FileItem) => {
    setSelectedFileId(file.id);
    setSidebarOpen(true);
  };

  const handleDoubleClick = (file: FileItem) => {
    if (file.type === "folder") {
      setCurrentPath([...currentPath, file.name]);
      setSelectedFileId(null);
      setSidebarOpen(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "—";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case "folder":
        return (
          <Folder className="h-6 w-6 text-yellow-500 fill-yellow-500/10 group-hover:scale-110 transition-transform duration-200" />
        );
      case "image":
        return (
          <FileImage className="h-6 w-6 text-blue-500 group-hover:scale-110 transition-transform duration-200" />
        );
      case "code":
        return (
          <FileCode className="h-6 w-6 text-green-500 group-hover:scale-110 transition-transform duration-200" />
        );
      default:
        return (
          <FileText className="h-6 w-6 text-purple-500 group-hover:scale-110 transition-transform duration-200" />
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium">Fetching directory contents...</p>
      </div>
    );
  }

  if (filteredFiles.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
        <div className="p-4 bg-secondary/30 rounded-full border border-border/50">
          <Folder className="h-12 w-12 text-muted-foreground/60" />
        </div>
        <div className="text-center">
          <p className="text-lg font-medium text-foreground">Empty Folder</p>
          <p className="text-sm text-muted-foreground max-w-xs mt-1">
            {searchQuery
              ? "No files match your search query."
              : "Upload files or create folders to get started."}
          </p>
        </div>
      </div>
    );
  }

  // LIST VIEW
  if (viewMode === "list") {
    return (
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border text-xs font-semibold text-muted-foreground tracking-wider uppercase">
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Size</th>
              <th className="py-3 px-4">Modified</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredFiles.map((file) => {
              const isSelected = selectedFileId === file.id;
              return (
                <tr
                  key={file.id}
                  onClick={() => handleItemClick(file)}
                  onDoubleClick={() => handleDoubleClick(file)}
                  className={`group border-b border-border/50 hover:bg-secondary/40 transition-colors cursor-pointer select-none ${
                    isSelected ? "bg-accent/40 border-l-2 border-l-primary" : ""
                  }`}
                >
                  <td className="py-3.5 px-4 font-medium text-sm flex items-center gap-3">
                    {getFileIcon(file.type)}
                    <span className="truncate max-w-[200px] md:max-w-md" title={file.name}>
                      {file.name}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-sm text-muted-foreground">
                    {formatSize(file.size)}
                  </td>
                  <td className="py-3.5 px-4 text-sm text-muted-foreground">
                    {new Date(file.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // GRID VIEW
  return (
    <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 py-4">
      {filteredFiles.map((file) => {
        const isSelected = selectedFileId === file.id;
        return (
          <div
            key={file.id}
            onClick={() => handleItemClick(file)}
            onDoubleClick={() => handleDoubleClick(file)}
            className={`group flex flex-col p-4 rounded-xl border bg-card/50 text-left cursor-pointer transition-all hover:shadow-md select-none ${
              isSelected
                ? "border-primary ring-1 ring-primary shadow-sm bg-accent/30"
                : "border-border/60 hover:border-border-hover hover:bg-secondary/20"
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              {getFileIcon(file.type)}
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                {file.type === "folder" ? "" : formatSize(file.size)}
              </span>
            </div>
            <div className="mt-auto">
              <p className="text-sm font-semibold truncate w-full mb-0.5" title={file.name}>
                {file.name}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {new Date(file.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
