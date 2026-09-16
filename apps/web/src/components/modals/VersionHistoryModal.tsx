import { Download, History, Loader2 } from "lucide-react";
import type { FileItem } from "../../types/file";
import { formatBytes, formatDate } from "../../utils/format";
import { ModalShell } from "./ModalShell";

export function VersionHistoryModal({
  item,
  latestVersion,
  olderVersions,
  loading,
  onClose,
  onDownloadVersion,
}: {
  item: FileItem;
  latestVersion: number;
  olderVersions: number[];
  loading: boolean;
  onClose: () => void;
  onDownloadVersion: (version: number) => void;
}) {
  return (
    <ModalShell onClose={onClose}>
      <h3 className="modal-title flex items-center gap-2">
        <History className="w-4 h-4" /> Version History
      </h3>
      <p className="modal-description break-all">{item.name}</p>

      <div className="max-h-80 overflow-y-auto flex flex-col gap-2 mb-5">
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-accent-border bg-accent-bg">
          <div>
            <div className="text-xs font-semibold text-accent">Current version (v{latestVersion})</div>
            <div className="text-[11px] text-text-main">
              {formatDate(item.modifiedAt)} · {formatBytes(item.size)}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 text-xs text-text-main py-6">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading versions…
          </div>
        ) : olderVersions.length === 0 ? (
          <div className="text-xs text-text-main text-center py-6">No earlier versions yet — replacing this file creates one.</div>
        ) : (
          olderVersions.map((v) => (
            <div key={v} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border-main">
              <div className="text-xs font-semibold text-text-heading">Version {v}</div>
              <button
                onClick={() => onDownloadVersion(v)}
                className="border-none bg-transparent p-1.5 rounded-full text-text-main hover:bg-code-bg cursor-pointer transition"
                title="Download this version"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="modal-actions">
        <button onClick={onClose} className="btn-outline">
          Close
        </button>
      </div>
    </ModalShell>
  );
}
