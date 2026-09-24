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
import { FileWarning } from "lucide-react";
import { consumeCollaboraHandoff, type CollaboraHandoff } from "../../services/collaboraHandoff";
import { COLLABORA_BASE_URL } from "../../services/collaboraConstants";

const FRAME_READY_TIMEOUT_MS = 12000;
const FRAME_NAME = "collabora-standalone-frame";
const EXIT_SAVE_GRACE_MS = 500;

type Handoff = CollaboraHandoff | "expired" | null; // null = still checking

const CenteredMessage = ({ children }: { children: React.ReactNode }) => (
  <div className="fixed inset-0 flex items-center justify-center bg-neutral-950 text-white text-sm px-6 text-center">
    {children}
  </div>
);

// /collabora?h=<id> page: the session arrives via collaboraHandoff.ts and the WOPI token is its only auth.
export function CollaboraStandaloneView() {
  const [handoff, setHandoff] = useState<Handoff>(null);
  const [frameReady, setFrameReady] = useState(false);
  const [frameStalled, setFrameStalled] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const frameReadyRef = useRef(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("h");
    const data = id ? consumeCollaboraHandoff(id) : null;
    setHandoff(data ?? "expired");
    // The handoff is single-use, so drop ?h= from the URL.
    if (data) window.history.replaceState(null, "", "/collabora");
  }, []);

  useEffect(() => {
    if (!handoff || handoff === "expired") return;
    setFrameReady(false);
    frameReadyRef.current = false;
    setFrameStalled(false);

    // Collabora's close button asks it to save (Close_Session) before this tab closes.
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== COLLABORA_BASE_URL) return;
      if (!frameReadyRef.current) {
        setFrameReady(true);
        frameReadyRef.current = true;
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
      if (payload.MessageId === "UI_Close") {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ MessageId: "Close_Session" }), COLLABORA_BASE_URL);
        window.setTimeout(() => window.close(), EXIT_SAVE_GRACE_MS);
      }
    };
    window.addEventListener("message", onMessage);
    const timer = window.setTimeout(() => setFrameStalled(true), FRAME_READY_TIMEOUT_MS);
    formRef.current?.submit();
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
    };
  }, [handoff]);

  if (handoff === "expired") {
    return (
      <CenteredMessage>
        <div className="flex flex-col items-center gap-3 max-w-sm">
          <FileWarning className="w-10 h-10 text-amber-400" />
          <p>
            This link has expired or was already used. Go back to the app and click <b>Open in new tab</b> again.
          </p>
        </div>
      </CenteredMessage>
    );
  }
  if (!handoff) return <CenteredMessage>Opening…</CenteredMessage>;

  return (
    <div className="fixed inset-0 flex flex-col bg-bg-main">
      {/* POSTed so the access_token stays out of the URL. */}
      <form ref={formRef} action={handoff.actionUrl} target={FRAME_NAME} method="POST" className="hidden">
        <input type="hidden" name="access_token" value={handoff.accessToken} />
        <input type="hidden" name="access_token_ttl" value={String(handoff.accessTokenTtl)} />
      </form>
      {frameStalled && !frameReady && (
        <div className="flex items-start gap-2 border-b border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 px-4 py-2.5 text-xs text-text-main shrink-0">
          <FileWarning className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <span>The editor didn't load — try refreshing this tab, or go back to the app and reopen it from there.</span>
        </div>
      )}
      <iframe
        ref={iframeRef}
        name={FRAME_NAME}
        title={handoff.fileName}
        className="w-full flex-1 min-h-0 border-0"
        allow="clipboard-read; clipboard-write"
        allowFullScreen
      />
    </div>
  );
}
