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

import { useEffect, useState } from "react";
import type { FileItem } from "../types/file";
import { useDownload } from "./useDownload";
import { expectedMagic, matchesMagic, MAX_SIGNATURE_LENGTH } from "../utils/fileSignature";

export type SignatureStatus =
  | "skip" // extension has no fixed signature, or nothing to check (folder/local item) — proceed as normal
  | "checking"
  | "ok"
  | "mismatch"; // stored bytes don't look like the claimed format — don't hand them to a viewer

// Verifies a server/shared file's actual bytes match its extension before a viewer (Collabora or
// a local one) opens it. Without this, a corrupted or mislabeled office/PDF file gets imported as
// plain text and rendered as garbled characters instead of failing visibly.
export function useFileSignatureCheck(item: FileItem, enabled: boolean): SignatureStatus {
  const { peekFileHeader } = useDownload();
  const magic = item.extension ? expectedMagic(item.extension) : null;

  const [status, setStatus] = useState<SignatureStatus>(magic && enabled ? "checking" : "skip");

  useEffect(() => {
    if (!magic || !enabled) {
      setStatus("skip");
      return;
    }
    let active = true;
    setStatus("checking");
    peekFileHeader(item, MAX_SIGNATURE_LENGTH)
      .then((header) => {
        if (!active) return;
        // No server content to peek at (shouldn't happen once `enabled`, but don't block on it).
        if (!header) {
          setStatus("skip");
          return;
        }
        setStatus(matchesMagic(header, magic) ? "ok" : "mismatch");
      })
      .catch(() => {
        // Couldn't verify (network hiccup) — fail open rather than blocking a possibly-valid file.
        if (active) setStatus("ok");
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.fileId, item.version, enabled]);

  return status;
}
