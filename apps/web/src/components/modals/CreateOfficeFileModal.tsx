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
import { OFFICE_KINDS, type OfficeKind } from "../../utils/officeTemplates";

export function CreateOfficeFileModal({
  kind,
  onCancel,
  onCreate,
}: {
  kind: OfficeKind;
  onCancel: () => void;
  onCreate: (name: string) => void;
}) {
  const { label, extension } = OFFICE_KINDS[kind];
  const [name, setName] = useState(`Untitled ${label}`);

  return (
    <ModalShell onClose={onCancel}>
      <h3 className="modal-title">New {label}</h3>
      <div className="dialog-form-group">
        <label className="data-label">File Name</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Enter ${label.toLowerCase()} name`}
            className="dialog-input"
            autoFocus
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && onCreate(name)}
          />
          <span className="text-sm text-text-main shrink-0">.{extension}</span>
        </div>
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
          Create {label}
        </button>
      </div>
    </ModalShell>
  );
}
