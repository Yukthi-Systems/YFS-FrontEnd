import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{ top: number; left: number; visibility: "hidden" | "visible" }>({
    top: y,
    left: x,
    visibility: "hidden",
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;

    let top = y;
    let left = x;

    // Flip upwards if overflowing the bottom viewport edge, otherwise clamp
    if (top + rect.height > window.innerHeight - margin) {
      top = y - rect.height >= margin ? y - rect.height : Math.max(margin, window.innerHeight - rect.height - margin);
    }

    // Flip leftwards if overflowing the right viewport edge, otherwise clamp
    if (left + rect.width > window.innerWidth - margin) {
      left = x - rect.width >= margin ? x - rect.width : Math.max(margin, window.innerWidth - rect.width - margin);
    }

    if (top < margin) top = margin;
    if (left < margin) left = margin;

    setStyle({ top, left, visibility: "visible" });
  }, [x, y]);

  const itemClass =
    "flex items-center gap-3 px-3.5 py-2.5 border-none bg-transparent text-text-main rounded-lg text-sm font-medium text-left cursor-pointer hover:bg-accent-bg hover:text-accent transition duration-150";

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[2000] w-48 bg-bg-main border border-border-main rounded-xl p-1.5 shadow-md flex flex-col gap-0.5 animate-scale-in context-dropdown"
      style={{ top: style.top, left: style.left, visibility: style.visibility }}
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
    </div>,
    document.body
  );
}
