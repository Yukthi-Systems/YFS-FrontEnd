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
import {
  Folder,
  FolderPlus,
  FileUp,
  FolderUp,
  Plus,
  RefreshCw,
  Trash2,
  LogOut,
  Users,
  User,
  Link2,
  Share2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import type { SidebarTab } from "../../types/file";
import type { UserInfo } from "../../atoms/auth";
import { useToast } from "../../atoms/toast";
import { UserMenu } from "./UserMenu";

type NavItem = { tab: SidebarTab; label: string; icon: typeof Folder };

const NAV_ITEMS_TOP: NavItem[] = [{ tab: "drive", label: "My Drive", icon: Folder }];
const SHARE_ITEMS: NavItem[] = [
  { tab: "shared", label: "Shared with you", icon: User },
  { tab: "shared-out", label: "Shared by you", icon: Users },
  { tab: "shared-links", label: "Shared by link", icon: Link2 },
];
const NAV_ITEMS_BOTTOM: NavItem[] = [
  { tab: "trash", label: "Trash", icon: Trash2 },
];

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-main";

function NavRow({
  label,
  Icon,
  active,
  onClick,
}: {
  label: string;
  Icon: typeof Folder;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={`w-full flex items-center gap-3 rounded-lg text-[0.9rem] text-left cursor-pointer transition px-3 py-2 border-none ${focusRing} ${
          active
            ? "bg-accent-bg text-accent font-semibold"
            : "bg-transparent text-text-main font-medium hover:bg-code-bg hover:text-text-heading"
        }`}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="truncate">{label}</span>
      </button>
    </li>
  );
}

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  activeTab,
  onTabChange,
  onCreateFolder,
  onUploadFiles,
  canCreateHere = true,
  isRootFolder = false,
  storagePercentage,
  storageUsedLabel,
  storageTotalLabel,
  storageFileCount,
  onRefreshQuota,
  refreshingQuota = false,
  user,
  onRequestLogout,
  mobileOpen = false,
  onMobileClose,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onCreateFolder: () => void;
  onUploadFiles: (files: FileList) => void;
  // False inside a "Shared with me" folder the caller can't create in.
  canCreateHere?: boolean;
  // My Drive root can't hold files directly — only folder uploads (they nest) are allowed here.
  isRootFolder?: boolean;
  storagePercentage: number;
  storageUsedLabel: string;
  storageTotalLabel: string;
  // From GET /user/quota — undefined until that request resolves.
  storageFileCount?: number;
  // Expensive server-side recalculation, so it's behind a confirm.
  onRefreshQuota?: () => void;
  refreshingQuota?: boolean;
  user: UserInfo | null;
  onRequestLogout: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const shareTabActive = activeTab === "shared" || activeTab === "shared-out" || activeTab === "shared-links";
  const [sharesOpen, setSharesOpen] = useState(shareTabActive);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (!newMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setNewMenuOpen(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [newMenuOpen]);

  const triggerFileUpload = () => {
    if (isRootFolder) {
      showToast("Open or create a folder to upload files — My Drive can't hold files directly", "error");
      setNewMenuOpen(false);
      return;
    }
    fileInputRef.current?.click();
    setNewMenuOpen(false);
  };

  const triggerFolderUpload = () => {
    folderInputRef.current?.click();
    setNewMenuOpen(false);
  };

  const selectTab = (tab: SidebarTab) => {
    onTabChange(tab);
    onMobileClose?.();
  };

  return (
    <aside
      className={`bg-bg-main border-r border-border-main flex flex-col p-4 box-border shrink-0 transition-all duration-300 ${
        collapsed ? "w-[72px] min-w-[72px]" : "w-60 min-w-60"
      } max-[768px]:fixed max-[768px]:inset-y-0 max-[768px]:left-0 max-[768px]:z-50 max-[768px]:w-64! max-[768px]:min-w-0 max-[768px]:max-w-[85vw] max-[768px]:p-4 max-[768px]:shadow-2xl max-[768px]:transition-transform ${
        mobileOpen ? "max-[768px]:translate-x-0" : "max-[768px]:-translate-x-full"
      }`}
    >
      <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden -mr-3 pr-3">
        <div className={`flex items-center gap-2 px-1 py-1 ${collapsed ? "justify-center" : "justify-between"}`}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl text-accent flex items-center justify-center shrink-0">⚡</span>
            {!collapsed && (
              <span
                className="text-lg font-bold text-text-heading tracking-tight truncate"
                title={user?.organization_name || "YFS"}
              >
                {user?.organization_name || "YFS"}
              </span>
            )}
          </div>
          <button
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            className={`border-none bg-transparent p-1.5 rounded-lg cursor-pointer text-text-main hover:bg-code-bg flex items-center justify-center transition max-[768px]:hidden ${focusRing}`}
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={onMobileClose}
            aria-label="Close menu"
            className={`hidden max-[768px]:flex border-none bg-transparent p-1.5 rounded-lg cursor-pointer text-text-main hover:bg-code-bg items-center justify-center transition ${focusRing}`}
            title="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative w-full flex justify-center" ref={dropdownRef}>
          <button
            onClick={() => setNewMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={newMenuOpen}
            className={`flex items-center justify-center bg-bg-main border border-border-main rounded-2xl shadow-sm hover:bg-code-bg active:translate-y-0 hover:-translate-y-0.5 text-text-heading font-semibold cursor-pointer transition-all duration-200 ${focusRing} ${
              collapsed ? "w-10 h-10 rounded-full p-0" : "gap-2 w-32 py-2 px-4"
            }`}
            title={collapsed ? "New" : undefined}
          >
            <Plus className="w-5 h-5 text-accent" strokeWidth={2.5} />
            {!collapsed && <span>New</span>}
          </button>
          {newMenuOpen && (
            <div
              className={`absolute z-50 w-48 bg-bg-main border border-border-main rounded-xl p-1.5 shadow-md flex flex-col gap-0.5 animate-scale-in ${
                collapsed ? "top-0 left-full ml-2" : "top-[calc(100%+8px)] left-0"
              }`}
            >
              {canCreateHere && (
                <button
                  onClick={() => {
                    onCreateFolder();
                    setNewMenuOpen(false);
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 border-none bg-transparent text-text-main rounded-lg text-[0.85rem] font-medium text-left cursor-pointer hover:bg-accent-bg hover:text-accent transition duration-150"
                >
                  <FolderPlus className="w-4 h-4" /> Create Folder
                </button>
              )}
              {canCreateHere && (
                <button
                  onClick={triggerFileUpload}
                  className="flex items-center gap-2.5 px-3 py-2 border-none bg-transparent text-text-main rounded-lg text-[0.85rem] font-medium text-left cursor-pointer hover:bg-accent-bg hover:text-accent transition duration-150"
                >
                  <FileUp className="w-4 h-4" /> Upload File
                </button>
              )}
              {canCreateHere && (
                <button
                  onClick={triggerFolderUpload}
                  className="flex items-center gap-2.5 px-3 py-2 border-none bg-transparent text-text-main rounded-lg text-[0.85rem] font-medium text-left cursor-pointer hover:bg-accent-bg hover:text-accent transition duration-150"
                >
                  <FolderUp className="w-4 h-4" /> Upload Folder
                </button>
              )}
              {!canCreateHere && (
                <span className="px-3 py-2 text-[11px] text-text-main">
                  You don't have permission to add items here.
                </span>
              )}
            </div>
          )}
        </div>
        {/* Stays mounted so closing the menu doesn't drop the file-picker change event. */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) onUploadFiles(e.target.files);
            e.target.value = "";
          }}
          style={{ display: "none" }}
          multiple
        />
        {/* webkitdirectory isn't in React's input types, so it's set via the ref. */}
        <input
          type="file"
          ref={(el) => {
            folderInputRef.current = el;
            if (el) el.setAttribute("webkitdirectory", "");
          }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) onUploadFiles(e.target.files);
            e.target.value = "";
          }}
          style={{ display: "none" }}
          multiple
        />

        <nav aria-label="Sidebar">
          <ul className="flex flex-col gap-1 p-0 m-0 list-none">
            {collapsed ? (
              [NAV_ITEMS_TOP, SHARE_ITEMS, NAV_ITEMS_BOTTOM].map((group, groupIndex) => (
                <li key={groupIndex} className={groupIndex > 0 ? "mt-2 pt-2 border-t border-border-main" : undefined}>
                  <ul className="flex flex-col items-center gap-1 p-0 m-0 list-none">
                    {group.map(({ tab, label, icon: Icon }) => (
                      <li key={tab}>
                        <button
                          type="button"
                          onClick={() => selectTab(tab)}
                          aria-label={label}
                          aria-current={activeTab === tab ? "page" : undefined}
                          title={label}
                          className={`w-10 h-10 flex items-center justify-center rounded-xl cursor-pointer transition border-none ${focusRing} ${
                            activeTab === tab
                              ? "bg-accent-bg text-accent font-semibold"
                              : "bg-transparent text-text-main hover:bg-code-bg hover:text-text-heading"
                          }`}
                        >
                          <Icon className="w-[18px] h-[18px]" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))
            ) : (
              <>
                {NAV_ITEMS_TOP.map(({ tab, label, icon: Icon }) => (
                  <NavRow key={tab} label={label} Icon={Icon} active={activeTab === tab} onClick={() => selectTab(tab)} />
                ))}

                <li>
                  <button
                    type="button"
                    onClick={() => setSharesOpen((v) => !v)}
                    aria-expanded={sharesOpen}
                    className={`w-full flex items-center justify-between rounded-lg font-medium text-[0.9rem] text-left cursor-pointer transition px-3 py-2 border-none bg-transparent hover:bg-code-bg hover:text-text-heading ${focusRing} ${
                      shareTabActive ? "text-accent font-semibold" : "text-text-main"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Share2 className="w-4 h-4" />
                      <span>Shares</span>
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${sharesOpen ? "rotate-180" : ""}`} />
                  </button>
                </li>
                {sharesOpen &&
                  SHARE_ITEMS.map(({ tab, label, icon: Icon }) => (
                    <li key={tab}>
                      <button
                        type="button"
                        onClick={() => selectTab(tab)}
                        aria-current={activeTab === tab ? "page" : undefined}
                        className={`w-full flex items-center gap-2.5 pl-9 pr-3 py-1.5 rounded-lg text-[0.85rem] text-left cursor-pointer transition border-none bg-transparent hover:bg-code-bg hover:text-text-heading ${focusRing} ${
                          activeTab === tab ? "bg-accent-bg text-accent font-semibold" : "text-text-main font-medium"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{label}</span>
                      </button>
                    </li>
                  ))}

                {NAV_ITEMS_BOTTOM.map(({ tab, label, icon: Icon }) => (
                  <NavRow key={tab} label={label} Icon={Icon} active={activeTab === tab} onClick={() => selectTab(tab)} />
                ))}
              </>
            )}
          </ul>
        </nav>
      </div>

      <div className="flex flex-col gap-3">
        {!collapsed && (
          <div className="bg-code-bg p-3 rounded-xl border border-border-main text-[11px]">
            <div className="flex justify-between items-center font-semibold text-text-heading mb-1.5">
              <span className="flex items-center gap-1">
                Storage
                {onRefreshQuota && (
                  <button
                    onClick={onRefreshQuota}
                    disabled={refreshingQuota}
                    title="Refresh storage usage"
                    aria-label="Refresh storage usage"
                    className="p-0.5 rounded text-text-main hover:text-accent hover:bg-accent-bg disabled:opacity-50 disabled:cursor-not-allowed border-none bg-transparent cursor-pointer inline-flex items-center justify-center transition"
                  >
                    <RefreshCw className={`w-3 h-3 ${refreshingQuota ? "animate-spin" : ""}`} />
                  </button>
                )}
              </span>
              <span>{Math.round(storagePercentage)}% Used</span>
            </div>
            <div className="w-full h-1.5 bg-border-main rounded-full overflow-hidden mb-2.5">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${storagePercentage}%` }}
              ></div>
            </div>
            <span className="text-text-main text-[11px]">
              {storageUsedLabel} of {storageTotalLabel} used
              {storageFileCount !== undefined && ` · ${storageFileCount.toLocaleString()} file${storageFileCount === 1 ? "" : "s"}`}
            </span>
          </div>
        )}

        <div className="border-t border-border-main pt-3 flex items-center gap-1">
          <UserMenu
            user={user}
            compact={collapsed}
            storagePercentage={storagePercentage}
            storageUsedLabel={storageUsedLabel}
            storageTotalLabel={storageTotalLabel}
            storageFileCount={storageFileCount}
            onLogout={onRequestLogout}
          />
          {!collapsed && (
            <button
              onClick={onRequestLogout}
              title="Sign out"
              aria-label="Sign out"
              className={`shrink-0 p-2 rounded-lg text-text-main hover:bg-red-500/10 hover:text-red-500 border-none bg-transparent cursor-pointer flex items-center justify-center transition ${focusRing}`}
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
