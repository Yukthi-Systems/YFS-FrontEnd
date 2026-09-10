import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import {
  createPublicFolder,
  createPublicSession,
  editPublicFolder,
  getPublicSession,
  listPublicFolderChildren,
  movePublicFolder,
  publicLogout,
  validatePublicSessionPassword,
  type BackendResource,
  type PublicSession,
  type PublicSessionInfo,
} from "@yfs/service";
import type { FileItem, SortField, SortOrder, ViewMode } from "../../types/file";
import { categorizeByName } from "../../utils/fileType";
import { useFileSelection } from "../../hooks/useFileSelection";
import { FileListTable } from "../files/FileListTable";
import { FileGrid } from "../files/FileGrid";
import { Breadcrumbs, type BreadcrumbSegment } from "../layout/Breadcrumbs";
import { ShareInfoBar } from "./ShareInfoBar";
import { ListSkeleton, GridSkeleton } from "../common/Skeletons";
import { EmptyState } from "../common/EmptyState";
import { CreateFolderModal } from "../modals/CreateFolderModal";
import { RenameModal } from "../modals/RenameModal";

// Anonymous visitor page for an external folder-share link (/share/<share_id>).
// Uses the same browse UI as the signed-in app (FileListTable / FileGrid /
// Breadcrumbs), driven by the public endpoints and gated on the session's
// per-visitor permissions. File shares and content preview/download have no public
// endpoint yet, so a file target stops at the access screen.

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
    isStarred: false,
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
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1; // folders first, always
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

  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<PublicSession | null>(null);
  const [info, setInfo] = useState<PublicSessionInfo | null>(null);

  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const [path, setPath] = useState<Crumb[]>([]);
  const [rows, setRows] = useState<BackendResource[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

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
  const [busy, setBusy] = useState(false);

  const token = session?.public_session_token ?? "";
  const shareRootId = info?.share_folder_target_id ?? null;
  const currentFolderId = path.length ? path[path.length - 1].id : shareRootId;
  const canCreate = !!info?.can_create;
  const canEdit = !!info?.can_update;
  const canMove = !!info?.can_update && !!info?.can_create;

  const setViewMode = (m: ViewMode) => {
    setViewModeState(m);
    try {
      localStorage.setItem(SHARE_VIEW_KEY, m);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await createPublicSession(shareId);
        if (cancelled) return;
        setSession(s);
        if (s.is_password_protected) setPhase("password");
        else if (s.is_email_otp_protected || s.is_phone_otp_protected) setPhase("otp");
        else setPhase("granted");
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message.toLowerCase() : "";
        setPhase(msg.includes("expired") ? "expired" : "not-found");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  useEffect(() => {
    if (phase !== "granted" || !token) return;
    let cancelled = false;
    getPublicSession(token)
      .then((i) => !cancelled && setInfo(i))
      .catch(() => !cancelled && setListError("Couldn't load share details."));
    return () => {
      cancelled = true;
    };
  }, [phase, token]);

  const loadFolder = useCallback(
    async (folderId: string) => {
      if (!token) return;
      setListLoading(true);
      setListError(null);
      try {
        setRows(await listPublicFolderChildren(token, folderId));
      } catch (err) {
        setListError(err instanceof Error ? err.message : "Couldn't load this folder.");
        setRows([]);
      } finally {
        setListLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (currentFolderId) loadFolder(currentFolderId);
  }, [currentFolderId, loadFolder]);

  const refresh = () => currentFolderId && loadFolder(currentFolderId);
  const fail = (err: unknown, fallback: string) => setListError(err instanceof Error ? err.message : fallback);

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

  const submitCreateFolder = async (name: string) => {
    if (!token || !currentFolderId || !name.trim()) return;
    setBusy(true);
    try {
      await createPublicFolder(token, { parentFolderId: currentFolderId, folderName: name.trim(), shareId });
      setCreatingFolder(false);
      await refresh();
    } catch (err) {
      fail(err, "Couldn't create the folder.");
    } finally {
      setBusy(false);
    }
  };

  const submitRename = async (name: string) => {
    if (!renameTarget || !name.trim()) return;
    setBusy(true);
    try {
      await editPublicFolder(token, { folderId: renameTarget.id, folderName: name.trim() });
      setRenameTarget(null);
      await refresh();
    } catch (err) {
      fail(err, "Couldn't rename the folder.");
    } finally {
      setBusy(false);
    }
  };

  const moveHere = async () => {
    if (!moveTarget || !currentFolderId) return;
    setBusy(true);
    try {
      await movePublicFolder(token, { folderId: moveTarget.id, newParentFolderId: currentFolderId });
      setMoveTarget(null);
      await refresh();
    } catch (err) {
      fail(err, "Couldn't move the folder.");
    } finally {
      setBusy(false);
    }
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

  const submitPassword = async () => {
    if (!session || !passwordInput) return;
    setChecking(true);
    setPasswordError(null);
    try {
      await validatePublicSessionPassword(session.public_session_token, passwordInput);
      setPhase(session.is_email_otp_protected || session.is_phone_otp_protected ? "otp" : "granted");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Incorrect password");
    } finally {
      setChecking(false);
    }
  };

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
        title="Access granted"
        description="This link shares a single file. A public download isn't available yet."
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

          <div className="flex gap-2">
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="px-3 py-1.5 bg-code-bg border border-border-main rounded-full text-xs font-medium text-text-main cursor-pointer focus:outline-none"
            >
              <option value="name">Sort by Name</option>
              <option value="modifiedAt">Sort by Modified</option>
              <option value="size">Sort by Size</option>
            </select>
            <button
              onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
              className="px-3 py-1.5 bg-code-bg border border-border-main rounded-full text-xs font-medium text-text-main cursor-pointer hover:bg-border-main transition"
              title="Toggle sort direction"
            >
              {sortOrder === "asc" ? "▲" : "▼"}
            </button>
          </div>
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
          Preview and download for shared content aren&apos;t available yet.
        </p>
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
