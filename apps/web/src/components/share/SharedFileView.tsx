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

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  FileWarning,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Info,
  Loader2,
  Lock,
  LogOut,
  Pencil,
  ShieldAlert,
  File as FileIcon,
} from "lucide-react";
import type { BackendResource, PublicSession } from "@yfs/service";
import type { FileItem, GridSize, SortField, SortOrder, ViewMode } from "../../types/file";
import { categorizeByName } from "../../utils/fileType";
import { shortName } from "../../utils/format";
import { useFileSelection } from "../../hooks/useFileSelection";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";
import {
  useCreatePublicFolder,
  useCreatePublicSession,
  useMovePublicFolder,
  usePublicFolderChildren,
  usePublicLogout,
  usePublicSessionInfo,
  useRenamePublicFolder,
  useValidatePublicPassword,
} from "../../hooks/usePublicSession";
import { useToast } from "../../atoms/toast";
import { FileListTable } from "../files/FileListTable";
import { FileGrid } from "../files/FileGrid";
import { FileTiles } from "../files/FileTiles";
import { SelectionPill, SortControls, pillActionClass } from "../files/FilterSortBar";
import { Breadcrumbs, type BreadcrumbSegment } from "../layout/Breadcrumbs";
import { ViewModeToggle } from "../layout/ViewModeToggle";
import { ListSkeleton, GridSkeleton, TilesSkeleton } from "../common/Skeletons";
import { EmptyState } from "../common/EmptyState";
import { ToastContainer } from "../common/ToastContainer";
import { CreateFolderModal } from "../modals/CreateFolderModal";
import { RenameModal } from "../modals/RenameModal";
import { ShareAccessBadge, ShareNoteBanner } from "./ShareAccessBadge";
import { SharedDetailsPanel } from "./SharedDetailsPanel";
import { ShareGate, gatePrimaryButton, gateSecondaryButton } from "./ShareGate";

interface Crumb {
  id: string;
  name: string;
}

const VIEW_KEY = "yfs_share_view";
const GRID_SIZE_KEY = "yfs_share_grid_size";
const ROOT_NAME = "Shared folder";
const FILE_UNAVAILABLE = "Opening and downloading files from a shared link isn't available yet.";

const noop = () => {};

const readStored = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
};
const writeStored = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
};

// share_info is an owner-controlled JSONB blob; show a note if one's in there.
const shareNote = (session: PublicSession | null): string | null => {
  if (!session) return null;
  for (const k of ["note", "message", "description", "title"]) {
    const v = session.share_info[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
};

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

// The visitor can't resolve the owner, so owner stays blank (and the column is hidden).
const mapPublicResource = (r: BackendResource): FileItem => {
  const info = (r.resource_info ?? undefined) as { ui?: { color?: string; icon?: string } } | undefined;
  const base = {
    id: r.resource_id,
    name: r.resource_name,
    parentId: r.parent_folder_id ?? null,
    size: r.total_resource_size ?? 0,
    owner: { name: "", email: "" },
    modifiedAt: r.updated_at,
    createdAt: r.created_at,
    isDeleted: false,
    color: info?.ui?.color,
    icon: info?.ui?.icon,
    origin: "shared" as const,
  };
  if (r.is_resource_folder) return { ...base, isFolder: true, type: "folder" };
  const { type, extension } = categorizeByName(r.resource_name);
  return { ...base, isFolder: false, type, extension };
};

// Folders first, like the signed-in listing.
const sortItems = (items: FileItem[], field: SortField, order: SortOrder): FileItem[] => {
  const dir = order === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    let cmp = 0;
    if (field === "name") cmp = a.name.localeCompare(b.name, undefined, { numeric: true });
    else if (field === "size") cmp = a.size - b.size;
    else cmp = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
    return cmp * dir;
  });
};

export function SharedFileView() {
  const shareId = useMemo(() => {
    const match = window.location.pathname.match(/\/share\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }, []);

  const sessionMutation = useCreatePublicSession();
  useEffect(() => {
    if (shareId) sessionMutation.mutate(shareId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId]);
  const session = sessionMutation.data ?? null;
  const token = session?.public_session_token ?? "";

  const passwordMutation = useValidatePublicPassword();
  const [passwordInput, setPasswordInput] = useState("");
  const needsPassword = !!session?.is_password_protected && !passwordMutation.isSuccess;
  const needsOtp = !!session && (session.is_email_otp_protected || session.is_phone_otp_protected);
  const granted = !!session && !needsPassword && !needsOtp;

  const infoQuery = usePublicSessionInfo(token, granted);

  const submitPassword = () => {
    if (!token || !passwordInput || passwordMutation.isPending) return;
    passwordMutation.mutate({ token, password: passwordInput });
  };

  const logoutMutation = usePublicLogout();
  const exitShare = async () => {
    if (token) await logoutMutation.mutateAsync(token).catch(noop);
    window.location.assign(`/share-ended?from=${encodeURIComponent(shareId)}`);
  };

  useEffect(() => {
    document.title = "Shared folder · YFS";
  }, []);

  if (!shareId || sessionMutation.isError) {
    const msg = errorMessage(sessionMutation.error, "").toLowerCase();
    const expired = msg.includes("expired");
    if (shareId && !expired && !msg.includes("does not exist")) {
      return (
        <ShareGate
          tone="danger"
          icon={<AlertCircle className="w-7 h-7" />}
          title="Couldn't open this link"
          description={errorMessage(sessionMutation.error, "Check your connection and try again.")}
        >
          <button onClick={() => sessionMutation.mutate(shareId)} className={gatePrimaryButton}>
            Try again
          </button>
        </ShareGate>
      );
    }
    return (
      <ShareGate
        tone="danger"
        icon={expired ? <ShieldAlert className="w-7 h-7" /> : <FileWarning className="w-7 h-7" />}
        title={expired ? "This link has expired" : "Link not found"}
        description={
          expired
            ? "The owner set this link to stop working after a certain date. Ask them for a new one."
            : "This share link doesn't exist or has been removed. Check the address, or ask the owner to share it again."
        }
      >
        <button onClick={() => window.location.assign("/")} className={gateSecondaryButton}>
          Go to YFS
        </button>
      </ShareGate>
    );
  }

  if (!session || (granted && infoQuery.isPending)) {
    return (
      <ShareGate icon={<Loader2 className="w-7 h-7 animate-spin" />} title="Opening shared link…" description="Checking the link and your access." />
    );
  }

  if (needsPassword) {
    return (
      <ShareGate
        icon={<Lock className="w-7 h-7" />}
        title="Password required"
        description="The owner protected this link with a password. Enter it to continue."
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submitPassword();
          }}
        >
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => {
              setPasswordInput(e.target.value);
              if (passwordMutation.isError) passwordMutation.reset();
            }}
            placeholder="Password"
            aria-label="Password"
            aria-invalid={passwordMutation.isError}
            autoFocus
            className={`w-full py-3 px-4 rounded-2xl border bg-code-bg text-text-heading text-sm transition focus:outline-none focus:bg-bg-main focus:ring-4 ${
              passwordMutation.isError ? "border-red-500/60 focus:ring-red-500/10" : "border-border-main focus:border-accent focus:ring-accent-bg"
            }`}
          />
          {passwordMutation.isError && (
            <span className="flex items-center gap-1.5 text-xs text-red-500">
              <AlertCircle className="w-3.5 h-3.5" />
              {errorMessage(passwordMutation.error, "Incorrect password")}
            </span>
          )}
          <button type="submit" disabled={!passwordInput || passwordMutation.isPending} className={gatePrimaryButton}>
            {passwordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {passwordMutation.isPending ? "Checking…" : "Unlock"}
          </button>
        </form>
      </ShareGate>
    );
  }

  if (needsOtp) {
    return (
      <ShareGate
        icon={<Lock className="w-7 h-7" />}
        title="Verification required"
        description="This link needs a one-time code sent to an approved email or phone. Code verification isn't available yet — ask the owner to share it without one."
      >
        <button onClick={exitShare} className={gateSecondaryButton}>
          <LogOut className="w-4 h-4" /> Exit
        </button>
      </ShareGate>
    );
  }

  if (infoQuery.isError || !infoQuery.data) {
    return (
      <ShareGate
        tone="danger"
        icon={<AlertCircle className="w-7 h-7" />}
        title="Couldn't open this share"
        description={errorMessage(infoQuery.error, "Something went wrong loading the share details.")}
      >
        <button onClick={() => infoQuery.refetch()} className={gatePrimaryButton}>
          Try again
        </button>
      </ShareGate>
    );
  }

  const info = infoQuery.data;
  if (!info.share_folder_target_id) {
    return (
      <ShareGate
        icon={<FileIcon className="w-7 h-7" />}
        title="A file was shared with you"
        description={`Your access is confirmed. ${FILE_UNAVAILABLE} Ask the owner to share it with your YFS account instead.`}
      >
        <div className="flex justify-center">
          <ShareAccessBadge info={info} session={session} />
        </div>
        <button onClick={exitShare} className={gateSecondaryButton}>
          <LogOut className="w-4 h-4" /> Exit
        </button>
      </ShareGate>
    );
  }

  return (
    <SharedFolderBrowser
      token={token}
      shareId={shareId}
      rootId={info.share_folder_target_id}
      permissions={info.permission_set}
      header={<ShareAccessBadge info={info} session={session} />}
      note={shareNote(session)}
      onExit={exitShare}
      exiting={logoutMutation.isPending}
    />
  );
}

function SharedFolderBrowser({
  token,
  shareId,
  rootId,
  permissions,
  header,
  note,
  onExit,
  exiting,
}: {
  token: string;
  shareId: string;
  rootId: string;
  permissions: { can_create: boolean; can_update: boolean };
  header: React.ReactNode;
  note: string | null;
  onExit: () => void;
  exiting: boolean;
}) {
  const { showToast } = useToast();

  const [viewMode, setViewModeState] = useState<ViewMode>(() => readStored(VIEW_KEY, ["list", "tiles", "grid"], "list"));
  const [gridSize, setGridSizeState] = useState<GridSize>(() => readStored(GRID_SIZE_KEY, ["small", "medium", "large"], "medium"));
  const setViewMode = (m: ViewMode) => {
    setViewModeState(m);
    writeStored(VIEW_KEY, m);
  };
  const setGridSize = (s: GridSize) => {
    setGridSizeState(s);
    writeStored(GRID_SIZE_KEY, s);
  };
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const toggleSortOrder = () => setSortOrder((o) => (o === "asc" ? "desc" : "asc"));

  const [path, setPath] = useState<Crumb[]>([]);
  const currentFolderId = path.length ? path[path.length - 1].id : rootId;

  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ id: string; name: string; parentId: string } | null>(null);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);

  const canCreate = permissions.can_create;
  const canEdit = permissions.can_update;
  const canMove = permissions.can_update && permissions.can_create;

  const folderQuery = usePublicFolderChildren(token, currentFolderId);
  const createFolder = useCreatePublicFolder(token, shareId);
  const renameFolder = useRenamePublicFolder(token);
  const moveFolder = useMovePublicFolder(token);

  const rows = useMemo(() => folderQuery.data?.pages.flat() ?? [], [folderQuery.data]);
  const items = useMemo(() => sortItems(rows.map(mapPublicResource), sortField, sortOrder), [rows, sortField, sortOrder]);

  const sentinelRef = useInfiniteScroll(() => folderQuery.fetchNextPage(), {
    hasMore: !!folderQuery.hasNextPage,
    loading: folderQuery.isFetchingNextPage,
    root: scrollEl,
  });

  const segments: BreadcrumbSegment[] = [{ id: rootId, name: ROOT_NAME }, ...path];
  // Breadcrumbs calls onNavigate(segmentIndex - 1); -1 is the share root.
  const goToBreadcrumb = (index: number) => setPath((p) => (index < 0 ? [] : p.slice(0, index + 1)));
  const openFolder = (item: FileItem) => setPath((p) => [...p, { id: item.id, name: item.name }]);

  const selection = useFileSelection({
    listItems: items,
    onOpenItem: (item) => {
      if (item.isFolder) openFolder(item);
      else showToast(FILE_UNAVAILABLE, "info");
    },
  });

  useEffect(() => {
    selection.resetSelection();
    setContextMenuId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolderId]);

  const selectedItem = items.find((i) => i.id === selection.selectedItemId) ?? null;

  const dismissAll = () => {
    setContextMenuId(null);
    selection.clearSelection();
  };

  const startRename = (item: FileItem) => {
    setContextMenuId(null);
    setRenameTarget({ id: item.id, name: item.name });
  };
  const startMove = (item: FileItem) => {
    setContextMenuId(null);
    selection.resetSelection();
    setMoveTarget({ id: item.id, name: item.name, parentId: currentFolderId });
  };

  const submitCreateFolder = (name: string) => {
    if (!name.trim()) return;
    createFolder.mutate(
      { parentFolderId: currentFolderId, name },
      {
        onSuccess: () => {
          setCreatingFolder(false);
          showToast(`Created "${shortName(name.trim())}"`, "success");
        },
        onError: (err) => showToast(errorMessage(err, "Couldn't create the folder"), "error"),
      }
    );
  };

  const submitRename = (name: string) => {
    if (!renameTarget || !name.trim()) return;
    renameFolder.mutate(
      { id: renameTarget.id, name },
      {
        onSuccess: () => {
          setRenameTarget(null);
          showToast("Renamed", "success");
        },
        onError: (err) => showToast(errorMessage(err, "Couldn't rename the folder"), "error"),
      }
    );
  };

  // Can't drop a folder into itself, a folder inside it, or where it already is.
  const moveBlocked =
    !!moveTarget &&
    (currentFolderId === moveTarget.parentId || currentFolderId === moveTarget.id || path.some((c) => c.id === moveTarget.id));
  const moveHere = () => {
    if (!moveTarget || moveBlocked) return;
    const { id, name } = moveTarget;
    const destination = path.length ? path[path.length - 1].name : ROOT_NAME;
    moveFolder.mutate(
      { id, newParentId: currentFolderId },
      {
        onSuccess: () => {
          setMoveTarget(null);
          showToast(`Moved "${shortName(name)}" to "${shortName(destination)}"`, "success");
        },
        onError: (err) => showToast(errorMessage(err, "Couldn't move the folder"), "error"),
      }
    );
  };

  const menuItemClass =
    "flex items-center gap-2.5 px-3 py-2 border-none bg-transparent text-text-main rounded-lg text-xs font-semibold text-left cursor-pointer hover:bg-code-bg hover:text-text-heading transition";
  const renderContextMenu = (item: FileItem) => (
    <div className="context-dropdown z-50 w-52 bg-bg-main border border-border-main rounded-xl p-1 shadow-md flex flex-col gap-0.5 animate-scale-in">
      {item.isFolder ? (
        <>
          <button
            className={menuItemClass}
            onClick={() => {
              setContextMenuId(null);
              openFolder(item);
            }}
          >
            <FolderOpen className="w-3.5 h-3.5" /> Open
          </button>
          {canEdit && (
            <button className={menuItemClass} onClick={() => startRename(item)}>
              <Pencil className="w-3.5 h-3.5" /> Rename
            </button>
          )}
          {canMove && (
            <button className={menuItemClass} onClick={() => startMove(item)}>
              <FolderInput className="w-3.5 h-3.5" /> Move to…
            </button>
          )}
        </>
      ) : (
        <div className="flex items-start gap-2 px-3 py-2 text-[11px] leading-normal text-text-main">
          <Info className="w-3.5 h-3.5 shrink-0 mt-px opacity-60" />
          <span>{FILE_UNAVAILABLE}</span>
        </div>
      )}
    </div>
  );

  const openItemContextMenu = (item: FileItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuId(item.id);
  };

  const listProps = {
    items,
    selectedItemId: selection.selectedItemId,
    checkedItemIds: selection.checkedItemIds,
    contextMenuId,
    dragOverFolderId: null,
    onItemClick: selection.handleItemClick,
    onCheckboxToggle: selection.handleCheckboxToggle,
    onContextMenuToggle: setContextMenuId,
    onItemContextMenu: openItemContextMenu,
    renderContextMenu,
    onDragStartItem: (_: FileItem, e: React.DragEvent) => e.preventDefault(),
    onDragOverFolder: noop,
    onDragLeaveFolder: noop,
    onDropOnFolder: noop,
  };

  const refreshing = folderQuery.isRefetching && !folderQuery.isFetchingNextPage;

  return (
    <div className="flex flex-col w-screen h-screen bg-bg-main text-text-main overflow-hidden font-sans" onClick={dismissAll}>
      <header className="h-14 min-h-14 border-b border-border-main px-5 flex items-center justify-between gap-3 md:gap-6 box-border max-[768px]:px-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xl text-accent flex items-center justify-center">⚡</span>
            <span className="text-lg font-bold text-text-heading tracking-tight max-[480px]:hidden">YFS</span>
          </div>
          <div className="h-5 w-px bg-border-main shrink-0 max-[480px]:hidden" />
          {header}
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} gridSize={gridSize} onGridSizeChange={setGridSize} />
          <button
            onClick={onExit}
            disabled={exiting}
            title="Leave this share"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 bg-code-bg border border-border-main rounded-full text-xs font-semibold text-text-heading cursor-pointer hover:bg-border-main disabled:opacity-60 transition"
          >
            {exiting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            <span className="max-[640px]:hidden">Exit</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <div ref={setScrollEl} className="flex-1 overflow-y-auto px-5 py-4 pb-10 flex flex-col gap-4 max-[768px]:px-3" onClick={dismissAll}>
          {note && <ShareNoteBanner note={note} />}

          <div className="flex items-center gap-3 flex-wrap pb-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Breadcrumbs segments={segments} onNavigate={goToBreadcrumb} />
            </div>

            {moveTarget ? (
              <SelectionPill
                label={
                  <span className="truncate max-w-56">
                    Moving “{moveTarget.name}” — open the destination
                  </span>
                }
                onClear={() => setMoveTarget(null)}
              >
                <button
                  type="button"
                  onClick={moveHere}
                  disabled={moveBlocked || moveFolder.isPending}
                  title={moveBlocked ? "Open a different folder to move it there" : undefined}
                  className={pillActionClass}
                >
                  {moveFolder.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" /> : <FolderInput className="w-3.5 h-3.5 text-accent" />}
                  <span>Move here</span>
                </button>
              </SelectionPill>
            ) : (
              selection.checkedItemIds.length > 0 && (
                <SelectionPill count={selection.checkedItemIds.length} onClear={() => selection.setCheckedItemIds([])} />
              )
            )}

            {canCreate && (
              <button
                onClick={() => setCreatingFolder(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-accent text-white rounded-full text-xs font-semibold cursor-pointer hover:shadow-md shadow-accent/20 transition shrink-0"
              >
                <FolderPlus className="w-3.5 h-3.5" /> New folder
              </button>
            )}

            <SortControls
              sortField={sortField}
              onSortFieldChange={setSortField}
              sortOrder={sortOrder}
              onToggleSortOrder={toggleSortOrder}
              onRefresh={() => folderQuery.refetch()}
              refreshing={refreshing}
            />
          </div>

          {folderQuery.isPending ? (
            viewMode === "list" ? <ListSkeleton /> : viewMode === "tiles" ? <TilesSkeleton /> : <GridSkeleton />
          ) : folderQuery.isError ? (
            <div className="flex flex-col items-center justify-center text-center py-16 px-4 text-text-main">
              <AlertCircle className="w-14 h-14 mb-4 opacity-60 text-red-400" />
              <div className="text-base font-semibold text-text-heading mb-1.5">Couldn't load this folder</div>
              <div className="text-sm max-w-[320px] leading-relaxed mb-4">
                {errorMessage(folderQuery.error, "Something went wrong. Your session may have ended.")}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  folderQuery.refetch();
                }}
                className="px-4 py-2 bg-code-bg border border-border-main rounded-full text-xs font-semibold text-text-heading cursor-pointer hover:bg-border-main transition"
              >
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="This folder is empty"
              description={canCreate ? 'Nothing here yet. Use "New folder" to add one.' : "Nothing has been added to this folder yet."}
            />
          ) : viewMode === "list" ? (
            <FileListTable
              {...listProps}
              showOwner={false}
              sortField={sortField}
              sortOrder={sortOrder}
              onSortFieldChange={setSortField}
              onToggleSortOrder={toggleSortOrder}
              onSelectAllToggle={selection.handleSelectAllToggle}
            />
          ) : viewMode === "tiles" ? (
            <FileTiles {...listProps} />
          ) : (
            <FileGrid {...listProps} gridSize={gridSize} />
          )}

          <div ref={sentinelRef} />
          {folderQuery.isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-border-main border-t-accent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {selectedItem && (
          <SharedDetailsPanel
            item={selectedItem}
            canEdit={canEdit}
            canMove={canMove}
            onClose={selection.clearSelection}
            onOpenFolder={() => {
              openFolder(selectedItem);
              selection.clearSelection();
            }}
            onRename={() => startRename(selectedItem)}
            onMove={() => startMove(selectedItem)}
          />
        )}
      </div>

      {creatingFolder && <CreateFolderModal onCancel={() => setCreatingFolder(false)} onCreate={submitCreateFolder} />}
      {renameTarget && <RenameModal currentName={renameTarget.name} onCancel={() => setRenameTarget(null)} onRename={submitRename} />}
      <ToastContainer />
    </div>
  );
}
