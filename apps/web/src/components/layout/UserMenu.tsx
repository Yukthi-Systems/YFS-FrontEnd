import { useEffect, useRef, useState } from "react";
import { ChevronRight, LogOut, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { capitalize } from "@yfs/utils";
import type { UserInfo } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import type { Theme } from "../../utils/theme";
import { ProfileModal } from "../modals/ProfileModal";

const THEME_OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "system", label: "System", Icon: Monitor },
  { value: "dark", label: "Dark", Icon: Moon },
];

export function UserMenu({
  user,
  compact = false,
  storagePercentage,
  storageUsedLabel,
  storageTotalLabel,
  onLogout,
}: {
  user: UserInfo | null;
  compact?: boolean;
  storagePercentage: number;
  storageUsedLabel: string;
  storageTotalLabel: string;
  onLogout: () => void;
}) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  useEffect(() => {
    if (!open) setThemeOpen(false);
  }, [open]);

  const name = capitalize(user?.username || "Guest User");
  const initials = (user?.username || user?.email || "US").substring(0, 2).toUpperCase();
  const CurrentThemeIcon = (THEME_OPTIONS.find((o) => o.value === theme) ?? THEME_OPTIONS[1]).Icon;

  const rowClass =
    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[0.82rem] font-medium text-left cursor-pointer transition border-none bg-transparent text-text-main hover:bg-code-bg hover:text-text-heading";

  return (
    <div className="relative min-w-0 flex-1" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2.5 rounded-lg hover:bg-code-bg transition cursor-pointer border-none bg-transparent w-full ${
          compact ? "justify-center p-1" : "p-1 text-left"
        }`}
        title="Account"
      >
        <span className="w-8 h-8 min-w-8 rounded-full bg-gradient-to-tr from-accent to-indigo-500 text-white flex items-center justify-center font-bold text-[11px]">
          {initials}
        </span>
        {!compact && (
          <span className="flex flex-col overflow-hidden">
            <span className="text-[0.8rem] font-semibold text-text-heading truncate">{name}</span>
            <span className="text-[10px] text-text-main truncate">{user?.email}</span>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute z-50 w-52 left-0 bottom-full mb-2 bg-bg-main border border-border-main rounded-xl p-1 shadow-lg animate-scale-in flex flex-col gap-0.5">
          <button
            onClick={() => {
              setProfileOpen(true);
              setOpen(false);
            }}
            className={rowClass}
          >
            <UserRound className="w-4 h-4" />
            <span className="flex-1">Profile</span>
          </button>

          <button onClick={() => setThemeOpen((v) => !v)} className={rowClass}>
            <CurrentThemeIcon className="w-4 h-4" />
            <span className="flex-1">Theme</span>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${themeOpen ? "rotate-90" : ""}`} />
          </button>
          {themeOpen && (
            <div className="flex flex-col gap-0.5 pl-2">
              {THEME_OPTIONS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[0.8rem] font-medium text-left cursor-pointer transition border-none bg-transparent ${
                    theme === value ? "text-accent bg-accent-bg" : "text-text-main hover:bg-code-bg hover:text-text-heading"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="my-0.5 border-t border-border-main" />

          <button
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[0.82rem] font-semibold text-left cursor-pointer transition border-none bg-transparent text-red-500 hover:bg-red-500/10"
          >
            <LogOut className="w-4 h-4" />
            <span className="flex-1">Sign out</span>
          </button>
        </div>
      )}

      {profileOpen && (
        <ProfileModal
          user={user}
          storagePercentage={storagePercentage}
          storageUsedLabel={storageUsedLabel}
          storageTotalLabel={storageTotalLabel}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </div>
  );
}
