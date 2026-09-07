import { useEffect, useRef, useState } from "react";
import {
  Folder,
  Plus,
  Star,
  Trash2,
  LogOut,
  Shield,
  Clock,
  Users,
  HardDrive,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ListFilter,
  X,
} from "lucide-react";
import type { SidebarTab } from "../../types/file";
import type { UserInfo } from "../../context/AuthContext";
import { TYPE_FILTERS } from "../../utils/fileType";
import { capitalize } from "@yfs/utils";

const NAV_ITEMS: { tab: SidebarTab; label: string; icon: typeof Folder }[] = [
  { tab: "drive", label: "My Drive", icon: Folder },
  { tab: "projects", label: "Projects", icon: HardDrive },
  { tab: "shared", label: "Shared", icon: Users },
  { tab: "recent", label: "Recent", icon: Clock },
  { tab: "starred", label: "Starred", icon: Star },
  { tab: "trash", label: "Trash", icon: Trash2 },
];

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  activeTab,
  onTabChange,
  onCreateFolder,
  onUploadFiles,
  storagePercentage,
  storageUsedLabel,
  storageTotalLabel,
  user,
  onRequestLogout,
  typeFilter,
  onTypeFilterChange,
  mobileOpen = false,
  onMobileClose,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onCreateFolder: () => void;
  onUploadFiles: (files: FileList) => void;
  storagePercentage: number;
  storageUsedLabel: string;
  storageTotalLabel: string;
  user: UserInfo | null;
  onRequestLogout: () => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
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

  const userInitials = user?.username
    ? user.username.substring(0, 2).toUpperCase()
    : user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "US";

  const selectTab = (tab: SidebarTab) => {
    onTabChange(tab);
    onMobileClose?.();
  };

  return (
    <aside
      className={`bg-bg-main border-r border-border-main flex flex-col p-6 box-border shrink-0 transition-all duration-300 ${
        collapsed ? "w-20 min-w-[80px]" : "w-70 min-w-[280px]"
      } max-[768px]:fixed max-[768px]:inset-y-0 max-[768px]:left-0 max-[768px]:z-50 max-[768px]:w-[280px]! max-[768px]:min-w-0 max-[768px]:max-w-[85vw] max-[768px]:p-5 max-[768px]:shadow-2xl max-[768px]:transition-transform ${
        mobileOpen ? "max-[768px]:translate-x-0" : "max-[768px]:-translate-x-full"
      }`}
    >
      <div className="flex flex-col gap-6 max-[768px]:gap-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden -mr-3 pr-3">
        <div className={`flex items-center gap-3 px-2 py-2 ${collapsed ? "justify-center" : "justify-between"}`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl text-accent flex items-center justify-center">⚡</span>
            {!collapsed && <span className="text-xl font-bold text-text-heading tracking-tight">YFS</span>}
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
              collapsed ? "w-12 h-12 rounded-full p-0" : "gap-2 w-36 py-3 px-5"
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
              <button
                onClick={() => {
                  onCreateFolder();
                  setNewMenuOpen(false);
                }}
                className="flex items-center gap-3 px-3.5 py-2.5 border-none bg-transparent text-text-main rounded-lg text-sm font-medium text-left cursor-pointer hover:bg-accent-bg hover:text-accent transition duration-150"
              >
                <Folder className="w-4 h-4" /> Create Folder
              </button>
              <button
                onClick={triggerFileUpload}
                className="flex items-center gap-3 px-3.5 py-2.5 border-none bg-transparent text-text-main rounded-lg text-sm font-medium text-left cursor-pointer hover:bg-accent-bg hover:text-accent transition duration-150"
              >
                <Plus className="w-4 h-4 rotate-45" /> Upload File
              </button>
              <button
                onClick={triggerFolderUpload}
                className="flex items-center gap-3 px-3.5 py-2.5 border-none bg-transparent text-text-main rounded-lg text-sm font-medium text-left cursor-pointer hover:bg-accent-bg hover:text-accent transition duration-150"
              >
                <Folder className="w-4 h-4" /> Upload Folder
              </button>
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
            {NAV_ITEMS.map(({ tab, label, icon: Icon }) => (
              <li
                key={tab}
                onClick={() => selectTab(tab)}
                className={`flex items-center rounded-xl text-text-main font-medium text-[0.95rem] cursor-pointer transition hover:bg-code-bg hover:text-text-heading ${
                  activeTab === tab ? "bg-accent-bg text-accent font-semibold" : ""
                } ${collapsed ? "justify-center p-3" : "justify-between px-4 py-3"}`}
                title={collapsed ? label : undefined}
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  {!collapsed && <span>{label}</span>}
                </span>
              </li>
            ))}
            <li
              onClick={() => selectTab("system")}
              className={`flex items-center rounded-xl text-text-main font-medium text-[0.95rem] cursor-pointer transition hover:bg-code-bg hover:text-text-heading border-t border-border-main mt-4 pt-4 ${
                activeTab === "system" ? "bg-accent-bg text-accent font-semibold" : ""
              } ${collapsed ? "justify-center p-3" : "justify-between px-4 py-3"}`}
              title={collapsed ? "Workspace & System" : undefined}
            >
              <span className="flex items-center gap-3">
                <Shield className="w-4 h-4" />
                {!collapsed && <span>Workspace & System</span>}
              </span>
            </li>
            {!collapsed && (
              <li className="mt-1">
                <button
                  onClick={() => setTypeMenuOpen((v) => !v)}
                  className={`w-full flex items-center justify-between rounded-xl text-text-main font-medium text-[0.95rem] cursor-pointer transition hover:bg-code-bg hover:text-text-heading bg-transparent border-none px-4 py-3 ${
                    typeFilter !== "all" ? "text-accent font-semibold" : ""
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <ListFilter className="w-4 h-4" />
                    <span>File Type</span>
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${typeMenuOpen ? "rotate-180" : ""}`} />
                </button>
                {typeMenuOpen && (
                  <ul className="flex flex-col gap-0.5 p-0 m-0 mt-1 list-none animate-fade-in">
                    {TYPE_FILTERS.map(({ value, label, icon: Icon }) => (
                      <li
                        key={value}
                        onClick={() => onTypeFilterChange(value)}
                        className={`flex items-center gap-3 pl-10 pr-4 py-2 rounded-xl text-[0.85rem] cursor-pointer transition hover:bg-code-bg hover:text-text-heading ${
                          typeFilter === value ? "bg-accent-bg text-accent font-semibold" : "text-text-main font-medium"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )}
          </ul>
        </nav>
      </div>

      <div className="flex flex-col gap-5">
        {!collapsed && (
          <div className="bg-code-bg p-4 rounded-2xl border border-border-main text-xs">
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

        <div className={`flex items-center justify-between border-t border-border-main ${collapsed ? "pt-4 justify-center" : "pt-4"}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 min-w-[40px] rounded-full bg-gradient-to-tr from-accent to-indigo-500 text-white flex items-center justify-center font-bold text-sm">
              {userInitials}
            </div>
            {!collapsed && (
              <div className="flex flex-col overflow-hidden text-left animate-fade-in">
                <span className="text-sm font-semibold text-text-heading truncate">{capitalize(user?.username || "Guest User")}</span>
                <span className="text-[11px] text-text-main truncate">{user?.email}</span>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={onRequestLogout}
              className="border-none bg-transparent p-2 rounded-lg cursor-pointer text-text-main hover:bg-red-500/10 hover:text-red-500 flex items-center justify-center transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
