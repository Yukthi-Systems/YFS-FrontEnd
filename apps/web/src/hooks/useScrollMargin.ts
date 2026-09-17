import { useLayoutEffect, useRef, useState } from "react";

export function useScrollMargin<T extends HTMLElement>(scrollElement: HTMLElement | null) {
  const ref = useRef<T | null>(null);
  const [margin, setMargin] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (!el || !scrollElement) return;
      const calculated = Math.round(
        el.getBoundingClientRect().top - scrollElement.getBoundingClientRect().top + scrollElement.scrollTop
      );
      setMargin((prev) => (Math.abs(prev - calculated) > 1 ? calculated : prev));
    };

    measure();

    if (!scrollElement) return;

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(scrollElement);
    if (ref.current) ro?.observe(ref.current);

    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [scrollElement]);

  return { ref, margin };
}
