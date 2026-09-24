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

import { QueryClient } from '@tanstack/react-query'
import { HttpError } from '@yfs/service'

const MAX_API_RETRIES = 3;

// Retry only network errors and 5xx; a 4xx won't succeed on retry.
const shouldRetry = (failureCount: number, error: unknown): boolean => {
  if (failureCount >= MAX_API_RETRIES) return false;
  if (error instanceof HttpError && error.status >= 400 && error.status < 500) return false;
  return true;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: shouldRetry },
    mutations: { retry: shouldRetry },
  },
})
