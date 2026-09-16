import { useLayoutEffect, useRef, useState } from "react";

export function useScrollMargin<T extends HTMLElement>(scrollElement: HTMLElement | null) {
  const ref = useRef<T | null>(null);
  const [margin, setMargin] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (!el || !scrollElement) return;
      setMargin(el.getBoundingClientRect().top - scrollElement.getBoundingClientRect().top + scrollElement.scrollTop);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });

  return { ref, margin };
}
