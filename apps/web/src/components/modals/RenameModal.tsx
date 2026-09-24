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
