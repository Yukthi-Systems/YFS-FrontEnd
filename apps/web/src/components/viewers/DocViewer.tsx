import { useEffect, useState } from "react";
import mammoth from "mammoth";
import { FileText } from "lucide-react";
import type { FileItem } from "../../types/file";

const Placeholder = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center gap-2 text-center text-text-main py-16">
    <FileText className="w-12 h-12 text-blue-400" />
    <div className="text-sm font-medium">{message}</div>
  </div>
);

export function DocViewer({ item }: { item: FileItem }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHtml(null);
    setError(null);
    if (!item.blobUrl) return;

    // mammoth only understands the modern .docx (OOXML zip) format — legacy .doc is a
    // binary OLE format it can't parse, so surface that distinctly instead of a generic failure.
    if (item.extension === "doc") {
      setError("Legacy .doc files can't be previewed in the browser — download to view.");
      return;
    }

    let active = true;
    fetch(item.blobUrl)
      .then((res) => res.arrayBuffer())
      .then((buf) => mammoth.convertToHtml({ arrayBuffer: buf }))
      .then((result) => {
        if (active) setHtml(result.value);
      })
      .catch(() => {
        if (active) setError("Could not render this document.");
      });

    return () => {
      active = false;
    };
  }, [item.id, item.blobUrl, item.extension]);

  if (!item.blobUrl) return <Placeholder message="Seeded demo item — no document content to open." />;
  if (error) return <Placeholder message={error} />;
  if (!html) return <div className="text-sm text-text-main text-center py-16">Loading document…</div>;

  return (
    <div
      className="w-full max-h-[70vh] overflow-y-auto text-text-heading text-sm leading-relaxed [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
