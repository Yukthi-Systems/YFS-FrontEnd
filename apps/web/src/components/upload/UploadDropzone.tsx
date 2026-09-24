/*
 * Copyright (C) 2026 Yukthi Systems Private Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * version 3 along with this program. If not, see
 * <https://www.gnu.org/licenses/>.
 */

import { useState } from "react";
import type { ReactNode } from "react";
import { UploadCloud } from "lucide-react";
import { resolveDroppedItems } from "../../utils/directoryEntry";
import type { FileWithRelativePath } from "../../atoms/uploadQueue";

export function UploadDropzone({
  onDropFiles,
  disabled = false,
  children,
}: {
  onDropFiles: (items: FileWithRelativePath[]) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [, setDragDepth] = useState(0);

  const isFileDrag = (e: React.DragEvent) => !disabled && Array.from(e.dataTransfer.types).includes("Files");

  return (
    <div
      className="relative flex-1 flex overflow-hidden"
      onDragEnter={(e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        setDragDepth((d) => d + 1);
        setIsDraggingFiles(true);
      }}
      onDragOver={(e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        setDragDepth((d) => {
          const next = Math.max(0, d - 1);
          if (next === 0) setIsDraggingFiles(false);
          return next;
        });
      }}
      onDrop={(e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        setIsDraggingFiles(false);
        setDragDepth(0);
        // Capture before the async folder walk, which preserves structure the plain file list loses.
        const dataTransfer = e.dataTransfer;
        resolveDroppedItems(dataTransfer).then((items) => {
          if (items.length > 0) onDropFiles(items);
        });
      }}
    >
      {children}
      {isDraggingFiles && (
        <div className="absolute inset-0 z-[900] bg-accent/10 backdrop-blur-[1px] border-4 border-dashed border-accent rounded-xl flex items-center justify-center pointer-events-none animate-fade-in">
          <div className="flex flex-col items-center gap-3 text-accent bg-bg-main px-8 py-6 rounded-2xl shadow-lg">
            <UploadCloud className="w-10 h-10" />
            <span className="font-semibold">Drop files to upload here</span>
          </div>
        </div>
      )}
    </div>
  );
}
