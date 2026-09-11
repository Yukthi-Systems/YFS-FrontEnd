import type { SidebarTab } from "../types/file";

// The authenticated app's URL shape: /<tab>/<folderId1>/<folderId2>/... . Keeps
// useFileNavigation's browsing state (sidebar tab + folder path) in sync with the
// address bar so a refresh (or a shared link to a specific folder) lands back where
// the user was instead of resetting to My Drive. Distinct from the public
// /share/<id> and /share-ended routes handled directly in main.tsx.
const VALID_TABS: SidebarTab[] = [
  "drive",
  "projects",
  "shared",
  "shared-out",
  "shared-links",
  "recent",
  "starred",
  "trash",
];

export interface AppRoute {
  tab: SidebarTab;
  path: string[];
}

export const parseAppRoute = (pathname: string): AppRoute => {
  const segments = pathname.split("/").filter(Boolean);
  const [tabSegment, ...rest] = segments;
  const tab = (VALID_TABS as string[]).includes(tabSegment ?? "") ? (tabSegment as SidebarTab) : "drive";
  // Only trust the trailing segments as a folder path when the tab itself was
  // recognized — an unknown first segment falls back to the drive root entirely.
  return { tab, path: tabSegment === tab ? rest : [] };
};

export const buildAppRoute = (tab: SidebarTab, path: string[]): string =>
  `/${tab}${path.length ? `/${path.join("/")}` : ""}`;
