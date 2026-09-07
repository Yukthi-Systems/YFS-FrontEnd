import type { FileItem, SidebarTab, SortField, SortOrder } from "../types/file";
import { SHARED_ROOT_ID } from "../types/file";

interface FilterSortParams {
  activeSidebarTab: SidebarTab;
  currentFolderId: string | null;
  searchQuery: string;
  typeFilter: string;
  sortField: SortField;
  sortOrder: SortOrder;
}

export function getFilteredSortedItems(files: FileItem[], params: FilterSortParams): FileItem[] {
  const { activeSidebarTab, currentFolderId, searchQuery, typeFilter, sortField, sortOrder } = params;
  let result = [...files];

  if (activeSidebarTab === "drive") {
    result = result.filter((f) => f.parentId === currentFolderId && !f.isDeleted);
  } else if (activeSidebarTab === "projects") {
    result = result.filter((f) => f.parentId === "projects-folder" && !f.isDeleted);
  } else if (activeSidebarTab === "shared") {
    result = result.filter((f) => f.parentId === SHARED_ROOT_ID && !f.isDeleted);
  } else if (activeSidebarTab === "recent") {
    result = result.filter((f) => !f.isFolder && !f.isDeleted);
  } else if (activeSidebarTab === "starred") {
    result = result.filter((f) => f.isStarred && !f.isDeleted);
  } else if (activeSidebarTab === "trash") {
    result = result.filter((f) => f.isDeleted);
  }

  if (searchQuery.trim() !== "") {
    const query = searchQuery.toLowerCase();
    result = result.filter((f) => f.name.toLowerCase().includes(query) && !f.isDeleted);
  }

  if (typeFilter !== "all" && activeSidebarTab !== "trash") {
    result = result.filter((f) => f.type === typeFilter);
  }

  result.sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;

    let comparison = 0;
    if (sortField === "name") comparison = a.name.localeCompare(b.name);
    else if (sortField === "modifiedAt") comparison = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
    else if (sortField === "size") comparison = a.size - b.size;

    return sortOrder === "asc" ? comparison : -comparison;
  });

  if (activeSidebarTab === "recent" && searchQuery.trim() === "") {
    result = result.slice(0, 15);
  }

  return result;
}

// All descendant ids of a folder, recursive. `rootId: null` means "the whole tree from the
// top" (top-level items have parentId === null, so the BFS just starts there). This is a
// pure, files-array-based counterpart to the private helper of the same name in
// FileSystemContext.tsx (which only ever needs a real id, never the whole-tree case).
export function collectDescendantIds(files: FileItem[], rootId: string | null): string[] {
  const result: string[] = [];
  const queue: (string | null)[] = [rootId];
  while (queue.length) {
    const parentId = queue.shift()!;
    for (const f of files) {
      if (f.parentId === parentId) {
        result.push(f.id);
        queue.push(f.id);
      }
    }
  }
  return result;
}

// The recursive candidate set for a full-text/name search within the current section —
// unlike normal browsing (direct children only), search should look at every descendant,
// since the point is finding something you don't remember the exact location of.
export function getSearchScope(
  files: FileItem[],
  params: { activeSidebarTab: SidebarTab; currentFolderId: string | null; typeFilter: string }
): FileItem[] {
  const { activeSidebarTab, currentFolderId, typeFilter } = params;
  let result: FileItem[];

  if (activeSidebarTab === "drive") {
    const ids = new Set(collectDescendantIds(files, currentFolderId));
    result = files.filter((f) => ids.has(f.id) && !f.isDeleted);
  } else if (activeSidebarTab === "projects") {
    const ids = new Set(collectDescendantIds(files, "projects-folder"));
    result = files.filter((f) => ids.has(f.id) && !f.isDeleted);
  } else if (activeSidebarTab === "shared") {
    const ids = new Set(collectDescendantIds(files, SHARED_ROOT_ID));
    result = files.filter((f) => ids.has(f.id) && !f.isDeleted);
  } else if (activeSidebarTab === "recent") {
    result = files.filter((f) => !f.isFolder && !f.isDeleted);
  } else if (activeSidebarTab === "starred") {
    result = files.filter((f) => f.isStarred && !f.isDeleted);
  } else if (activeSidebarTab === "trash") {
    result = files.filter((f) => f.isDeleted);
  } else {
    result = [];
  }

  if (typeFilter !== "all" && activeSidebarTab !== "trash") {
    result = result.filter((f) => f.type === typeFilter);
  }

  return result;
}

export function getNameMatches(items: FileItem[], query: string): FileItem[] {
  const q = query.toLowerCase();
  return items.filter((f) => f.name.toLowerCase().includes(q));
}

// Human-readable ancestry path for an item, e.g. "My Drive > Projects > Q3".
export function getItemPath(files: FileItem[], item: FileItem): string {
  const path: string[] = [];
  let current: FileItem | undefined = item;
  while (current && current.parentId) {
    const parent = files.find((f) => f.id === current!.parentId);
    if (parent) {
      path.unshift(parent.name);
      current = parent;
    } else break;
  }
  path.unshift("My Drive");
  return path.join(" > ");
}
