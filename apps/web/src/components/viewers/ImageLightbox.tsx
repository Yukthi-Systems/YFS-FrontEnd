import { useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import type { FileItem } from "../../types/file";

const PLACEHOLDER_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='1'><rect x='3' y='3' width='18' height='18' rx='2'/><circle cx='8.5' cy='8.5' r='1.5'/><polyline points='21 15 16 10 5 21'/></svg>";

export function ImageLightbox({ item }: { item: FileItem }) {
  const [zoom, setZoom] = useState(1);

  return (
    <div className="flex flex-col items-center gap-4 w-full h-full">
      <div className="flex-1 w-full flex items-center justify-center overflow-auto">
        <img
          src={item.blobUrl || PLACEHOLDER_SVG}
          alt={item.name}
          style={{ transform: `scale(${zoom})` }}
          className="max-w-full max-h-[70vh] object-contain transition-transform duration-150"
        />
      </div>
      <div className="flex items-center gap-2 bg-code-bg border border-border-main rounded-full px-2 py-1">
        <button
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
          className="border-none bg-transparent p-1.5 rounded-full text-text-main hover:bg-border-main cursor-pointer transition"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs text-text-main w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
          className="border-none bg-transparent p-1.5 rounded-full text-text-main hover:bg-border-main cursor-pointer transition"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
