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

import type { SidebarTab } from "../types/file";

// App URLs are /<tab>/<folderId>/..., so refresh and deep links land in the same place.
const VALID_TABS: SidebarTab[] = [
  "drive",
  "projects",
  "shared",
  "shared-out",
  "shared-links",
  "recent",
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
  return { tab, path: tabSegment === tab ? rest : [] };
};

export const buildAppRoute = (tab: SidebarTab, path: string[]): string =>
  `/${tab}${path.length ? `/${path.join("/")}` : ""}`;
