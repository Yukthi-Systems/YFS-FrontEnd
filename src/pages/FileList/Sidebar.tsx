import { useAtom } from "jotai";
import {
  FileText,
  Folder,
  Eye,
  Download,
  Trash,
  RefreshCw,
  X,
  FileImage,
  FileCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  selectedFileIdAtom,
  detailsSidebarOpenAtom,
  renameModalOpenAtom,
  currentPathAtom,
} from "@/store/fileSystem";
import { useFileDetails, useDeleteFile } from "@/services/files/mutations";

export function Sidebar() {
  const [selectedFileId, setSelectedFileId] = useAtom(selectedFileIdAtom) as [
    string | null,
    (update: string | null) => void,
  ];
  const [sidebarOpen, setSidebarOpen] = useAtom(detailsSidebarOpenAtom);
  const [, setRenameOpen] = useAtom(renameModalOpenAtom);
  const [currentPath] = useAtom(currentPathAtom);

  const { data: file, isLoading } = useFileDetails(selectedFileId);
  const deleteFileMutation = useDeleteFile();

  if (!sidebarOpen) return null;

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "—";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleDelete = async () => {
    if (!file) return;
    if (confirm(`Are you sure you want to delete "${file.name}"?`)) {
      await deleteFileMutation.mutateAsync({ id: file.id, path: currentPath });
      setSelectedFileId(null);
      setSidebarOpen(false);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case "folder":
        return <Folder className="h-10 w-10 text-yellow-500 fill-yellow-500/10" />;
      case "image":
        return <FileImage className="h-10 w-10 text-blue-500" />;
      case "code":
        return <FileCode className="h-10 w-10 text-green-500" />;
      default:
        return <FileText className="h-10 w-10 text-purple-500" />;
    }
  };

  return (
    <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-border bg-card p-6 flex flex-col gap-6 animate-in slide-in-from-right duration-250">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Details</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(false)}
          className="rounded-full h-8 w-8 text-muted-foreground hover:bg-secondary"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm">Loading details...</span>
        </div>
      ) : !file ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Select a file or folder to view details.
        </div>
      ) : (
        <div className="flex flex-col gap-6 h-full justify-between">
          <div className="flex flex-col gap-6">
            {/* Visual Preview Placeholder */}
            <div className="flex flex-col items-center gap-3 p-6 bg-secondary/20 rounded-xl border border-border/50">
              {getFileIcon(file.type)}
              <div className="text-center w-full">
                <p className="font-semibold text-sm truncate max-w-full" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">{file.type}</p>
              </div>
            </div>

            {/* Properties */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-between py-1.5 border-b border-border/40 text-sm">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium capitalize">{file.type}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/40 text-sm">
                <span className="text-muted-foreground">Size</span>
                <span className="font-medium">{formatSize(file.size)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/40 text-sm">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium truncate max-w-[150px]">
                  {file.path.length === 0 ? "Root" : "/" + file.path.join("/")}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/40 text-sm">
                <span className="text-muted-foreground">Modified</span>
                <span className="font-medium text-xs">
                  {new Date(file.updatedAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col gap-2 mt-auto">
            {file.type !== "folder" && (
              <Button className="w-full gap-2 justify-center" variant="default">
                <Eye className="h-4 w-4" /> Preview
              </Button>
            )}
            <div className="flex gap-2">
              <Button
                className="flex-1 gap-2 justify-center"
                variant="outline"
                onClick={() => setRenameOpen(true)}
              >
                Rename
              </Button>
              {file.type !== "folder" && (
                <Button
                  className="gap-2 justify-center"
                  variant="outline"
                  size="icon"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Button
              className="w-full gap-2 justify-center hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20"
              variant="ghost"
              onClick={handleDelete}
              disabled={deleteFileMutation.isPending}
            >
              <Trash className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
