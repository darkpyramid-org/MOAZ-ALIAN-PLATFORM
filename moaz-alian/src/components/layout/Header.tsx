import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowUpLeft, BookOpen, ChevronLeft, Menu, Search, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useStaff } from "@/hooks/use-staff";
import { authClient } from "@/lib/auth";

import { SearchOverlay } from "@/components/search/SearchOverlay";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { trapFocus, useDismiss, usePresence, useScrollLock } from "@/hooks/use-overlay";

const NAV = [
  { to: "/", label: "الرئيسية" },
  { to: "/videos", label: "الفيديوهات" },
  { to: "/books", label: "الكتب" },
  { to: "/articles", label: "المقالات" },
  { to: "/research", label: "الأبحاث" },
] as const;

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const home = pathname === "/";
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const staff = useStaff();
  const user = staff.data?.user ?? null;
  const {
    mounted: drawerMounted,
    visible: drawerVisible,
    state: drawerState,
  } = usePresence(menuOpen, 360);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useScrollLock(menuOpen);
  useDismiss(menuOpen, closeMenu);

  useEffect(() => {
    if (drawerVisible) closeRef.current?.focus();
  }, [drawerVisible]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the drawer on navigation
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!accountOpen) return;
    const handler = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [accountOpen]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1280px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");

  return (
    <header
      className={`site-header fixed inset-x-0 top-4 z-40 mx-auto ${home ? "site-header-home" : ""}`}
      data-scrolled={scrolled}
    >
      <div className="site-header-inner flex items-center justify-between gap-3">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="الصفحة الرئيسية">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <BookOpen className="size-4" aria-hidden />
          </span>
          <span className="text-lg font-bold md:text-xl">
            معاذ <span className="text-primary">عليان</span>
          </span>
        </Link>

        <nav
          aria-label="التنقل الرئيسي"
          className="site-nav hidden items-center gap-0.5 rounded-full border border-border px-2 py-1.5 backdrop-blur-xl xl:flex"
        >
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-current={isActive(item.to) ? "page" : undefined}
              className={`relative whitespace-nowrap rounded-full px-3 py-2 text-xs transition-all duration-200 ${
                isActive(item.to)
                  ? "bg-accent font-semibold text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-2">
          <div className="hidden xl:block">
            <ThemeToggle />
          </div>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="فتح البحث"
            title="فتح البحث"
            className="site-header-tool hidden rounded-full border border-border xl:inline-flex"
          >
            <Search className="size-5" aria-hidden />
          </Button>
          <Button asChild className="hidden px-4 xl:inline-flex">
            <Link to="/categories">
              استكشف{" "}
              <span className="grid size-5 place-items-center rounded-full bg-primary-foreground/15">
                <ArrowUpLeft className="size-3" aria-hidden />
              </span>
            </Link>
          </Button>
          {/* Account avatar / login */}
          <div className="relative" ref={accountRef}>
            <button
              type="button"
              onClick={() => setAccountOpen((o) => !o)}
              aria-label={user ? "حسابي" : "تسجيل الدخول"}
              aria-expanded={accountOpen}
              className="grid size-9 place-items-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {user ? (
                <Avatar className="size-9">
                  <AvatarImage
                    src={user.avatarUrl ?? undefined}
                    alt={user.displayName ?? user.email}
                  />
                  <AvatarFallback className="text-xs">
                    {(user.displayName || user.email).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <User className="size-4" aria-hidden />
              )}
            </button>
            {accountOpen && (
              <div className="absolute end-0 top-11 z-50 w-56 rounded-2xl border border-border bg-surface p-2 shadow-float">
                {user ? (
                  <>
                    <div className="px-3 py-2 text-sm">
                      <p className="font-semibold">{user.displayName || user.email}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="my-1 h-px bg-border" />
                    <Link
                      to="/dashboard/profile"
                      onClick={() => setAccountOpen(false)}
                      className="block rounded-xl px-3 py-2 text-sm hover:bg-accent"
                    >
                      الملف الشخصي
                    </Link>
                    {user.canEditContent && (
                      <Link
                        to="/dashboard"
                        onClick={() => setAccountOpen(false)}
                        className="block rounded-xl px-3 py-2 text-sm hover:bg-accent"
                      >
                        لوحة التحكم
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        authClient.logout();
                        setAccountOpen(false);
                      }}
                      className="block w-full rounded-xl px-3 py-2 text-start text-sm text-destructive hover:bg-accent"
                    >
                      تسجيل الخروج
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/auth"
                      onClick={() => setAccountOpen(false)}
                      className="block rounded-xl px-3 py-2 text-sm hover:bg-accent"
                    >
                      تسجيل الدخول
                    </Link>
                    <Link
                      to="/auth"
                      onClick={() => setAccountOpen(false)}
                      className="block rounded-xl px-3 py-2 text-sm hover:bg-accent"
                    >
                      إنشاء حساب
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            type="button"
            ref={triggerRef}
            onClick={() => setMenuOpen(true)}
            aria-label="فتح قائمة التنقل"
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            title="فتح قائمة التنقل"
            className="site-header-tool rounded-full border border-border xl:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </Button>
        </div>
      </div>

      {drawerMounted &&
        createPortal(
          <div
            className="fixed inset-0 z-50 xl:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="قائمة التنقل"
            onKeyDown={trapFocus(panelRef)}
          >
            <div
              data-state={drawerState}
              className="drawer-backdrop absolute inset-0 bg-overlay/50"
              onClick={() => setMenuOpen(false)}
            />
            <div
              ref={panelRef}
              data-state={drawerState}
              className="reference-menu absolute inset-x-4 top-24 mx-auto flex max-h-[calc(100svh-7rem)] max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background/95 shadow-float backdrop-blur-xl"
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <span className="flex items-baseline gap-2">
                  <span className="text-lg font-bold">معاذ عليان</span>
                  <span className="text-xs text-muted-foreground">فضاء معرفي</span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  ref={closeRef}
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="إغلاق القائمة"
                  className="grid size-10 place-items-center rounded-full border border-border text-muted-foreground transition-all hover:rotate-90 hover:border-primary hover:text-primary"
                >
                  <X className="size-5" aria-hidden />
                </Button>
              </div>
              <nav
                aria-label="تنقل الجوال"
                className="flex flex-1 flex-col gap-1 overflow-y-auto p-3"
              >
                {NAV.map((item, i) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    style={{ "--i": i } as CSSProperties}
                    aria-current={isActive(item.to) ? "page" : undefined}
                    className={`flex items-center justify-between rounded-xl px-4 py-3 text-base active:scale-[0.98] ${
                      isActive(item.to)
                        ? "bg-primary/12 font-semibold text-primary"
                        : "text-foreground hover:bg-accent"
                    }`}
                  >
                    {item.label}
                    <ChevronLeft
                      className={`size-4 ${isActive(item.to) ? "text-primary" : "text-muted-foreground"}`}
                      aria-hidden
                    />
                  </Link>
                ))}
              </nav>
              <div className="flex items-center gap-3 border-t border-border p-3">
                <ThemeToggle />
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setSearchOpen(true);
                  }}
                  className="flex h-11 flex-1 items-center gap-3 rounded-full border border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  style={{ "--i": NAV.length } as CSSProperties}
                >
                  <Search className="size-4" aria-hidden />
                  ابحث في المكتبة…
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
