import { useCallback, useEffect, useState } from "react";
import { Info, Loader2, Trash2, UserPlus } from "lucide-react";
import type { FileItem, InternalSharePermissions } from "../../types/file";
import type { BasicUserInfo } from "@yfs/service";
import {
  getFolderShareInfo,
  getUserById,
  searchUsersByEmail,
  createInternalShare,
  updateInternalShare,
  deleteInternalShare,
} from "@yfs/service";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { ModalShell } from "./ModalShell";

const PERMISSION_FIELDS: { key: keyof InternalSharePermissions; label: string }[] = [
  { key: "can_preview", label: "Preview" },
  { key: "can_download", label: "Download" },
  { key: "can_create", label: "Create" },
  { key: "can_update", label: "Edit" },
  { key: "can_delete", label: "Delete" },
];

const DEFAULT_PERMS: InternalSharePermissions = {
  can_preview: true,
  can_download: true,
  can_create: false,
  can_update: false,
  can_delete: false,
};

interface ShareRow {
  userId: string;
  email: string;
  permissions: InternalSharePermissions;
}

function PermissionToggles({
  value,
  disabled,
  onChange,
}: {
  value: InternalSharePermissions;
  disabled?: boolean;
  onChange: (next: InternalSharePermissions) => void;
}) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {PERMISSION_FIELDS.map(({ key, label }) => (
        <label key={key} className="flex items-center gap-1.5 text-[11px] text-text-heading cursor-pointer">
          <input
            type="checkbox"
            checked={value[key]}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
          />
          {label}
        </label>
      ))}
    </div>
  );
}

export function ShareModal({ item, onClose }: { item: FileItem; onClose: () => void }) {
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const [rows, setRows] = useState<ShareRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [emailQuery, setEmailQuery] = useState("");
  const [results, setResults] = useState<BasicUserInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<BasicUserInfo | null>(null);
  const [newPerms, setNewPerms] = useState<InternalSharePermissions>(DEFAULT_PERMS);

  const sharingDisabled = user?.is_sharing_enabled === false;
  const shareable = item.isFolder && !sharingDisabled && !!token;

  const refresh = useCallback(async () => {
    if (!token || !item.isFolder) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const forFolder = await getFolderShareInfo(token, item.id);
      const withEmails = await Promise.all(
        forFolder.map(async (s): Promise<ShareRow> => {
          let email = s.shared_with_user_id;
          try {
            const u = await getUserById(token, s.shared_with_user_id);
            if (u) email = u.email;
          } catch {
            /* fall back to showing the id */
          }
          return {
            userId: s.shared_with_user_id,
            email,
            permissions: {
              can_preview: s.can_preview,
              can_download: s.can_download,
              can_create: s.can_create,
              can_update: s.can_update,
              can_delete: s.can_delete,
            },
          };
        })
      );
      setRows(withEmails);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't load sharing info", "error");
    } finally {
      setLoading(false);
    }
  }, [token, item.id, item.isFolder, showToast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Debounced same-organization user search for the "add people" field.
  useEffect(() => {
    const q = emailQuery.trim();
    if (!token || q.length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await searchUsersByEmail(token, q);
        if (active) setResults(found);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [emailQuery, token]);

  const handleAdd = async () => {
    if (!token || !picked) return;
    setBusy(true);
    try {
      await createInternalShare(token, {
        folderId: item.id,
        sharedWithUserId: picked.user_id,
        permissions: newPerms,
      });
      showToast(`Shared with ${picked.email}`, "success");
      setPicked(null);
      setEmailQuery("");
      setResults([]);
      setNewPerms(DEFAULT_PERMS);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't share the folder", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (row: ShareRow, next: InternalSharePermissions) => {
    if (!token) return;
    setRows((prev) => prev.map((r) => (r.userId === row.userId ? { ...r, permissions: next } : r)));
    try {
      await updateInternalShare(token, { folderId: item.id, sharedWithUserId: row.userId, permissions: next });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't update permissions", "error");
      await refresh();
    }
  };

  const handleRemove = async (row: ShareRow) => {
    if (!token) return;
    setBusy(true);
    try {
      await deleteInternalShare(token, item.id, row.userId);
      showToast(`Stopped sharing with ${row.email}`, "success");
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't remove the share", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell onClose={onClose} size="lg">
      <h3 className="modal-title">Share "{item.name}"</h3>

      {!item.isFolder ? (
        <div className="flex gap-2.5 text-left bg-accent-bg border border-accent-border text-text-heading p-3 rounded-xl text-[11px] leading-normal mb-4">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-accent" />
          <span>Only folders can be shared. Move this file into a folder and share that instead.</span>
        </div>
      ) : sharingDisabled ? (
        <div className="flex gap-2.5 text-left bg-red-500/5 border border-red-500/20 text-red-500 p-3 rounded-xl text-[11px] leading-normal mb-4">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>Sharing is turned off for your organization. Ask an admin to enable it.</span>
        </div>
      ) : (
        <div className="flex gap-2.5 text-left bg-accent-bg border border-accent-border text-text-heading p-3 rounded-xl text-[11px] leading-normal mb-4">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-accent" />
          <span>You can only share with people in your organization who have signed in to YFS at least once.</span>
        </div>
      )}

      {item.isFolder && (
        <div className="flex flex-col gap-4 mb-5">
          <div>
            <label className="data-label mb-1.5 block">People with access</label>
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-text-main py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
              </div>
            ) : rows.length === 0 ? (
              <div className="text-xs text-text-main py-1">Not shared with anyone yet.</div>
            ) : (
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                {rows.map((row) => (
                  <div key={row.userId} className="bg-code-bg rounded-lg px-2.5 py-2 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-text-heading truncate">{row.email}</span>
                      <button
                        onClick={() => handleRemove(row)}
                        disabled={busy}
                        className="flex items-center gap-1 text-[11px] text-red-500 bg-transparent border-none cursor-pointer hover:bg-red-500/10 rounded px-1.5 py-0.5 shrink-0 disabled:opacity-50"
                      >
                        <Trash2 className="w-3 h-3" /> Remove
                      </button>
                    </div>
                    <PermissionToggles value={row.permissions} disabled={busy} onChange={(next) => handleUpdate(row, next)} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {shareable && (
            <div className="border-t border-border-main pt-3 flex flex-col gap-2">
              <label className="data-label block">Add people</label>
              {picked ? (
                <div className="flex items-center justify-between gap-2 bg-code-bg rounded-lg px-2.5 py-1.5">
                  <span className="text-xs text-text-heading truncate">{picked.email}</span>
                  <button
                    onClick={() => setPicked(null)}
                    className="text-[11px] text-text-main bg-transparent border-none cursor-pointer hover:text-red-500"
                  >
                    change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="email"
                    value={emailQuery}
                    onChange={(e) => setEmailQuery(e.target.value)}
                    placeholder="Search by email"
                    className="dialog-input w-full"
                  />
                  {(searching || results.length > 0) && emailQuery.trim().length >= 2 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-bg-main border border-border-main rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {searching && <div className="px-2.5 py-1.5 text-[11px] text-text-main">Searching…</div>}
                      {!searching && results.length === 0 && (
                        <div className="px-2.5 py-1.5 text-[11px] text-text-main">No matching users.</div>
                      )}
                      {results.map((u) => {
                        const shared = rows.some((r) => r.userId === u.user_id);
                        return (
                          <button
                            key={u.user_id}
                            disabled={shared}
                            onClick={() => {
                              setPicked(u);
                              setResults([]);
                            }}
                            className="w-full text-left px-2.5 py-1.5 text-xs text-text-heading hover:bg-code-bg disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {u.email} {shared && <span className="text-[10px] text-text-main">· already shared</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <PermissionToggles value={newPerms} onChange={setNewPerms} />

              <button
                onClick={handleAdd}
                disabled={!picked || busy}
                className="btn-primary self-start flex items-center gap-1.5"
                style={{ width: "auto" }}
              >
                <UserPlus className="w-3.5 h-3.5" /> Share
              </button>
            </div>
          )}
        </div>
      )}

      <div className="modal-actions">
        <button onClick={onClose} className="btn-outline">
          Done
        </button>
      </div>
    </ModalShell>
  );
}
