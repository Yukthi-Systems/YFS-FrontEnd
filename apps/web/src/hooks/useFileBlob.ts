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
import { useDownload } from "./useDownload";
import type { FileItem } from "../types/file";

export interface FileBlobState {
  blob: Blob | null;
  loading: boolean;
  error: string | null;
}

// Bytes for the client-side viewers: blob: URL for local items, a download session for server items.
export function useFileBlob(item: FileItem): FileBlobState {
  const { fetchBlob } = useDownload();
  // fetchBlob is recreated every render — read it through a ref so it isn't an effect dep.
  const fetchRef = useRef(fetchBlob);
  fetchRef.current = fetchBlob;

  const [state, setState] = useState<FileBlobState>({ blob: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState({ blob: null, loading: true, error: null });
    fetchRef
      .current(item)
      .then((blob) => {
        if (!active) return;
        setState(
          blob
            ? { blob, loading: false, error: null }
            : { blob: null, loading: false, error: "This item has no file content to open." }
        );
      })
      .catch((err) => {
        if (!active) return;
        setState({
          blob: null,
          loading: false,
          error: err instanceof Error ? err.message : "Could not load this file.",
        });
      });
    return () => {
      active = false;
    };
  }, [item.id, item.fileId, item.version, item.blobUrl]);

  return state;
}
