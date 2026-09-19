import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Info, Link2, Loader2, Plus, Trash2, Undo2, Users, X } from "lucide-react";
import type { FileItem, InternalSharePermissions } from "../../types/file";
import type { BasicUserInfo, ExternalShare } from "@yfs/service";
import {
  getFolderShareInfo,
  getUserById,
  searchUsersByEmail,
  createInternalShare,
  updateInternalShare,
  deleteInternalShare,
  listExternalShares,
  createExternalShare,
  updateExternalShare,
  deleteExternalShare,
} from "@yfs/service";
import { useAuth } from "../../hooks/useAuth";
import { withAuthRetry } from "../../utils/authRetry";
import { useToast } from "../../atoms/toast";
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

const permsOf = (s: InternalSharePermissions): InternalSharePermissions => ({
  can_preview: s.can_preview,
  can_download: s.can_download,
  can_create: s.can_create,
  can_update: s.can_update,
  can_delete: s.can_delete,
});
const permsEqual = (a: InternalSharePermissions, b: InternalSharePermissions) =>
  PERMISSION_FIELDS.every(({ key }) => a[key] === b[key]);
const newShareId = () => Math.random().toString(36).slice(2, 12);
// Extract the *local* calendar date an ISO instant falls on (not a raw UTC slice —
// see toExpiresIso below for why the two have to agree).
const toDateInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const toExpiresIso = (dateStr: string): string | null => {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
};
const todayDateInput = () => toDateInput(new Date().toISOString());
// Links can't be set to expire more than 3 months out.
const MAX_EXPIRY_MONTHS = 3;
const maxDateInput = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + MAX_EXPIRY_MONTHS);
  return toDateInput(d.toISOString());
};
const isPastDate = (dateStr: string) => !!dateStr && dateStr < todayDateInput();
const isTooFarFuture = (dateStr: string) => !!dateStr && dateStr > maxDateInput();
const expiryError = (dateStr: string): string | null => {
  if (isPastDate(dateStr)) return "Expiry date can't be in the past.";
  if (isTooFarFuture(dateStr)) return `Expiry can't be more than ${MAX_EXPIRY_MONTHS} months out.`;
  return null;
};
const splitList = (raw: string) =>
  raw.split(",").map((s) => s.trim()).filter(Boolean);
const sameList = (a: string[], b: string[]) => [...a].sort().join(",") === [...b].sort().join(",");
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

interface PersonRow {
  userId: string;
  email: string;
  name?: string; // public_info.display_name, when the user has set one
  base: InternalSharePermissions | null; // null = not yet on the server
  perms: InternalSharePermissions;
  removed: boolean;
}

// public_info.display_name if the user has set one, else undefined.
const displayNameOf = (u: BasicUserInfo): string | undefined => {
  const n = u.public_info?.display_name;
  return typeof n === "string" && n.trim() ? n.trim() : undefined;
};

interface LinkDraft {
  key: string;
  shareId: string;
  base: ExternalShare | null; // null = not yet on the server
  perms: InternalSharePermissions;
  otpEmails: string;
  otpPhones: string;
  expiresAt: string; // yyyy-mm-dd
  changePassword: boolean;
  password: string;
  removed: boolean;
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
  const { token, user, refreshAccessToken } = useAuth();
  const { showToast } = useToast();

  const sharingDisabled = user?.is_sharing_enabled === false;
  const canShareInternally = item.isFolder && !sharingDisabled;

  const [tab, setTab] = useState<"people" | "links">(canShareInternally ? "people" : "links");
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [links, setLinks] = useState<LinkDraft[]>([]);

  // Add-people search.
  const [emailQuery, setEmailQuery] = useState("");
  const [debouncedEmailQuery, setDebouncedEmailQuery] = useState("");
  const [newPerms, setNewPerms] = useState<InternalSharePermissions>(DEFAULT_PERMS);

  const targetKey = item.isFolder ? "share_folder_target_id" : "share_file_target_id";
  const queryClient = useQueryClient();
  const shareQueryKey = ["shareInfo", item.id] as const;

  const shareQuery = useQuery({
    queryKey: shareQueryKey,
    queryFn: async () => {
      const [shareInfo, allLinks] = await Promise.all([
        canShareInternally
          ? withAuthRetry(token, refreshAccessToken, (tk) => getFolderShareInfo(tk, item.id))
          : Promise.resolve([]),
        (async () => {
          const out: ExternalShare[] = [];
          for (let offset = 0; offset < 2000; offset += 100) {
            const page = await withAuthRetry(token, refreshAccessToken, (tk) =>
              listExternalShares(tk, { limit: 100, offset })
            );
            out.push(...page);
            if (page.length < 100) break;
          }
          return out.filter((s) => s[targetKey] === item.id);
        })(),
      ]);

      const rows = await Promise.all(
        shareInfo.map(async (s): Promise<PersonRow> => {
          let email = s.shared_with_user_id;
          let name: string | undefined;
          try {
            const u = await withAuthRetry(token, refreshAccessToken, (tk) => getUserById(tk, s.shared_with_user_id));
            if (u) {
              email = u.email;
              name = displayNameOf(u);
            }
          } catch {
            /* fall back to id */
          }
          const perms = permsOf(s);
          return { userId: s.shared_with_user_id, email, name, base: perms, perms, removed: false };
        })
      );

      return { rows, links: allLinks };
    },
    enabled: !!token,
  });

  useEffect(() => {
    if (shareQuery.isError) showToast(errMsg(shareQuery.error), "error");
  }, [shareQuery.isError, shareQuery.error, showToast]);

  // Reset the editable drafts to match the server truth whenever fresh data lands —
  // on first load and again after a save (which invalidates this query).
  useEffect(() => {
    if (!shareQuery.data) return;
    setPeople(shareQuery.data.rows);
    setLinks(
      shareQuery.data.links.map((s) => ({
        key: s.share_id,
        shareId: s.share_id,
        base: s,
        perms: permsOf(s.permission_set),
        otpEmails: s.emails_for_otp.join(", "),
        otpPhones: s.phones_for_otp.join(", "),
        expiresAt: toDateInput(s.expires_at),
        changePassword: false,
        password: "",
        removed: false,
      }))
    );
  }, [shareQuery.data]);

  const loading = !!token && shareQuery.isPending;

  // Debounced same-organization user search: debouncing is a UI concern (kept as a
  // plain timer), the fetch itself is a query keyed on the debounced value.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedEmailQuery(emailQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [emailQuery]);

  const searchEnabled = !!token && debouncedEmailQuery.length >= 2;
  const searchQuery = useQuery({
    queryKey: ["userSearch", debouncedEmailQuery],
    queryFn: () => withAuthRetry(token, refreshAccessToken, (tk) => searchUsersByEmail(tk, debouncedEmailQuery)),
    enabled: searchEnabled,
  });
  const results = searchEnabled ? (searchQuery.data ?? []) : [];
  const searching = searchEnabled && searchQuery.isFetching;

  const addPerson = (u: BasicUserInfo) => {
    setPeople((prev) => {
      const existing = prev.find((p) => p.userId === u.user_id);
      if (existing) return prev.map((p) => (p.userId === u.user_id ? { ...p, removed: false, perms: newPerms } : p));
      return [
        ...prev,
        { userId: u.user_id, email: u.email, name: displayNameOf(u), base: null, perms: newPerms, removed: false },
      ];
    });
    setEmailQuery("");
    setDebouncedEmailQuery("");
    setNewPerms(DEFAULT_PERMS);
  };

  const addLink = () =>
    setLinks((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}`,
        shareId: newShareId(),
        base: null,
        perms: DEFAULT_PERMS,
        otpEmails: "",
        otpPhones: "",
        expiresAt: "",
        changePassword: false,
        password: "",
        removed: false,
      },
    ]);

  const linkDirty = (l: LinkDraft) => {
    if (l.base === null) return !l.removed;
    if (l.removed) return true;
    return (
      !permsEqual(permsOf(l.base.permission_set), l.perms) ||
      !sameList(l.base.emails_for_otp, splitList(l.otpEmails)) ||
      !sameList(l.base.phones_for_otp, splitList(l.otpPhones)) ||
      toDateInput(l.base.expires_at) !== l.expiresAt ||
      l.changePassword
    );
  };
  const personDirty = (p: PersonRow) => {
    if (p.base === null) return !p.removed;
    if (p.removed) return true;
    return !permsEqual(p.base, p.perms);
  };

  const dirty = useMemo(
    () => people.some(personDirty) || links.some(linkDirty),
    [people, links]
  );
  const hasInvalidExpiry = useMemo(
    () => links.some((l) => !l.removed && !!expiryError(l.expiresAt)),
    [links]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!token) return;
      const errors: string[] = [];

      for (const p of people) {
        try {
          if (p.base && p.removed)
            await withAuthRetry(token, refreshAccessToken, (tk) => deleteInternalShare(tk, item.id, p.userId));
          else if (!p.base && !p.removed)
            await withAuthRetry(token, refreshAccessToken, (tk) =>
              createInternalShare(tk, { folderId: item.id, sharedWithUserId: p.userId, permissions: p.perms })
            );
          else if (p.base && !p.removed && !permsEqual(p.base, p.perms))
            await withAuthRetry(token, refreshAccessToken, (tk) =>
              updateInternalShare(tk, { folderId: item.id, sharedWithUserId: p.userId, permissions: p.perms })
            );
        } catch (err) {
          errors.push(`${p.email}: ${errMsg(err)}`);
        }
      }

      for (const l of links) {
        const id = l.shareId.trim();
        try {
          if (l.base && l.removed) {
            await withAuthRetry(token, refreshAccessToken, (tk) => deleteExternalShare(tk, l.shareId));
          } else if (!l.base && !l.removed) {
            if (id.length < 3 || id.length > 36) {
              errors.push(`Link id "${id}" must be 3–36 characters`);
              continue;
            }
            const expiryErr = expiryError(l.expiresAt);
            if (expiryErr) {
              errors.push(`Link "${id}": ${expiryErr}`);
              continue;
            }
            await withAuthRetry(token, refreshAccessToken, (tk) =>
              createExternalShare(tk, {
                shareId: id,
                fileTargetId: item.isFolder ? null : item.id,
                folderTargetId: item.isFolder ? item.id : null,
                permissions: l.perms,
                rawPassword: l.password.trim() || null,
                emailsForOtp: splitList(l.otpEmails),
                phonesForOtp: splitList(l.otpPhones),
                expiresAt: toExpiresIso(l.expiresAt),
              })
            );
          } else if (l.base && !l.removed && linkDirty(l)) {
            const expiryErr = expiryError(l.expiresAt);
            if (expiryErr) {
              errors.push(`Link "${id}": ${expiryErr}`);
              continue;
            }
            await withAuthRetry(token, refreshAccessToken, (tk) =>
              updateExternalShare(tk, l.shareId, {
                permissions: l.perms,
                shareInfo: l.base!.share_info,
                updatePassword: l.changePassword,
                rawPassword: l.changePassword ? l.password.trim() || null : null,
                emailsForOtp: splitList(l.otpEmails),
                phonesForOtp: splitList(l.otpPhones),
                expiresAt: toExpiresIso(l.expiresAt),
              })
            );
          }
        } catch (err) {
          errors.push(`Link ${id}: ${errMsg(err)}`);
        }
      }

      if (errors.length) throw new Error(errors[0]);
    },
    // Always refresh from the server after a save attempt — some items may have
    // succeeded even if others failed.
    onSettled: () => queryClient.invalidateQueries({ queryKey: shareQueryKey }),
    onSuccess: () => showToast("Sharing updated", "success"),
    onError: (err) => showToast(errMsg(err), "error"),
  });

  const save = () => saveMutation.mutate();
  const saving = saveMutation.isPending;

  const patchLink = (key: string, patch: Partial<LinkDraft>) =>
    setLinks((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const activePeople = people.filter((p) => !(p.base === null && p.removed));
  const activeLinks = links.filter((l) => !(l.base === null && l.removed));

  return (
    <ModalShell onClose={onClose} size="lg">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="modal-title mb-0 truncate">Share "{item.name}"</h3>
        <button
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 -mt-1 -mr-1 p-1.5 rounded-lg text-text-main hover:bg-code-bg hover:text-text-heading transition border-none bg-transparent cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border-main mb-4 -mx-1 px-1">
        {canShareInternally && (
          <TabButton active={tab === "people"} onClick={() => setTab("people")} icon={<Users className="w-3.5 h-3.5" />}>
            People
          </TabButton>
        )}
        <TabButton active={tab === "links"} onClick={() => setTab("links")} icon={<Link2 className="w-3.5 h-3.5" />}>
          Public links
        </TabButton>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-text-main py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : tab === "people" ? (
        <PeopleTab
          item={item}
          people={activePeople}
          setPeople={setPeople}
          emailQuery={emailQuery}
          setEmailQuery={setEmailQuery}
          results={results}
          searching={searching}
          newPerms={newPerms}
          setNewPerms={setNewPerms}
          onAddPerson={addPerson}
          sharingDisabled={sharingDisabled}
          personDirty={personDirty}
        />
      ) : (
        <LinksTab
          item={item}
          links={activeLinks}
          onAddLink={addLink}
          patchLink={patchLink}
          setLinks={setLinks}
          linkDirty={linkDirty}
        />
      )}

      <div className="flex items-center justify-end gap-3 mt-5">
        {hasInvalidExpiry ? (
          <span className="text-[11px] text-red-500 mr-auto">Fix the expiry date on a link before saving</span>
        ) : (
          dirty && <span className="text-[11px] text-text-main mr-auto">Unsaved changes</span>
        )}
        <button
          onClick={save}
          disabled={!dirty || saving || hasInvalidExpiry}
          className="btn-primary flex items-center justify-center gap-1.5"
          style={{ width: "auto" }}
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </ModalShell>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition ${
        active ? "border-accent text-accent" : "border-transparent text-text-main hover:text-text-heading"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function PeopleTab({
  item,
  people,
  setPeople,
  emailQuery,
  setEmailQuery,
  results,
  searching,
  newPerms,
  setNewPerms,
  onAddPerson,
  sharingDisabled,
  personDirty,
}: {
  item: FileItem;
  people: PersonRow[];
  setPeople: React.Dispatch<React.SetStateAction<PersonRow[]>>;
  emailQuery: string;
  setEmailQuery: (v: string) => void;
  results: BasicUserInfo[];
  searching: boolean;
  newPerms: InternalSharePermissions;
  setNewPerms: (p: InternalSharePermissions) => void;
  onAddPerson: (u: BasicUserInfo) => void;
  sharingDisabled: boolean;
  personDirty: (p: PersonRow) => boolean;
}) {
  if (!item.isFolder) {
    return (
      <div className="flex gap-2.5 bg-accent-bg border border-accent-border text-text-heading p-3 rounded-xl text-[11px] leading-normal">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-accent" />
        <span>Only folders can be shared with people. Use a public link to share this file.</span>
      </div>
    );
  }
  if (sharingDisabled) {
    return (
      <div className="flex gap-2.5 bg-red-500/5 border border-red-500/20 text-red-500 p-3 rounded-xl text-[11px] leading-normal">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>Sharing is turned off for your organization. Ask an admin to enable it.</span>
      </div>
    );
  }

  const patch = (userId: string, p: Partial<PersonRow>) =>
    setPeople((prev) => prev.map((r) => (r.userId === userId ? { ...r, ...p } : r)));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="data-label mb-1.5 block">People with access</label>
        {people.length === 0 ? (
          <div className="text-xs text-text-main py-1">Not shared with anyone yet.</div>
        ) : (
          <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
            {people.map((row) => (
              <div
                key={row.userId}
                className={`bg-code-bg rounded-lg px-2.5 py-2 flex flex-col gap-1.5 ${row.removed ? "opacity-50" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-text-heading truncate">
                    {row.name ? (
                      <>
                        {row.name} <span className="text-text-main">· {row.email}</span>
                      </>
                    ) : (
                      row.email
                    )}
                    {row.base === null && <span className="ml-1.5 text-[10px] text-accent">· new</span>}
                    {personDirty(row) && row.base !== null && !row.removed && (
                      <span className="ml-1.5 text-[10px] text-amber-500">· edited</span>
                    )}
                  </span>
                  <button
                    onClick={() => patch(row.userId, { removed: !row.removed })}
                    className="flex items-center gap-1 text-[11px] text-red-500 bg-transparent border-none cursor-pointer hover:bg-red-500/10 rounded px-1.5 py-0.5 shrink-0"
                  >
                    {row.removed ? <Undo2 className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                    {row.removed ? "Keep" : "Remove"}
                  </button>
                </div>
                {!row.removed && (
                  <PermissionToggles
                    value={row.perms}
                    onChange={(next) => patch(row.userId, { perms: next })}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border-main pt-3 flex flex-col gap-2">
        <label className="data-label block">Add people</label>
        <div className="flex gap-2.5 bg-accent-bg border border-accent-border text-text-heading p-2.5 rounded-xl text-[11px] leading-normal">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-accent" />
          <span>Only people in your organization who have signed in to YFS at least once.</span>
        </div>
        <div className="relative">
          <input
            type="email"
            value={emailQuery}
            onChange={(e) => setEmailQuery(e.target.value)}
            placeholder="Search by email"
            className="dialog-input w-full"
          />
          {(searching || results.length > 0) && emailQuery.trim().length >= 2 && (
            <div className="absolute z-20 left-0 right-0 mt-1.5 bg-bg-main border border-border-main rounded-xl p-1 shadow-lg animate-scale-in max-h-48 overflow-y-auto flex flex-col gap-0.5">
              {searching && (
                <div className="flex items-center gap-2 px-2.5 py-2 text-[11px] text-text-main">
                  <Loader2 className="w-3 h-3 animate-spin" /> Searching…
                </div>
              )}
              {!searching && results.length === 0 && (
                <div className="px-2.5 py-2 text-[11px] text-text-main">No matching users.</div>
              )}
              {results.map((u) => {
                const already = people.some((p) => p.userId === u.user_id && !p.removed);
                const name = displayNameOf(u);
                const initials = (name || u.email).substring(0, 2).toUpperCase();
                return (
                  <button
                    key={u.user_id}
                    disabled={already}
                    onClick={() => onAddPerson(u)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs font-medium border-none bg-transparent cursor-pointer transition text-text-main hover:bg-code-bg hover:text-text-heading disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <span className="w-6 h-6 min-w-6 rounded-full bg-gradient-to-tr from-accent to-indigo-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                      {initials}
                    </span>
                    <span className="flex-1 truncate text-text-heading">
                      {name ? (
                        <>
                          {name} <span className="text-text-main font-normal">· {u.email}</span>
                        </>
                      ) : (
                        u.email
                      )}
                    </span>
                    {already && <span className="text-[10px] text-text-main shrink-0">Added</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-text-main">Permissions for new people</span>
          <PermissionToggles value={newPerms} onChange={setNewPerms} />
        </div>
      </div>
    </div>
  );
}

function LinksTab({
  item,
  links,
  onAddLink,
  patchLink,
  setLinks,
  linkDirty,
}: {
  item: FileItem;
  links: LinkDraft[];
  onAddLink: () => void;
  patchLink: (key: string, patch: Partial<LinkDraft>) => void;
  setLinks: React.Dispatch<React.SetStateAction<LinkDraft[]>>;
  linkDirty: (l: LinkDraft) => boolean;
}) {
  const origin = window.location.origin;
  const toggleRemoved = (key: string, removed: boolean) =>
    setLinks((prev) => prev.map((l) => (l.key === key ? { ...l, removed } : l)));

  return (
    <div className="flex flex-col gap-3">
      {links.length === 0 && <div className="text-xs text-text-main">No public links yet.</div>}

      {links.map((l) => {
        const expiryErr = l.removed ? null : expiryError(l.expiresAt);
        return (
          <div
            key={l.key}
            className={`bg-code-bg rounded-lg px-2.5 py-2.5 flex flex-col gap-2.5 ${l.removed ? "opacity-50" : ""}`}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-text-main shrink-0">{origin}/share/</span>
              <input
                value={l.shareId}
                disabled={l.base !== null}
                onChange={(e) => patchLink(l.key, { shareId: e.target.value })}
                className="dialog-input flex-1 font-mono text-[11px] disabled:opacity-70"
              />
              <button
                onClick={() => toggleRemoved(l.key, !l.removed)}
                title={l.removed ? "Keep link" : "Remove link"}
                className="p-1 rounded text-red-500 hover:bg-red-500/10 shrink-0"
              >
                {l.removed ? <Undo2 className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </div>

            {!l.removed && (
              <>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-text-main">Permissions</span>
                    {l.base === null && <span className="text-[10px] text-accent">· new</span>}
                    {l.base !== null && linkDirty(l) && <span className="text-[10px] text-amber-500">· edited</span>}
                  </div>
                  <PermissionToggles value={l.perms} onChange={(next) => patchLink(l.key, { perms: next })} />
                </div>

                {l.base === null ? (
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-text-main">Password (optional)</span>
                    <input
                      type="password"
                      value={l.password}
                      onChange={(e) => patchLink(l.key, { password: e.target.value })}
                      placeholder="No password"
                      className="dialog-input"
                    />
                  </label>
                ) : (
                  <div className="flex flex-col gap-1">
                    <label className="flex items-center gap-1.5 text-[11px] text-text-heading cursor-pointer">
                      <input
                        type="checkbox"
                        checked={l.changePassword}
                        onChange={(e) => patchLink(l.key, { changePassword: e.target.checked, password: "" })}
                      />
                      {l.base.password_hash ? "Change / remove password" : "Set a password"}
                    </label>
                    {l.changePassword && (
                      <input
                        type="password"
                        value={l.password}
                        onChange={(e) => patchLink(l.key, { password: e.target.value })}
                        placeholder="New password (leave blank to remove)"
                        className="dialog-input"
                      />
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-text-main">OTP emails (optional)</span>
                    <input
                      value={l.otpEmails}
                      onChange={(e) => patchLink(l.key, { otpEmails: e.target.value })}
                      placeholder="name@company.com, …"
                      className="dialog-input"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-text-main">OTP phone numbers (optional)</span>
                    <input
                      value={l.otpPhones}
                      onChange={(e) => patchLink(l.key, { otpPhones: e.target.value })}
                      placeholder="+1 555 0100, …"
                      className="dialog-input"
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-text-main">Expires (optional)</span>
                  <input
                    type="date"
                    min={todayDateInput()}
                    max={maxDateInput()}
                    value={l.expiresAt}
                    onChange={(e) => patchLink(l.key, { expiresAt: e.target.value })}
                    className="dialog-input"
                  />
                  {expiryErr && <span className="text-[10px] text-red-500">{expiryErr}</span>}
                </label>
              </>
            )}
          </div>
        );
      })}

      <button onClick={onAddLink} className="btn-outline self-start flex items-center gap-1.5" style={{ width: "auto" }}>
        <Plus className="w-3.5 h-3.5" /> Add link
      </button>

      {!item.isFolder && (
        <div className="flex gap-2.5 bg-accent-bg border border-accent-border text-text-heading p-2.5 rounded-xl text-[11px] leading-normal">
          <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-accent" />
          <span>Public links are the only way to share a single file.</span>
        </div>
      )}
    </div>
  );
}
