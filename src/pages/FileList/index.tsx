import { useAtom } from "jotai";
import { HardDrive } from "lucide-react";
import { currentPathAtom, selectedFileIdAtom } from "@/store/fileSystem";
import { useFiles, useFileDetails } from "@/services/files/mutations";
import { Breadcrumbs } from "./Breadcrumbs";
import { Toolbar } from "./Toolbar";
import { FileGrid } from "./FileGrid";
import { Sidebar } from "./Sidebar";
import { Dialogs } from "./Dialogs";

export default function FileList() {
  const [currentPath] = useAtom(currentPathAtom);
  const [selectedFileId] = useAtom(selectedFileIdAtom);
  const { data: files = [], isLoading } = useFiles(currentPath);

  const { data: selectedFile } = useFileDetails(selectedFileId);

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="px-6 py-5 border-b border-border bg-card/60 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <HardDrive className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight m-0 text-foreground">YFS</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Secure, local-first web storage interface
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        <main className="flex-1 flex flex-col p-6 min-w-0 overflow-y-auto">
          <Breadcrumbs />
          <Toolbar />
          <FileGrid files={files} isLoading={isLoading} />
        </main>

        <Sidebar />
      </div>

      <Dialogs selectedFile={selectedFile} />
    </div>
  );
}
