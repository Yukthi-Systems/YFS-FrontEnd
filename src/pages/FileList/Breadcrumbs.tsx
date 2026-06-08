import { useAtom } from "jotai";
import { ChevronRight, Home } from "lucide-react";
import { currentPathAtom, selectedFileIdAtom } from "@/store/fileSystem";

export function Breadcrumbs() {
  const [currentPath, setCurrentPath] = useAtom(currentPathAtom);
  const [, setSelectedFileId] = useAtom(selectedFileIdAtom) as [
    string | null,
    (update: string | null) => void,
  ];

  const navigateToSegment = (index: number) => {
    setSelectedFileId(null);
    setCurrentPath(currentPath.slice(0, index + 1));
  };

  const navigateHome = () => {
    setSelectedFileId(null);
    setCurrentPath([]);
  };

  return (
    <nav className="flex items-center space-x-1 text-sm font-medium text-muted-foreground py-2 overflow-x-auto whitespace-nowrap">
      <button
        onClick={navigateHome}
        className="flex items-center gap-1.5 hover:text-foreground transition-colors py-1 px-2 rounded-md hover:bg-secondary cursor-pointer"
      >
        <Home className="h-4 w-4" />
        <span>Root</span>
      </button>

      {currentPath.map((segment, index) => (
        <div key={index} className="flex items-center space-x-1">
          <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
          <button
            onClick={() => navigateToSegment(index)}
            className="hover:text-foreground transition-colors py-1 px-2 rounded-md hover:bg-secondary cursor-pointer"
          >
            {segment}
          </button>
        </div>
      ))}
    </nav>
  );
}
