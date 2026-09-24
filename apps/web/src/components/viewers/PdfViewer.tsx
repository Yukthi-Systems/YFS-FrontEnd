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

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import type { FileItem } from "../../types/file";
import { useFileBlob } from "../../hooks/useFileBlob";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

export function PdfViewer({ item }: { item: FileItem }) {
  const { blob, loading, error } = useFileBlob(item);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [failed, setFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState(620);

  // Track the container width so the page fills it.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setPageWidth(Math.max(320, Math.floor(width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (loading) return <div className="text-sm text-text-main text-center py-16">Loading PDF…</div>;
  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 text-center text-text-main py-16">
        <FileText className="w-12 h-12 text-red-400" />
        <div className="text-sm font-medium">{error}</div>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-2 text-center text-text-main py-16">
        <FileText className="w-12 h-12 text-red-400" />
        <div className="text-sm font-medium">Could not render this PDF.</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-3 w-full">
      <Document
        file={blob}
        onLoadSuccess={({ numPages }) => {
          setNumPages(numPages);
          setPageNumber(1);
        }}
        onLoadError={() => setFailed(true)}
        loading={<div className="text-sm text-text-main py-16">Loading PDF…</div>}
      >
        <Page pageNumber={pageNumber} width={pageWidth} />
      </Document>
      {numPages && numPages > 1 && (
        <div className="flex items-center gap-3 bg-code-bg border border-border-main rounded-full px-3 py-1.5">
          <button
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            className="border-none bg-transparent p-1 rounded-full text-text-main hover:bg-border-main disabled:opacity-30 cursor-pointer transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-text-main">
            Page {pageNumber} of {numPages}
          </span>
          <button
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
            disabled={pageNumber >= numPages}
            className="border-none bg-transparent p-1 rounded-full text-text-main hover:bg-border-main disabled:opacity-30 cursor-pointer transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
