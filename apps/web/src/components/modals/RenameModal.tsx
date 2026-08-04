import { useState } from "react";
import { ModalShell } from "./ModalShell";

export function RenameModal({
  currentName,
  onCancel,
  onRename,
}: {
  currentName: string;
  onCancel: () => void;
  onRename: (name: string) => void;
}) {
  const [name, setName] = useState(currentName);

  return (
    <ModalShell onClose={onCancel}>
      <h3 className="modal-title">Rename Item</h3>
      <div className="dialog-form-group">
        <label className="data-label">New Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="dialog-input"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && name.trim() && onRename(name)}
        />
      </div>
      <div className="modal-actions">
        <button onClick={onCancel} className="btn-outline">
          Cancel
        </button>
        <button
          onClick={() => onRename(name)}
          disabled={!name.trim()}
          className="btn-primary"
          style={{ width: "auto" }}
        >
          Rename
        </button>
      </div>
    </ModalShell>
  );
}
