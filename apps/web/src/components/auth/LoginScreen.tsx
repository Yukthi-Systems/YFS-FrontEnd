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

export function LoginScreen({
  errorMsg,
  ssoPending,
  isLogoutParam,
  onLogin,
}: {
  errorMsg: string | null;
  ssoPending: boolean;
  isLogoutParam: boolean;
  onLogin: () => void;
}) {
  return (
    <div className="flex min-h-screen w-screen items-center justify-center p-6 bg-gradient-to-tr from-indigo-500/5 via-transparent to-accent/5">
      <div className="w-full max-w-md bg-bg-main/75 backdrop-blur-lg border border-border-main rounded-3xl p-10 shadow-lg text-center hover:-translate-y-0.5 transition-all duration-300">
        <div className="inline-flex items-center justify-center w-15 h-15 bg-accent-bg border border-accent-border rounded-2xl text-accent mb-6 text-3xl">
          🛡️
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-text-heading mb-2">YFS</h1>
        <p className="text-text-main text-sm leading-relaxed mb-8">
          Access your secure organization workspace and tools using Single Sign-On (SSO).
        </p>

        {errorMsg ? (
          <div className="flex gap-3 text-left bg-red-500/5 border border-red-500/20 text-red-500 p-4 rounded-2xl text-xs leading-normal mb-6">
            <div>
              <strong className="font-semibold text-red-600 block mb-0.5">Authentication Notice</strong>
              <p>{errorMsg}</p>
            </div>
          </div>
        ) : ssoPending ? (
          <div className="flex gap-3 text-left bg-accent-bg border border-accent-border text-text-heading p-4 rounded-2xl text-xs leading-normal mb-6">
            <div>
              <strong className="font-semibold text-accent block mb-0.5">SSO Authentication Active</strong>
              <p>Please complete the login verification in the opened SSO window.</p>
            </div>
          </div>
        ) : null}

        {ssoPending && (
          <div className="w-8 h-8 border-3 border-border-main border-t-accent rounded-full animate-spin mx-auto mb-6"></div>
        )}

        <button
          onClick={onLogin}
          disabled={ssoPending}
          className="flex items-center justify-center w-full py-3.5 px-6 rounded-2xl bg-accent text-white font-semibold shadow-md shadow-accent/20 hover:shadow-lg hover:shadow-accent/30 hover:-translate-y-0.5 active:translate-y-0 disabled:bg-border-main disabled:text-text-main disabled:shadow-none disabled:transform-none cursor-pointer transition-all"
        >
          {ssoPending ? "Awaiting SSO Verification..." : "Continue with Yukthi SSO"}
        </button>

        {isLogoutParam && <p className="text-xs text-text-main mt-6">You have been logged out successfully.</p>}
      </div>
    </div>
  );
}
