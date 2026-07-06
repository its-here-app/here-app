"use client";

import { useEffect, useState } from "react";

/** Drives mount-on-open / delayed-unmount-on-close timing for a slide or fade transition. */
export function useSlideTransition(isOpen: boolean, duration = 300) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsAnimating(false);
      let raf2: number;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setIsAnimating(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    } else {
      setIsAnimating(false);
      const t = setTimeout(() => setIsVisible(false), duration);
      return () => clearTimeout(t);
    }
  }, [isOpen, duration]);

  return { isVisible, isAnimating };
}
