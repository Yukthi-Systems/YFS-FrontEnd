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

import { HttpError } from "@yfs/service";

// Runs `fn` with the token, refreshing once and retrying on 401/400.
export async function withAuthRetry<T>(
  token: string | null | undefined,
  refresh: () => Promise<string | null>,
  fn: (token: string) => Promise<T>
): Promise<T> {
  try {
    return await fn(token ?? "");
  } catch (err) {
    if (!(err instanceof HttpError) || (err.status !== 401 && err.status !== 400)) throw err;
    const fresh = await refresh();
    if (!fresh) throw err;
    return fn(fresh);
  }
}
