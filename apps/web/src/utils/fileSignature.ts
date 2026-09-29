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

// Magic-byte signatures for formats whose viewer (Collabora or a local one) is picked from the
// file extension alone. When the stored bytes don't start with the right signature, the content
// isn't really that format — e.g. a corrupted upload or a file mislabeled with the wrong
// extension — and Collabora/LibreOffice falls back to importing it as plain text, rendering
// binary data as garbled characters instead of failing. Catching the mismatch up front lets the
// viewer show a clear error instead.

const ZIP_MAGIC = [0x50, 0x4b]; // "PK" — Office Open XML / OpenDocument formats are zip containers
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // legacy .doc/.xls/.ppt (OLE2)

const ZIP_EXTENSIONS = new Set([
  "xlsx", "xlsm", "xltx", "xltm",
  "docx", "docm", "dotx", "dotm",
  "pptx", "pptm", "potx", "potm", "ppsx", "ppsm",
  "odt", "ott", "odp", "otp", "ods", "ots", "odg", "otg",
]);

const OLE_EXTENSIONS = new Set(["doc", "dot", "xls", "xlt", "xla", "ppt", "pot", "pps"]);

// Longest signature above, so callers know how many header bytes to fetch.
export const MAX_SIGNATURE_LENGTH = Math.max(ZIP_MAGIC.length, PDF_MAGIC.length, OLE_MAGIC.length);

// null means this extension has no fixed magic number to check (plain text, csv, etc.) —
// callers should treat that as "nothing to verify", not a mismatch.
export function expectedMagic(extension: string): number[] | null {
  const ext = extension.toLowerCase();
  if (ext === "pdf") return PDF_MAGIC;
  if (ZIP_EXTENSIONS.has(ext)) return ZIP_MAGIC;
  if (OLE_EXTENSIONS.has(ext)) return OLE_MAGIC;
  return null;
}

export function matchesMagic(header: Uint8Array, magic: number[]): boolean {
  if (header.length < magic.length) return false;
  return magic.every((byte, i) => header[i] === byte);
}
