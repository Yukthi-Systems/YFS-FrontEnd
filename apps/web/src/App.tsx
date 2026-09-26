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

import { useEffect, useRef, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useFileSystem } from "./hooks/useFileSystem";
import { useToast } from "./atoms/toast";
import { useUploadQueue } from "./hooks/useUploadQueue";
import { useUserSettings } from "./hooks/useUserSettings";
import { UserSettingsBridge } from "./components/UserSettingsBridge";
import { Trash2 } from "lucide-react";
import "./App.css";

import type { FileItem } from "./types/file";
import type { ExternalShare } from "@yfs/service";
import { getFilteredSortedItems, getItemPath } from "./utils/fileQueries";
import { buildAppRoute } from "./utils/appRoute";
import { canDownloadItem, getStorageQuota, GB, itemBusyReason } from "./utils/format";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useSsoAutoLogin } from "./hooks/useSsoAutoLogin";
import { useContextMenuState } from "./hooks/useContextMenuState";
import { useFileNavigation } from "./hooks/useFileNavigation";
import { useFileSelection } from "./hooks/useFileSelection";
import { useMarqueeSelection } from "./hooks/useMarqueeSelection";
import { useFileActions } from "./hooks/useFileActions";
import { useVersionHistory } from "./hooks/useVersionHistory";
import { useShareSettings } from "./hooks/useShareSettings";
import { useDragAndDrop } from "./hooks/useDragAndDrop";
import { useFileSearch } from "./hooks/useFileSearch";
import { useMyQuota } from "./hooks/useUserQuota";

import { LoginScreen } from "./components/auth/LoginScreen";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { FilterSortBar } from "./components/files/FilterSortBar";
import { FileListTable } from "./components/files/FileListTable";
import { FileGrid } from "./components/files/FileGrid";
import { FileTiles } from "./components/files/FileTiles";
import { SearchResultsList } from "./components/files/SearchResultsList";
import { SharedLinksList } from "./components/files/SharedLinksList";
import { ItemContextMenu } from "./components/files/ItemContextMenu";
import { CanvasContextMenu } from "./components/files/CanvasContextMenu";
import { DetailsDrawer } from "./components/files/DetailsDrawer";
import { EmptyState } from "./components/common/EmptyState";
import { ListSkeleton, GridSkeleton, TilesSkeleton } from "./components/common/Skeletons";
import { ToastContainer } from "./components/common/ToastContainer";
import { CreateFolderModal } from "./components/modals/CreateFolderModal";
import { RenameModal } from "./components/modals/RenameModal";
import { ConfirmModal } from "./components/modals/ConfirmModal";
import { MoveCopyModal } from "./components/modals/MoveCopyModal";
import { VersionHistoryModal } from "./components/modals/VersionHistoryModal";
import { ShareModal } from "./components/modals/ShareModal";
import { EditShareLinkModal } from "./components/modals/EditShareLinkModal";
import { ViewerModal } from "./components/viewers/ViewerModal";
import { UploadDropzone } from "./components/upload/UploadDropzone";
import { UploadTray } from "./components/upload/UploadTray";
import { DownloadTray } from "./components/download/DownloadTray";

function App() {
  const { user, isAuthenticated, isLoading: authLoading, errorMsg, loginWithSso, logout, clearError } = useAuth();
  const {
    files,
    isLoading: filesLoading,
    remoteError,
    loadFolder,
    loadMoreFolder,
    loadSharedFolders,
    loadMoreSharedFolders,
    getPagination,
    getSharedPermissions,
    trashFolderId,
    idRemap,
    sharedOut,
    sharedOutLoading,
    sharedOutLoaded,
    loadSharedOut,
    sharedLinks,
    sharedLinksLoading,
    sharedLinksLoaded,
    loadSharedLinks,
    revokeSharedLink,
    createFolder,
    renameItem,
    setFolderStyle,
    setItemDescription,
    trashItems,
    restoreItems,
    permanentDeleteItems,
    deleteFileVersion,
    moveItems,
    updateFileContent,
  } = useFileSystem();
  const { showToast } = useToast();
  const { enqueueFiles } = useUploadQueue();

  // Server-backed view preferences (see UserSettingsBridge).
  const {
    viewMode,
    gridSize,
    sortField,
    sortOrder,
    sidebarCollapsed,
    setViewMode,
    setGridSize,
    setSortField,
    setSortOrder,
    setSidebarCollapsed,
  } = useUserSettings();
  const typeFilter = "all";
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [viewerItem, setViewerItem] = useState<FileItem | null>(null);

  const canvasFileInputRef = useRef<HTMLInputElement>(null);
  const canvasFolderInputRef = useRef<HTMLInputElement>(null);
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const sso = useSsoAutoLogin({ isAuthenticated, authLoading, loginWithSso, clearError });
  const menus = useContextMenuState();
  const nav = useFileNavigation();

  const currentFolderPerms = getSharedPermissions(nav.currentFolderId);
  const canCreateHere = !currentFolderPerms || currentFolderPerms.can_create;
  const search = useFileSearch({
    files,
    activeSidebarTab: nav.activeSidebarTab,
    currentFolderId: nav.currentFolderId,
    typeFilter,
    trashFolderId,
  });

    // A deep link into a shared folder must load its ancestors root-first so requests route through the share endpoint.
  const [restoringSharedRoute, setRestoringSharedRoute] = useState(
    () => nav.activeSidebarTab === "shared" && nav.currentPath.length > 0
  );
  const hydratedRouteRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || hydratedRouteRef.current) return;
    hydratedRouteRef.current = true;
    const ancestorIds = nav.currentPath.slice(0, -1);
    if (nav.activeSidebarTab === "shared" && nav.currentPath.length > 0) {
      (async () => {
        await loadSharedFolders();
        for (const id of ancestorIds) await loadFolder(id);
        setRestoringSharedRoute(false);
      })();
    } else if (ancestorIds.length > 0) {
      (async () => {
        for (const id of ancestorIds) await loadFolder(id);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Follow a just-created folder's temp id → server id swap.
  useEffect(() => {
    nav.replacePathIds(idRemap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idRemap]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const tab = nav.activeSidebarTab;
    if (tab === "shared" && !nav.currentFolderId) loadSharedFolders();
    else if (tab === "shared-out") loadSharedOut({ force: true });
    else if (tab === "shared-links") loadSharedLinks({ force: true });
    else if (tab === "trash") {
      const target = nav.currentFolderId ?? trashFolderId;
      if (target) loadFolder(target, { force: true });
    } else if (restoringSharedRoute) {
      // The hydration effect loads this chain, then re-runs this effect for the leaf.
    } else loadFolder(nav.currentFolderId);
  }, [
    isAuthenticated,
    nav.activeSidebarTab,
    nav.currentFolderId,
    trashFolderId,
    restoringSharedRoute,
    loadFolder,
    loadSharedFolders,
    loadSharedOut,
    loadSharedLinks,
  ]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const tab = nav.activeSidebarTab;
      if (tab === "shared" && !nav.currentFolderId) await loadSharedFolders({ force: true });
      else if (tab === "shared-out") await loadSharedOut({ force: true });
      else if (tab === "shared-links") await loadSharedLinks({ force: true });
      else if (tab === "trash") {
        const target = nav.currentFolderId ?? trashFolderId;
        if (target) await loadFolder(target, { force: true });
      } else await loadFolder(nav.currentFolderId, { force: true });
    } finally {
      setRefreshing(false);
    }
  };

  // Only server-backed listings (drive, shared, trash) paginate.
  const isSharedTab = nav.activeSidebarTab === "shared";
  const isSharedRoot = isSharedTab && !nav.currentFolderId;
  const isTrashTab = nav.activeSidebarTab === "trash";
  const isPaginatedTab = isSharedTab || nav.activeSidebarTab === "drive" || isTrashTab;
  const paginationParentId = isTrashTab ? (nav.currentFolderId ?? trashFolderId) : nav.currentFolderId;
  const pagination = getPagination(paginationParentId, isSharedRoot);

  const isSharedOutTab = nav.activeSidebarTab === "shared-out";

  const lastLoadTimeRef = useRef(0);
  useEffect(() => {
    const el = scrollContainer;
    if (!el) return;
    const handleScroll = () => {
      if (!isPaginatedTab || !pagination.hasMore || pagination.loading) return;
      if (Date.now() - lastLoadTimeRef.current < 800) return;
      if (el.scrollHeight > el.clientHeight + 50 && el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
        lastLoadTimeRef.current = Date.now();
        if (isSharedRoot) loadMoreSharedFolders();
        else if (isTrashTab) {
          if (paginationParentId) loadMoreFolder(paginationParentId);
        } else loadMoreFolder(nav.currentFolderId);
      }
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [
    scrollContainer,
    isPaginatedTab,
    pagination.hasMore,
    pagination.loading,
    isSharedRoot,
    isTrashTab,
    paginationParentId,
    loadMoreSharedFolders,
    loadMoreFolder,
    nav.currentFolderId,
  ]);

  useEffect(() => {
    if (remoteError) showToast(`File service unavailable — showing cached data. (${remoteError})`, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteError]);

  // Search results render separately (SearchResultsList).
  const listItems =
    nav.activeSidebarTab === "shared-out"
      ? [...sharedOut].sort((a, b) => a.name.localeCompare(b.name))
      : getFilteredSortedItems(files, {
          activeSidebarTab: nav.activeSidebarTab,
          currentFolderId: nav.currentFolderId,
          searchQuery: "",
          typeFilter,
          sortField,
          sortOrder,
          trashFolderId,
        });

  const isFolderLoading =
    filesLoading ||
    (isPaginatedTab && (!pagination.loaded || pagination.loading) && listItems.length === 0) ||
    (isSharedOutTab && (!sharedOutLoaded || sharedOutLoading) && listItems.length === 0);

  const viewSkeleton =
    viewMode === "list" ? <ListSkeleton /> : viewMode === "tiles" ? <TilesSkeleton /> : <GridSkeleton />;

  const viewerSiblings = search.isSearching ? search.results.map((r) => r.item) : listItems;

  const selection = useFileSelection({ listItems, onOpenItem: (item) => handleItemDoubleClick(item) });
  const checkedItems = files.filter((f) => selection.checkedItemIds.includes(f.id));
  // On touch, long-press means "select" (useFileSelection); ignore the browser's long-press context menu.
  const openItemMenu = (item: FileItem, e: React.MouseEvent) => {
    if (selection.isMobile) e.preventDefault();
    else menus.openItemContextMenu(item, e);
  };

  useEffect(() => {
    selection.resetSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.currentFolderId, nav.activeSidebarTab]);

  const marquee = useMarqueeSelection({
    container: scrollContainer,
    checkedItemIds: selection.checkedItemIds,
    onSelectionChange: selection.setCheckedItemIds,
  });

  const fileActions = useFileActions({
    files,
    currentFolderId: nav.currentFolderId,
    fileSystem: {
      createFolder,
      renameItem,
      trashItems,
      restoreItems,
      permanentDeleteItems,
      deleteFileVersion,
      moveItems,
      updateFileContent,
    },
    enqueueFiles,
    showToast,
    logout,
    closeContextMenu: menus.closeContextMenu,
    clearSelection: selection.clearSelection,
    setCheckedItemIds: selection.setCheckedItemIds,
  });

  const versionHistory = useVersionHistory({ files, showToast, closeContextMenu: menus.closeContextMenu });
  const shareSettings = useShareSettings({ closeContextMenu: menus.closeContextMenu });
  const [editingShareLink, setEditingShareLink] = useState<ExternalShare | null>(null);

  const dnd = useDragAndDrop({
    checkedItemIds: selection.checkedItemIds,
    moveItems,
    showToast,
    onDropFiles: fileActions.handleUploadFiles,
  });

  function openFolder(folderId: string) {
    nav.navigateToFolder(folderId);
    selection.clearSelection();
    search.setSearchQuery("");
  }

  // Ancestors aren't resolvable yet (no folder-by-id endpoint), so the breadcrumb shows only the target.
  function openSharedLinkFolder(folderId: string) {
    nav.openPath("drive", [folderId]);
    selection.clearSelection();
    search.setSearchQuery("");
  }

  function goToBreadcrumb(index: number) {
    nav.navigateBackTo(index);
    selection.clearSelection();
    search.setSearchQuery("");
  }

  // Recipient-facing link; grants no access by itself.
  async function handleCopyShareLink(item: FileItem) {
    const url = `${window.location.origin}${buildAppRoute("shared", [item.id])}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied — only people you've shared this with can open it", "success");
    } catch {
      showToast("Couldn't copy the link to your clipboard", "error");
    }
  }

  function handleItemDoubleClick(item: FileItem) {
    if (nav.activeSidebarTab === "shared-out") {
      if (item.isFolder) {
        openSharedLinkFolder(item.id);
      } else {
        setViewerItem(item);
      }
      return;
    }
    if (item.isFolder) {
      openFolder(item.id);
    } else {
      setViewerItem(item);
    }
  }

  useKeyboardShortcuts({
    enabled:
      isAuthenticated &&
      !viewerItem &&
      !fileActions.activeModal &&
      !fileActions.renameTarget &&
      !fileActions.moveCopyState &&
      !fileActions.pendingConfirm &&
      !versionHistory.versionHistoryItemId &&
      !shareSettings.shareItemId,
    onDelete: () => {
      const ids = selection.checkedItemIds.length > 0 ? selection.checkedItemIds : selection.selectedItemId ? [selection.selectedItemId] : [];
      if (ids.length === 0) return;
      if (nav.activeSidebarTab === "trash") fileActions.requestPermanentDelete(ids);
      else fileActions.requestTrash(ids);
    },
    onEnter: () => {
      if (!selection.selectedItemId) return;
      const item = files.find((f) => f.id === selection.selectedItemId);
      if (!item) return;
      handleItemDoubleClick(item);
    },
    onEscape: () => {
      selection.clearSelection();
      selection.setCheckedItemIds([]);
      menus.dismissAll();
    },
  });

  // Falls back to the SSO login snapshot until GET /user/quota lands.
  const { quota, refetchQuota, refetching: refetchingQuota } = useMyQuota();
  const storage = getStorageQuota(user?.quota_allocated, quota ? quota.used_storage_bytes / GB : user?.quota_utilized);
  const handleRefetchQuota = () => {
    refetchQuota().catch(() => {});
  };

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
    return <LoginScreen errorMsg={errorMsg} ssoPending={sso.ssoPending} isLogoutParam={sso.isLogoutParam} onLogin={sso.handleManualLogin} />;
  }

  const selectedItem = files.find((f) => f.id === selection.selectedItemId);

  const renderItemContextMenu = (item: FileItem) => (
    <ItemContextMenu
      item={item}
      permissions={getSharedPermissions(item.id)}
      onOpen={() => {
        menus.closeContextMenu();
        handleItemDoubleClick(item);
      }}
      onDownload={(format) => fileActions.handleDownload(item, format)}
      onRename={() => fileActions.openRenameModal(item)}
      onMove={() => fileActions.openMoveModal(selection.checkedItemIds.includes(item.id) ? selection.checkedItemIds : [item.id])}
      onVersionHistory={() => versionHistory.openVersionHistory(item)}
      onShare={() => shareSettings.openShareModal(item)}
      onCopyLink={
        isSharedOutTab
          ? () => {
              menus.closeContextMenu();
              handleCopyShareLink(item);
            }
          : undefined
      }
      onSetColor={(color) => setFolderStyle(item.id, { color })}
      onSetIcon={(icon) => setFolderStyle(item.id, { icon })}
      onTrash={() => fileActions.requestTrash([item.id])}
      onRestore={() => fileActions.handleRestore([item.id])}
      onPermanentDelete={() => fileActions.requestPermanentDelete([item.id])}
    />
  );

  return (
    <div className="flex w-screen h-screen bg-bg-main text-text-main overflow-hidden font-sans" onClick={menus.dismissAll}>
      <UserSettingsBridge />
      {mobileNavOpen && (
        <div
          className="hidden max-[768px]:block fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeTab={nav.activeSidebarTab}
        onTabChange={(tab) => {
          nav.switchTab(tab);
          selection.clearSelection();
        }}
        onCreateFolder={fileActions.openCreateFolderModal}
        onUploadFiles={(fl) => fileActions.handleUploadFiles(fl, nav.currentFolderId)}
        canCreateHere={canCreateHere}
        isRootFolder={nav.currentFolderId === null}
        storagePercentage={storage.percent}
        storageUsedLabel={storage.usedLabel}
        storageTotalLabel={storage.totalLabel}
        storageFileCount={quota?.used_file_count}
        onRefreshQuota={handleRefetchQuota}
        refreshingQuota={refetchingQuota}
        user={user}
        onRequestLogout={fileActions.requestLogout}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-bg-main">
        <TopBar
          searchQuery={search.searchQuery}
          onSearchChange={search.setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          gridSize={gridSize}
          onGridSizeChange={setGridSize}
          onMenuClick={() => setMobileNavOpen(true)}
        />

        <div className="flex-1 flex overflow-hidden relative">
        <UploadDropzone
          onDropFiles={(items) => {
            if (!canCreateHere) {
              showToast("You don't have permission to add files to this folder", "error");
              return;
            }
            enqueueFiles(items, nav.currentFolderId);
          }}
        >
          <div
            ref={setScrollContainer}
              className="flex-1 overflow-y-auto px-5 py-4 pb-10 flex flex-col gap-4 max-[768px]:px-3"
              onClick={() => {
                selection.clearSelection();
                menus.closeContextMenu();
              }}
              onContextMenu={menus.openCanvasContextMenu}
              onMouseDown={marquee.onMouseDown}
            >
              {nav.activeSidebarTab === "shared-links" ? (
                (!sharedLinksLoaded || sharedLinksLoading) && sharedLinks.length === 0 ? (
                  viewSkeleton
                ) : (
                  <SharedLinksList links={sharedLinks} onRevoke={revokeSharedLink} onEdit={setEditingShareLink} />
                )
              ) : search.isSearching ? (
                <SearchResultsList
                  results={search.results}
                  files={files}
                  isSearchingContent={search.isSearchingContent}
                  query={search.searchQuery}
                  contextMenuId={menus.contextMenuId}
                  onContextMenuToggle={menus.setContextMenuId}
                  onItemContextMenu={openItemMenu}
                  renderContextMenu={renderItemContextMenu}
                  onOpenItem={(item) => {
                    if (item.isFolder) {
                      if (!item.isDeleted) openFolder(item.id);
                    } else {
                      setViewerItem(item);
                    }
                  }}
                />
              ) : (
                <>
                  <FilterSortBar
                    breadcrumbSegments={nav.getBreadcrumbSegments(files)}
                    onBreadcrumbNavigate={goToBreadcrumb}
                    activeSidebarTab={nav.activeSidebarTab}
                    checkedCount={selection.checkedItemIds.length}
                    sortField={sortField}
                    onSortFieldChange={setSortField}
                    sortOrder={sortOrder}
                    onToggleSortOrder={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    onRefresh={handleRefresh}
                    refreshing={refreshing}
                    onClearSelection={() => selection.setCheckedItemIds([])}
                    onBatchTrash={() => fileActions.requestTrash(selection.checkedItemIds)}
                    onBatchRestore={() => fileActions.handleRestore(selection.checkedItemIds)}
                    onBatchPermanentDelete={() => fileActions.requestPermanentDelete(selection.checkedItemIds)}
                    onBatchDownload={() => fileActions.handleBatchDownload(selection.checkedItemIds)}
                    downloadBlockedReason={
                      checkedItems.length > 0 && !checkedItems.some(canDownloadItem)
                        ? "Selected files are still processing or failed"
                        : null
                    }
                    changeBlockedReason={
                      checkedItems.length > 0 && checkedItems.every((f) => itemBusyReason(f))
                        ? "Selected files are locked or still processing"
                        : null
                    }
                  />

                  {isFolderLoading ? (
                    viewSkeleton
                  ) : listItems.length === 0 ? (
                    nav.activeSidebarTab === "trash" && !nav.currentFolderId ? (
                      <EmptyState
                        icon={<Trash2 className="w-14 h-14 mb-4 opacity-50 text-neutral-400" />}
                        title="Trash is Empty"
                        description="Items moved to trash will appear here."
                      />
                    ) : (
                      <EmptyState />
                    )
                  ) : viewMode === "list" ? (
                    <FileListTable
                      items={listItems}
                      selectedItemId={selection.selectedItemId}
                      checkedItemIds={selection.checkedItemIds}
                      contextMenuId={menus.contextMenuId}
                      dragOverFolderId={dnd.dragOverFolderId}
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSortFieldChange={setSortField}
                      onToggleSortOrder={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                      onItemClick={selection.handleItemClick}
                      onCheckboxToggle={selection.handleCheckboxToggle}
                      onSelectAllToggle={selection.handleSelectAllToggle}
                      onContextMenuToggle={menus.setContextMenuId}
                      onItemContextMenu={openItemMenu}
                      renderContextMenu={renderItemContextMenu}
                      onShare={shareSettings.openShareModal}
                      onCopyLink={isSharedOutTab ? handleCopyShareLink : undefined}
                      onDragStartItem={dnd.handleDragStartItem}
                      onDragOverFolder={dnd.handleDragOverFolder}
                      onDragLeaveFolder={dnd.handleDragLeaveFolder}
                      onDropOnFolder={dnd.handleDropOnFolder}
                      getItemPressHandlers={selection.getItemPressHandlers}
                    />
                  ) : viewMode === "tiles" ? (
                    <FileTiles
                      items={listItems}
                      selectedItemId={selection.selectedItemId}
                      checkedItemIds={selection.checkedItemIds}
                      contextMenuId={menus.contextMenuId}
                      dragOverFolderId={dnd.dragOverFolderId}
                      onItemClick={selection.handleItemClick}
                      onCheckboxToggle={selection.handleCheckboxToggle}
                      onContextMenuToggle={menus.setContextMenuId}
                      onItemContextMenu={openItemMenu}
                      renderContextMenu={renderItemContextMenu}
                      onDragStartItem={dnd.handleDragStartItem}
                      onDragOverFolder={dnd.handleDragOverFolder}
                      onDragLeaveFolder={dnd.handleDragLeaveFolder}
                      onDropOnFolder={dnd.handleDropOnFolder}
                      getItemPressHandlers={selection.getItemPressHandlers}
                    />
                  ) : (
                    <FileGrid
                      items={listItems}
                      gridSize={gridSize}
                      selectedItemId={selection.selectedItemId}
                      checkedItemIds={selection.checkedItemIds}
                      contextMenuId={menus.contextMenuId}
                      dragOverFolderId={dnd.dragOverFolderId}
                      onItemClick={selection.handleItemClick}
                      onCheckboxToggle={selection.handleCheckboxToggle}
                      onContextMenuToggle={menus.setContextMenuId}
                      onItemContextMenu={openItemMenu}
                      renderContextMenu={renderItemContextMenu}
                      onDragStartItem={dnd.handleDragStartItem}
                      onDragOverFolder={dnd.handleDragOverFolder}
                      onDragLeaveFolder={dnd.handleDragLeaveFolder}
                      onDropOnFolder={dnd.handleDropOnFolder}
                      getItemPressHandlers={selection.getItemPressHandlers}
                    />
                  )}

                  {isPaginatedTab && !isFolderLoading && pagination.loading && (
                    <div className="flex justify-center py-4">
                      <div className="w-5 h-5 border-2 border-border-main border-t-accent rounded-full animate-spin" />
                    </div>
                  )}
                </>
              )}
            </div>
        </UploadDropzone>

        {marquee.marqueeRect && (
          <div
            className="fixed z-[80] border border-accent bg-accent-bg/60 pointer-events-none"
            style={{
              left: marquee.marqueeRect.left,
              top: marquee.marqueeRect.top,
              width: marquee.marqueeRect.width,
              height: marquee.marqueeRect.height,
            }}
          />
        )}

        {selectedItem && (
          <DetailsDrawer
            item={selectedItem}
            files={files}
            pathLabel={getItemPath(files, selectedItem)}
            permissions={selectedItem.sharedIn?.permissions ?? getSharedPermissions(selectedItem.id)}
            onClose={selection.clearSelection}
            onOpenFull={() => setViewerItem(selectedItem)}
            onDownload={(format) => fileActions.handleDownload(selectedItem, format)}
            onRename={() => fileActions.openRenameModal(selectedItem)}
            onMove={() => fileActions.openMoveModal([selectedItem.id])}
            onVersionHistory={() => versionHistory.openVersionHistory(selectedItem)}
            onShare={() => shareSettings.openShareModal(selectedItem)}
            onTrash={() => fileActions.requestTrash([selectedItem.id])}
            onRestore={() => fileActions.handleRestore([selectedItem.id])}
            onSaveDescription={(text) => setItemDescription(selectedItem.id, text)}
          />
        )}
        </div>
      </main>

      {menus.canvasContextMenu && (
        <CanvasContextMenu
          x={menus.canvasContextMenu.x}
          y={menus.canvasContextMenu.y}
          canCreateHere={canCreateHere}
          onCreateFolder={() => {
            fileActions.openCreateFolderModal();
            menus.setCanvasContextMenu(null);
          }}
          onUploadFile={() => {
            if (nav.currentFolderId === null) {
              showToast("Open or create a folder to upload files — My Drive can't hold files directly", "error");
              menus.setCanvasContextMenu(null);
              return;
            }
            canvasFileInputRef.current?.click();
            menus.setCanvasContextMenu(null);
          }}
          onUploadFolder={() => {
            canvasFolderInputRef.current?.click();
            menus.setCanvasContextMenu(null);
          }}
          onRefresh={() => {
            handleRefresh();
            menus.setCanvasContextMenu(null);
          }}
        />
      )}
      <input
        type="file"
        ref={canvasFileInputRef}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) fileActions.handleUploadFiles(e.target.files, nav.currentFolderId);
          e.target.value = "";
        }}
        style={{ display: "none" }}
        multiple
      />
      {/* webkitdirectory isn't in React's input types, so it's set via the ref. */}
      <input
        type="file"
        ref={(el) => {
          canvasFolderInputRef.current = el;
          if (el) el.setAttribute("webkitdirectory", "");
        }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) fileActions.handleUploadFiles(e.target.files, nav.currentFolderId);
          e.target.value = "";
        }}
        style={{ display: "none" }}
        multiple
      />

      {fileActions.activeModal === "createFolder" && (
        <CreateFolderModal onCancel={fileActions.closeCreateFolderModal} onCreate={fileActions.handleCreateFolderConfirm} />
      )}

      {fileActions.renameTarget && (
        <RenameModal currentName={fileActions.renameTarget.name} onCancel={fileActions.closeRenameModal} onRename={fileActions.handleRenameConfirm} />
      )}

      {fileActions.moveCopyState && (
        <MoveCopyModal
          files={files}
          mode={fileActions.moveCopyState.mode}
          sourceIds={fileActions.moveCopyState.ids}
          currentParentId={nav.currentFolderId}
          trashFolderId={trashFolderId}
          onCancel={fileActions.closeMoveCopyModal}
          onConfirm={fileActions.handleMoveCopyConfirm}
        />
      )}

      {versionHistory.item && (
        <VersionHistoryModal
          item={versionHistory.item}
          latestVersion={versionHistory.latestVersion}
          olderVersions={versionHistory.olderVersions}
          loading={versionHistory.isLoadingVersions}
          onClose={versionHistory.closeVersionHistory}
          onDownloadVersion={versionHistory.handleDownloadVersion}
          onDeleteVersion={(v) =>
            fileActions.requestDeleteVersion(
              versionHistory.item!,
              v,
              v === versionHistory.latestVersion && versionHistory.olderVersions.length === 0
            )
          }
          permissions={getSharedPermissions(versionHistory.item.id)}
        />
      )}

      {shareSettings.shareItemId &&
        (() => {
          const shareItem = files.find((f) => f.id === shareSettings.shareItemId);
          if (!shareItem) return null;
          return (
            <ShareModal item={shareItem} onClose={shareSettings.closeShareModal} />
          );
        })()}

      {editingShareLink && (
        <EditShareLinkModal share={editingShareLink} onClose={() => setEditingShareLink(null)} />
      )}

      {fileActions.pendingConfirm && (
        <ConfirmModal
          title={fileActions.pendingConfirm.title}
          description={fileActions.pendingConfirm.description}
          confirmLabel={fileActions.pendingConfirm.confirmLabel}
          destructive={fileActions.pendingConfirm.destructive}
          onCancel={fileActions.closeConfirm}
          onConfirm={fileActions.pendingConfirm.onConfirm}
        />
      )}

      {viewerItem && (
        <ViewerModal
          item={viewerItem}
          siblings={viewerSiblings}
          onClose={() => setViewerItem(null)}
          onNavigate={setViewerItem}
          onDownload={fileActions.handleDownload}
          onSaveContent={fileActions.handleSaveContent}
          permissions={getSharedPermissions(viewerItem.id)}
        />
      )}

      <ToastContainer />
      <div className="fixed bottom-5 right-5 z-[1900] w-full max-w-sm flex flex-col gap-3 max-[480px]:right-3 max-[480px]:left-3 max-[480px]:w-auto">
        <DownloadTray />
        <UploadTray />
      </div>
    </div>
  );
}

export default App;
