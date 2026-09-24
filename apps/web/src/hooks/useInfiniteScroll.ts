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

import { useEffect, useRef } from "react";

interface InfiniteScrollOptions {
  // Whether there is another page to fetch. The observer disconnects when false.
  hasMore: boolean;
  // Whether a page is already in flight — suppresses further triggers.
  loading: boolean;
  // Scroll container the sentinel lives in. Falls back to the viewport when null.
  root?: HTMLElement | null;
  // How early to fire, in px before the sentinel actually enters view.
  rootMargin?: string;
}

// Ref for a sentinel at the end of a list; calls the latest `onLoadMore` when it scrolls into view.
export function useInfiniteScroll(
  onLoadMore: () => void,
  { hasMore, loading, root, rootMargin = "300px" }: InfiniteScrollOptions
) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMoreRef.current();
      },
      { root: root ?? null, rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, root, rootMargin]);

  return sentinelRef;
}
