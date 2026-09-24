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

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { ContextMenuPortal } from "./ContextMenuPortal";
import type { AnchorRect } from "./ContextMenuPortal";

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}


export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  placeholder = "Select…",
  triggerClassName,
  panelClassName,
  align = "start",
}: {
  value: T | null;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  triggerClassName?: string;
  panelClassName?: string;
  align?: "start" | "end";
}) {
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const open = anchor !== null;
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setAnchor(null);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAnchor(null);
    };
    document.addEventListener("click", onOutsideClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("click", onOutsideClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const toggle = () => {
    if (open) {
      setAnchor(null);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setAnchor({ top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className={
          triggerClassName ??
          "px-3 py-1.5 bg-code-bg border border-border-main rounded-full text-xs font-medium text-text-main cursor-pointer hover:bg-border-main transition inline-flex items-center gap-1.5"
        }
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ContextMenuPortal anchor={anchor} align={align}>
          <div
            ref={panelRef}
            className={
              panelClassName ??
              "w-48 bg-bg-main border border-border-main rounded-xl p-1 shadow-lg animate-scale-in flex flex-col gap-0.5 max-h-64 overflow-y-auto"
            }
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setAnchor(null);
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs font-medium cursor-pointer transition border-none ${
                    isSelected
                      ? "text-accent bg-accent-bg"
                      : "text-text-main bg-transparent hover:bg-code-bg hover:text-text-heading"
                  }`}
                >
                  {opt.icon}
                  <span className="flex-1 truncate">{opt.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>
        </ContextMenuPortal>
      )}
    </>
  );
}
