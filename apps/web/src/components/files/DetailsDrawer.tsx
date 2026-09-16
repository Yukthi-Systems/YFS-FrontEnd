import { Download, Expand, FolderInput, CopyPlus, Star, Trash2, X, History, Share2 } from "lucide-react";
import type { FileItem, InternalSharePermissions } from "../../types/file";
import { formatBytes, formatDate } from "../../utils/format";
import { getFileIcon, getItemIcon } from "./FileIcon";
import { MediaPlayer } from "../viewers/MediaPlayer";
import { useStreamUrl } from "../../hooks/useDownload";

const PLACEHOLDER_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='1'><rect x='3' y='3' width='18' height='18' rx='2'/><circle cx='8.5' cy='8.5' r='1.5'/><polyline points='21 15 16 10 5 21'/></svg>";

// `openable`: whether clicking through to a full viewer is actually wired up for
// this render — false in read-only contexts (e.g. the public share view) that have
// no "Open" action, so the hint text isn't left promising one.
export function CompactPreview({ item, openable = true }: { item: FileItem; openable?: boolean }) {
  const { data: imageUrl } = useStreamUrl(item.type === "image" ? item : null);

  if (item.isFolder) {
    return (
      <div className="flex flex-col items-center gap-2 text-center text-text-main">
        {getItemIcon(item, "w-12 h-12")}
        <div className="text-xs font-medium">Folder containing directory contents</div>
      </div>
    );
  }

  if (item.type === "image") {
    return (
      <img
        src={imageUrl || item.blobUrl || PLACEHOLDER_SVG}
        alt={item.name}
        className="max-w-full max-h-[160px] object-contain rounded-lg shadow-sm"
      />
    );
  }

  if (item.type === "audio" || item.type === "video") {
    return <MediaPlayer item={item} size="compact" />;
  }

  return (
    <div className="flex flex-col items-center gap-2 text-center text-text-main">
      {getFileIcon(item.type, "w-12 h-12")}
      <div className="text-xs font-medium">
        {item.extension?.toUpperCase() || "Unknown"} file{openable ? " — click Open to view" : ""}
      </div>
    </div>
  );
}

export const KIND_LABEL: Record<FileItem["type"], string> = {
  folder: "Folder",
  audio: "Audio",
  video: "Video",
  image: "Image",
  pdf: "PDF document",
  spreadsheet: "Spreadsheet",
  document: "Document",
  code: "Code",
  other: "File",
};

export function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-xs leading-normal">
      <span className="text-text-main font-semibold shrink-0">{label}</span>
      <span className="text-text-heading font-medium truncate text-right">{children}</span>
    </div>
  );
}

// Direct + total counts of an item's live descendants.
function folderContents(files: FileItem[], rootId: string) {
  const direct = files.filter((f) => f.parentId === rootId && !f.isDeleted);
  const seen = new Set<string>();
  const queue = [rootId];
  let folders = 0;
  let leaves = 0;
  while (queue.length) {
    const pid = queue.shift()!;
    for (const f of files) {
      if (f.parentId !== pid || f.isDeleted || seen.has(f.id)) continue;
      seen.add(f.id);
      queue.push(f.id);
      if (f.isFolder) folders++;
      else leaves++;
    }
  }
  return { directCount: direct.length, folders, files: leaves };
}

import { useFileInfo } from "../../hooks/useFileInfo";

export function DetailsDrawer({
  item,
  files,
  pathLabel,
  permissions = null,
  onClose,
  onOpenFull,
  onDownload,
  onToggleStar,
  onRename,
  onMove,
  onCopy,
  onVersionHistory,
  onShare,
  onTrash,
  onRestore,
}: {
  item: FileItem;
  files: FileItem[];
  pathLabel: string;
  // Caller's permissions when `item` is in a "Shared with me" subtree; null otherwise.
  permissions?: InternalSharePermissions | null;
  onClose: () => void;
  onOpenFull: () => void;
  onDownload: () => void;
  onToggleStar: () => void;
  onRename: () => void;
  onMove: () => void;
  onCopy: () => void;
  onVersionHistory: () => void;
  onShare: () => void;
  onTrash: () => void;
  onRestore: () => void;
}) {
  const shared = permissions !== null;
  const allowDownload = !shared || permissions.can_download;
  const allowEdit = !shared || permissions.can_update;
  const allowMove = !shared || (permissions.can_update && permissions.can_create);
  const allowDelete = !shared && !item.isDeleted;
  const allowShare = !shared;

  const { data: fileInfo, isLoading: isLoadingInfo } = useFileInfo(item, !item.isFolder);

  return (
    <aside
      className="w-80 min-w-80 border-l border-border-main bg-bg-main flex flex-col h-full overflow-y-auto box-border shrink-0 max-[1024px]:absolute max-[1024px]:right-0 max-[1024px]:top-0 max-[1024px]:bottom-0 max-[1024px]:z-40 max-[1024px]:shadow-xl max-[360px]:w-full max-[420px]:min-w-0 animate-slide-in-right"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-4 py-3 border-b border-border-main flex items-center justify-between">
        <h3 className="text-base font-bold text-text-heading">Details</h3>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-code-bg text-text-main hover:text-text-heading border-none bg-transparent cursor-pointer transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4 text-left">
        <div
          className="w-full rounded-xl bg-code-bg border border-border-main overflow-hidden flex flex-col items-center justify-center min-h-40 p-4 box-border relative cursor-pointer"
          onClick={() => !item.isFolder && onOpenFull()}
        >
          <CompactPreview item={item} />
          {!item.isFolder && (
            <div className="absolute top-2 right-2 bg-black/40 text-white rounded-full p-1.5">
              <Expand className="w-3.5 h-3.5" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-bold text-text-heading break-all leading-snug">{item.name}</h4>
          <span className="text-xs text-text-main">{KIND_LABEL[item.type]}</span>
        </div>

        <div className="flex flex-col gap-2.5">
          <InfoRow label="Kind">
            {item.isFolder ? "Folder" : `${item.extension ? item.extension.toUpperCase() + " · " : ""}${KIND_LABEL[item.type]}`}
          </InfoRow>

          {item.isFolder &&
            (() => {
              const c = folderContents(files, item.id);
              return (
                <>
                  <InfoRow label="Contains">
                    {c.folders + c.files === 0
                      ? "Empty"
                      : [c.folders && `${c.folders} folder${c.folders > 1 ? "s" : ""}`, c.files && `${c.files} file${c.files > 1 ? "s" : ""}`]
                          .filter(Boolean)
                          .join(", ")}
                  </InfoRow>
                  <InfoRow label="Items here">{c.directCount}</InfoRow>
                </>
              );
            })()}

          {!item.isFolder && item.version != null && <InfoRow label="Version">v{item.version}</InfoRow>}

          <InfoRow label="Owner">{item.owner.name || "—"}</InfoRow>
          {item.createdBy && <InfoRow label="Created by">{item.createdBy}</InfoRow>}
          <InfoRow label="Location">
            <span title={pathLabel}>{pathLabel}</span>
          </InfoRow>
          <InfoRow label="Size">{item.size ? formatBytes(item.size) : "—"}</InfoRow>
          <InfoRow label="Modified">{formatDate(item.modifiedAt)}</InfoRow>
          <InfoRow label="Created">{formatDate(item.createdAt)}</InfoRow>

          {item.isStarred && <InfoRow label="Starred">Yes</InfoRow>}
          {item.isDeleted && <InfoRow label="Status">In Trash</InfoRow>}
          {item.isFolder && item.color && (
            <div className="flex justify-between gap-3 text-xs leading-normal">
              <span className="text-text-main font-semibold">Colour</span>
              <span className="w-4 h-4 rounded-full border border-border-main" style={{ backgroundColor: item.color }} />
            </div>
          )}

          <InfoRow label="ID">
            <span className="font-mono text-[10px]">{item.id}</span>
          </InfoRow>

          {!item.isFolder && (
            <>
              <div className="my-2 border-t border-border-main" />
              {isLoadingInfo ? (
                <div className="text-xs text-text-main text-center py-2">Loading additional details...</div>
              ) : fileInfo ? (
                <div className="flex flex-col gap-2">
                  <h4 className="text-sm font-semibold text-text-heading">Extended Info</h4>
                  <pre className="text-[10px] text-text-main bg-code-bg p-2 rounded border border-border-main overflow-auto max-h-40">
                    {JSON.stringify(fileInfo, null, 2)}
                  </pre>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="flex flex-col gap-2 mt-2">
          {!item.isFolder && (
            <button
              onClick={onOpenFull}
              className="flex items-center justify-center gap-2 w-full py-2 bg-gradient-to-br from-accent to-purple-600 text-white font-semibold rounded-xl hover:shadow-md cursor-pointer transition-all"
            >
              <Expand className="w-4 h-4" /> Open
            </button>
          )}
          {allowDownload && (
            <button
              onClick={onDownload}
              className="flex items-center justify-center gap-2 w-full py-2 bg-transparent border border-border-main text-text-heading font-semibold rounded-xl hover:bg-code-bg cursor-pointer transition text-xs"
            >
              <Download className="w-3.5 h-3.5" /> {item.isFolder ? "Download as .zip" : "Download"}
            </button>
          )}
          {allowEdit && (
            <div className="flex gap-2">
              <button
                onClick={onToggleStar}
                className="flex-1 py-2 bg-transparent border border-border-main text-text-heading font-semibold rounded-xl hover:bg-code-bg cursor-pointer transition text-xs flex items-center justify-center gap-1.5"
              >
                <Star className={`w-3.5 h-3.5 ${item.isStarred ? "text-yellow-400 fill-yellow-400" : ""}`} /> {item.isStarred ? "Unstar" : "Star"}
              </button>
              <button
                onClick={onRename}
                className="flex-1 py-2 bg-transparent border border-border-main text-text-heading font-semibold rounded-xl hover:bg-code-bg cursor-pointer transition text-xs"
              >
                Rename
              </button>
            </div>
          )}
          {!item.isFolder && (
            <button
              onClick={onVersionHistory}
              className="w-full py-2 bg-transparent border border-border-main text-text-heading font-semibold rounded-xl hover:bg-code-bg cursor-pointer transition text-xs flex items-center justify-center gap-1.5"
            >
              <History className="w-3.5 h-3.5" /> Version History
            </button>
          )}
          {!item.isDeleted && (allowMove || !item.isFolder) && (
            <div className="flex gap-2">
              {allowMove && (
                <button
                  onClick={onMove}
                  className="flex-1 py-2 bg-transparent border border-border-main text-text-heading font-semibold rounded-xl hover:bg-code-bg cursor-pointer transition text-xs flex items-center justify-center gap-1.5"
                >
                  <FolderInput className="w-3.5 h-3.5" /> Move
                </button>
              )}
              {!item.isFolder && (
                <button
                  onClick={onCopy}
                  className="flex-1 py-2 bg-transparent border border-border-main text-text-heading font-semibold rounded-xl hover:bg-code-bg cursor-pointer transition text-xs flex items-center justify-center gap-1.5"
                >
                  <CopyPlus className="w-3.5 h-3.5" /> Copy
                </button>
              )}
            </div>
          )}
          {!item.isDeleted && allowShare && (
            <button
              onClick={onShare}
              className="w-full py-2 bg-transparent border border-border-main text-text-heading font-semibold rounded-xl hover:bg-code-bg cursor-pointer transition text-xs flex items-center justify-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
          )}
          {item.isDeleted ? (
            <button
              onClick={onRestore}
              className="w-full py-2 bg-transparent border border-green-500/50 text-green-600 font-semibold rounded-xl hover:bg-green-500/10 cursor-pointer transition text-xs"
            >
              Restore Item
            </button>
          ) : (
            allowDelete && (
              <button
                onClick={onTrash}
                className="w-full py-2 bg-transparent border border-red-500/50 text-red-500 font-semibold rounded-xl hover:bg-red-500/10 cursor-pointer transition text-xs flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Move to Trash
              </button>
            )
          )}
        </div>
      </div>
    </aside>
  );
}
