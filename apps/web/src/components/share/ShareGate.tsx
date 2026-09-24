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

import type { ReactNode } from "react";

// Card screen for the share route's non-browse states, styled like LoginScreen.
export function ShareGate({
  icon,
  tone = "accent",
  title,
  description,
  children,
}: {
  icon: ReactNode;
  tone?: "accent" | "danger";
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  const iconTile =
    tone === "danger" ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-accent-bg border-accent-border text-accent";
  return (
    <div className="flex min-h-screen w-screen flex-col items-center justify-center gap-6 p-6 bg-gradient-to-tr from-indigo-500/5 via-transparent to-accent/5 text-text-main">
      <div className="w-full max-w-md bg-bg-main/75 backdrop-blur-lg border border-border-main rounded-3xl p-10 shadow-lg text-center max-[480px]:p-6">
        <div className={`inline-flex items-center justify-center w-15 h-15 border rounded-2xl mb-6 ${iconTile}`}>{icon}</div>
        <h1 className="text-2xl font-bold tracking-tight text-text-heading mb-2">{title}</h1>
        {description && <p className="text-text-main text-sm leading-relaxed">{description}</p>}
        {children && <div className="mt-8 flex flex-col gap-3 text-left">{children}</div>}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-text-main">
        <span className="text-accent">⚡</span>
        <span className="font-semibold text-text-heading">YFS</span>
        <span>· Secure file sharing</span>
      </div>
    </div>
  );
}

export const gatePrimaryButton =
  "flex items-center justify-center gap-2 w-full py-3 px-6 rounded-2xl bg-accent text-white font-semibold shadow-md shadow-accent/20 hover:shadow-lg hover:shadow-accent/30 disabled:bg-border-main disabled:text-text-main disabled:shadow-none cursor-pointer transition-all";
export const gateSecondaryButton =
  "flex items-center justify-center gap-2 w-full py-3 px-6 rounded-2xl bg-transparent border border-border-main text-text-heading font-semibold hover:bg-code-bg cursor-pointer transition";
