import { useEffect, useRef, useState } from "react";
import {
  Folder,
  FolderPlus,
  FileUp,
  FolderUp,
  Plus,
  Star,
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
import type { UserInfo } from "../../context/AuthContext";
import { UserMenu } from "./UserMenu";

type NavItem = { tab: SidebarTab; label: string; icon: typeof Folder };

const NAV_ITEMS_TOP: NavItem[] = [{ tab: "drive", label: "My Drive", icon: Folder }];
const SHARE_ITEMS: NavItem[] = [
  { tab: "shared", label: "Shared with you", icon: User },
  { tab: "shared-out", label: "Shared by you", icon: Users },
  { tab: "shared-links", label: "Shared by link", icon: Link2 },
];
const NAV_ITEMS_BOTTOM: NavItem[] = [
  { tab: "starred", label: "Starred", icon: Star },
  { tab: "trash", label: "Trash", icon: Trash2 },
];

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
    <li
      onClick={onClick}
      className={`flex items-center justify-between rounded-lg text-text-main font-medium text-[0.9rem] cursor-pointer transition hover:bg-code-bg hover:text-text-heading px-3 py-2 ${
        active ? "bg-accent-bg text-accent font-semibold" : ""
      }`}
    >
      <span className="flex items-center gap-3">
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </span>
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
  canUploadFiles = true,
  canCreateHere = true,
  storagePercentage,
  storageUsedLabel,
  storageTotalLabel,
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
  // Files need a folder — false at the My Drive root.
  canUploadFiles?: boolean;
  // False inside a "Shared with me" folder the caller can't create in.
  canCreateHere?: boolean;
  storagePercentage: number;
  storageUsedLabel: string;
  storageTotalLabel: string;
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
        collapsed ? "w-16 min-w-16" : "w-60 min-w-60"
      } max-[768px]:fixed max-[768px]:inset-y-0 max-[768px]:left-0 max-[768px]:z-50 max-[768px]:w-64! max-[768px]:min-w-0 max-[768px]:max-w-[85vw] max-[768px]:p-4 max-[768px]:shadow-2xl max-[768px]:transition-transform ${
        mobileOpen ? "max-[768px]:translate-x-0" : "max-[768px]:-translate-x-full"
      }`}
    >
      <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden -mr-3 pr-3">
        <div className={`flex items-center gap-2 px-1 py-1 ${collapsed ? "justify-center" : "justify-between"}`}>
          <div className="flex items-center gap-2">
            <span className="text-xl text-accent flex items-center justify-center">⚡</span>
            {!collapsed && <span className="text-lg font-bold text-text-heading tracking-tight">YFS</span>}
          </div>
          <button
            onClick={onToggleCollapsed}
            className="border-none bg-transparent p-1.5 rounded-lg cursor-pointer text-text-main hover:bg-code-bg flex items-center justify-center transition max-[768px]:hidden"
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={onMobileClose}
            className="hidden max-[768px]:flex border-none bg-transparent p-1.5 rounded-lg cursor-pointer text-text-main hover:bg-code-bg items-center justify-center transition"
            title="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative w-full flex justify-center" ref={dropdownRef}>
          <button
            onClick={() => setNewMenuOpen((v) => !v)}
            className={`flex items-center justify-center bg-bg-main border border-border-main rounded-2xl shadow-sm hover:bg-code-bg active:translate-y-0 hover:-translate-y-0.5 text-text-heading font-semibold cursor-pointer transition-all duration-200 ${
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
              {canUploadFiles && canCreateHere && (
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
        {/* Kept mounted regardless of menu open state — closing the menu right after
            triggering the picker would otherwise unmount this input before the browser's
            file-selection change event can reach it, silently dropping the upload. */}
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
        {/* webkitdirectory is non-standard and not part of React's typed input props, so it's
            set imperatively via the ref callback rather than as a JSX attribute. */}
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

        <nav>
          <ul className="flex flex-col gap-1 p-0 m-0 list-none">
            {collapsed ? (
              // Collapsed rail: every tab as a flat icon.
              [...NAV_ITEMS_TOP, ...SHARE_ITEMS, ...NAV_ITEMS_BOTTOM].map(({ tab, label, icon: Icon }) => (
                <li
                  key={tab}
                  onClick={() => selectTab(tab)}
                  title={label}
                  className={`flex items-center justify-center p-2.5 rounded-lg text-text-main cursor-pointer transition hover:bg-code-bg hover:text-text-heading ${
                    activeTab === tab ? "bg-accent-bg text-accent" : ""
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </li>
              ))
            ) : (
              <>
                {NAV_ITEMS_TOP.map(({ tab, label, icon: Icon }) => (
                  <NavRow key={tab} label={label} Icon={Icon} active={activeTab === tab} onClick={() => selectTab(tab)} />
                ))}

                <li
                  onClick={() => setSharesOpen((v) => !v)}
                  className={`flex items-center justify-between rounded-lg font-medium text-[0.9rem] cursor-pointer transition px-3 py-2 hover:bg-code-bg hover:text-text-heading ${
                    shareTabActive ? "text-accent font-semibold" : "text-text-main"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Share2 className="w-4 h-4" />
                    <span>Shares</span>
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${sharesOpen ? "rotate-180" : ""}`} />
                </li>
                {sharesOpen &&
                  SHARE_ITEMS.map(({ tab, label, icon: Icon }) => (
                    <li
                      key={tab}
                      onClick={() => selectTab(tab)}
                      className={`flex items-center gap-2.5 pl-9 pr-3 py-1.5 rounded-lg text-[0.85rem] cursor-pointer transition hover:bg-code-bg hover:text-text-heading ${
                        activeTab === tab ? "bg-accent-bg text-accent font-semibold" : "text-text-main font-medium"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{label}</span>
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
            <div className="flex justify-between font-semibold text-text-heading mb-1.5">
              <span>Storage</span>
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
            onLogout={onRequestLogout}
          />
          {!collapsed && (
            <button
              onClick={onRequestLogout}
              title="Sign out"
              className="shrink-0 p-2 rounded-lg text-text-main hover:bg-red-500/10 hover:text-red-500 border-none bg-transparent cursor-pointer flex items-center justify-center transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
