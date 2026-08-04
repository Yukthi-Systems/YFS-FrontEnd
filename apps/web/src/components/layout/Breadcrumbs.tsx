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
  return (
    <div className="flex items-center flex-wrap gap-1 text-lg font-medium text-text-main">
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
