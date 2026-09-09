import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  File as FileIcon,
  FileWarning,
  Folder,
  FolderInput,
  FolderPlus,
  Lock,
  LogOut,
  Pencil,
  ShieldAlert,
  X,
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
import { formatBytes, formatDate } from "../../utils/format";

// Anonymous visitor page for an external share link (/share/<share_id>).
//
// Wired to the real /public/* endpoints: mint a session, pass the password if the
// share is protected, then — for a folder share — browse its contents through
// /public/folders/list/under, and (with permission) create / rename / move
// folders inside it. File shares can't be fetched yet (no public download
// endpoint), so they stop at the details screen.

type Phase = "loading" | "not-found" | "expired" | "password" | "otp" | "granted" | "left";
interface Crumb {
  id: string;
  name: string;
}

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

  const [newFolderName, setNewFolderName] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [moving, setMoving] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const token = session?.public_session_token ?? "";
  const currentFolderId = path.length ? path[path.length - 1].id : info?.share_folder_target_id ?? null;
  const canEdit = !!info?.can_update;
  const canMove = !!info?.can_update && !!info?.can_create;

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
  const fail = (err: unknown, fallback: string) =>
    setListError(err instanceof Error ? err.message : fallback);

  const submitNewFolder = async () => {
    const name = (newFolderName ?? "").trim();
    if (!token || !currentFolderId || !name) return;
    setCreatingFolder(true);
    try {
      await createPublicFolder(token, { parentFolderId: currentFolderId, folderName: name });
      setNewFolderName(null);
      await refresh();
    } catch (err) {
      fail(err, "Couldn't create the folder.");
    } finally {
      setCreatingFolder(false);
    }
  };

  const submitRename = async () => {
    if (!renaming || !renaming.value.trim()) return;
    setBusy(renaming.id);
    try {
      await editPublicFolder(token, { folderId: renaming.id, folderName: renaming.value.trim() });
      setRenaming(null);
      await refresh();
    } catch (err) {
      fail(err, "Couldn't rename the folder.");
    } finally {
      setBusy(null);
    }
  };

  const moveHere = async () => {
    if (!moving || !currentFolderId) return;
    setBusy(moving.id);
    try {
      await movePublicFolder(token, { folderId: moving.id, newParentFolderId: currentFolderId });
      setMoving(null);
      await refresh();
    } catch (err) {
      fail(err, "Couldn't move the folder.");
    } finally {
      setBusy(null);
    }
  };

  const exitShare = async () => {
    try {
      if (token) await publicLogout(token);
    } catch {
      /* session already gone */
    }
    setPhase("left");
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

  if (phase === "loading") return <CenteredMessage title="Loading…" />;
  if (phase === "left")
    return (
      <CenteredMessage
        icon={<Check className="w-10 h-10 text-accent" />}
        title="You've left this share"
        description="Reopen the link to access it again."
      />
    );
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
        {session?.expires_at && (
          <p className="text-xs text-text-main">Link expires {new Date(session.expires_at).toLocaleString()}</p>
        )}
        <button onClick={exitShare} className="btn-outline mt-2 flex items-center gap-1.5" style={{ width: "auto" }}>
          <LogOut className="w-3.5 h-3.5" /> Exit
        </button>
      </CenteredMessage>
    );
  }

  // granted — folder share: browse it.
  return (
    <div className="min-h-screen w-screen flex flex-col items-center bg-bg-main text-text-main px-4 py-10">
      <div className="w-full max-w-3xl flex flex-col gap-4">
        <div className="flex items-center gap-2 flex-wrap text-sm">
          {path.length > 0 && (
            <button
              onClick={() => setPath((p) => p.slice(0, -1))}
              className="btn-outline flex items-center gap-1 shrink-0"
              style={{ width: "auto" }}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          )}
          <button onClick={() => setPath([])} className="text-text-heading font-semibold hover:underline">
            Shared folder
          </button>
          {path.map((c, i) => (
            <span key={c.id} className="flex items-center gap-2">
              <span className="text-text-main">/</span>
              <button
                onClick={() => setPath((p) => p.slice(0, i + 1))}
                className="text-text-heading hover:underline truncate max-w-[12rem]"
              >
                {c.name}
              </button>
            </span>
          ))}
          <button
            onClick={exitShare}
            className="btn-outline ml-auto flex items-center gap-1.5 shrink-0"
            style={{ width: "auto" }}
          >
            <LogOut className="w-3.5 h-3.5" /> Exit
          </button>
        </div>

        {moving && (
          <div className="flex items-center gap-2 bg-accent-bg border border-accent-border rounded-xl px-3 py-2 text-xs">
            <FolderInput className="w-3.5 h-3.5 text-accent shrink-0" />
            <span className="flex-1 text-text-heading">
              Moving <strong>{moving.name}</strong> — open a folder, then drop it here.
            </span>
            <button
              onClick={moveHere}
              disabled={busy === moving.id}
              className="btn-primary"
              style={{ width: "auto" }}
            >
              Move here
            </button>
            <button onClick={() => setMoving(null)} className="btn-outline" style={{ width: "auto" }}>
              Cancel
            </button>
          </div>
        )}

        {info?.can_create && (
          <div className="flex items-center gap-2">
            {newFolderName === null ? (
              <button
                onClick={() => setNewFolderName("")}
                className="btn-outline flex items-center gap-1.5"
                style={{ width: "auto" }}
              >
                <FolderPlus className="w-3.5 h-3.5" /> New folder
              </button>
            ) : (
              <>
                <input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitNewFolder();
                    if (e.key === "Escape") setNewFolderName(null);
                  }}
                  placeholder="Folder name"
                  className="dialog-input flex-1 max-w-xs"
                  autoFocus
                />
                <button onClick={submitNewFolder} disabled={creatingFolder} className="btn-primary" style={{ width: "auto" }}>
                  {creatingFolder ? "Creating…" : "Create"}
                </button>
                <button onClick={() => setNewFolderName(null)} className="btn-outline" style={{ width: "auto" }}>
                  Cancel
                </button>
              </>
            )}
          </div>
        )}

        <div className="bg-bg-main border border-border-main rounded-2xl shadow-sm overflow-hidden">
          {listLoading ? (
            <div className="text-sm text-text-main text-center py-16">Loading…</div>
          ) : listError ? (
            <div className="text-sm text-red-500 text-center py-16">{listError}</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-text-main text-center py-16">This folder is empty.</div>
          ) : (
            <div className="flex flex-col divide-y divide-border-main">
              {[...rows]
                .sort((a, b) => Number(b.is_resource_folder) - Number(a.is_resource_folder))
                .map((r) => {
                  const isFolder = r.is_resource_folder;
                  const isRenaming = renaming?.id === r.resource_id;
                  return (
                    <div
                      key={r.resource_id}
                      onClick={() =>
                        isFolder && !isRenaming && setPath((p) => [...p, { id: r.resource_id, name: r.resource_name }])
                      }
                      className={`group flex items-center gap-3 px-4 py-2.5 ${
                        isFolder && !isRenaming ? "cursor-pointer hover:bg-code-bg" : ""
                      }`}
                    >
                      {isFolder ? (
                        <Folder className="w-4 h-4 text-accent shrink-0" />
                      ) : (
                        <FileIcon className="w-4 h-4 text-text-main shrink-0" />
                      )}

                      {isRenaming ? (
                        <div className="flex-1 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            value={renaming.value}
                            onChange={(e) => setRenaming({ id: r.resource_id, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") submitRename();
                              if (e.key === "Escape") setRenaming(null);
                            }}
                            className="dialog-input flex-1"
                            autoFocus
                          />
                          <button onClick={submitRename} disabled={busy === r.resource_id} className="p-1 text-accent">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setRenaming(null)} className="p-1 text-text-main">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm text-text-heading truncate flex-1">{r.resource_name}</span>
                          {isFolder && (canEdit || canMove) && (
                            <div
                              className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {canEdit && (
                                <button
                                  onClick={() => setRenaming({ id: r.resource_id, value: r.resource_name })}
                                  title="Rename"
                                  className="p-1 rounded text-text-main hover:bg-code-bg hover:text-text-heading"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canMove && (
                                <button
                                  onClick={() => setMoving({ id: r.resource_id, name: r.resource_name })}
                                  title="Move"
                                  className="p-1 rounded text-text-main hover:bg-code-bg hover:text-text-heading"
                                >
                                  <FolderInput className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                          <span className="text-[11px] text-text-main shrink-0">
                            {isFolder ? "" : formatBytes(r.total_resource_size)} · {formatDate(r.updated_at)}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <p className="text-[11px] text-text-main text-center">
          Preview and download for shared content aren&apos;t available yet.
        </p>
      </div>
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
