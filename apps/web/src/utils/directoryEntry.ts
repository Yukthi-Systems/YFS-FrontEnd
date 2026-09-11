import type { FileWithRelativePath } from "../atoms/uploadQueue";

// Minimal shape of the non-standard FileSystemEntry API exposed by
// DataTransferItem.webkitGetAsEntry() — used to walk a dropped folder recursively and
// preserve its structure (plain `dataTransfer.files` flattens/loses nested folders).
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
        readBatch(); // readEntries may not return everything in one call — keep going.
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

// Resolves a drop's DataTransfer into a flat list of files with folder-preserving relative
// paths. Falls back to the flat file list (no nested structure) if the browser doesn't
// support webkitGetAsEntry.
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
