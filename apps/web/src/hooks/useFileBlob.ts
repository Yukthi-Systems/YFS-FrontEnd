import { useEffect, useRef, useState } from "react";
import { useDownload } from "./useDownload";
import type { FileItem } from "../types/file";

export interface FileBlobState {
  blob: Blob | null;
  loading: boolean;
  error: string | null;
}

// Loads a file's bytes for the client-side viewers (PDF, text/code, CSV, docx). Local
// items resolve from their blob: URL; server-backed items (own or shared) go through
// the download session, same as batch download. Re-runs when the file or its version
// changes.
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
