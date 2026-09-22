import type { ReactNode } from "react";
import { Folder } from "lucide-react";

export function EmptyState({
  icon,
  title = "Folder is Empty",
  description = 'There are no files here. Create a new folder or upload files using the "+ New" button.',
}: {
  icon?: ReactNode;
  title?: string;
  description?: string;
} = {}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4 text-text-main">
      {icon ?? <Folder className="w-14 h-14 mb-4 opacity-50 text-neutral-400" />}
      <div className="text-base font-semibold text-text-heading mb-1.5">{title}</div>
      <div className="text-sm max-w-[320px] leading-relaxed">{description}</div>
    </div>
  );
}
