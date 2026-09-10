import { Check } from "lucide-react";

// Landing page after a visitor exits a share (/share-ended). It's its own route so
// the address bar no longer shows the share link once access has ended. The
// original share id rides in ?from= so "Reopen this share" can still work.
export function ShareEndedView() {
  const from = new URLSearchParams(window.location.search).get("from") ?? "";

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center gap-3 bg-bg-main text-text-main px-6 text-center">
      <Check className="w-10 h-10 text-accent" />
      <h3 className="text-lg font-bold text-text-heading">You've left this share</h3>
      <p className="text-sm text-text-main max-w-sm">Your access to this link has ended.</p>
      <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
        <button onClick={() => window.location.assign("/")} className="btn-primary" style={{ width: "auto" }}>
          Go to YFS
        </button>
        {from && (
          <button
            onClick={() => window.location.assign(`/share/${encodeURIComponent(from)}`)}
            className="btn-outline"
            style={{ width: "auto" }}
          >
            Reopen this share
          </button>
        )}
      </div>
    </div>
  );
}
