import { ArrowLeft } from "lucide-react";

export interface BreadcrumbSegment {
  id: string | null;
  name: string;
}

export function Breadcrumbs({
  segments,
  onNavigate,
}: {
  segments: BreadcrumbSegment[];
  onNavigate: (index: number) => void;
}) {
  // More than the root segment means we're inside a folder and can go up one level.
  const canGoBack = segments.length > 1;

  return (
    <div className="flex items-center flex-wrap gap-1 text-sm font-medium text-text-main">
      {canGoBack && (
        <button
          onClick={() => onNavigate(segments.length - 3)}
          title="Back"
          aria-label="Back"
          className="mr-1 -ml-1 p-1.5 rounded-lg text-text-main hover:bg-code-bg hover:text-text-heading transition cursor-pointer border-none bg-transparent flex items-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      )}
      {segments.map((seg, idx) => {
        const isLast = idx === segments.length - 1;
        return (
          <span key={seg.id ?? "root"} className="inline-flex items-center">
            {idx > 0 && <span className="text-border-main px-1 text-sm">/</span>}
            <span
              onClick={() => !isLast && onNavigate(idx - 1)}
              className={`hover:text-accent cursor-pointer transition ${
                isLast ? "text-text-heading font-semibold cursor-default hover:text-text-heading!" : ""
              }`}
            >
              {seg.name}
            </span>
          </span>
        );
      })}
    </div>
  );
}
