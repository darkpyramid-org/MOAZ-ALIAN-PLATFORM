import { useEffect, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export type Theme = "dark" | "light";
export const THEME_KEY = "theme";

/** Runs before paint (inlined in <head>) so the saved theme never flashes. */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(!t){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}if(t==="light"){document.documentElement.classList.add("light");var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","#f7f4ed")}}catch(e){}})();`;

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("light", theme === "light");
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "light" ? "#f7f4ed" : "#101820");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage unavailable */
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("light") ? "light" : "dark");
  }, []);

  const toggle = (e: MouseEvent<HTMLButtonElement>) => {
    const next: Theme = theme === "light" ? "dark" : "light";
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const commit = () => {
      flushSync(() => setTheme(next));
      applyTheme(next);
    };

    if (reduce) return commit();

    if (typeof document.startViewTransition === "function") {
      const x = e.clientX || window.innerWidth / 2;
      const y = e.clientY || 0;
      const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      root.style.setProperty("--theme-x", `${x}px`);
      root.style.setProperty("--theme-y", `${y}px`);
      root.style.setProperty("--theme-r", `${r}px`);
      document.startViewTransition(commit);
      return;
    }

    root.classList.add("theme-animating");
    commit();
    window.setTimeout(() => root.classList.remove("theme-animating"), 450);
  };

  const isLight = theme === "light";
  return (
    <Button
      variant="ghost"
      size="icon"
      type="button"
      onClick={toggle}
      aria-label={isLight ? "التبديل إلى الوضع الداكن" : "التبديل إلى الوضع الفاتح"}
      title={isLight ? "الوضع الداكن" : "الوضع الفاتح"}
      className="site-header-tool relative overflow-hidden rounded-full border border-border"
    >
      <Sun
        aria-hidden
        className={`absolute size-5 transition-all duration-500 ${isLight ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`}
      />
      <Moon
        aria-hidden
        className={`absolute size-5 transition-all duration-500 ${isLight ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`}
      />
    </Button>
  );
}
