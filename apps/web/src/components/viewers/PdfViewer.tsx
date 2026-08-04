import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import type { FileItem } from "../../types/file";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

export function PdfViewer({ item }: { item: FileItem }) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [failed, setFailed] = useState(false);

  if (!item.blobUrl) {
    return (
      <div className="flex flex-col items-center gap-2 text-center text-text-main py-16">
        <FileText className="w-12 h-12 text-red-400" />
        <div className="text-sm font-medium">Seeded demo item — no PDF content to render.</div>
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
    <div className="flex flex-col items-center gap-3 w-full">
      <Document
        file={item.blobUrl}
        onLoadSuccess={({ numPages }) => {
          setNumPages(numPages);
          setPageNumber(1);
        }}
        onLoadError={() => setFailed(true)}
        loading={<div className="text-sm text-text-main py-16">Loading PDF…</div>}
      >
        <Page pageNumber={pageNumber} width={620} />
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
