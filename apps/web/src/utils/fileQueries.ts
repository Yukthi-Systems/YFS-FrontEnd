import type { FileItem, SidebarTab, SortField, SortOrder } from "../types/file";

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
    result = result.filter((f) => f.parentId === "shared-folder" && !f.isDeleted);
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
