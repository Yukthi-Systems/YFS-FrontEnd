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
import { Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { useStreamUrl } from "../../hooks/useDownload";
import type { FileItem } from "../../types/file";

const PLACEHOLDER_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='1'><rect x='3' y='3' width='18' height='18' rx='2'/><circle cx='8.5' cy='8.5' r='1.5'/><polyline points='21 15 16 10 5 21'/></svg>";

export function ImageLightbox({ item }: { item: FileItem }) {
  const [zoom, setZoom] = useState(1);
  const { data: streamUrl, isLoading } = useStreamUrl(item);

  return (
    <div className="flex flex-col items-center gap-4 w-full h-full">
      <div className="flex-1 w-full flex items-center justify-center overflow-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-text-main">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
            <div className="text-xs">Loading image…</div>
          </div>
        ) : (
          <img
            src={streamUrl || item.blobUrl || PLACEHOLDER_SVG}
            alt={item.name}
            style={{ transform: `scale(${zoom})` }}
            className="max-w-full max-h-[70vh] object-contain transition-transform duration-150"
          />
        )}
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
