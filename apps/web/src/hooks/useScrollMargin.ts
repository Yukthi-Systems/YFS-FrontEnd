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
