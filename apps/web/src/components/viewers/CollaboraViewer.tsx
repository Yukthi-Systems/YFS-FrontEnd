import { useEffect, useRef, useState } from "react";
import { ExternalLink, FileWarning } from "lucide-react";
import type { FileItem } from "../../types/file";
import { useCollabora, type CollaboraEditorSession } from "../../hooks/useCollabora";
import { COLLABORA_BASE_URL } from "../../services/collaboraClient";

// If Collabora hasn't said anything (via its postMessage API) this long after the frame
// was submitted, assume the browser blocked the embed (frame-ancestors) or it never loaded.
const FRAME_READY_TIMEOUT_MS = 12000;

const ErrorState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center gap-2 text-center text-text-main py-16">
    <FileWarning className="w-12 h-12 text-amber-400" />
    <div className="text-sm font-medium">{message}</div>
  </div>
);

// Embeds a Collabora Online editor/viewer for a server-backed file. Per Collabora's
// own WOPI iframe integration guidance, the access_token travels in a POSTed form
// (not a query string) so it never lands in browser history or a referrer header —
// the hidden form below auto-submits into the named iframe as soon as the session
// resolves.
export function CollaboraViewer({ item, canEdit }: { item: FileItem; canEdit: boolean }) {
  const { getEditorSession } = useCollabora();
  const [session, setSession] = useState<CollaboraEditorSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  const [frameStalled, setFrameStalled] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const tabFormRef = useRef<HTMLFormElement>(null);
  const frameName = `collabora-frame-${item.id}`;

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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.fileId, item.version, canEdit]);

  useEffect(() => {
    setFrameReady(false);
    setFrameStalled(false);
    if (!session) return;

    // Collabora's embedded page posts JSON messages (App_LoadingStatus, …) to its parent
    // once it starts. Any message from its origin proves the embed isn't blocked.
    const onMessage = (e: MessageEvent) => {
      if (e.origin === COLLABORA_BASE_URL) setFrameReady(true);
    };
    window.addEventListener("message", onMessage);
    const timer = window.setTimeout(() => setFrameStalled(true), FRAME_READY_TIMEOUT_MS);
    formRef.current?.submit();
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
    };
  }, [session]);

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
      {/* Same POST, but into a new top-level tab. Collabora only allows itself and its
          configured frame-ancestors to embed it, so if the app's origin isn't on that list
          the iframe below is blocked by the browser — a top-level tab isn't subject to it. */}
      <form ref={tabFormRef} action={session.actionUrl} target="_blank" method="POST" className="hidden">
        {tokenFields}
      </form>
      {frameStalled && !frameReady && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-text-main shrink-0">
          <FileWarning className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <span>
            The editor didn't load inside the app — the browser may be blocking Collabora from being embedded here.
            Use <b>Open in new tab</b> to edit this file.
          </span>
        </div>
      )}
      <div className="flex items-center justify-end shrink-0">
        <button
          onClick={() => tabFormRef.current?.submit()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-code-bg border border-border-main text-text-main text-xs font-semibold rounded-full cursor-pointer hover:bg-border-main transition"
          title="Open in a new tab (use this if the editor below stays blank)"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Open in new tab
        </button>
      </div>
      <iframe
        name={frameName}
        title={item.name}
        className="w-full flex-1 min-h-0 border-0 rounded-2xl"
        allow="clipboard-read; clipboard-write"
        allowFullScreen
      />
    </div>
  );
}
