import { FolderPlus, FileUp, FolderUp } from "lucide-react";

export function CanvasContextMenu({
  x,
  y,
  canCreateHere = true,
  onCreateFolder,
  onUploadFile,
  onUploadFolder,
}: {
  x: number;
  y: number;
  // False inside a "Shared with me" folder the caller can't create in.
  canCreateHere?: boolean;
  onCreateFolder: () => void;
  onUploadFile: () => void;
  onUploadFolder: () => void;
}) {
  return (
    <div
      className="fixed z-50 w-48 bg-bg-main border border-border-main rounded-xl p-1.5 shadow-md flex flex-col gap-0.5 animate-scale-in context-dropdown"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      {canCreateHere ? (
        <>
          <button
            onClick={onCreateFolder}
            className="flex items-center gap-3 px-3.5 py-2.5 border-none bg-transparent text-text-main rounded-lg text-sm font-medium text-left cursor-pointer hover:bg-accent-bg hover:text-accent transition duration-150"
          >
            <FolderPlus className="w-4 h-4" /> Create Folder
          </button>
          <button
            onClick={onUploadFile}
            className="flex items-center gap-3 px-3.5 py-2.5 border-none bg-transparent text-text-main rounded-lg text-sm font-medium text-left cursor-pointer hover:bg-accent-bg hover:text-accent transition duration-150"
          >
            <FileUp className="w-4 h-4" /> Upload File
          </button>
          <button
            onClick={onUploadFolder}
            className="flex items-center gap-3 px-3.5 py-2.5 border-none bg-transparent text-text-main rounded-lg text-sm font-medium text-left cursor-pointer hover:bg-accent-bg hover:text-accent transition duration-150"
          >
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
