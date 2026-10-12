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

import { FileText, FileSpreadsheet, Presentation } from "lucide-react";
import { OFFICE_KINDS, type OfficeKind } from "../../utils/officeTemplates";

const ITEMS: { kind: OfficeKind; icon: typeof FileText; color: string }[] = [
  { kind: "document", icon: FileText, color: "text-blue-500" },
  { kind: "spreadsheet", icon: FileSpreadsheet, color: "text-green-500" },
  { kind: "presentation", icon: Presentation, color: "text-orange-500" },
];

export function OfficeFileMenuItems({ className, onSelect }: { className: string; onSelect: (kind: OfficeKind) => void }) {
  return (
    <>
      {ITEMS.map(({ kind, icon: Icon, color }) => (
        <button key={kind} onClick={() => onSelect(kind)} className={className}>
          <Icon className={`w-4 h-4 ${color}`} /> New {OFFICE_KINDS[kind].label}
        </button>
      ))}
    </>
  );
}
