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

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { FileWarning } from "lucide-react";
import type { FileItem } from "../../types/file";
import { useCollabora, type CollaboraEditorSession } from "../../hooks/useCollabora";
import { COLLABORA_BASE_URL } from "../../services/collaboraClient";
import { storeCollaboraHandoff } from "../../services/collaboraHandoff";

export interface CollaboraViewerHandle {
  // Opens /collabora?h=<handoff id> in a new tab; see collaboraHandoff.ts.
  openInNewTab: () => void;
  // Posts WOPI Close_Session so Collabora saves unsaved edits before the iframe goes away.
  requestExitSave: () => void;
}

// No postMessage from Collabora by then means the embed was blocked or never loaded.
const FRAME_READY_TIMEOUT_MS = 12000;

const ErrorState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center gap-2 text-center text-text-main py-16">
    <FileWarning className="w-12 h-12 text-amber-400" />
    <div className="text-sm font-medium">{message}</div>
  </div>
);

// The access_token is POSTed via a hidden form (not a query string) so it stays out of history and referrers.
export const CollaboraViewer = forwardRef<
  CollaboraViewerHandle,
  {
    item: FileItem;
    canEdit: boolean;
    onReadyChange?: (ready: boolean) => void;
    // Fires once Collabora's UI has rendered, later than onReadyChange.
    onFrameReadyChange?: (ready: boolean) => void;
    // Collabora's own close button; callers should treat it like their close button.
    onNativeClose?: () => void;
  }
>(function CollaboraViewer({ item, canEdit, onReadyChange, onFrameReadyChange, onNativeClose }, ref) {
  const { getEditorSession } = useCollabora();
  const [session, setSession] = useState<CollaboraEditorSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  const [frameStalled, setFrameStalled] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const frameName = `collabora-frame-${item.id}`;
  // Latest value for closures captured once (cleanups, beforeunload).
  const frameReadyRef = useRef(false);
  // Kept in a ref so a new function identity doesn't re-submit the form.
  const onNativeCloseRef = useRef(onNativeClose);
  useEffect(() => {
    onNativeCloseRef.current = onNativeClose;
  }, [onNativeClose]);

  const sendCloseSession = () => {
    if (!frameReadyRef.current) return;
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ MessageId: "Close_Session" }), COLLABORA_BASE_URL);
  };

  useImperativeHandle(ref, () => ({
    openInNewTab: () => {
      if (!session) return;
      const id = storeCollaboraHandoff({
        actionUrl: session.actionUrl,
        accessToken: session.accessToken,
        accessTokenTtl: session.accessTokenTtl,
        fileName: item.name,
      });
      window.open(`/collabora?h=${id}`, "_blank", "noopener");
    },
    requestExitSave: sendCloseSession,
  }), [session, item.name]);

  useEffect(() => {
    onReadyChange?.(!!session);
  }, [session, onReadyChange]);

  useEffect(() => {
    onFrameReadyChange?.(frameReady);
  }, [frameReady, onFrameReadyChange]);

  useEffect(() => {
    let active = true;
    setSession(null);
    setError(null);
    getEditorSession(item, canEdit)
      .then((s) => {
        if (active) setSession(s);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not open this file in Collabora.");
      });
    return () => {
      active = false;
      // Covers item changes and unmounts that didn't go through requestExitSave.
      sendCloseSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.fileId, item.version, canEdit]);

  useEffect(() => {
    setFrameReady(false);
    frameReadyRef.current = false;
    setFrameStalled(false);
    if (!session) return;

    // Any message from Collabora's origin proves the embed isn't blocked.
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== COLLABORA_BASE_URL) return;
      if (!frameReadyRef.current) {
        setFrameReady(true);
        frameReadyRef.current = true;
        // Stop Collabora discarding the document when its own close button is clicked.
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ MessageId: "Disable_Default_UIAction", Values: { action: "UI_Close", disable: true } }),
          COLLABORA_BASE_URL
        );
      }
      let payload: { MessageId?: string };
      try {
        payload = JSON.parse(e.data);
      } catch {
        return;
      }
      if (payload.MessageId === "UI_Close") onNativeCloseRef.current?.();
    };
    window.addEventListener("message", onMessage);
    const timer = window.setTimeout(() => setFrameStalled(true), FRAME_READY_TIMEOUT_MS);
    formRef.current?.submit();
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
    };
  }, [session]);

  // Tab close/refresh never unmounts the component; best-effort save.
  useEffect(() => {
    window.addEventListener("beforeunload", sendCloseSession);
    window.addEventListener("pagehide", sendCloseSession);
    return () => {
      window.removeEventListener("beforeunload", sendCloseSession);
      window.removeEventListener("pagehide", sendCloseSession);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!session) {
    return <div className="text-sm text-text-main text-center py-16">Opening in Collabora…</div>;
  }

  const tokenFields = (
    <>
      <input type="hidden" name="access_token" value={session.accessToken} />
      <input type="hidden" name="access_token_ttl" value={String(session.accessTokenTtl)} />
    </>
  );

  return (
    <div className="w-full h-full flex flex-col gap-2">
      <form ref={formRef} action={session.actionUrl} target={frameName} method="POST" className="hidden">
        {tokenFields}
      </form>
      {frameStalled && !frameReady && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-text-main shrink-0">
          <FileWarning className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <span>
            The editor didn't load inside the app — the browser may be blocking Collabora from being embedded here.
            Use the <b>Open in new tab</b> button in the toolbar above to edit this file.
          </span>
        </div>
      )}
      <iframe
        ref={iframeRef}
        name={frameName}
        title={item.name}
        className="w-full flex-1 min-h-0 border-0"
        allow="clipboard-read; clipboard-write"
        allowFullScreen
      />
    </div>
  );
});
