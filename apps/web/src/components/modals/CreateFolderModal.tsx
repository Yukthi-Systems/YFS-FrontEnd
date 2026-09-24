/*
 * Copyright (C) 2026 Yukthi Systems Private Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * version 3 along with this program. If not, see
 * <https://www.gnu.org/licenses/>.
 */

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
