import { Folder, Plus } from "lucide-react";

export function CanvasContextMenu({
  x,
  y,
  onCreateFolder,
  onUploadFile,
}: {
  x: number;
  y: number;
  onCreateFolder: () => void;
  onUploadFile: () => void;
}) {
  return (
    <div
      className="fixed z-50 w-48 bg-bg-main border border-border-main rounded-xl p-1.5 shadow-md flex flex-col gap-0.5 animate-scale-in context-dropdown"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onCreateFolder}
        className="flex items-center gap-3 px-3.5 py-2.5 border-none bg-transparent text-text-main rounded-lg text-sm font-medium text-left cursor-pointer hover:bg-accent-bg hover:text-accent transition duration-150"
      >
        <Folder className="w-4 h-4" /> Create Folder
      </button>
      <button
        onClick={onUploadFile}
        className="flex items-center gap-3 px-3.5 py-2.5 border-none bg-transparent text-text-main rounded-lg text-sm font-medium text-left cursor-pointer hover:bg-accent-bg hover:text-accent transition duration-150"
      >
        <Plus className="w-4 h-4 rotate-45" /> Upload File
      </button>
    </div>
  );
}
