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

import { atom } from "jotai";

export type ArchiveJobStatus = "starting" | "queued" | "processing" | "ready" | "failed";

export interface ArchiveJob {
  id: string;
  name: string;
  status: ArchiveJobStatus;
  processedFiles: number;
  totalFiles: number;
  processedBytes: number;
  totalBytes: number;
  downloadUrl?: string;
  expiresAt?: number; // epoch ms after which downloadUrl stops working
  error?: string;
}

// Server-side folder archives (zip/tar), shown in DownloadTray.
export const archiveJobsAtom = atom<ArchiveJob[]>([]);
