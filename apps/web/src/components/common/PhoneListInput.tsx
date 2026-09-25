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

import { useMemo, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { PhoneInput } from "./PhoneInput";

// Drop-in replacement for a plain "+1 555 0100, …" free-text input, wherever a field
// stores several OTP-eligible phone numbers as one comma-joined string (ShareModal's
// LinkDraft.otpPhones, EditShareLinkModal's otpPhones — same `splitList`/`join(", ")`
// convention in both, untouched here) — same external shape, so no change needed on
// the caller's save/dirty-check logic. Existing numbers show as chips below the input;
// PhoneInput (with its country-code picker) adds new ones, each stored in full "+<code
// ><digits>" form so it matches exactly what the OTP endpoints compare against
// (routes/auth.rs: phones_for_otp.contains(&phone_or_email), exact string equality).
// Clicking a chip pulls it back into the input to edit — committing then replaces it
// in place rather than adding a duplicate.
export function PhoneListInput({
  value,
  onChange,
  placeholder = "Add a phone number",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const phones = useMemo(() => value.split(",").map((s) => s.trim()).filter(Boolean), [value]);
  const [draft, setDraft] = useState("");
  // Index in `phones` currently loaded into the input for editing, if any — commit()
  // replaces that entry instead of appending.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const withoutEdited = editingIndex === null ? phones : phones.filter((_, i) => i !== editingIndex);
    if (!withoutEdited.includes(trimmed)) onChange([...withoutEdited, trimmed].join(", "));
    else onChange(withoutEdited.join(", "));
    setDraft("");
    setEditingIndex(null);
  };

  const startEdit = (index: number) => {
    setDraft(phones[index]);
    setEditingIndex(index);
  };

  const removeAt = (index: number) => {
    onChange(phones.filter((_, i) => i !== index).join(", "));
    if (editingIndex === index) {
      setDraft("");
      setEditingIndex(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Its own form (neither ShareModal nor EditShareLinkModal wraps these fields in
          one already) purely so Enter in the phone input adds/saves it, without
          submitting — or needing to know about — whatever the caller's own Save action is. */}
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
      >
        <div className="flex-1 min-w-0">
          <PhoneInput value={draft} onChange={setDraft} placeholder={placeholder} compact />
        </div>
        <button
          type="submit"
          disabled={!draft.trim()}
          title={editingIndex === null ? "Add phone number" : "Save phone number"}
          className="shrink-0 w-8 flex items-center justify-center rounded-lg border border-border-main bg-code-bg text-text-main hover:text-text-heading hover:bg-border-main disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
        >
          {editingIndex === null ? <Plus className="w-3.5 h-3.5" /> : <Pencil className="w-3 h-3" />}
        </button>
      </form>
      {phones.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {phones.map((p, i) => (
            <span
              key={`${p}-${i}`}
              className={`inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full border text-xs transition ${
                editingIndex === i
                  ? "bg-accent-bg border-accent-border text-accent"
                  : "bg-code-bg border-border-main text-text-heading"
              }`}
            >
              <button
                type="button"
                onClick={() => startEdit(i)}
                title={`Edit ${p}`}
                className="border-none bg-transparent p-0 cursor-pointer text-inherit"
              >
                {p}
              </button>
              <button
                type="button"
                onClick={() => removeAt(i)}
                title={`Remove ${p}`}
                className="p-0.5 rounded-full border-none bg-transparent text-text-main hover:bg-border-main hover:text-text-heading cursor-pointer transition"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
