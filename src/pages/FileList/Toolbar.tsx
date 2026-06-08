import { useAtom } from "jotai";
import { Search, Grid, List, FolderPlus, Upload, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  searchQueryAtom,
  viewModeAtom,
  newFolderModalOpenAtom,
  uploadModalOpenAtom,
} from "@/store/fileSystem";
import { toggleThemeAtom } from "@/store/theme";

export function Toolbar() {
  const [searchQuery, setSearchQuery] = useAtom(searchQueryAtom);
  const [viewMode, setViewMode] = useAtom(viewModeAtom);
  const [, setNewFolderOpen] = useAtom(newFolderModalOpenAtom);
  const [, setUploadOpen] = useAtom(uploadModalOpenAtom);
  const [theme, toggleTheme] = useAtom(toggleThemeAtom);

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between py-4 border-b border-border">
      {/* Search Bar */}
      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search files and folders..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-secondary/30 border-none hover:bg-secondary/50 focus-visible:ring-1 focus-visible:ring-primary"
        />
      </div>

      {/* Actions */}
      <div className="flex w-full sm:w-auto items-center justify-end gap-2">
        {/* Toggle Theme */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => toggleTheme()}
          className="rounded-lg hover:scale-105 active:scale-95 transition-all"
          title="Toggle Theme"
        >
          {theme === "dark" ? (
            <Sun className="h-[1.2rem] w-[1.2rem]" />
          ) : (
            <Moon className="h-[1.2rem] w-[1.2rem]" />
          )}
        </Button>

        {/* View mode toggle */}
        <div className="flex items-center bg-secondary/50 rounded-lg p-0.5 border border-border">
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("list")}
            className="h-8 w-8 rounded-md"
            title="List View"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("grid")}
            className="h-8 w-8 rounded-md"
            title="Grid View"
          >
            <Grid className="h-4 w-4" />
          </Button>
        </div>

        {/* Create folder button */}
        <Button
          variant="outline"
          onClick={() => setNewFolderOpen(true)}
          className="gap-2 cursor-pointer hover:border-primary hover:text-primary transition-all"
        >
          <FolderPlus className="h-4 w-4" />
          <span className="hidden md:inline">New Folder</span>
        </Button>

        {/* Upload file button */}
        <Button onClick={() => setUploadOpen(true)} className="gap-2 cursor-pointer transition-all">
          <Upload className="h-4 w-4" />
          <span>Upload</span>
        </Button>
      </div>
    </div>
  );
}
