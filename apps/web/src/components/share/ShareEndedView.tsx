import { Check, RotateCcw } from "lucide-react";
import { ShareGate, gatePrimaryButton, gateSecondaryButton } from "./ShareGate";

// Landing page after a visitor exits a share (/share-ended). It's its own route so
// the address bar no longer shows the share link; ?from= keeps "Reopen" working.
export function ShareEndedView() {
  const from = new URLSearchParams(window.location.search).get("from") ?? "";

  return (
    <ShareGate
      icon={<Check className="w-7 h-7" />}
      title="You've left this share"
      description="Your access through this link has ended. You can reopen it any time while the link is still active."
    >
      {from && (
        <button onClick={() => window.location.assign(`/share/${encodeURIComponent(from)}`)} className={gatePrimaryButton}>
          <RotateCcw className="w-4 h-4" /> Reopen this share
        </button>
      )}
      <button onClick={() => window.location.assign("/")} className={from ? gateSecondaryButton : gatePrimaryButton}>
        Go to YFS
      </button>
    </ShareGate>
  );
}
