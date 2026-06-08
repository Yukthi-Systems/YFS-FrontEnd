import React, { useState } from "react";
import { useAtom } from "jotai";
import type { FileItem } from "@/types";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  newFolderModalOpenAtom,
  uploadModalOpenAtom,
  renameModalOpenAtom,
  currentPathAtom,
} from "@/store/fileSystem";
import { useCreateFolder, useUploadFile, useRenameFile } from "@/services/files/mutations";

interface DialogsProps {
  selectedFile: FileItem | null | undefined;
}

export function Dialogs({ selectedFile }: DialogsProps) {
  const [currentPath] = useAtom(currentPathAtom);

  // Modal Atoms
  const [newFolderOpen, setNewFolderOpen] = useAtom(newFolderModalOpenAtom);
  const [uploadOpen, setUploadOpen] = useAtom(uploadModalOpenAtom);
  const [renameOpen, setRenameOpen] = useAtom(renameModalOpenAtom);

  // Local state
  const [folderName, setFolderName] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("1.2 MB");
  const [newName, setNewName] = useState("");

  // Mutations
  const createFolderMutation = useCreateFolder();
  const uploadFileMutation = useUploadFile();
  const renameFileMutation = useRenameFile();

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    await createFolderMutation.mutateAsync({
      name: folderName,
      path: currentPath,
    });
    setFolderName("");
    setNewFolderOpen(false);
  };

  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim()) return;

    // Parse size
    const sizeInBytes = parseFloat(fileSize) * 1024 * 1024 || 1024 * 1024;

    // Determine type by extension
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    let type: any = "file";
    if (["png", "jpg", "jpeg", "gif"].includes(ext)) type = "image";
    else if (ext === "pdf") type = "pdf";
    else if (["mp3", "wav", "ogg"].includes(ext)) type = "audio";
    else if (["mp4", "mov", "avi"].includes(ext)) type = "video";
    else if (ext === "txt") type = "text";
    else if (["ts", "tsx", "js", "jsx", "json", "css", "html"].includes(ext)) type = "code";

    await uploadFileMutation.mutateAsync({
      name: fileName,
      type,
      size: sizeInBytes,
      path: currentPath,
    });
    setFileName("");
    setUploadOpen(false);
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !newName.trim()) return;
    await renameFileMutation.mutateAsync({
      id: selectedFile.id,
      newName: newName.trim(),
      path: currentPath,
    });
    setNewName("");
    setRenameOpen(false);
  };

  React.useEffect(() => {
    if (selectedFile && renameOpen) {
      setNewName(selectedFile.name);
    }
  }, [selectedFile, renameOpen]);

  return (
    <>
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <form onSubmit={handleCreateFolder}>
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription>Create a new folder in the current directory.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Folder Name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewFolderOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createFolderMutation.isPending}>
              {createFolderMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <form onSubmit={handleUploadFile}>
          <DialogHeader>
            <DialogTitle>Upload File (Mock)</DialogTitle>
            <DialogDescription>Simulate uploading a file to this directory.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">File Name</label>
              <Input
                placeholder="example.pdf, photo.jpg, etc."
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">File Size (MB)</label>
              <Input
                placeholder="1.2"
                value={fileSize}
                onChange={(e) => setFileSize(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={uploadFileMutation.isPending}>
              {uploadFileMutation.isPending ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <form onSubmit={handleRename}>
          <DialogHeader>
            <DialogTitle>Rename Item</DialogTitle>
            <DialogDescription>Enter a new name for the file or folder.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="New name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={renameFileMutation.isPending}>
              {renameFileMutation.isPending ? "Renaming..." : "Rename"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}
