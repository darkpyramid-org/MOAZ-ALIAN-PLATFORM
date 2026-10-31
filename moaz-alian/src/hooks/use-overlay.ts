import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";

/** Keeps an overlay mounted during its exit animation; `visible` flips a frame after mount so CSS transitions run. */
export function usePresence(open: boolean, exitMs = 340) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setVisible(false);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => setMounted(false), reduce ? 0 : exitMs);
    return () => window.clearTimeout(t);
  }, [open, exitMs]);

  return { mounted, visible, state: visible ? ("open" as const) : ("closed" as const) };
}

let lockCount = 0;
/** Ref-counted body scroll lock so stacked overlays don't unlock each other. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (lockCount++ === 0) {
      // html has scrollbar-gutter: stable, so the gutter is kept and no padding compensation is needed.
      document.documentElement.style.overflow = "hidden";
    }
    return () => {
      if (--lockCount === 0) {
        document.documentElement.style.overflow = "";
      }
    };
  }, [active]);
}

/** Escape to close + remembers and restores the previously focused element. */
export function useDismiss(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      // Only restore if focus is lost (another overlay may have taken it).
      requestAnimationFrame(() => {
        if (!document.activeElement || document.activeElement === document.body) previous?.focus?.();
      });
    };
  }, [open]);
}

/** onKeyDown handler that keeps Tab focus inside the container. */
export function trapFocus(ref: RefObject<HTMLElement | null>) {
  return (e: ReactKeyboardEvent) => {
    if (e.key !== "Tab" || !ref.current) return;
    const f = ref.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!f.length) return;
    const first = f[0]!;
    const last = f[f.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
}
