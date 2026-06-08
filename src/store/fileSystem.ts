import { atom } from "jotai";

// Current path segments (e.g., ['documents', 'work'])
export const currentPathAtom = atom<string[]>([]);

// View mode: grid or list
export const viewModeAtom = atom<"grid" | "list">("list");

// Selected file ID or path (null if none selected)
export const selectedFileIdAtom = atom<string | null>(null);

// Search query for filtering files
export const searchQueryAtom = atom<string>("");

// Sidebar toggles
export const detailsSidebarOpenAtom = atom<boolean>(false);
export const uploadModalOpenAtom = atom<boolean>(false);
export const newFolderModalOpenAtom = atom<boolean>(false);
export const renameModalOpenAtom = atom<boolean>(false);
