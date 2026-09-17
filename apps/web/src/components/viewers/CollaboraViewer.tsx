import { useEffect, useRef, useState } from "react";
import { FileWarning } from "lucide-react";
import type { FileItem } from "../../types/file";
import { useCollabora, type CollaboraEditorSession } from "../../hooks/useCollabora";

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
  const formRef = useRef<HTMLFormElement>(null);
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
    if (session) formRef.current?.submit();
  }, [session]);

  if (error) return <ErrorState message={error} />;
  if (!session) {
    return <div className="text-sm text-text-main text-center py-16">Opening in Collabora…</div>;
  }

  return (
    <div className="w-full h-full">
      <form ref={formRef} action={session.actionUrl} target={frameName} method="POST" className="hidden">
        <input type="hidden" name="access_token" value={session.accessToken} />
        <input type="hidden" name="access_token_ttl" value={String(session.accessTokenTtl)} />
      </form>
      <iframe
        name={frameName}
        title={item.name}
        className="w-full h-full border-0 rounded-2xl"
        allow="clipboard-read; clipboard-write"
        allowFullScreen
      />
    </div>
  );
}
