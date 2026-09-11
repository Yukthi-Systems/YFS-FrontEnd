import { useAtom, useAtomValue } from "jotai";
import {
  viewModeAtom,
  sortFieldAtom,
  sortOrderAtom,
  sidebarCollapsedAtom,
  publicProfileAtom,
  savingProfileAtom,
  type PublicProfile,
} from "../atoms/userSettings";

export { AVATAR_COLORS } from "../atoms/userSettings";

// View/sort/sidebar/profile preferences, server-backed via UserSettingsBridge
// (mounted once in App.tsx), so they follow the user across devices. Values fall
// back to defaults until the bridge finishes loading private_info/public_info.
export const useUserSettings = () => {
  const [viewMode, setViewMode] = useAtom(viewModeAtom);
  const [sortField, setSortField] = useAtom(sortFieldAtom);
  const [sortOrder, setSortOrder] = useAtom(sortOrderAtom);
  const [sidebarCollapsed, setSidebarCollapsed] = useAtom(sidebarCollapsedAtom);
  const [publicProfile, setPublicProfile] = useAtom(publicProfileAtom);
  const savingProfile = useAtomValue(savingProfileAtom);

  const savePublicProfile = (patch: PublicProfile) => setPublicProfile((p) => ({ ...p, ...patch }));

  return {
    viewMode,
    sortField,
    sortOrder,
    sidebarCollapsed,
    setViewMode,
    setSortField,
    setSortOrder,
    setSidebarCollapsed,
    publicProfile,
    savePublicProfile,
    savingProfile,
  };
};
