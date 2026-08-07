import { useRef, useState } from "react";
import { useAuth } from "./context/AuthContext";
import { useFileSystem } from "./context/FileSystemContext";
import { useToast } from "./context/ToastContext";
import { useUploadQueue } from "./context/UploadQueueContext";
import "./App.css";

import type { FileItem, ViewMode, SortField, SortOrder } from "./types/file";
import { getFilteredSortedItems, getItemPath } from "./utils/fileQueries";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useSsoAutoLogin } from "./hooks/useSsoAutoLogin";
import { useSystemDiagnostics } from "./hooks/useSystemDiagnostics";
import { useContextMenuState } from "./hooks/useContextMenuState";
import { useFileNavigation } from "./hooks/useFileNavigation";
import { useFileSelection } from "./hooks/useFileSelection";
import { useFileActions } from "./hooks/useFileActions";
import { useVersionHistory } from "./hooks/useVersionHistory";
import { useShareSettings } from "./hooks/useShareSettings";
import { useDragAndDrop } from "./hooks/useDragAndDrop";

import { LoginScreen } from "./components/auth/LoginScreen";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { Breadcrumbs } from "./components/layout/Breadcrumbs";
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

function App() {
  const { user, token, isAuthenticated, isLoading: authLoading, errorMsg, loginWithSso, logout, clearError } = useAuth();
  const {
    files,
    isLoading: filesLoading,
    createFolder,
    renameItem,
    toggleStar,
    starItems,
    trashItems,
    restoreItems,
    permanentDeleteItems,
    moveItems,
    copyItem,
    updateFileContent,
    restoreVersion,
    setShareSettings,
    clearShareSettings,
  } = useFileSystem();
  const { showToast } = useToast();
  const { enqueueFiles } = useUploadQueue();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [viewerItem, setViewerItem] = useState<FileItem | null>(null);

  const canvasFileInputRef = useRef<HTMLInputElement>(null);

  const sso = useSsoAutoLogin({ isAuthenticated, authLoading, loginWithSso, clearError });
  const diagnostics = useSystemDiagnostics(token);
  const menus = useContextMenuState();
  const nav = useFileNavigation();

  const listItems = getFilteredSortedItems(files, {
    activeSidebarTab: nav.activeSidebarTab,
    currentFolderId: nav.currentFolderId,
    searchQuery,
    typeFilter,
    sortField,
    sortOrder,
  });

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

  const versionHistory = useVersionHistory({ files, restoreVersion, showToast, closeContextMenu: menus.closeContextMenu });
  const shareSettings = useShareSettings({ setShareSettings, clearShareSettings, showToast, closeContextMenu: menus.closeContextMenu });

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
    setSearchQuery("");
  }

  function goToBreadcrumb(index: number) {
    nav.navigateBackTo(index);
    selection.clearSelection();
    setSearchQuery("");
  }

  function handleItemDoubleClick(item: FileItem) {
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
    return <LoginScreen errorMsg={errorMsg} ssoPending={sso.ssoPending} isLogoutParam={sso.isLogoutParam} onLogin={sso.handleManualLogin} />;
  }

  const selectedItem = files.find((f) => f.id === selection.selectedItemId);

  const renderItemContextMenu = (item: FileItem) => (
    <ItemContextMenu
      item={item}
      onDownload={() => fileActions.handleDownload(item)}
      onToggleStar={() => fileActions.handleToggleStar(item.id)}
      onRename={() => fileActions.openRenameModal(item)}
      onMove={() => fileActions.openMoveModal(selection.checkedItemIds.includes(item.id) ? selection.checkedItemIds : [item.id])}
      onCopy={() => fileActions.openCopyModal(selection.checkedItemIds.includes(item.id) ? selection.checkedItemIds : [item.id])}
      onVersionHistory={() => versionHistory.openVersionHistory(item)}
      onShare={() => shareSettings.openShareModal(item)}
      onTrash={() => fileActions.requestTrash([item.id])}
      onRestore={() => fileActions.handleRestore([item.id])}
      onPermanentDelete={() => fileActions.requestPermanentDelete([item.id])}
    />
  );

  return (
    <div className="flex w-screen h-screen bg-bg-main text-text-main overflow-hidden font-sans" onClick={menus.dismissAll}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        activeTab={nav.activeSidebarTab}
        onTabChange={(tab) => {
          nav.switchTab(tab);
          selection.clearSelection();
        }}
        onCreateFolder={fileActions.openCreateFolderModal}
        onUploadFiles={(fl) => fileActions.handleUploadFiles(fl, nav.currentFolderId)}
        storagePercentage={storagePercentage}
        totalStorageUtilized={totalStorageUtilized}
        totalStorageAllocated={totalStorageAllocated}
        user={user}
        onRequestLogout={fileActions.requestLogout}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
      />

      <main className="flex-1 flex flex-col overflow-hidden bg-bg-main">
        <TopBar
          isSystemView={nav.activeSidebarTab === "system"}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        <div className="flex-1 flex overflow-hidden relative">
        <UploadDropzone disabled={nav.activeSidebarTab === "system"} onDropFiles={(items) => enqueueFiles(items, nav.currentFolderId)}>
          {nav.activeSidebarTab === "system" ? (
            <SystemDashboard
              user={user}
              token={token}
              exampleMessage={diagnostics.exampleMessage}
              apiResponse={diagnostics.apiResponse}
              apiLoading={diagnostics.apiLoading}
              onTestApi={diagnostics.testAuthenticatedApi}
            />
          ) : (
            <div
              className="flex-1 overflow-y-auto px-8 py-6 pb-12 flex flex-col gap-6 max-[768px]:px-4"
              onClick={() => {
                selection.clearSelection();
                menus.closeContextMenu();
              }}
              onContextMenu={menus.openCanvasContextMenu}
            >
              <Breadcrumbs segments={nav.getBreadcrumbSegments(files)} onNavigate={goToBreadcrumb} />

              <FilterSortBar
                activeSidebarTab={nav.activeSidebarTab}
                checkedCount={selection.checkedItemIds.length}
                sortField={sortField}
                onSortFieldChange={setSortField}
                sortOrder={sortOrder}
                onToggleSortOrder={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
                onClearSelection={() => selection.setCheckedItemIds([])}
                onBatchStar={() => fileActions.handleBatchStar(selection.checkedItemIds)}
                onBatchTrash={() => fileActions.requestTrash(selection.checkedItemIds)}
                onBatchRestore={() => fileActions.handleRestore(selection.checkedItemIds)}
                onBatchPermanentDelete={() => fileActions.requestPermanentDelete(selection.checkedItemIds)}
                onBatchDownload={() => fileActions.handleBatchDownload(selection.checkedItemIds)}
              />

              {filesLoading ? (
                viewMode === "list" ? <ListSkeleton /> : <GridSkeleton />
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
              ) : (
                <FileGrid
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
              )}
            </div>
          )}
        </UploadDropzone>

        {selectedItem && nav.activeSidebarTab !== "system" && (
          <DetailsDrawer
            item={selectedItem}
            pathLabel={getItemPath(files, selectedItem)}
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
          onCreateFolder={() => {
            fileActions.openCreateFolderModal();
            menus.setCanvasContextMenu(null);
          }}
          onUploadFile={() => {
            canvasFileInputRef.current?.click();
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
          onCancel={fileActions.closeMoveCopyModal}
          onConfirm={fileActions.handleMoveCopyConfirm}
        />
      )}

      {versionHistory.versionHistoryItemId &&
        (() => {
          const versionHistoryItem = files.find((f) => f.id === versionHistory.versionHistoryItemId);
          if (!versionHistoryItem) return null;
          return (
            <VersionHistoryModal
              item={versionHistoryItem}
              onClose={versionHistory.closeVersionHistory}
              onRestore={versionHistory.handleRestoreVersion}
              onDownloadVersion={versionHistory.handleDownloadVersion}
            />
          );
        })()}

      {shareSettings.shareItemId &&
        (() => {
          const shareItem = files.find((f) => f.id === shareSettings.shareItemId);
          if (!shareItem) return null;
          return (
            <ShareModal item={shareItem} onClose={shareSettings.closeShareModal} onSave={shareSettings.handleSaveShare} onRevoke={shareSettings.handleRevokeShare} />
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
          siblings={listItems}
          onClose={() => setViewerItem(null)}
          onNavigate={setViewerItem}
          onDownload={fileActions.handleDownload}
          onSaveContent={fileActions.handleSaveContent}
        />
      )}

      <ToastContainer />
      <UploadTray />
    </div>
  );
}

export default App;
