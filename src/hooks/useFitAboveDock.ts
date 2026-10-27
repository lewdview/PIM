import { useEffect, useState, type RefObject } from "react";

const GAP = 12;

/**
 * Height that lets a full-screen page end just above the phone dock (or the
 * viewport bottom when the dock is hidden), measured from the element's top
 * in document coordinates. Re-measures on resize and when the dock lifts.
 */
export function useFitAboveDock(ref: RefObject<HTMLElement | null>, enabled = true) {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const viewportH = window.visualViewport?.height ?? window.innerHeight;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const dock = document.querySelector<HTMLElement>(".pim-dock");
      const dockRect = dock && getComputedStyle(dock).display !== "none" ? dock.getBoundingClientRect() : null;
      const bottom = dockRect ? dockRect.top - GAP : viewportH;
      setHeight(Math.max(280, Math.floor(bottom - top)));
    };

    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    // The dock lift is a style property on <body>; the dock class toggles there too.
    const mo = new MutationObserver(measure);
    mo.observe(document.body, { attributes: true, attributeFilter: ["style", "class"] });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      mo.disconnect();
    };
  }, [ref, enabled]);

  return height;
}
