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

// "Jane Doe" -> "J", falling back to the email if no name.
const initialsOf = (name?: string | null, email?: string | null): string => {
  const trimmedName = (name || "").trim();
  if (trimmedName) return trimmedName[0].toUpperCase();
  return (email || "").trim().substring(0, 1).toUpperCase() || "?";
};

export function Avatar({
  name,
  email,
  color,
  className = "",
}: {
  name?: string | null;
  email?: string | null;
  // Without an override, uses a tint of the theme accent.
  color?: string;
  // Caller controls size/shape/text-size via utility classes (e.g. "w-8 h-8 text-[11px]").
  className?: string;
}) {
  const initials = initialsOf(name, email);

  if (color) {
    return (
      <span
        className={`rounded-full text-white flex items-center justify-center font-bold shrink-0 ${className}`}
        style={{ background: color }}
      >
        {initials}
      </span>
    );
  }

  return (
    <span className={`rounded-full bg-accent-bg text-accent flex items-center justify-center font-bold shrink-0 ${className}`}>
      {initials}
    </span>
  );
}
