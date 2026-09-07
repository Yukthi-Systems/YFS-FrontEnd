import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Lock, ShieldAlert, FileWarning, Download } from "lucide-react";
import type { FileItem } from "../../types/file";
import { getBlob } from "../../services/blobStore";
import { useToast } from "../../context/ToastContext";
import { formatBytes, formatDate } from "../../utils/format";
import { isTextEditable } from "../../utils/fileType";
import { ImageLightbox } from "../viewers/ImageLightbox";
import { MediaPlayer } from "../viewers/MediaPlayer";

const PdfViewer = lazy(() => import("../viewers/PdfViewer").then((m) => ({ default: m.PdfViewer })));
const SpreadsheetViewer = lazy(() => import("../viewers/SpreadsheetViewer").then((m) => ({ default: m.SpreadsheetViewer })));
const CodeEditor = lazy(() => import("../viewers/CodeEditor").then((m) => ({ default: m.CodeEditor })));
const ViewerLoading = () => <div className="text-sm text-text-main text-center py-16">Loading…</div>;

// Same cache the authenticated app writes its file tree to (see FileSystemContext).
const FILES_STORAGE_KEY = "yfs_fs_cache";

type LoadState = "loading" | "not-found" | "expired";

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

export function SharedFileView() {
  const { showToast } = useToast();
  const token = useMemo(() => {
    const match = window.location.pathname.match(/\/share\/([^/]+)/);
    return match ? match[1] : "";
  }, []);

  const [state, setState] = useState<LoadState | "ready">("loading");
  const [item, setItem] = useState<FileItem | null>(null);

  const [passwordInput, setPasswordInput] = useState("");
  const [passwordOk, setPasswordOk] = useState(false);
  const [passwordError, setPasswordError] = useState(false);

  const [otpCode, setOtpCode] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [otpOk, setOtpOk] = useState(false);
  const [otpError, setOtpError] = useState(false);

  useEffect(() => {
    (async () => {
      let found: FileItem | null = null;
      try {
        const stored = localStorage.getItem(FILES_STORAGE_KEY);
        const files: FileItem[] = stored ? JSON.parse(stored) : [];
        found = files.find((f) => f.share?.token === token) ?? null;
      } catch {
        found = null;
      }

      if (!found) {
        setState("not-found");
        return;
      }

      if (found.share?.expiresAt && new Date(found.share.expiresAt).getTime() < Date.now()) {
        setState("expired");
        return;
      }

      if (found.storageKey) {
        try {
          const blob = await getBlob(found.storageKey);
          if (blob) found = { ...found, blobUrl: URL.createObjectURL(blob) };
        } catch {
          // leave blobUrl unset — viewers already handle "no content" gracefully
        }
      }

      setItem(found);
      if (found.share?.otpRequired) setOtpCode(generateOtp());
      setState("ready");
    })();
  }, [token]);

  const needsPassword = !!item?.share?.password && !passwordOk;
  const needsOtp = !!item?.share?.otpRequired && !otpOk;

  const handlePasswordSubmit = () => {
    if (passwordInput === item?.share?.password) {
      setPasswordOk(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  const handleOtpSubmit = () => {
    if (otpInput === otpCode) {
      setOtpOk(true);
      setOtpError(false);
    } else {
      setOtpError(true);
    }
  };

  const handleDownload = () => {
    if (!item?.blobUrl) {
      showToast("No content available to download", "error");
      return;
    }
    const link = document.createElement("a");
    link.href = item.blobUrl;
    link.download = item.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const noOpSave = () => showToast("Editing isn't available on a shared link", "info");

  if (state === "loading") {
    return <CenteredMessage title="Loading…" />;
  }

  if (state === "not-found") {
    return <CenteredMessage icon={<FileWarning className="w-10 h-10 text-red-400" />} title="Link not found" description="This share link doesn't exist or was removed." />;
  }

  if (state === "expired") {
    return <CenteredMessage icon={<ShieldAlert className="w-10 h-10 text-red-400" />} title="Link expired" description="This share link is no longer active." />;
  }

  if (!item) return null;

  if (needsPassword) {
    return (
      <CenteredMessage icon={<Lock className="w-10 h-10 text-accent" />} title="Password required" description={`This link is protected. Enter the password to view "${item.name}".`}>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
            placeholder="Password"
            className="dialog-input"
            autoFocus
          />
          {passwordError && <span className="text-xs text-red-500">Incorrect password.</span>}
          <button onClick={handlePasswordSubmit} className="btn-primary">
            Unlock
          </button>
        </div>
      </CenteredMessage>
    );
  }

  if (needsOtp) {
    return (
      <CenteredMessage icon={<Lock className="w-10 h-10 text-accent" />} title="Verification code required" description={`Enter the one-time code to view "${item.name}".`}>
        <div className="flex gap-2.5 text-left bg-accent-bg border border-accent-border text-text-heading p-3 rounded-xl text-[11px] leading-normal mb-3 max-w-xs">
          Demo mode — a real deployment would email this code instead of showing it here. Your code:{" "}
          <strong className="text-accent">{otpCode}</strong>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <input
            type="text"
            value={otpInput}
            onChange={(e) => setOtpInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleOtpSubmit()}
            placeholder="6-digit code"
            className="dialog-input"
            autoFocus
          />
          {otpError && <span className="text-xs text-red-500">Incorrect code.</span>}
          <button onClick={handleOtpSubmit} className="btn-primary">
            Verify
          </button>
        </div>
      </CenteredMessage>
    );
  }

  const renderContent = () => {
    if (item.type === "image") return <ImageLightbox item={item} />;
    if (item.type === "pdf") {
      return (
        <Suspense fallback={<ViewerLoading />}>
          <PdfViewer item={item} />
        </Suspense>
      );
    }
    if (item.type === "spreadsheet") {
      return (
        <Suspense fallback={<ViewerLoading />}>
          <SpreadsheetViewer item={item} onSave={noOpSave} />
        </Suspense>
      );
    }
    if (item.type === "video" || item.type === "audio") return <MediaPlayer item={item} size="full" />;
    if (isTextEditable(item)) {
      return (
        <Suspense fallback={<ViewerLoading />}>
          <CodeEditor item={item} onSave={noOpSave} />
        </Suspense>
      );
    }
    return <div className="text-sm text-text-main text-center py-16">No preview available for this file type.</div>;
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center bg-bg-main text-text-main px-4 py-10">
      <div className="w-full max-w-3xl flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-text-heading break-all">{item.name}</h3>
            <p className="text-xs text-text-main">
              {formatBytes(item.size)} · Last modified {formatDate(item.modifiedAt)} · Shared as{" "}
              {item.share?.linkPermission === "edit" ? "Editor (view-only in this demo)" : "Viewer"}
            </p>
          </div>
          <button onClick={handleDownload} className="btn-outline flex items-center gap-1.5 shrink-0" style={{ width: "auto" }}>
            <Download className="w-3.5 h-3.5" /> Download
          </button>
        </div>
        <div className="bg-bg-main border border-border-main rounded-2xl p-6 shadow-sm">{renderContent()}</div>
      </div>
    </div>
  );
}

function CenteredMessage({
  icon,
  title,
  description,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center gap-3 bg-bg-main text-text-main px-6 text-center">
      {icon}
      <h3 className="text-lg font-bold text-text-heading">{title}</h3>
      {description && <p className="text-sm text-text-main max-w-sm">{description}</p>}
      {children}
    </div>
  );
}
