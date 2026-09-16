import { FolderPlus, FileUp, FolderUp, RefreshCw } from "lucide-react";

export function CanvasContextMenu({
  x,
  y,
  canCreateHere = true,
  onCreateFolder,
  onUploadFile,
  onUploadFolder,
  onRefresh,
}: {
  x: number;
  y: number;
  // False inside a "Shared with me" folder the caller can't create in.
  canCreateHere?: boolean;
  onCreateFolder: () => void;
  onUploadFile: () => void;
  onUploadFolder: () => void;
  onRefresh: () => void;
}) {
  const itemClass =
    "flex items-center gap-3 px-3.5 py-2.5 border-none bg-transparent text-text-main rounded-lg text-sm font-medium text-left cursor-pointer hover:bg-accent-bg hover:text-accent transition duration-150";

  return (
    <div
      className="fixed z-50 w-48 bg-bg-main border border-border-main rounded-xl p-1.5 shadow-md flex flex-col gap-0.5 animate-scale-in context-dropdown"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={onRefresh} className={itemClass}>
        <RefreshCw className="w-4 h-4" /> Refresh
      </button>
      {canCreateHere ? (
        <>
          <div className="my-0.5 border-t border-border-main" />
          <button onClick={onCreateFolder} className={itemClass}>
            <FolderPlus className="w-4 h-4" /> Create Folder
          </button>
          <button onClick={onUploadFile} className={itemClass}>
            <FileUp className="w-4 h-4" /> Upload File
          </button>
          <button onClick={onUploadFolder} className={itemClass}>
            <FolderUp className="w-4 h-4" /> Upload Folder
          </button>
        </>
      ) : (
        <span className="px-3.5 py-2.5 text-xs text-text-main">
          You don't have permission to add items here.
        </span>
      )}
    </div>
  );
}
