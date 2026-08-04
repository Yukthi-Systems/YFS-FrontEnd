import { Download, History, RotateCcw } from "lucide-react";
import type { FileItem, FileVersion } from "../../types/file";
import { formatBytes, formatDate } from "../../utils/format";
import { ModalShell } from "./ModalShell";

export function VersionHistoryModal({
  item,
  onClose,
  onRestore,
  onDownloadVersion,
}: {
  item: FileItem;
  onClose: () => void;
  onRestore: (versionId: string) => void;
  onDownloadVersion: (version: FileVersion) => void;
}) {
  const versions = item.versions ?? [];

  return (
    <ModalShell onClose={onClose}>
      <h3 className="modal-title flex items-center gap-2">
        <History className="w-4 h-4" /> Version History
      </h3>
      <p className="modal-description break-all">{item.name}</p>

      <div className="max-h-80 overflow-y-auto flex flex-col gap-2 mb-5">
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-accent-border bg-accent-bg">
          <div>
            <div className="text-xs font-semibold text-accent">Current version</div>
            <div className="text-[11px] text-text-main">
              {formatDate(item.modifiedAt)} · {formatBytes(item.size)}
            </div>
          </div>
        </div>

        {versions.length === 0 ? (
          <div className="text-xs text-text-main text-center py-6">No earlier versions yet — saving an edit creates one automatically.</div>
        ) : (
          versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border-main">
              <div>
                <div className="text-xs font-semibold text-text-heading">{formatDate(v.savedAt)}</div>
                <div className="text-[11px] text-text-main">{formatBytes(v.size)}</div>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => onDownloadVersion(v)}
                  className="border-none bg-transparent p-1.5 rounded-full text-text-main hover:bg-code-bg cursor-pointer transition"
                  title="Download this version"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onRestore(v.id)}
                  className="border-none bg-transparent p-1.5 rounded-full text-text-main hover:bg-code-bg cursor-pointer transition"
                  title="Restore this version"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
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
