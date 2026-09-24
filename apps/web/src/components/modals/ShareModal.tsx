import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, FileText, Folder, Info, Link2, Loader2, Lock, Plus, Search, Trash2, Undo2, Users, X } from "lucide-react";
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
import { Avatar } from "../common/Avatar";
import { Checkbox } from "../common/Checkbox";
import { PermissionPicker, permsEqual, permsOf } from "../common/PermissionPicker";
import { ModalShell } from "./ModalShell";

const DEFAULT_PERMS: InternalSharePermissions = {
  can_preview: true,
  can_download: true,
  can_create: false,
  can_update: false,
  can_delete: false,
};

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

// public_info.avatar_color if the user has chosen one, else undefined.
const avatarColorOf = (u: BasicUserInfo): string | undefined => {
  const c = u.public_info?.avatar_color;
  return typeof c === "string" && c ? c : undefined;
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

const CARD = "rounded-xl border border-border-main bg-code-bg/50";
const SECTION_LABEL = "text-[11px] font-semibold uppercase tracking-wider text-text-main";

function Pill({ tone, children }: { tone: "accent" | "amber" | "red"; children: React.ReactNode }) {
  const tones = {
    accent: "bg-accent-bg text-accent border-accent-border",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    red: "bg-red-500/10 text-red-500 border-red-500/30",
  };
  return (
    <span className={`shrink-0 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium text-text-main">{label}</span>
      {children}
    </label>
  );
}

function PermissionSection({
  value,
  onChange,
  note,
}: {
  value: InternalSharePermissions;
  onChange: (next: InternalSharePermissions) => void;
  note?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className={SECTION_LABEL}>Permissions</span>
        {note}
      </div>
      <PermissionPicker value={value} onChange={onChange} />
    </div>
  );
}

function IconButton({
  onClick,
  title,
  tone = "default",
  disabled,
  children,
}: {
  onClick: () => void;
  title: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={`shrink-0 p-1.5 rounded-lg border-none bg-transparent cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed ${
        tone === "danger"
          ? "text-red-500 hover:bg-red-500/10"
          : "text-text-main hover:bg-code-bg hover:text-text-heading"
      }`}
    >
      {children}
    </button>
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

  const peopleCount = activePeople.filter((p) => !p.removed).length;
  const linkCount = activeLinks.filter((l) => !l.removed).length;

  return (
    <ModalShell onClose={onClose} size="xl" padded={false}>
      <div className="shrink-0 px-5 pt-5">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-xl bg-accent-bg border border-accent-border flex items-center justify-center">
            {item.isFolder ? <Folder className="w-4 h-4 text-accent" /> : <FileText className="w-4 h-4 text-accent" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[0.95rem] font-semibold text-text-heading leading-snug m-0">Share</h3>
            <p className="text-[11px] text-text-main truncate mt-0.5">{item.name}</p>
          </div>
          <IconButton onClick={onClose} title="Close">
            <X className="w-4 h-4" />
          </IconButton>
        </div>

        <div className="inline-flex gap-1 p-1 mt-4 bg-code-bg rounded-xl">
          {canShareInternally && (
            <TabButton
              active={tab === "people"}
              onClick={() => setTab("people")}
              icon={<Users className="w-3.5 h-3.5" />}
              count={peopleCount}
            >
              People
            </TabButton>
          )}
          <TabButton
            active={tab === "links"}
            onClick={() => setTab("links")}
            icon={<Link2 className="w-3.5 h-3.5" />}
            count={linkCount}
          >
            Public links
          </TabButton>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-text-main py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading sharing settings…
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
      </div>

      <div className="shrink-0 flex items-center gap-3 px-5 py-3.5 border-t border-border-main">
        {hasInvalidExpiry ? (
          <span className="text-[11px] text-red-500 mr-auto">Fix the expiry date on a link before saving</span>
        ) : dirty ? (
          <span className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 mr-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Unsaved changes
          </span>
        ) : (
          <span className="mr-auto" />
        )}
        <button onClick={onClose} className="btn-outline">
          {dirty ? "Discard" : "Close"}
        </button>
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
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border-none cursor-pointer transition ${
        active
          ? "bg-bg-main text-text-heading shadow-sm"
          : "bg-transparent text-text-main hover:text-text-heading"
      }`}
    >
      {icon}
      {children}
      {!!count && (
        <span
          className={`px-1.5 rounded-full text-[10px] leading-4 ${
            active ? "bg-accent-bg text-accent" : "bg-bg-main text-text-main"
          }`}
        >
          {count}
        </span>
      )}
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
    <div className="flex flex-col gap-5">
      <div className={`${CARD} p-3 flex flex-col gap-3`}>
        <div className="flex flex-col gap-1.5">
          <span className={SECTION_LABEL}>Add people</span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-main pointer-events-none" />
            <input
              type="email"
              value={emailQuery}
              onChange={(e) => setEmailQuery(e.target.value)}
              placeholder="Search people by email"
              className="dialog-input has-icon-left w-full"
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
                  return (
                    <button
                      key={u.user_id}
                      disabled={already}
                      onClick={() => onAddPerson(u)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs font-medium border-none bg-transparent cursor-pointer transition text-text-main hover:bg-code-bg hover:text-text-heading disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                      <Avatar name={name} email={u.email} color={avatarColorOf(u)} className="w-6 h-6 min-w-6 text-[10px]" />
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
        </div>

        <div className="pt-3 border-t border-border-main">
          <PermissionSection
            value={newPerms}
            onChange={setNewPerms}
            note={<span className="text-[10px] text-text-main normal-case tracking-normal font-normal">applied to people you add</span>}
          />
        </div>

        <div className="flex gap-2 text-[11px] leading-normal text-text-main">
          <Info className="w-3.5 h-3.5 shrink-0 mt-px text-accent" />
          <span>Only people in your organization who have signed in to YFS at least once.</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className={SECTION_LABEL}>People with access</span>
        {people.length === 0 ? (
          <div className={`${CARD} px-3 py-6 text-center`}>
            <Users className="w-6 h-6 mx-auto mb-2 text-text-main opacity-40" />
            <p className="text-xs text-text-main">Not shared with anyone yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {people.map((row) => (
              <div
                key={row.userId}
                className={`${CARD} p-3 flex flex-col gap-3 transition ${row.removed ? "opacity-60" : ""}`}
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={row.name} email={row.email} className="w-8 h-8 min-w-8 text-[11px]" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-text-heading truncate">{row.name || row.email}</div>
                    {row.name && <div className="text-[11px] text-text-main truncate">{row.email}</div>}
                  </div>
                  {row.removed ? (
                    <Pill tone="red">Removing</Pill>
                  ) : row.base === null ? (
                    <Pill tone="accent">New</Pill>
                  ) : (
                    personDirty(row) && <Pill tone="amber">Edited</Pill>
                  )}
                  <IconButton
                    onClick={() => patch(row.userId, { removed: !row.removed })}
                    title={row.removed ? "Keep access" : "Remove access"}
                    tone={row.removed ? "default" : "danger"}
                  >
                    {row.removed ? <Undo2 className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </IconButton>
                </div>
                {!row.removed && (
                  <div className="pt-3 border-t border-border-main">
                    <PermissionSection
                      value={row.perms}
                      onChange={(next) => patch(row.userId, { perms: next })}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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
  const toggleRemoved = (key: string, removed: boolean) =>
    setLinks((prev) => prev.map((l) => (l.key === key ? { ...l, removed } : l)));

  return (
    <div className="flex flex-col gap-3">
      {links.length === 0 ? (
        <div className={`${CARD} px-3 py-7 text-center`}>
          <Link2 className="w-6 h-6 mx-auto mb-2 text-text-main opacity-40" />
          <p className="text-xs text-text-main mb-0.5">No public links yet.</p>
          <p className="text-[11px] text-text-main opacity-70">
            Create one to share {item.isFolder ? "this folder" : "this file"} with anyone.
          </p>
        </div>
      ) : (
        links.map((l) => (
          <LinkCard
            key={l.key}
            link={l}
            dirty={linkDirty(l)}
            onPatch={(patch) => patchLink(l.key, patch)}
            onToggleRemoved={() => toggleRemoved(l.key, !l.removed)}
          />
        ))
      )}

      <button onClick={onAddLink} className="btn-outline self-start gap-1.5" style={{ width: "auto" }}>
        <Plus className="w-3.5 h-3.5" /> Add link
      </button>

      {!item.isFolder && (
        <div className="flex gap-2 text-[11px] leading-normal text-text-main">
          <Check className="w-3.5 h-3.5 shrink-0 mt-px text-accent" />
          <span>Public links are the only way to share a single file.</span>
        </div>
      )}
    </div>
  );
}

function LinkStatus({ removed, saved, dirty }: { removed: boolean; saved: boolean; dirty: boolean }) {
  const [dot, text] = removed
    ? ["bg-red-500", "Removed when you save"]
    : !saved
      ? ["bg-accent", "New · active once you save"]
      : dirty
        ? ["bg-amber-500", "Unsaved changes"]
        : ["bg-green-500", "Active"];
  return (
    <span className="flex items-center gap-1.5 text-[10px] text-text-main pl-0.5">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {text}
    </span>
  );
}

function LinkCard({
  link: l,
  dirty,
  onPatch,
  onToggleRemoved,
}: {
  link: LinkDraft;
  dirty: boolean;
  onPatch: (patch: Partial<LinkDraft>) => void;
  onToggleRemoved: () => void;
}) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const origin = window.location.origin;
  const saved = l.base !== null;
  const url = `${origin}/share/${l.shareId}`;
  const expiryErr = l.removed ? null : expiryError(l.expiresAt);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast("Couldn't copy the link to your clipboard", "error");
    }
  };

  return (
    <div className={`${CARD} overflow-hidden transition ${l.removed ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-1.5 p-3">
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div
            className="flex items-center h-8 px-2.5 rounded-lg border border-border-main bg-code-bg font-mono text-[11px] min-w-0 transition focus-within:border-accent"
            title={url}
          >
            <span className="text-text-main truncate min-w-0">{window.location.host}/share/</span>
            {saved ? (
              <span className="text-text-heading shrink-0">{l.shareId}</span>
            ) : (
              <input
                value={l.shareId}
                onChange={(e) => onPatch({ shareId: e.target.value })}
                aria-label="Link address"
                className="flex-1 min-w-[10ch] p-0 bg-transparent border-none outline-none text-text-heading font-mono text-[11px]"
              />
            )}
          </div>
          <LinkStatus removed={l.removed} saved={saved} dirty={dirty} />
        </div>

        <IconButton onClick={copy} disabled={!saved || l.removed} title={saved ? (copied ? "Copied" : "Copy link") : "Save changes first to activate this link"}>
          {copied ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
        </IconButton>
        <IconButton
          onClick={onToggleRemoved}
          title={l.removed ? "Keep link" : "Remove link"}
          tone={l.removed ? "default" : "danger"}
        >
          {l.removed ? <Undo2 className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
        </IconButton>
      </div>

      {!l.removed && (
        <div className="px-3 pb-3 pt-3 border-t border-border-main flex flex-col gap-3.5">
          <PermissionSection value={l.perms} onChange={(next) => onPatch({ perms: next })} />

          <div className="flex flex-col gap-1.5">
            <span className={SECTION_LABEL}>Protection</span>
            {!saved ? (
              <Field label="Password (optional)">
                <input
                  type="password"
                  value={l.password}
                  onChange={(e) => onPatch({ password: e.target.value })}
                  placeholder="No password"
                  className="dialog-input"
                />
              </Field>
            ) : (
              <div className="flex flex-col gap-2">
                <Checkbox
                  checked={l.changePassword}
                  onChange={(next) => onPatch({ changePassword: next, password: "" })}
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-text-main" />
                      {l.base?.password_hash ? "Change or remove password" : "Set a password"}
                    </span>
                  }
                />
                {l.changePassword && (
                  <input
                    type="password"
                    value={l.password}
                    onChange={(e) => onPatch({ password: e.target.value })}
                    placeholder="New password (leave blank to remove)"
                    className="dialog-input"
                  />
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 max-[440px]:grid-cols-1">
              <Field label="OTP emails (optional)">
                <input
                  value={l.otpEmails}
                  onChange={(e) => onPatch({ otpEmails: e.target.value })}
                  placeholder="name@company.com, …"
                  className="dialog-input"
                />
              </Field>
              <Field label="OTP phone numbers (optional)">
                <input
                  value={l.otpPhones}
                  onChange={(e) => onPatch({ otpPhones: e.target.value })}
                  placeholder="+1 555 0100, …"
                  className="dialog-input"
                />
              </Field>
            </div>

            <Field label="Expires (optional)">
              <input
                type="date"
                min={todayDateInput()}
                max={maxDateInput()}
                value={l.expiresAt}
                onChange={(e) => onPatch({ expiresAt: e.target.value })}
                className="dialog-input"
              />
            </Field>
            {expiryErr && <span className="text-[10px] text-red-500">{expiryErr}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
