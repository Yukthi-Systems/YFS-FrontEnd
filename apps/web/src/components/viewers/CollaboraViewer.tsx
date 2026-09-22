import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { FileWarning } from "lucide-react";
import type { FileItem } from "../../types/file";
import { useCollabora, type CollaboraEditorSession } from "../../hooks/useCollabora";
import { COLLABORA_BASE_URL } from "../../services/collaboraClient";

// Exposed to ViewerModal so its header toolbar (next to Download) can trigger the
// same "open in a new tab" POST this component used to render its own button for —
// the button moved up into the shared header, this is what it now calls. Also lets
// ViewerModal ask Collabora to flush a save before it tears the iframe down on close.
export interface CollaboraViewerHandle {
  openInNewTab: () => void;
  // Posts WOPI's documented "Close_Session" message into the iframe, which tells
  // Collabora's own server component (coolwsd) to save (if there are unsaved edits)
  // and end the session cleanly — it is *Collabora* that then PUTs the file to the
  // WOPI host with `X-COOL-WOPI-IsExitSave: true` on that request, not something we
  // can set as a header ourselves; this message is what triggers it. Without this,
  // just unmounting the iframe on close abandons any edit made since Collabora's last
  // periodic autosave. No-op if the frame never actually loaded (nothing listening).
  requestExitSave: () => void;
}

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
export const CollaboraViewer = forwardRef<
  CollaboraViewerHandle,
  {
    item: FileItem;
    canEdit: boolean;
    onReadyChange?: (ready: boolean) => void;
    // Fires once Collabora's own UI has actually rendered inside the iframe (its
    // postMessage proves it, same signal frameStalled's warning banner watches) — later
    // than onReadyChange, which only means a session exists. ViewerModal uses this to
    // hold off colouring the toolbar strip until Collabora's ribbon is behind it, so the
    // colour doesn't show against a bare "Opening in Collabora…" loading screen.
    onFrameReadyChange?: (ready: boolean) => void;
  }
>(function CollaboraViewer({ item, canEdit, onReadyChange, onFrameReadyChange }, ref) {
  const { getEditorSession } = useCollabora();
  const [session, setSession] = useState<CollaboraEditorSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  const [frameStalled, setFrameStalled] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const tabFormRef = useRef<HTMLFormElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const frameName = `collabora-frame-${item.id}`;
  // Mirrors `frameReady` for code that needs the latest value inside a closure captured
  // once (effect cleanups, the beforeunload listener) rather than one pinned to whatever
  // render created it.
  const frameReadyRef = useRef(false);

  // Posts WOPI's "Close_Session" message into the iframe — see CollaboraViewerHandle's
  // requestExitSave doc for what this actually triggers on Collabora's side. Shared by
  // every path that can end this session: the explicit ref method ViewerModal calls
  // before its own deliberate close/navigate, the item-changing effect's cleanup
  // (catches sibling navigation or any other prop change we didn't explicitly wire),
  // this component unmounting outright, and the tab itself closing/refreshing.
  const sendCloseSession = () => {
    if (!frameReadyRef.current) return;
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ MessageId: "Close_Session" }), COLLABORA_BASE_URL);
  };

  useImperativeHandle(ref, () => ({
    openInNewTab: () => tabFormRef.current?.submit(),
    requestExitSave: sendCloseSession,
  }), []);

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
      // Catch-all for `item` changing (or this component unmounting) via any path other
      // than ViewerModal's own requestExitSave()-then-delay — e.g. a sibling switch that
      // bypassed it. No grace period possible here: by the time this runs, the new
      // session fetch (or the unmount) is already underway.
      sendCloseSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.fileId, item.version, canEdit]);

  useEffect(() => {
    setFrameReady(false);
    frameReadyRef.current = false;
    setFrameStalled(false);
    if (!session) return;

    // Collabora's embedded page posts JSON messages (App_LoadingStatus, …) to its parent
    // once it starts. Any message from its origin proves the embed isn't blocked.
    const onMessage = (e: MessageEvent) => {
      if (e.origin === COLLABORA_BASE_URL) {
        setFrameReady(true);
        frameReadyRef.current = true;
      }
    };
    window.addEventListener("message", onMessage);
    const timer = window.setTimeout(() => setFrameStalled(true), FRAME_READY_TIMEOUT_MS);
    formRef.current?.submit();
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
    };
  }, [session]);

  // The tab closing or refreshing mid-edit never unmounts this component — React gets no
  // chance to run the cleanup above, so it needs its own listener. Best-effort only: the
  // postMessage dispatch itself is synchronous, but whether Collabora's resulting save PUT
  // actually lands before the browser tears the page down is up to the browser, not us.
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
            Use the <b>Open in new tab</b> button in the toolbar above to edit this file.
          </span>
        </div>
      )}
      {/* No rounding here — ViewerModal's panel around this whole component already clips
          to rounded-2xl via overflow-hidden. Rounding the iframe's own corners too used to
          match (it sat flush at the panel's top edge), but now the coloured toolbar strip
          sits above it, so the iframe's top corners land mid-panel and poke the panel's
          background colour through in a notch right where the strip meets it. */}
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
