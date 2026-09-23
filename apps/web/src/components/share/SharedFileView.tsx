import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  File as FileIcon,
  FileWarning,
  FolderInput,
  FolderPlus,
  Grid,
  List,
  Lock,
  LogOut,
  Pencil,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import {
  createPublicFolder,
  createPublicSession,
  deletePublicFolder,
  editPublicFolder,
  getPublicSession,
  listPublicFolderChildren,
  movePublicFolder,
  publicLogout,
  validatePublicSessionPassword,
  type BackendResource,
  type PublicSession,
} from "@yfs/service";
import { SORT_FIELD_OPTIONS } from "../../types/file";
import type { FileItem, SortField, SortOrder, ViewMode } from "../../types/file";
import { categorizeByName } from "../../utils/fileType";
import { useFileSelection } from "../../hooks/useFileSelection";
import { FileListTable } from "../files/FileListTable";
import { Dropdown } from "../common/Dropdown";
import { FileGrid } from "../files/FileGrid";
import { Breadcrumbs, type BreadcrumbSegment } from "../layout/Breadcrumbs";
import { ShareInfoBar } from "./ShareInfoBar";
import { SharedDetailsPanel } from "./SharedDetailsPanel";
import { ListSkeleton, GridSkeleton } from "../common/Skeletons";
import { EmptyState } from "../common/EmptyState";
import { CreateFolderModal } from "../modals/CreateFolderModal";
import { RenameModal } from "../modals/RenameModal";
import { ConfirmModal } from "../modals/ConfirmModal";



type Phase = "loading" | "not-found" | "expired" | "password" | "otp" | "granted";
interface Crumb {
  id: string;
  name: string;
}

const SHARE_VIEW_KEY = "yfs_share_view";

const noop = () => {};

// BackendResource -> the FileItem shape the shared browse components expect. The
// owner column just shows the share, and trash/versioning don't apply here.
const mapPublicResource = (r: BackendResource): FileItem => {
  const info = (r.resource_info ?? undefined) as { ui?: { color?: string; icon?: string } } | undefined;
  const base = {
    id: r.resource_id,
    name: r.resource_name,
    parentId: r.parent_folder_id ?? null,
    size: r.total_resource_size ?? 0,
    owner: { name: "Shared", email: "" },
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

const sortItems = (items: FileItem[], field: SortField, order: SortOrder): FileItem[] => {
  const dir = order === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
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

  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<PublicSession | null>(null);

  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [path, setPath] = useState<Crumb[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  // createPublicSession mints a new anonymous session server-side (not an idempotent
  // read), so it's a mutation fired once per shareId rather than a query — a query
  // could otherwise silently re-fire (refetch-on-focus etc.) and mint duplicate
  // sessions.
  const sessionMutation = useMutation({ mutationFn: () => createPublicSession(shareId) });
  useEffect(() => {
    sessionMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId]);

  useEffect(() => {
    if (sessionMutation.isPending || sessionMutation.isIdle) return;
    if (sessionMutation.isError) {
      const msg = sessionMutation.error instanceof Error ? sessionMutation.error.message.toLowerCase() : "";
      setPhase(msg.includes("expired") ? "expired" : "not-found");
      return;
    }
    const s = sessionMutation.data;
    setSession(s);
    if (s.is_password_protected) setPhase("password");
    else if (s.is_email_otp_protected || s.is_phone_otp_protected) setPhase("otp");
    else setPhase("granted");
  }, [sessionMutation.isPending, sessionMutation.isIdle, sessionMutation.isError, sessionMutation.error, sessionMutation.data]);

  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    try {
      return localStorage.getItem(SHARE_VIEW_KEY) === "grid" ? "grid" : "list";
    } catch {
      return "list";
    }
  });
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const [contextMenuId, setContextMenuId] = useState<string | null>(null);

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const setViewMode = (m: ViewMode) => {
    setViewModeState(m);
    try {
      localStorage.setItem(SHARE_VIEW_KEY, m);
    } catch {
      /* ignore */
    }
  };

  const token = session?.public_session_token ?? "";

  const infoQuery = useQuery({
    queryKey: ["publicSessionInfo", token],
    queryFn: () => getPublicSession(token),
    enabled: phase === "granted" && !!token,
  });
  useEffect(() => {
    if (infoQuery.isError) setListError("Couldn't load share details.");
  }, [infoQuery.isError]);
  const info = infoQuery.data ?? null;

  const shareRootId = info?.share_folder_target_id ?? null;
  const currentFolderId = path.length ? path[path.length - 1].id : shareRootId;
  const canCreate = !!info?.permission_set.can_create;
  const canEdit = !!info?.permission_set.can_update;
  const canMove = !!info?.permission_set.can_update && !!info?.permission_set.can_create;
  const canDelete = !!info?.permission_set.can_delete;

  const folderQueryKey = ["publicFolder", token, currentFolderId] as const;
  const folderQuery = useQuery({
    queryKey: folderQueryKey,
    queryFn: () => listPublicFolderChildren(token, currentFolderId!),
    enabled: !!token && !!currentFolderId,
  });
  useEffect(() => {
    if (folderQuery.isError) {
      setListError(folderQuery.error instanceof Error ? folderQuery.error.message : "Couldn't load this folder.");
    } else if (folderQuery.isSuccess) {
      setListError(null);
    }
  }, [folderQuery.isError, folderQuery.error, folderQuery.isSuccess]);
  const rows = folderQuery.data ?? [];
  const listLoading = folderQuery.isPending && !!token && !!currentFolderId;

  const refresh = () => queryClient.invalidateQueries({ queryKey: folderQueryKey });
  const fail = (err: unknown, fallback: string) => setListError(err instanceof Error ? err.message : fallback);

  const createFolderMutation = useMutation({
    mutationFn: (name: string) =>
      createPublicFolder(token, { parentFolderId: currentFolderId!, folderName: name.trim(), shareId }),
    onSuccess: () => {
      setCreatingFolder(false);
      refresh();
    },
    onError: (err) => fail(err, "Couldn't create the folder."),
  });
  const renameFolderMutation = useMutation({
    mutationFn: (vars: { id: string; name: string }) => editPublicFolder(token, { folderId: vars.id, folderName: vars.name.trim() }),
    onSuccess: () => {
      setRenameTarget(null);
      refresh();
    },
    onError: (err) => fail(err, "Couldn't rename the folder."),
  });
  const moveFolderMutation = useMutation({
    mutationFn: (vars: { id: string; newParentId: string }) =>
      movePublicFolder(token, { folderId: vars.id, newParentFolderId: vars.newParentId }),
    onSuccess: () => {
      setMoveTarget(null);
      refresh();
    },
    onError: (err) => fail(err, "Couldn't move the folder."),
  });
  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => deletePublicFolder(token, id),
    onSuccess: () => {
      setDeleteTarget(null);
      refresh();
    },
    onError: (err) => fail(err, "Couldn't delete the folder."),
  });
  const busy =
    createFolderMutation.isPending ||
    renameFolderMutation.isPending ||
    moveFolderMutation.isPending ||
    deleteFolderMutation.isPending;

  const items = useMemo(() => sortItems(rows.map(mapPublicResource), sortField, sortOrder), [rows, sortField, sortOrder]);

  const segments: BreadcrumbSegment[] = [
    { id: shareRootId, name: "Shared folder" },
    ...path.map((c) => ({ id: c.id, name: c.name })),
  ];
  // Breadcrumbs calls onNavigate(segmentIndex - 1); -1 is the share root.
  const goToBreadcrumb = (index: number) => setPath((p) => (index < 0 ? [] : p.slice(0, index + 1)));

  const openFolder = (item: FileItem) => setPath((p) => [...p, { id: item.id, name: item.name }]);

  // Same selection behaviour as the signed-in app: single-click selects, double-click
  // opens a folder, shift/ctrl range- and multi-select for batch actions.
  const selection = useFileSelection({
    listItems: items,
    onOpenItem: (item) => {
      if (item.isFolder) openFolder(item);
    },
  });

  // Drop any selection when the folder changes (mirrors App's openFolder/goToBreadcrumb).
  useEffect(() => {
    selection.clearSelection();
    selection.setCheckedItemIds([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolderId]);

  const selectedItem = items.find((i) => i.id === selection.selectedItemId) ?? null;

  const submitCreateFolder = (name: string) => {
    if (!token || !currentFolderId || !name.trim()) return;
    createFolderMutation.mutate(name);
  };

  const submitRename = (name: string) => {
    if (!renameTarget || !name.trim()) return;
    renameFolderMutation.mutate({ id: renameTarget.id, name });
  };

  const moveHere = () => {
    if (!moveTarget || !currentFolderId) return;
    moveFolderMutation.mutate({ id: moveTarget.id, newParentId: currentFolderId });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteFolderMutation.mutate(deleteTarget.id);
  };

  const exitShare = async () => {
    try {
      if (token) await publicLogout(token);
    } catch {
      /* session already gone */
    }
    // Navigate to a dedicated route so the share link is no longer in the address bar.
    window.location.assign(`/share-ended?from=${encodeURIComponent(shareId)}`);
  };

  const passwordMutation = useMutation({
    mutationFn: (password: string) => validatePublicSessionPassword(session!.public_session_token, password),
    onSuccess: () => {
      setPhase(session!.is_email_otp_protected || session!.is_phone_otp_protected ? "otp" : "granted");
    },
    onError: (err) => setPasswordError(err instanceof Error ? err.message : "Incorrect password"),
  });
  const submitPassword = () => {
    if (!session || !passwordInput) return;
    setPasswordError(null);
    passwordMutation.mutate(passwordInput);
  };
  const checking = passwordMutation.isPending;

  const renderContextMenu = (item: FileItem) => {
    const rowClass =
      "flex items-center gap-2.5 px-3 py-2 border-none bg-transparent text-text-main rounded-lg text-xs font-semibold text-left cursor-pointer hover:bg-code-bg hover:text-text-heading transition w-full";
    return (
      <div className="min-w-40 bg-bg-main border border-border-main rounded-xl p-1 shadow-lg flex flex-col gap-0.5">
        {item.isFolder && (
          <button className={rowClass} onClick={() => { setContextMenuId(null); openFolder(item); }}>
            <FolderInput className="w-3.5 h-3.5" /> Open
          </button>
        )}
        {item.isFolder && canEdit && (
          <button
            className={rowClass}
            onClick={() => {
              setContextMenuId(null);
              setRenameTarget({ id: item.id, name: item.name });
            }}
          >
            <Pencil className="w-3.5 h-3.5" /> Rename
          </button>
        )}
        {item.isFolder && canMove && (
          <button
            className={rowClass}
            onClick={() => {
              setContextMenuId(null);
              setMoveTarget({ id: item.id, name: item.name });
            }}
          >
            <FolderInput className="w-3.5 h-3.5" /> Move…
          </button>
        )}
        {item.isFolder && canDelete && (
          <button
            className={`${rowClass} !text-red-500 hover:!bg-red-500/10`}
            onClick={() => {
              setContextMenuId(null);
              setDeleteTarget({ id: item.id, name: item.name });
            }}
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        )}
        {!item.isFolder && (
          <span className="px-3 py-2 text-[11px] text-text-main">No actions available yet</span>
        )}
      </div>
    );
  };

  // --- gate / status screens ---------------------------------------------------

  if (phase === "loading") return <CenteredMessage title="Loading…" />;
  if (phase === "not-found")
    return (
      <CenteredMessage
        icon={<FileWarning className="w-10 h-10 text-red-400" />}
        title="Link not found"
        description="This share link doesn't exist or was removed."
      />
    );
  if (phase === "expired")
    return (
      <CenteredMessage
        icon={<ShieldAlert className="w-10 h-10 text-red-400" />}
        title="Link expired"
        description="This share link is no longer active."
      />
    );
  if (phase === "otp")
    return (
      <CenteredMessage
        icon={<Lock className="w-10 h-10 text-accent" />}
        title="Verification required"
        description="This link needs a one-time code. Code verification isn't available yet — check back soon."
      />
    );

  if (phase === "password") {
    return (
      <CenteredMessage
        icon={<Lock className="w-10 h-10 text-accent" />}
        title="Password required"
        description="This link is protected. Enter the password to continue."
      >
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitPassword()}
            placeholder="Password"
            className="dialog-input"
            autoFocus
          />
          {passwordError && <span className="text-xs text-red-500">{passwordError}</span>}
          <button onClick={submitPassword} disabled={checking} className="btn-primary">
            {checking ? "Checking…" : "Unlock"}
          </button>
        </div>
      </CenteredMessage>
    );
  }

  if (info && !info.share_folder_target_id) {
    return (
      <CenteredMessage
        icon={<FileIcon className="w-10 h-10 text-accent" />}
        title="Link is valid"
        description="Your access to this file is confirmed, but opening or downloading a file straight from a link isn't supported by the server yet. Ask the owner to share it with your account instead."
      >
        <div className="w-full max-w-sm mt-1">
          <ShareInfoBar info={info} session={session} shareId={shareId} />
        </div>
        <button onClick={exitShare} className="btn-outline mt-2 flex items-center gap-1.5" style={{ width: "auto" }}>
          <LogOut className="w-3.5 h-3.5" /> Exit
        </button>
      </CenteredMessage>
    );
  }

  // --- folder share: browse it, styled like the signed-in app -----------------

  const viewToggleBtn = (mode: ViewMode, Icon: typeof List, label: string) => (
    <button
      onClick={() => setViewMode(mode)}
      title={label}
      className={`w-9 h-9 flex items-center justify-center rounded-full text-text-main hover:bg-code-bg hover:text-text-heading cursor-pointer transition ${
        viewMode === mode ? "bg-accent-bg text-accent! border border-accent-border!" : ""
      }`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  return (
    <div
      className="flex flex-col w-screen h-screen bg-bg-main text-text-main overflow-hidden font-sans"
      onClick={() => {
        setContextMenuId(null);
        selection.clearSelection();
      }}
    >
      <header className="h-14 min-h-14 border-b border-border-main px-5 flex items-center justify-between gap-3 max-[768px]:px-3">
        <div className="flex items-center gap-2 font-bold text-text-heading">
          <span className="text-accent">⚡</span> YFS
          <span className="text-text-main font-medium text-sm hidden sm:inline">· Shared with you</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canCreate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCreatingFolder(true);
              }}
              className="btn-outline flex items-center gap-1.5"
              style={{ width: "auto" }}
            >
              <FolderPlus className="w-3.5 h-3.5" /> New folder
            </button>
          )}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {viewToggleBtn("list", List, "List view")}
            {viewToggleBtn("grid", Grid, "Grid view")}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              exitShare();
            }}
            className="btn-outline flex items-center gap-1.5"
            style={{ width: "auto" }}
          >
            <LogOut className="w-3.5 h-3.5" /> Exit
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
      <div
        className="flex-1 overflow-y-auto px-5 py-4 pb-10 flex flex-col gap-4 max-[768px]:px-3"
        onClick={() => {
          setContextMenuId(null);
          selection.clearSelection();
        }}
      >
        {info && <ShareInfoBar info={info} session={session} shareId={shareId} />}

        <Breadcrumbs segments={segments} onNavigate={goToBreadcrumb} />

        <div
          className="flex items-center justify-between flex-wrap gap-3 border-b border-border-main pb-3"
          onClick={(e) => e.stopPropagation()}
        >
          {moveTarget ? (
            <div className="flex items-center gap-2 bg-accent-bg border border-accent-border px-3 py-1.5 rounded-xl text-xs">
              <FolderInput className="w-3.5 h-3.5 text-accent shrink-0" />
              <span className="text-text-heading">
                Moving <strong>{moveTarget.name}</strong> — open a folder, then drop it here.
              </span>
              <button onClick={moveHere} disabled={busy} className="btn-primary" style={{ width: "auto" }}>
                Move here
              </button>
              <button onClick={() => setMoveTarget(null)} className="btn-outline" style={{ width: "auto" }}>
                Cancel
              </button>
            </div>
          ) : selection.checkedItemIds.length > 0 ? (
            <div className="flex items-center gap-3 bg-accent-bg border border-accent-border px-3.5 py-1.5 rounded-xl">
              <span className="text-xs font-semibold text-accent">
                {selection.checkedItemIds.length} selected
              </span>
              <button
                onClick={() => selection.setCheckedItemIds([])}
                className="text-xs bg-transparent border-none text-text-heading hover:bg-black/5 dark:hover:bg-white/5 py-1 px-2 rounded font-medium cursor-pointer transition"
              >
                ✕ Clear
              </button>
            </div>
          ) : (
            <div />
          )}

          {/* List view sorts via the table's column headers instead. */}
          {viewMode !== "list" && (
            <div className="flex gap-2">
              <Dropdown value={sortField} options={SORT_FIELD_OPTIONS} onChange={(v) => setSortField(v)} align="end" />
              <button
                onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
                className="px-3 py-1.5 bg-code-bg border border-border-main rounded-full text-xs font-medium text-text-main cursor-pointer hover:bg-border-main transition"
                title="Toggle sort direction"
              >
                {sortOrder === "asc" ? "▲" : "▼"}
              </button>
            </div>
          )}
        </div>

        {listError && <div className="text-sm text-red-500">{listError}</div>}

        {listLoading ? (
          viewMode === "list" ? (
            <ListSkeleton />
          ) : (
            <GridSkeleton />
          )
        ) : items.length === 0 ? (
          <EmptyState />
        ) : viewMode === "list" ? (
          <FileListTable
            items={items}
            selectedItemId={selection.selectedItemId}
            checkedItemIds={selection.checkedItemIds}
            contextMenuId={contextMenuId}
            dragOverFolderId={null}
            sortField={sortField}
            sortOrder={sortOrder}
            onSortFieldChange={setSortField}
            onToggleSortOrder={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
            onItemClick={selection.handleItemClick}
            onCheckboxToggle={selection.handleCheckboxToggle}
            onSelectAllToggle={selection.handleSelectAllToggle}
            onContextMenuToggle={setContextMenuId}
            onItemContextMenu={(item, e) => {
              e.preventDefault();
              setContextMenuId(item.id);
            }}
            renderContextMenu={renderContextMenu}
            onDragStartItem={noop}
            onDragOverFolder={noop}
            onDragLeaveFolder={noop}
            onDropOnFolder={noop}
          />
        ) : (
          <FileGrid
            items={items}
            selectedItemId={selection.selectedItemId}
            checkedItemIds={selection.checkedItemIds}
            contextMenuId={contextMenuId}
            dragOverFolderId={null}
            onItemClick={selection.handleItemClick}
            onCheckboxToggle={selection.handleCheckboxToggle}
            onContextMenuToggle={setContextMenuId}
            onItemContextMenu={(item, e) => {
              e.preventDefault();
              setContextMenuId(item.id);
            }}
            renderContextMenu={renderContextMenu}
            onDragStartItem={noop}
            onDragOverFolder={noop}
            onDragLeaveFolder={noop}
            onDropOnFolder={noop}
          />
        )}

        <p className="text-[11px] text-text-main text-center mt-2">
          Browsing works, but opening or downloading a file from a public link isn&apos;t supported by the server yet —
          the permissions above apply once it is.
        </p>
      </div>

      {selectedItem && (
        <SharedDetailsPanel
          item={selectedItem}
          canEdit={canEdit}
          canMove={canMove}
          canDelete={canDelete}
          onClose={selection.clearSelection}
          onOpenFolder={() => {
            openFolder(selectedItem);
            selection.clearSelection();
          }}
          onRename={() => setRenameTarget({ id: selectedItem.id, name: selectedItem.name })}
          onMove={() => setMoveTarget({ id: selectedItem.id, name: selectedItem.name })}
          onDelete={() => setDeleteTarget({ id: selectedItem.id, name: selectedItem.name })}
        />
      )}
      </div>

      {creatingFolder && (
        <CreateFolderModal onCancel={() => setCreatingFolder(false)} onCreate={submitCreateFolder} />
      )}
      {renameTarget && (
        <RenameModal
          currentName={renameTarget.name}
          onCancel={() => setRenameTarget(null)}
          onRename={submitRename}
        />
      )}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Folder"
          description={`This will permanently delete "${deleteTarget.name}" and everything inside it. This action cannot be undone.`}
          confirmLabel="Delete"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

function CenteredMessage({
  icon,
  title,
  description,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center gap-3 bg-bg-main text-text-main px-6 text-center">
      {icon}
      <h3 className="text-lg font-bold text-text-heading">{title}</h3>
      {description && <p className="text-sm text-text-main max-w-sm">{description}</p>}
      {children}
    </div>
  );
}
