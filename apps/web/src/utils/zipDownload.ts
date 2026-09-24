/*
 * Copyright (C) 2026 Yukthi Systems Private Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * version 3 along with this program. If not, see
 * <https://www.gnu.org/licenses/>.
 */

import JSZip from "jszip";
import type { FileItem } from "../types/file";

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

// Items `fetchBlob` can't resolve are skipped, not fatal.
export const downloadAsZip = async (
  roots: FileItem[],
  allFiles: FileItem[],
  archiveName: string,
  fetchBlob: (item: FileItem) => Promise<Blob | null>
): Promise<{ skipped: number }> => {
  const entries = collectFilesForZip(roots, allFiles);
  const zip = new JSZip();
  let skipped = 0;

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
