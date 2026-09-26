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

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { COUNTRY_DIAL_CODES, flagEmoji, type CountryDialCode } from "../../data/countryCodes";
import { ContextMenuPortal, type AnchorRect } from "./ContextMenuPortal";

// Country dial codes aren't unique length, and some countries share a code (e.g. +1 for
// both the US and Canada) — sorted longest-first so a value like "+1264" (Anguilla)
// matches before the shorter "+1" (US) does.
const BY_DIAL_CODE_LENGTH = [...COUNTRY_DIAL_CODES].sort((a, b) => b.dialCode.length - a.dialCode.length);

const matchCountry = (value: string): CountryDialCode | undefined =>
  value.startsWith("+") ? BY_DIAL_CODE_LENGTH.find((c) => value.startsWith(c.dialCode)) : undefined;

const DEFAULT_COUNTRY = COUNTRY_DIAL_CODES.find((c) => c.iso2 === "in") ?? COUNTRY_DIAL_CODES[0];

// Country-code-aware phone input — adapted from Phoenix-Admin-UI's PhoneInput.jsx
// (same company) for YFS's own design tokens and its existing Dropdown/
// ContextMenuPortal positioning primitive instead of that component's bespoke
// outside-click/flip-to-top logic. Flags render as Unicode emoji (COUNTRY_DIAL_CODES'
// flagEmoji) rather than that project's SVG asset set, so no new static files were
// needed here. Fully controlled: `value` is the combined value (e.g. "+919876543210"),
// same shape callers already send to the API — there's no separate "country" field to
// thread through.
export function PhoneInput({
  value,
  onChange,
  placeholder = "Phone number",
  ariaLabel = "Phone number",
  invalid = false,
  autoFocus = false,
  defaultDialCode,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  invalid?: boolean;
  autoFocus?: boolean;
  // Country to preselect when `value` doesn't already start with a recognised dial
  // code (e.g. it's empty). Falls back to India, then whatever's first in the list.
  defaultDialCode?: string;
  // Matches ".dialog-input" (App.css) exactly — same border-radius/padding/font-size —
  // for sitting next to a plain dialog-input sibling (ShareModal/EditShareLinkModal's
  // OTP email field, via PhoneListInput) instead of this component's own larger default,
  // which matches the bigger password/OTP-code inputs on the public share gate screens
  // (SharedFileView) it was first built for.
  compact?: boolean;
}) {
  const initialCountry =
    matchCountry(value) ?? COUNTRY_DIAL_CODES.find((c) => c.dialCode === defaultDialCode) ?? DEFAULT_COUNTRY;
  const [country, setCountry] = useState<CountryDialCode>(initialCountry);
  const [localNumber, setLocalNumber] = useState(() => (matchCountry(value) ? value.slice(initialCountry.dialCode.length) : ""));
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const open = anchor !== null;

  // Re-sync from an externally-changed `value` (e.g. the parent resets the form) —
  // guarded so this doesn't fight the onChange below on every keystroke: only reparses
  // when `value` no longer matches what this component itself would currently produce.
  useEffect(() => {
    if (value === `${country.dialCode}${localNumber}`) return;
    const matched = matchCountry(value);
    if (matched) {
      setCountry(matched);
      setLocalNumber(value.slice(matched.dialCode.length));
    } else if (!value) {
      setLocalNumber("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const combined = localNumber ? `${country.dialCode}${localNumber}` : "";
    if (combined !== value) onChange(combined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country.dialCode, localNumber]);

  useEffect(() => {
    if (!open) return;
    const onOutsideClick = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setAnchor(null);
      setSearch("");
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAnchor(null);
        setSearch("");
      }
    };
    document.addEventListener("pointerdown", onOutsideClick, true);
    document.addEventListener("keydown", onEscape);
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("pointerdown", onOutsideClick, true);
      document.removeEventListener("keydown", onEscape);
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  const toggle = () => {
    if (open) {
      setAnchor(null);
      setSearch("");
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setAnchor({ top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom });
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return COUNTRY_DIAL_CODES;
    const q = search.trim().toLowerCase();
    return COUNTRY_DIAL_CODES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dialCode.includes(q) || c.iso2.includes(q)
    );
  }, [search]);

  return (
    <div
      className={`flex w-full border bg-code-bg transition focus-within:ring-4 ${compact ? "rounded-lg" : "rounded-2xl"} ${
        invalid ? "border-red-500/60 focus-within:ring-red-500/10" : "border-border-main focus-within:border-accent focus-within:ring-accent-bg"
      }`}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        title={country.name}
        className={`flex items-center border-none bg-transparent text-text-heading cursor-pointer shrink-0 ${
          compact ? "gap-1 pl-[0.65rem] pr-1.5 text-[0.82rem]" : "gap-1.5 pl-4 pr-2.5 text-sm"
        }`}
      >
        <span className="text-base leading-none">{flagEmoji(country.iso2)}</span>
        <span className="font-medium">{country.dialCode}</span>
        <ChevronDown className={`${compact ? "w-3 h-3" : "w-3.5 h-3.5"} text-text-main transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`w-px bg-border-main ${compact ? "my-1.5" : "my-2"}`} />
      <input
        type="tel"
        inputMode="tel"
        value={localNumber}
        onChange={(e) => setLocalNumber(e.target.value.replace(/[^0-9]/g, ""))}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        autoFocus={autoFocus}
        className={`flex-1 min-w-0 bg-transparent border-none text-text-heading focus:outline-none ${
          compact ? "py-[0.45rem] pl-1.5 pr-[0.65rem] text-[0.82rem]" : "py-3 pl-2.5 pr-4 text-sm"
        }`}
      />

      {open && (
        <ContextMenuPortal anchor={anchor}>
          <div ref={panelRef} className="w-72 bg-bg-main border border-border-main rounded-xl shadow-lg animate-scale-in flex flex-col">
            <div className="p-2 border-b border-border-main shrink-0">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country or code…"
                className="w-full py-1.5 px-2.5 rounded-lg border border-border-main bg-code-bg text-text-heading text-xs focus:outline-none focus:border-accent"
              />
            </div>
            <div className="max-h-60 overflow-y-auto p-1 flex flex-col gap-0.5">
              {filtered.length > 0 ? (
                filtered.map((c) => (
                  <button
                    key={`${c.iso2}-${c.dialCode}`}
                    type="button"
                    onClick={() => {
                      setCountry(c);
                      setAnchor(null);
                      setSearch("");
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left cursor-pointer transition border-none ${
                      c.iso2 === country.iso2 ? "text-accent bg-accent-bg" : "text-text-main bg-transparent hover:bg-code-bg hover:text-text-heading"
                    }`}
                  >
                    <span className="text-base leading-none shrink-0">{flagEmoji(c.iso2)}</span>
                    <span className="flex-1 truncate text-xs font-medium">{c.name}</span>
                    <span className="text-xs text-text-main shrink-0">{c.dialCode}</span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-6 text-center text-xs text-text-main">No countries found</div>
              )}
            </div>
          </div>
        </ContextMenuPortal>
      )}
    </div>
  );
}
