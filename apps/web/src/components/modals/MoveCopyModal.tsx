import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Folder, HardDrive } from "lucide-react";
import type { FileItem } from "../../types/file";
import { ModalShell } from "./ModalShell";

interface FolderNode {
  folder: FileItem | null; // null = "My Drive" root
  children: FolderNode[];
}

function buildTree(folders: FileItem[], parentId: string | null): FolderNode[] {
  return folders
    .filter((f) => f.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((folder) => ({ folder, children: buildTree(folders, folder.id) }));
}

function FolderRow({
  node,
  depth,
  disabledIds,
  selectedId,
  onSelect,
}: {
  node: FolderNode;
  depth: number;
  disabledIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const id = node.folder?.id ?? null;
  const isDisabled = id !== null && disabledIds.has(id);
  const isSelected = selectedId === id;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-1.5 rounded-lg cursor-pointer text-sm ${
          isDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-code-bg"
        } ${isSelected ? "bg-accent-bg! text-accent font-semibold" : "text-text-heading"}`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => !isDisabled && onSelect(id)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className={`border-none bg-transparent p-0.5 rounded text-text-main hover:bg-border-main cursor-pointer flex items-center justify-center transition ${
            hasChildren ? "" : "invisible"
          }`}
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        {node.folder ? (
          <Folder className="w-4 h-4 text-yellow-400 fill-yellow-400/20 shrink-0" />
        ) : (
          <HardDrive className="w-4 h-4 shrink-0" />
        )}
        <span className="truncate">{node.folder ? node.folder.name : "My Drive"}</span>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <FolderRow
              key={child.folder!.id}
              node={child}
              depth={depth + 1}
              disabledIds={disabledIds}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function MoveCopyModal({
  files,
  mode,
  sourceIds,
  currentParentId,
  trashFolderId,
  onCancel,
  onConfirm,
}: {
  files: FileItem[];
  mode: "move" | "copy";
  sourceIds: string[];
  currentParentId: string | null;
  trashFolderId?: string | null;
  onCancel: () => void;
  onConfirm: (destinationId: string | null) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(currentParentId);

  const folders = useMemo(
    () => files.filter((f) => f.isFolder && !f.isDeleted && f.id !== trashFolderId),
    [files, trashFolderId]
  );
  const tree = useMemo(() => buildTree(folders, null), [folders]);

  // A folder can't be moved/copied into itself or one of its own descendants.
  const disabledIds = useMemo(() => {
    const disabled = new Set<string>();
    const collectDescendants = (rootId: string) => {
      disabled.add(rootId);
      for (const f of folders) {
        if (f.parentId === rootId) collectDescendants(f.id);
      }
    };
    for (const id of sourceIds) {
      const item = files.find((f) => f.id === id);
      if (item?.isFolder) collectDescendants(id);
    }
    return disabled;
  }, [sourceIds, files, folders]);

  const isNoOp = mode === "move" && sourceIds.length === 1 && selectedId === currentParentId;

  return (
    <ModalShell onClose={onCancel}>
      <h3 className="modal-title">{mode === "move" ? "Move to…" : "Copy to…"}</h3>
      <p className="modal-description">
        Choose a destination folder for {sourceIds.length > 1 ? `${sourceIds.length} items` : "this item"}.
      </p>
      <div className="max-h-72 overflow-y-auto border border-border-main rounded-xl p-2 mb-5">
        <FolderRow
          node={{ folder: null, children: tree }}
          depth={0}
          disabledIds={disabledIds}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>
      <div className="modal-actions">
        <button onClick={onCancel} className="btn-outline">
          Cancel
        </button>
        <button
          onClick={() => onConfirm(selectedId)}
          disabled={isNoOp}
          className="btn-primary"
          style={{ width: "auto" }}
        >
          {mode === "move" ? "Move Here" : "Copy Here"}
        </button>
      </div>
    </ModalShell>
  );
}
