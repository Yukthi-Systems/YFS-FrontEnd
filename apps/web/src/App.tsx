import { useEffect, useRef, useState } from "react";
import { getJson, getApiJson } from "@yfs/service";
import { useAuth } from "./context/AuthContext";
import { useFileSystem } from "./context/FileSystemContext";
import { useToast } from "./context/ToastContext";
import { useUploadQueue } from "./context/UploadQueueContext";
import type { FileWithRelativePath } from "./context/UploadQueueContext";
import "./App.css";

import type { FileItem, FileVersion, ShareSettings, SidebarTab, ViewMode, SortField, SortOrder } from "./types/file";
import { getRangeSelection } from "./utils/selection";
import { downloadAsZip } from "./utils/zipDownload";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

import { LoginScreen } from "./components/auth/LoginScreen";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { Breadcrumbs } from "./components/layout/Breadcrumbs";
import type { BreadcrumbSegment } from "./components/layout/Breadcrumbs";
import { FilterSortBar } from "./components/files/FilterSortBar";
import { FileListTable } from "./components/files/FileListTable";
import { FileGrid } from "./components/files/FileGrid";
import { ItemContextMenu } from "./components/files/ItemContextMenu";
import { CanvasContextMenu } from "./components/files/CanvasContextMenu";
import { DetailsDrawer } from "./components/files/DetailsDrawer";
import { EmptyState } from "./components/common/EmptyState";
import { ListSkeleton, GridSkeleton } from "./components/common/Skeletons";
import { ToastContainer } from "./components/common/ToastContainer";
import { CreateFolderModal } from "./components/modals/CreateFolderModal";
import { RenameModal } from "./components/modals/RenameModal";
import { ConfirmModal } from "./components/modals/ConfirmModal";
import { MoveCopyModal } from "./components/modals/MoveCopyModal";
import { VersionHistoryModal } from "./components/modals/VersionHistoryModal";
import { ShareModal } from "./components/modals/ShareModal";
import { ViewerModal } from "./components/viewers/ViewerModal";
import { UploadDropzone } from "./components/upload/UploadDropzone";
import { UploadTray } from "./components/upload/UploadTray";
import { SystemDashboard } from "./components/system/SystemDashboard";

interface Example {
  message: string;
}

interface PendingConfirm {
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
  onConfirm: () => void;
}

interface MoveCopyState {
  mode: "move" | "copy";
  ids: string[];
}

function App() {
  const { user, token, isAuthenticated, isLoading: authLoading, errorMsg, loginWithSso, logout, clearError } = useAuth();
  const { files, isLoading: filesLoading, createFolder, renameItem, toggleStar, starItems, trashItems, restoreItems, permanentDeleteItems, moveItems, copyItem, updateFileContent, restoreVersion, setShareSettings, clearShareSettings } =
    useFileSystem();
  const { showToast } = useToast();
  const { enqueueFiles } = useUploadQueue();

  const [exampleMessage, setExampleMessage] = useState<string>("loading...");
  const [apiResponse, setApiResponse] = useState<string>("");
  const [apiLoading, setApiLoading] = useState<boolean>(false);
  const [ssoPending, setSsoPending] = useState<boolean>(false);

  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>("drive");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [checkedItemIds, setCheckedItemIds] = useState<string[]>([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  const [activeModal, setActiveModal] = useState<"createFolder" | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [moveCopyState, setMoveCopyState] = useState<MoveCopyState | null>(null);
  const [versionHistoryItemId, setVersionHistoryItemId] = useState<string | null>(null);
  const [shareItemId, setShareItemId] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [canvasContextMenu, setCanvasContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [viewerItem, setViewerItem] = useState<FileItem | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const canvasFileInputRef = useRef<HTMLInputElement>(null);
  // Selecting an item opens the details drawer, which reflows the file list (it's a flex
  // sibling, not an overlay) — if that reflow happens on the first click of a double-click,
  // the row moves before the second click lands. So double-click is detected manually via
  // click timestamps, and the actual select-and-open-drawer effect of a single click is
  // deferred until we're sure a second click isn't coming.
  const lastClickRef = useRef<{ id: string; time: number } | null>(null);
  const pendingSelectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchParams = new URLSearchParams(window.location.search);
  const isLogoutParam = searchParams.get("logout") === "true";

  useEffect(() => {
    if (isAuthenticated || authLoading || isLogoutParam) return;

    let active = true;
    const triggerAutoSso = async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      if (!active) return;
      try {
        setSsoPending(true);
        await loginWithSso();
      } catch (err) {
        console.warn("Auto SSO login was blocked or failed", err);
      } finally {
        if (active) setSsoPending(false);
      }
    };

    triggerAutoSso();
    return () => {
      active = false;
    };
  }, [isAuthenticated, authLoading, isLogoutParam, loginWithSso]);

  useEffect(() => {
    getJson<Example>("/example.json")
      .then((data) => setExampleMessage(data.message))
      .catch((err) => setExampleMessage(`error: ${err.message}`));
  }, []);

  useEffect(() => {
    if (!(contextMenuId || canvasContextMenu)) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (contextMenuId && !target.closest(".row-actions-trigger") && !target.closest(".context-dropdown")) {
        setContextMenuId(null);
      }
      if (canvasContextMenu && !target.closest(".context-dropdown")) {
        setCanvasContextMenu(null);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [contextMenuId, canvasContextMenu]);

  const handleManualLogin = async () => {
    try {
      setSsoPending(true);
      clearError();
      await loginWithSso();
    } catch (err) {
      console.error("Manual SSO login failed", err);
    } finally {
      setSsoPending(false);
    }
  };

  const testAuthenticatedApi = async () => {
    if (!token) return;
    setApiLoading(true);
    setApiResponse("");
    try {
      const data = await getApiJson<unknown>("/", { headers: { Authorization: `Bearer ${token}` } });
      setApiResponse(`Success: ${JSON.stringify(data)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to query backend API";
      setApiResponse(`Error: ${message}`);
    } finally {
      setApiLoading(false);
    }
  };

  const currentFolderId = currentPath[currentPath.length - 1] || null;

  const navigateToFolder = (folderId: string) => {
    setCurrentPath((prev) => [...prev, folderId]);
    clearSelection();
    setSearchQuery("");
  };

  const navigateBackTo = (index: number) => {
    setCurrentPath((prev) => (index === -1 ? [] : prev.slice(0, index + 1)));
    clearSelection();
    setSearchQuery("");
  };

  const getFilteredItems = (): FileItem[] => {
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
  };

  const listItems = getFilteredItems();

  const getBreadcrumbSegments = (): BreadcrumbSegment[] => {
    const segments: BreadcrumbSegment[] = [{ id: null, name: "My Drive" }];
    currentPath.forEach((folderId) => {
      const folder = files.find((f) => f.id === folderId);
      if (folder) segments.push({ id: folderId, name: folder.name });
    });
    return segments;
  };

  const getSelectedItemPath = (item: FileItem): string => {
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
  };

  // --- Selection ---
  const clearSelection = () => {
    if (pendingSelectRef.current) {
      clearTimeout(pendingSelectRef.current);
      pendingSelectRef.current = null;
    }
    setSelectedItemId(null);
  };

  const handleItemDoubleClick = (item: FileItem) => {
    if (item.isFolder) {
      if (!item.isDeleted) navigateToFolder(item.id);
    } else {
      setViewerItem(item);
    }
  };

  const DOUBLE_CLICK_WINDOW_MS = 400;

  const handleItemClick = (item: FileItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey) {
      if (pendingSelectRef.current) {
        clearTimeout(pendingSelectRef.current);
        pendingSelectRef.current = null;
      }
      const range = getRangeSelection(listItems.map((i) => i.id), selectionAnchorId, item.id);
      setCheckedItemIds((prev) => Array.from(new Set([...prev, ...range])));
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      if (pendingSelectRef.current) {
        clearTimeout(pendingSelectRef.current);
        pendingSelectRef.current = null;
      }
      setCheckedItemIds((prev) => (prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]));
      setSelectionAnchorId(item.id);
      return;
    }

    const now = Date.now();
    const last = lastClickRef.current;
    if (last && last.id === item.id && now - last.time < DOUBLE_CLICK_WINDOW_MS) {
      // Second click of a double-click: cancel the pending single-click select (it never
      // reflowed the layout, since it was deferred) and open the item instead.
      lastClickRef.current = null;
      if (pendingSelectRef.current) {
        clearTimeout(pendingSelectRef.current);
        pendingSelectRef.current = null;
      }
      handleItemDoubleClick(item);
      return;
    }
    lastClickRef.current = { id: item.id, time: now };
    setSelectionAnchorId(item.id);

    // Defer selecting (which opens the details drawer and reflows the file list) until
    // we're sure this isn't the first half of a double-click — otherwise the reflow
    // would move the row out from under the second click before it lands.
    if (pendingSelectRef.current) clearTimeout(pendingSelectRef.current);
    pendingSelectRef.current = setTimeout(() => {
      pendingSelectRef.current = null;
      setSelectedItemId((prev) => (prev === item.id ? null : item.id));
    }, DOUBLE_CLICK_WINDOW_MS);
  };

  const handleCheckboxToggle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckedItemIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
    setSelectionAnchorId(id);
  };

  const handleSelectAllToggle = () => {
    const listIds = listItems.map((item) => item.id);
    const allChecked = listIds.every((id) => checkedItemIds.includes(id));
    if (allChecked) setCheckedItemIds((prev) => prev.filter((id) => !listIds.includes(id)));
    else setCheckedItemIds((prev) => Array.from(new Set([...prev, ...listIds])));
  };

  const handleItemContextMenu = (item: FileItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCanvasContextMenu(null);
    setContextMenuId((prev) => (prev === item.id ? null : item.id));
  };

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuId(null);
    setCanvasContextMenu({ x: e.clientX, y: e.clientY });
  };

  // --- CRUD ---
  const handleCreateFolderConfirm = (name: string) => {
    const folder = createFolder(name, currentFolderId);
    if (folder) showToast(`Created folder "${folder.name}"`, "success");
    else showToast("Folder name can't be empty", "error");
    setActiveModal(null);
  };

  const handleUploadFiles = (fileList: FileList, parentId: string | null) => {
    const items: FileWithRelativePath[] = Array.from(fileList).map((file) => ({
      file,
      relativePath: file.webkitRelativePath || file.name,
    }));
    enqueueFiles(items, parentId);
  };

  const openRenameModal = (item: FileItem) => {
    setRenameTarget({ id: item.id, name: item.name });
    setContextMenuId(null);
  };

  const handleRenameConfirm = (name: string) => {
    if (renameTarget) {
      renameItem(renameTarget.id, name);
      showToast("Renamed", "success");
    }
    setRenameTarget(null);
  };

  const handleToggleStar = (id: string) => {
    toggleStar(id);
    setContextMenuId(null);
  };

  const handleBatchStar = () => {
    starItems(checkedItemIds);
    showToast(`Starred ${checkedItemIds.length} item${checkedItemIds.length > 1 ? "s" : ""}`, "success");
    setCheckedItemIds([]);
  };

  const requestTrash = (ids: string[]) => {
    if (ids.length === 0) return;
    setPendingConfirm({
      title: "Move to Trash",
      description: `Are you sure you want to move ${ids.length > 1 ? `${ids.length} items` : "this item"} to the Trash? You can restore ${
        ids.length > 1 ? "them" : "it"
      } later from the Trash tab.`,
      confirmLabel: "Move to Trash",
      destructive: true,
      onConfirm: () => {
        trashItems(ids);
        showToast(`Moved ${ids.length > 1 ? `${ids.length} items` : "item"} to Trash`, "success");
        setCheckedItemIds([]);
        setSelectedItemId(null);
        setContextMenuId(null);
        setPendingConfirm(null);
      },
    });
  };

  const requestPermanentDelete = (ids: string[]) => {
    if (ids.length === 0) return;
    setPendingConfirm({
      title: "Delete Permanently",
      description: `This will permanently delete ${ids.length > 1 ? `${ids.length} items` : "this item"}. This action cannot be undone.`,
      confirmLabel: "Delete Permanently",
      destructive: true,
      onConfirm: () => {
        permanentDeleteItems(ids);
        showToast(`Permanently deleted ${ids.length > 1 ? `${ids.length} items` : "item"}`, "success");
        setCheckedItemIds([]);
        setSelectedItemId(null);
        setContextMenuId(null);
        setPendingConfirm(null);
      },
    });
  };

  const handleRestore = (ids: string[]) => {
    if (ids.length === 0) return;
    restoreItems(ids);
    showToast(`Restored ${ids.length > 1 ? `${ids.length} items` : "item"}`, "success");
    setCheckedItemIds([]);
    setContextMenuId(null);
  };

  const requestLogout = () => {
    setPendingConfirm({
      title: "Logout Confirmation",
      description: "Are you sure you want to logout? You will need to login again to access the workspace.",
      confirmLabel: "Logout",
      destructive: true,
      onConfirm: () => {
        setPendingConfirm(null);
        logout();
      },
    });
  };

  const openMoveModal = (ids: string[]) => {
    setMoveCopyState({ mode: "move", ids });
    setContextMenuId(null);
  };

  const openCopyModal = (ids: string[]) => {
    setMoveCopyState({ mode: "copy", ids });
    setContextMenuId(null);
  };

  const handleMoveCopyConfirm = (destinationId: string | null) => {
    if (!moveCopyState) return;
    if (moveCopyState.mode === "move") {
      const { moved, blocked } = moveItems(moveCopyState.ids, destinationId);
      if (moved > 0) showToast(`Moved ${moved} item${moved > 1 ? "s" : ""}`, "success");
      if (blocked > 0) showToast(`Skipped ${blocked} item${blocked > 1 ? "s" : ""} — can't move a folder into itself`, "error");
    } else {
      let totalCopied = 0;
      let anyBlocked = false;
      moveCopyState.ids.forEach((id) => {
        const { copied, blocked } = copyItem(id, destinationId);
        totalCopied += copied;
        if (blocked) anyBlocked = true;
      });
      if (totalCopied > 0) showToast(`Copied ${totalCopied} item${totalCopied > 1 ? "s" : ""}`, "success");
      if (anyBlocked) showToast("Skipped an item — can't copy a folder into itself", "error");
    }
    setMoveCopyState(null);
    setCheckedItemIds([]);
  };

  const handleDownload = async (item: FileItem) => {
    setContextMenuId(null);

    if (item.isFolder) {
      const { skipped } = await downloadAsZip([item], files, item.name);
      if (skipped > 0) showToast(`${skipped} item${skipped > 1 ? "s" : ""} had no content to include`, "error");
      return;
    }

    const link = document.createElement("a");
    if (item.blobUrl) {
      link.href = item.blobUrl;
      link.download = item.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const blob = new Blob([`Seeded File: ${item.name}\nSize: ${item.size} bytes`], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = item.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleBatchDownload = async (ids: string[]) => {
    const items = files.filter((f) => ids.includes(f.id));
    if (items.length === 0) return;

    if (items.length === 1 && !items[0].isFolder) {
      await handleDownload(items[0]);
      return;
    }

    const { skipped } = await downloadAsZip(items, files, "Download");
    if (skipped > 0) showToast(`${skipped} item${skipped > 1 ? "s" : ""} had no content to include`, "error");
  };

  const handleSaveContent = async (id: string, blob: Blob) => {
    await updateFileContent(id, blob);
    showToast("Saved", "success");
  };

  const openVersionHistory = (item: FileItem) => {
    setVersionHistoryItemId(item.id);
    setContextMenuId(null);
  };

  const handleRestoreVersion = (versionId: string) => {
    if (!versionHistoryItemId) return;
    restoreVersion(versionHistoryItemId, versionId);
    showToast("Restored previous version", "success");
  };

  const handleDownloadVersion = (version: FileVersion) => {
    if (!version.blobUrl) {
      showToast("No content to download for this version", "error");
      return;
    }
    const item = files.find((f) => f.id === versionHistoryItemId);
    const link = document.createElement("a");
    link.href = version.blobUrl;
    link.download = item ? `${version.savedAt.slice(0, 10)}-${item.name}` : "version";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openShareModal = (item: FileItem) => {
    setShareItemId(item.id);
    setContextMenuId(null);
  };

  const handleSaveShare = (settings: ShareSettings) => {
    if (!shareItemId) return;
    setShareSettings(shareItemId, settings);
    showToast("Sharing settings saved", "success");
    setShareItemId(null);
  };

  const handleRevokeShare = () => {
    if (!shareItemId) return;
    clearShareSettings(shareItemId);
    showToast("Share link removed", "success");
    setShareItemId(null);
  };

  // --- Drag & drop ---
  const handleDragStartItem = (item: FileItem, e: React.DragEvent) => {
    e.dataTransfer.setData("application/x-yfs-item", item.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOverFolder = (item: FileItem, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFolderId(item.id);
  };

  const handleDragLeaveFolder = (item: FileItem) => {
    setDragOverFolderId((prev) => (prev === item.id ? null : prev));
  };

  const handleDropOnFolder = (item: FileItem, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files, item.id);
      return;
    }

    const draggedId = e.dataTransfer.getData("application/x-yfs-item");
    if (!draggedId) return;
    const ids = checkedItemIds.includes(draggedId) ? checkedItemIds : [draggedId];
    const { moved, blocked } = moveItems(ids, item.id);
    if (moved > 0) showToast(`Moved ${moved} item${moved > 1 ? "s" : ""} into "${item.name}"`, "success");
    if (blocked > 0) showToast("Can't move a folder into itself", "error");
  };

  // --- Keyboard shortcuts ---
  useKeyboardShortcuts({
    enabled: isAuthenticated && !viewerItem && !activeModal && !renameTarget && !moveCopyState && !pendingConfirm && !versionHistoryItemId && !shareItemId,
    onDelete: () => {
      const ids = checkedItemIds.length > 0 ? checkedItemIds : selectedItemId ? [selectedItemId] : [];
      if (ids.length === 0) return;
      if (activeSidebarTab === "trash") requestPermanentDelete(ids);
      else requestTrash(ids);
    },
    onEnter: () => {
      if (!selectedItemId) return;
      const item = files.find((f) => f.id === selectedItemId);
      if (!item) return;
      handleItemDoubleClick(item);
    },
    onEscape: () => {
      clearSelection();
      setCheckedItemIds([]);
      setContextMenuId(null);
      setCanvasContextMenu(null);
    },
  });

  // --- Storage ---
  const totalStorageAllocated = (user?.quota_allocated || 5120) * 1024 * 1024;
  const totalStorageUtilized =
    files.filter((f) => !f.isDeleted && !f.isFolder).reduce((sum, f) => sum + f.size, 0) + (user?.quota_utilized || 0) * 1024 * 1024;
  const storagePercentage = Math.min((totalStorageUtilized / totalStorageAllocated) * 100, 100);

  if (authLoading) {
    return (
      <div className="flex w-screen h-screen items-center justify-center bg-bg-main">
        <div className="w-full max-w-md bg-bg-main/70 backdrop-blur-md border border-border-main rounded-3xl p-10 shadow-lg text-center">
          <div className="w-8 h-8 border-3 border-border-main border-t-accent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-main font-medium">Restoring secure session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen errorMsg={errorMsg} ssoPending={ssoPending} isLogoutParam={isLogoutParam} onLogin={handleManualLogin} />;
  }

  const selectedItem = files.find((f) => f.id === selectedItemId);

  const renderItemContextMenu = (item: FileItem) => (
    <ItemContextMenu
      item={item}
      onDownload={() => handleDownload(item)}
      onToggleStar={() => handleToggleStar(item.id)}
      onRename={() => openRenameModal(item)}
      onMove={() => openMoveModal(checkedItemIds.includes(item.id) ? checkedItemIds : [item.id])}
      onCopy={() => openCopyModal(checkedItemIds.includes(item.id) ? checkedItemIds : [item.id])}
      onVersionHistory={() => openVersionHistory(item)}
      onShare={() => openShareModal(item)}
      onTrash={() => requestTrash([item.id])}
      onRestore={() => handleRestore([item.id])}
      onPermanentDelete={() => requestPermanentDelete([item.id])}
    />
  );

  return (
    <div
      className="flex w-screen h-screen bg-bg-main text-text-main overflow-hidden font-sans"
      onClick={() => {
        setContextMenuId(null);
        setCanvasContextMenu(null);
      }}
    >
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        activeTab={activeSidebarTab}
        onTabChange={(tab) => {
          setActiveSidebarTab(tab);
          setCurrentPath([]);
          clearSelection();
        }}
        onCreateFolder={() => setActiveModal("createFolder")}
        onUploadFiles={(fl) => handleUploadFiles(fl, currentFolderId)}
        storagePercentage={storagePercentage}
        totalStorageUtilized={totalStorageUtilized}
        totalStorageAllocated={totalStorageAllocated}
        user={user}
        onRequestLogout={requestLogout}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
      />

      <main className="flex-1 flex flex-col overflow-hidden bg-bg-main">
        <TopBar isSystemView={activeSidebarTab === "system"} searchQuery={searchQuery} onSearchChange={setSearchQuery} viewMode={viewMode} onViewModeChange={setViewMode} />

        <div className="flex-1 flex overflow-hidden relative">
        <UploadDropzone disabled={activeSidebarTab === "system"} onDropFiles={(items) => enqueueFiles(items, currentFolderId)}>
          {activeSidebarTab === "system" ? (
            <SystemDashboard user={user} token={token} exampleMessage={exampleMessage} apiResponse={apiResponse} apiLoading={apiLoading} onTestApi={testAuthenticatedApi} />
          ) : (
            <div
              className="flex-1 overflow-y-auto px-8 py-6 pb-12 flex flex-col gap-6 max-[768px]:px-4"
              onClick={() => {
                clearSelection();
                setContextMenuId(null);
              }}
              onContextMenu={handleCanvasContextMenu}
            >
              <Breadcrumbs segments={getBreadcrumbSegments()} onNavigate={navigateBackTo} />

              <FilterSortBar
                activeSidebarTab={activeSidebarTab}
                checkedCount={checkedItemIds.length}
                sortField={sortField}
                onSortFieldChange={setSortField}
                sortOrder={sortOrder}
                onToggleSortOrder={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
                onClearSelection={() => setCheckedItemIds([])}
                onBatchStar={handleBatchStar}
                onBatchTrash={() => requestTrash(checkedItemIds)}
                onBatchRestore={() => handleRestore(checkedItemIds)}
                onBatchPermanentDelete={() => requestPermanentDelete(checkedItemIds)}
                onBatchDownload={() => handleBatchDownload(checkedItemIds)}
              />

              {filesLoading ? (
                viewMode === "list" ? <ListSkeleton /> : <GridSkeleton />
              ) : listItems.length === 0 ? (
                <EmptyState />
              ) : viewMode === "list" ? (
                <FileListTable
                  items={listItems}
                  selectedItemId={selectedItemId}
                  checkedItemIds={checkedItemIds}
                  contextMenuId={contextMenuId}
                  dragOverFolderId={dragOverFolderId}
                  onItemClick={handleItemClick}
                  onCheckboxToggle={handleCheckboxToggle}
                  onSelectAllToggle={handleSelectAllToggle}
                  onContextMenuToggle={setContextMenuId}
                  onItemContextMenu={handleItemContextMenu}
                  renderContextMenu={renderItemContextMenu}
                  onDragStartItem={handleDragStartItem}
                  onDragOverFolder={handleDragOverFolder}
                  onDragLeaveFolder={handleDragLeaveFolder}
                  onDropOnFolder={handleDropOnFolder}
                />
              ) : (
                <FileGrid
                  items={listItems}
                  selectedItemId={selectedItemId}
                  checkedItemIds={checkedItemIds}
                  contextMenuId={contextMenuId}
                  dragOverFolderId={dragOverFolderId}
                  onItemClick={handleItemClick}
                  onCheckboxToggle={handleCheckboxToggle}
                  onContextMenuToggle={setContextMenuId}
                  onItemContextMenu={handleItemContextMenu}
                  renderContextMenu={renderItemContextMenu}
                  onDragStartItem={handleDragStartItem}
                  onDragOverFolder={handleDragOverFolder}
                  onDragLeaveFolder={handleDragLeaveFolder}
                  onDropOnFolder={handleDropOnFolder}
                />
              )}
            </div>
          )}
        </UploadDropzone>

        {selectedItem && activeSidebarTab !== "system" && (
          <DetailsDrawer
            item={selectedItem}
            pathLabel={getSelectedItemPath(selectedItem)}
            onClose={clearSelection}
            onOpenFull={() => setViewerItem(selectedItem)}
            onDownload={() => handleDownload(selectedItem)}
            onToggleStar={() => handleToggleStar(selectedItem.id)}
            onRename={() => openRenameModal(selectedItem)}
            onMove={() => openMoveModal([selectedItem.id])}
            onCopy={() => openCopyModal([selectedItem.id])}
            onVersionHistory={() => openVersionHistory(selectedItem)}
            onShare={() => openShareModal(selectedItem)}
            onTrash={() => requestTrash([selectedItem.id])}
            onRestore={() => handleRestore([selectedItem.id])}
          />
        )}
        </div>
      </main>

      {canvasContextMenu && (
        <CanvasContextMenu
          x={canvasContextMenu.x}
          y={canvasContextMenu.y}
          onCreateFolder={() => {
            setActiveModal("createFolder");
            setCanvasContextMenu(null);
          }}
          onUploadFile={() => {
            canvasFileInputRef.current?.click();
            setCanvasContextMenu(null);
          }}
        />
      )}
      <input
        type="file"
        ref={canvasFileInputRef}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) handleUploadFiles(e.target.files, currentFolderId);
          e.target.value = "";
        }}
        style={{ display: "none" }}
        multiple
      />

      {activeModal === "createFolder" && <CreateFolderModal onCancel={() => setActiveModal(null)} onCreate={handleCreateFolderConfirm} />}

      {renameTarget && <RenameModal currentName={renameTarget.name} onCancel={() => setRenameTarget(null)} onRename={handleRenameConfirm} />}

      {moveCopyState && (
        <MoveCopyModal
          files={files}
          mode={moveCopyState.mode}
          sourceIds={moveCopyState.ids}
          currentParentId={currentFolderId}
          onCancel={() => setMoveCopyState(null)}
          onConfirm={handleMoveCopyConfirm}
        />
      )}

      {versionHistoryItemId &&
        (() => {
          const versionHistoryItem = files.find((f) => f.id === versionHistoryItemId);
          if (!versionHistoryItem) return null;
          return (
            <VersionHistoryModal
              item={versionHistoryItem}
              onClose={() => setVersionHistoryItemId(null)}
              onRestore={handleRestoreVersion}
              onDownloadVersion={handleDownloadVersion}
            />
          );
        })()}

      {shareItemId &&
        (() => {
          const shareItem = files.find((f) => f.id === shareItemId);
          if (!shareItem) return null;
          return (
            <ShareModal
              item={shareItem}
              onClose={() => setShareItemId(null)}
              onSave={handleSaveShare}
              onRevoke={handleRevokeShare}
            />
          );
        })()}

      {pendingConfirm && (
        <ConfirmModal
          title={pendingConfirm.title}
          description={pendingConfirm.description}
          confirmLabel={pendingConfirm.confirmLabel}
          destructive={pendingConfirm.destructive}
          onCancel={() => setPendingConfirm(null)}
          onConfirm={pendingConfirm.onConfirm}
        />
      )}

      {viewerItem && (
        <ViewerModal
          item={viewerItem}
          siblings={listItems}
          onClose={() => setViewerItem(null)}
          onNavigate={setViewerItem}
          onDownload={handleDownload}
          onSaveContent={handleSaveContent}
        />
      )}

      <ToastContainer />
      <UploadTray />
    </div>
  );
}

export default App;
