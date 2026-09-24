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

import type { FileWithRelativePath } from "../atoms/uploadQueue";

// Subset of the non-standard FileSystemEntry API used to walk dropped folders.
interface EntryLike {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file(success: (file: File) => void, error?: (err: unknown) => void): void;
  createReader(): {
    readEntries(success: (entries: EntryLike[]) => void, error?: (err: unknown) => void): void;
  };
}

const readAllEntries = (reader: ReturnType<EntryLike["createReader"]>): Promise<EntryLike[]> => {
  return new Promise((resolve, reject) => {
    const all: EntryLike[] = [];
    const readBatch = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(all);
          return;
        }
        all.push(...batch);
        readBatch(); // readEntries returns results in batches.
      }, reject);
    };
    readBatch();
  });
};

const walkEntry = async (entry: EntryLike, pathPrefix: string): Promise<FileWithRelativePath[]> => {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => entry.file(resolve, reject));
    return [{ file, relativePath: pathPrefix + entry.name }];
  }
  if (entry.isDirectory) {
    const entries = await readAllEntries(entry.createReader());
    const nested = await Promise.all(entries.map((child) => walkEntry(child, `${pathPrefix}${entry.name}/`)));
    return nested.flat();
  }
  return [];
};

// Flattens a drop into files with relative paths; no nesting without webkitGetAsEntry.
export const resolveDroppedItems = async (dataTransfer: DataTransfer): Promise<FileWithRelativePath[]> => {
  const items = Array.from(dataTransfer.items);
  const entries = items
    .map((item) => (item.webkitGetAsEntry ? (item.webkitGetAsEntry() as EntryLike | null) : null))
    .filter((entry): entry is EntryLike => entry !== null);

  if (entries.length === 0) {
    return Array.from(dataTransfer.files).map((file) => ({ file, relativePath: file.name }));
  }

  const results = await Promise.all(entries.map((entry) => walkEntry(entry, "")));
  return results.flat();
};
