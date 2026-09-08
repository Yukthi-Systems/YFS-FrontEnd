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

// Returns a ref to attach to a sentinel element rendered at the end of a list.
// When that sentinel scrolls into view (and there's more to load), `onLoadMore`
// fires. The latest `onLoadMore` is always used, so callers needn't memoise it.
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
