import { useState } from "react";
import { ModalShell } from "./ModalShell";

export function CreateFolderModal({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");

  return (
    <ModalShell onClose={onCancel}>
      <h3 className="modal-title">New Folder</h3>
      <div className="dialog-form-group">
        <label className="data-label">Folder Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter folder name"
          className="dialog-input"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && name.trim() && onCreate(name)}
        />
      </div>
      <div className="modal-actions">
        <button onClick={onCancel} className="btn-outline">
          Cancel
        </button>
        <button
          onClick={() => onCreate(name)}
          disabled={!name.trim()}
          className="btn-primary"
          style={{ width: "auto" }}
        >
          Create Folder
        </button>
      </div>
    </ModalShell>
  );
}
