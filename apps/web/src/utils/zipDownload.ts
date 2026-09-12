import JSZip from "jszip";
import type { FileItem } from "../types/file";

// Builds the zip's internal folder structure by walking descendants from each root item,
// using each root's own name as the top-level path inside the archive. `parentPath` is the
// prefix (already ending in "/", or "") that this item's own name gets appended to.
const collectFilesForZip = (roots: FileItem[], allFiles: FileItem[]): { path: string; item: FileItem }[] => {
  const result: { path: string; item: FileItem }[] = [];

  const walk = (item: FileItem, parentPath: string) => {
    const itemPath = parentPath + item.name;
    if (item.isFolder) {
      const children = allFiles.filter((f) => f.parentId === item.id && !f.isDeleted);
      for (const child of children) walk(child, `${itemPath}/`);
    } else {
      result.push({ path: itemPath, item });
    }
  };

  for (const root of roots) walk(root, "");

  return result;
};

const triggerBlobDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Zips one or more items (folders recursively, or a flat multi-selection) and triggers a
// browser download. `fetchBlob` resolves one item's real bytes (server download session,
// or the local blob cache) — items it can't resolve (no server content, no local blob) are
// skipped rather than failing the whole archive.
export const downloadAsZip = async (
  roots: FileItem[],
  allFiles: FileItem[],
  archiveName: string,
  fetchBlob: (item: FileItem) => Promise<Blob | null>
): Promise<{ skipped: number }> => {
  const entries = collectFilesForZip(roots, allFiles);
  const zip = new JSZip();
  let skipped = 0;

  // One file's session/fetch failing (e.g. a locked file, an expired token) shouldn't
  // sink the whole archive — count it as skipped like "no content" and keep going.
  await Promise.all(
    entries.map(async ({ path, item }) => {
      try {
        const blob = await fetchBlob(item);
        if (!blob) {
          skipped++;
          return;
        }
        zip.file(path, blob);
      } catch (err) {
        console.error(`Skipping "${item.name}" in zip — failed to fetch its content`, err);
        skipped++;
      }
    })
  );

  const zipBlob = await zip.generateAsync({ type: "blob" });
  triggerBlobDownload(zipBlob, archiveName.endsWith(".zip") ? archiveName : `${archiveName}.zip`);

  return { skipped };
};
