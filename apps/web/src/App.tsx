import { useEffect, useRef, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useFileSystem } from "./hooks/useFileSystem";
import { useToast } from "./atoms/toast";
import { useUploadQueue } from "./hooks/useUploadQueue";
import { useUserSettings } from "./hooks/useUserSettings";
import { UserSettingsBridge } from "./components/UserSettingsBridge";
import "./App.css";

import type { FileItem } from "./types/file";
import { getFilteredSortedItems, getItemPath } from "./utils/fileQueries";
import { getStorageQuota } from "./utils/format";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useSsoAutoLogin } from "./hooks/useSsoAutoLogin";
import { useContextMenuState } from "./hooks/useContextMenuState";
import { useFileNavigation } from "./hooks/useFileNavigation";
import { useFileSelection } from "./hooks/useFileSelection";
import { useFileActions } from "./hooks/useFileActions";
import { useVersionHistory } from "./hooks/useVersionHistory";
import { useShareSettings } from "./hooks/useShareSettings";
import { useDragAndDrop } from "./hooks/useDragAndDrop";
import { useFileSearch } from "./hooks/useFileSearch";

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
import { ViewerModal } from "./components/viewers/ViewerModal";
import { UploadDropzone } from "./components/upload/UploadDropzone";
import { UploadTray } from "./components/upload/UploadTray";

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
    toggleStar,
    starItems,
    setFolderStyle,
    trashItems,
    restoreItems,
    permanentDeleteItems,
    moveItems,
    copyItem,
    updateFileContent,
  } = useFileSystem();
  const { showToast } = useToast();
  const { enqueueFiles } = useUploadQueue();

  // View preferences are server-backed (private_info) via UserSettingsBridge, so
  // they follow the user across devices; they fall back to defaults until loaded.
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
  // Type filtering was driven from the sidebar's "File Type" menu, which has been removed.
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

  // In a "Shared with me" folder, adding items needs the share's can_create.
  const currentFolderPerms = getSharedPermissions(nav.currentFolderId);
  const canCreateHere = !currentFolderPerms || currentFolderPerms.can_create;
  const search = useFileSearch({
    files,
    activeSidebarTab: nav.activeSidebarTab,
    currentFolderId: nav.currentFolderId,
    typeFilter,
    trashFolderId,
  });

    // A page load that starts deep inside a folder path (a refresh, or a bookmarked
  // URL — see useFileNavigation/utils/appRoute) only has the leaf folder id; `files`
  // doesn't yet contain its ancestors. That's merely cosmetic for a "drive" path
  // (breadcrumb names fill in once loaded), but for a "shared with me" path it's
  // load-bearing: fetchFolderPage's shared-context detection walks parentId links
  // already in `files` to route the request through the share endpoint, so the
  // ancestor chain has to be loaded in order, root-first, before the leaf. While
  // that's in flight `restoringSharedRoute` tells the effect below to hold off on
  // loading the leaf itself.
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
      // Best-effort breadcrumb hydration for a deep-linked drive/starred/etc path —
      // the leaf's own content loads via the effect below regardless.
      (async () => {
        for (const id of ancestorIds) await loadFolder(id);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Pull the current folder's children from YFS-Main-API whenever navigation changes.
  useEffect(() => {
    if (!isAuthenticated) return;
    const tab = nav.activeSidebarTab;
    // "Shared with me" root lists the shared folders; opening one lists its children
    // through the share endpoint (handled inside loadFolder).
    if (tab === "shared" && !nav.currentFolderId) loadSharedFolders();
    else if (tab === "shared-out") loadSharedOut({ force: true });
    else if (tab === "shared-links") loadSharedLinks({ force: true });
    else if (tab === "trash") {
      if (trashFolderId) loadFolder(trashFolderId, { force: true });
    } else if (restoringSharedRoute) {
      // The hydration effect above owns loading this chain in order; it flips
      // restoringSharedRoute to false once the ancestors are in, which re-runs this
      // effect and falls through to the branch below for the leaf.
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

  // Re-fetch whatever's currently showing, bypassing cache — mirrors the load
  // effect above's per-tab branching.
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const tab = nav.activeSidebarTab;
      if (tab === "shared" && !nav.currentFolderId) await loadSharedFolders({ force: true });
      else if (tab === "shared-out") await loadSharedOut({ force: true });
      else if (tab === "shared-links") await loadSharedLinks({ force: true });
      else if (tab === "trash") {
        if (trashFolderId) await loadFolder(trashFolderId, { force: true });
      } else await loadFolder(nav.currentFolderId, { force: true });
    } finally {
      setRefreshing(false);
    }
  };

  // Infinite scroll — only the server-backed listings ("drive" folders, the
  // "shared with me" bucket, and trash) page; the other tabs are client-side filters.
  const isSharedTab = nav.activeSidebarTab === "shared";
  const isSharedRoot = isSharedTab && !nav.currentFolderId;
  const isTrashTab = nav.activeSidebarTab === "trash";
  const isPaginatedTab = isSharedTab || nav.activeSidebarTab === "drive" || isTrashTab;
  const paginationParentId = isTrashTab ? trashFolderId : nav.currentFolderId;
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
          if (trashFolderId) loadMoreFolder(trashFolderId);
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
    trashFolderId,
    loadMoreSharedFolders,
    loadMoreFolder,
    nav.currentFolderId,
  ]);

  // Surface a one-time notice if the file service can't be reached.
  useEffect(() => {
    if (remoteError) showToast(`File service unavailable — showing cached data. (${remoteError})`, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteError]);

  // Normal folder browsing only — while a search is active, SearchResultsList renders
  // instead (it owns its own combined name+content match list), so search.searchQuery is
  // deliberately not threaded in here.
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

  // Prev/next in the full-screen viewer should step through whatever the user was actually
  // looking at — search results if a search is active, the current folder listing otherwise.
  const viewerSiblings = search.isSearching ? search.results.map((r) => r.item) : listItems;

  const selection = useFileSelection({ listItems, onOpenItem: (item) => handleItemDoubleClick(item) });

  const fileActions = useFileActions({
    files,
    currentFolderId: nav.currentFolderId,
    fileSystem: { createFolder, renameItem, toggleStar, starItems, trashItems, restoreItems, permanentDeleteItems, moveItems, copyItem, updateFileContent },
    enqueueFiles,
    showToast,
    logout,
    closeContextMenu: menus.closeContextMenu,
    clearSelection: selection.clearSelection,
    setCheckedItemIds: selection.setCheckedItemIds,
  });

  const versionHistory = useVersionHistory({ files, showToast, closeContextMenu: menus.closeContextMenu });
  const shareSettings = useShareSettings({ closeContextMenu: menus.closeContextMenu });

  const dnd = useDragAndDrop({
    checkedItemIds: selection.checkedItemIds,
    moveItems,
    showToast,
    onDropFiles: fileActions.handleUploadFiles,
  });

  // Folder navigation and breadcrumb navigation both clear the current selection and any
  // in-progress search, since neither carries over to a different listing.
  function openFolder(folderId: string) {
    nav.navigateToFolder(folderId);
    selection.clearSelection();
    search.setSearchQuery("");
  }

  // Opening a folder from "Shared by link" jumps straight to My Drive regardless of
  // whatever tab/path was active — it's one of my own folders, just reached via a
  // link rather than by browsing there.
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

  function handleItemDoubleClick(item: FileItem) {
    // In "Shared by you", double-clicking navigates into the folder (in My Drive) or previews the file,
    // matching standard file manager behavior. Sharing remains accessible via context menu and details drawer.
    if (nav.activeSidebarTab === "shared-out") {
      if (item.isFolder) {
        openSharedLinkFolder(item.id);
      } else {
        setViewerItem(item);
      }
      return;
    }
    if (item.isFolder) {
      if (!item.isDeleted) openFolder(item.id);
    } else {
      setViewerItem(item);
    }
  }

  // --- Keyboard shortcuts ---
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

  // --- Storage --- (from the API's account quota, not a client-side file tally)
  const storage = getStorageQuota(user?.quota_allocated, user?.quota_utilized);

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
      onDownload={() => fileActions.handleDownload(item)}
      onToggleStar={() => fileActions.handleToggleStar(item.id)}
      onRename={() => fileActions.openRenameModal(item)}
      onMove={() => fileActions.openMoveModal(selection.checkedItemIds.includes(item.id) ? selection.checkedItemIds : [item.id])}
      onCopy={() => fileActions.openCopyModal(selection.checkedItemIds.includes(item.id) ? selection.checkedItemIds : [item.id])}
      onVersionHistory={() => versionHistory.openVersionHistory(item)}
      onShare={() => shareSettings.openShareModal(item)}
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
        <UploadDropzone onDropFiles={(items) => enqueueFiles(items, nav.currentFolderId)}>
          <div
            ref={setScrollContainer}
              className="flex-1 overflow-y-auto px-5 py-4 pb-10 flex flex-col gap-4 max-[768px]:px-3"
              onClick={() => {
                selection.clearSelection();
                menus.closeContextMenu();
              }}
              onContextMenu={menus.openCanvasContextMenu}
            >
              {nav.activeSidebarTab === "shared-links" ? (
                (!sharedLinksLoaded || sharedLinksLoading) && sharedLinks.length === 0 ? (
                  viewSkeleton
                ) : (
                  <SharedLinksList 
                    links={sharedLinks} 
                    onRevoke={revokeSharedLink} 
                    onOpenFolder={openSharedLinkFolder}
                  />
                )
              ) : search.isSearching ? (
                <SearchResultsList
                  results={search.results}
                  files={files}
                  isSearchingContent={search.isSearchingContent}
                  query={search.searchQuery}
                  contextMenuId={menus.contextMenuId}
                  onContextMenuToggle={menus.setContextMenuId}
                  onItemContextMenu={menus.openItemContextMenu}
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
                    onBatchStar={() => fileActions.handleBatchStar(selection.checkedItemIds)}
                    onBatchTrash={() => fileActions.requestTrash(selection.checkedItemIds)}
                    onBatchRestore={() => fileActions.handleRestore(selection.checkedItemIds)}
                    onBatchPermanentDelete={() => fileActions.requestPermanentDelete(selection.checkedItemIds)}
                    onBatchDownload={() => fileActions.handleBatchDownload(selection.checkedItemIds)}
                  />

                  {isFolderLoading ? (
                    viewSkeleton
                  ) : listItems.length === 0 ? (
                    <EmptyState />
                  ) : viewMode === "list" ? (
                    <FileListTable
                      items={listItems}
                      selectedItemId={selection.selectedItemId}
                      checkedItemIds={selection.checkedItemIds}
                      contextMenuId={menus.contextMenuId}
                      dragOverFolderId={dnd.dragOverFolderId}
                      onItemClick={selection.handleItemClick}
                      onCheckboxToggle={selection.handleCheckboxToggle}
                      onSelectAllToggle={selection.handleSelectAllToggle}
                      onContextMenuToggle={menus.setContextMenuId}
                      onItemContextMenu={menus.openItemContextMenu}
                      renderContextMenu={renderItemContextMenu}
                      onDragStartItem={dnd.handleDragStartItem}
                      onDragOverFolder={dnd.handleDragOverFolder}
                      onDragLeaveFolder={dnd.handleDragLeaveFolder}
                      onDropOnFolder={dnd.handleDropOnFolder}
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
                      onItemContextMenu={menus.openItemContextMenu}
                      renderContextMenu={renderItemContextMenu}
                      onDragStartItem={dnd.handleDragStartItem}
                      onDragOverFolder={dnd.handleDragOverFolder}
                      onDragLeaveFolder={dnd.handleDragLeaveFolder}
                      onDropOnFolder={dnd.handleDropOnFolder}
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
                      onItemContextMenu={menus.openItemContextMenu}
                      renderContextMenu={renderItemContextMenu}
                      onDragStartItem={dnd.handleDragStartItem}
                      onDragOverFolder={dnd.handleDragOverFolder}
                      onDragLeaveFolder={dnd.handleDragLeaveFolder}
                      onDropOnFolder={dnd.handleDropOnFolder}
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

        {selectedItem && (
          <DetailsDrawer
            item={selectedItem}
            files={files}
            pathLabel={getItemPath(files, selectedItem)}
            permissions={getSharedPermissions(selectedItem.id)}
            onClose={selection.clearSelection}
            onOpenFull={() => setViewerItem(selectedItem)}
            onDownload={() => fileActions.handleDownload(selectedItem)}
            onToggleStar={() => fileActions.handleToggleStar(selectedItem.id)}
            onRename={() => fileActions.openRenameModal(selectedItem)}
            onMove={() => fileActions.openMoveModal([selectedItem.id])}
            onCopy={() => fileActions.openCopyModal([selectedItem.id])}
            onVersionHistory={() => versionHistory.openVersionHistory(selectedItem)}
            onShare={() => shareSettings.openShareModal(selectedItem)}
            onTrash={() => fileActions.requestTrash([selectedItem.id])}
            onRestore={() => fileActions.handleRestore([selectedItem.id])}
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
      {/* webkitdirectory is non-standard and not part of React's typed input props, so it's
          set imperatively via the ref callback rather than as a JSX attribute. */}
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
      <UploadTray />
    </div>
  );
}

export default App;
