import { useEffect, useRef, useState } from "react";
import { FileWarning } from "lucide-react";
import { consumeCollaboraHandoff, type CollaboraHandoff } from "../../services/collaboraHandoff";
import { COLLABORA_BASE_URL } from "../../services/collaboraConstants";

// If Collabora hasn't said anything (via its postMessage API) this long after the frame
// was submitted, assume the browser blocked the embed or it never loaded. Mirrors
// CollaboraViewer's own timeout.
const FRAME_READY_TIMEOUT_MS = 12000;
const FRAME_NAME = "collabora-standalone-frame";
// Grace period between asking Collabora to save-and-close (Close_Session, triggered by
// its own native close button here) and actually closing this tab — mirrors
// ViewerModal's COLLABORA_EXIT_SAVE_GRACE_MS. No confirmation comes back to wait on, so
// this is a fixed delay, not a real handshake.
const EXIT_SAVE_GRACE_MS = 500;

type Handoff = CollaboraHandoff | "expired" | null; // null = still checking

const CenteredMessage = ({ children }: { children: React.ReactNode }) => (
  <div className="fixed inset-0 flex items-center justify-center bg-neutral-950 text-white text-sm px-6 text-center">
    {children}
  </div>
);

// The page "Open in new tab" (CollaboraViewer's openInNewTab) opens: /collabora?h=<id>.
// Shows the app's own origin in the address bar with Collabora embedded in an iframe,
// instead of navigating straight to Collabora's domain — the session (actionUrl +
// access_token) rides over from the tab that minted it via localStorage
// (collaboraHandoff.ts), read once and discarded, never appearing in this URL. No
// AuthBridge/FileSystemBridge here (see main.tsx) — the WOPI access_token IS the
// authorization for this page, same as the raw-Collabora-domain tab this replaced.
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
    // Drop ?h=<id> from the visible URL/history once consumed — refreshing after this
    // finds nothing left in localStorage anyway (single-use), so the bare URL is what
    // should be left behind, not a now-dead link.
    if (data) window.history.replaceState(null, "", "/collabora");
  }, []);

  useEffect(() => {
    if (!handoff || handoff === "expired") return;
    setFrameReady(false);
    frameReadyRef.current = false;
    setFrameStalled(false);

    // Collabora's own native close button (buildCollaboraActionUrl's closebutton=1,
    // which the handed-off actionUrl already carries — see collaboraClient.ts) fires a
    // UI_Close postMessage when clicked. Its default reaction is to self-destroy its
    // document immediately, unsaved — disabled below as soon as the frame is ready, so
    // clicking it instead asks Collabora to save (Close_Session) and only then closes
    // this tab, same flow as the modal's own close button.
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
      {/* Same hidden-form POST pattern as CollaboraViewer — the access_token belongs in
          a POST body per Collabora's own WOPI iframe guidance, not a query string. */}
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
