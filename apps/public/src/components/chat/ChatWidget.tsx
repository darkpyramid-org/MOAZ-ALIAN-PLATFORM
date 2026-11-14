import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { History, MessageCircleQuestion, Plus, Sparkles, X, X as CloseIcon } from "lucide-react";

import { ChatPanel, LibraryMark } from "@/components/chat/ChatPanel";
import { FaqList } from "@/components/chat/FaqList";
import { WhatsAppIcon, WhatsAppPanel } from "@/components/chat/WhatsAppPanel";
import { useChatSession, useChatThreads, useThreadMessages } from "@/hooks/use-chat-threads";
import { usePresence } from "@/hooks/use-overlay";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Shimmer } from "@/components/ai-elements/shimmer";

const TABS = [
  { id: "assistant", label: "المساعد", icon: Sparkles },
  { id: "faq", label: "الأسئلة الشائعة", icon: MessageCircleQuestion },
  { id: "whatsapp", label: "واتساب", icon: WhatsAppIcon },
] as const;

type ChatTab = (typeof TABS)[number]["id"];

export function ChatWidget() {
  const router = useRouter();
  const search = useRouterState({ select: (s) => s.location.search }) as { chat?: string };
  const activeThread = typeof search.chat === "string" ? search.chat : undefined;

  const [open, setOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState<ChatTab>("assistant");
  const [everOpened, setEverOpened] = useState(false);
  const { mounted, visible } = usePresence(open, 300);
  // No page scroll lock: the panel is a side floating window, so the page
  // behind it stays scrollable; the panel body contains its own overscroll.

  const { loading: sessionLoading, signedIn } = useChatSession();
  const threads = useChatThreads(open && signedIn);
  const threadMessages = useThreadMessages(
    activeThread ?? null,
    open && signedIn && !!activeThread,
  );

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setEverOpened(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (drawerOpen) setDrawerOpen(false);
        else setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, drawerOpen]);

  const setChatParam = (id: string | undefined) => {
    // Route the active thread through the router history so reload restores it.
    const href = `${router.state.location.pathname}${id ? `?chat=${encodeURIComponent(id)}` : ""}`;
    router.history.replace(href);
  };

  const startNewChat = async () => {
    try {
      const thread = await threads.createThread();
      setChatParam(thread.id);
      setDrawerOpen(false);
    } catch (error) {
      console.error(error);
    }
  };

  const selectThread = (id: string) => {
    setChatParam(id);
    setDrawerOpen(false);
  };

  const removeThread = async (id: string) => {
    try {
      await threads.deleteThread(id);
      if (activeThread === id) setChatParam(undefined);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "إغلاق المساعد" : "افتح مساعد المكتبة"}
        className="chat-fab group fixed bottom-5 end-5 z-50 inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-gold transition-transform duration-300 hover:scale-105 active:scale-95"
      >
        {!everOpened && !open ? <span className="chat-fab-ring" aria-hidden="true" /> : null}
        <span
          className={cn(
            "absolute inset-0 grid place-items-center transition-all duration-300",
            open ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100",
          )}
        >
          <svg
            viewBox="0 0 24 24"
            className="size-6 fill-none stroke-current stroke-2"
            aria-hidden="true"
          >
            <path
              d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-2.9-.36-4.1-1L3 20l1.1-4.3A8.5 8.5 0 1 1 21 11.5Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M9 11h6M9 14h4" strokeLinecap="round" />
          </svg>
        </span>
        <span
          className={cn(
            "absolute inset-0 grid place-items-center transition-all duration-300",
            open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0",
          )}
        >
          <CloseIcon className="size-6" aria-hidden="true" />
        </span>
      </button>

      {mounted && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="مساعد المكتبة"
              className={cn(
                "fixed bottom-24 end-5 z-50 flex h-[min(64vh,560px)] w-[min(92vw,384px)] flex-col overflow-hidden rounded-3xl border border-border bg-popover text-popover-foreground shadow-float",
                visible ? "chat-panel-in" : "chat-panel-out",
              )}
            >
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-border bg-deep/60 px-4 py-3">
                <LibraryMark className="size-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">مساعد المكتبة</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    يرشدك في أقسام الموقع ومواده
                  </p>
                </div>
                {signedIn && tab === "assistant" ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="المحادثات السابقة"
                      onClick={() => setDrawerOpen((v) => !v)}
                    >
                      <History className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="محادثة جديدة"
                      onClick={startNewChat}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="إغلاق"
                  onClick={() => setOpen(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>

              {/* Tabs */}
              <div
                role="tablist"
                aria-label="أقسام نافذة المساعد"
                className="flex gap-1 border-b border-border bg-deep/40 px-3 py-2"
              >
                {TABS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={tab === id}
                    onClick={() => setTab(id)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-[11px] font-medium transition-colors duration-200",
                      tab === id
                        ? "bg-primary text-primary-foreground shadow-gold"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Body */}
              {tab === "assistant" ? (
                <>
                  {!sessionLoading && !signedIn ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                      <LibraryMark className="size-12" />
                      <p className="text-sm text-muted-foreground">
                        سجّل الدخول لبدء محادثة مع مساعد المكتبة، وستُحفظ محادثاتك في حسابك.
                      </p>
                      <Button asChild>
                        <Link to="/auth">تسجيل الدخول</Link>
                      </Button>
                    </div>
                  ) : !activeThread ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                      <LibraryMark className="size-12" />
                      <p className="text-sm text-muted-foreground">
                        ابدأ محادثة جديدة مع مساعد المكتبة — تُحفظ محادثاتك في حسابك وتستطيع العودة
                        إليها.
                      </p>
                      <Button onClick={startNewChat} disabled={sessionLoading}>
                        <Plus className="size-4" />
                        محادثة جديدة
                      </Button>
                      {threads.data && threads.data.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setDrawerOpen(true)}
                          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                        >
                          عرض المحادثات السابقة
                        </button>
                      ) : null}
                    </div>
                  ) : threadMessages.isSuccess ? (
                    <ChatPanel
                      key={activeThread}
                      threadId={activeThread}
                      initialMessages={threadMessages.data}
                      autoFocus
                    />
                  ) : (
                    <div className="flex flex-1 items-center justify-center">
                      <Shimmer className="text-sm text-muted-foreground">
                        جارٍ استرجاع المحادثة…
                      </Shimmer>
                    </div>
                  )}
                </>
              ) : tab === "faq" ? (
                <FaqList />
              ) : (
                <WhatsAppPanel />
              )}

              {/* Threads drawer */}
              {drawerOpen && signedIn ? (
                <div className="absolute inset-0 z-10 flex flex-col bg-popover/95 backdrop-blur chat-drawer-in">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <p className="text-sm font-semibold">محادثاتك</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="رجوع"
                      onClick={() => setDrawerOpen(false)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto overscroll-contain p-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="mx-2 mb-2 w-[calc(100%-1rem)]"
                      onClick={startNewChat}
                    >
                      <Plus className="size-4" />
                      محادثة جديدة
                    </Button>
                    {threads.isLoading ? (
                      <p className="p-4 text-center text-xs text-muted-foreground">جارٍ التحميل…</p>
                    ) : (threads.data?.length ?? 0) === 0 ? (
                      <p className="p-4 text-center text-xs text-muted-foreground">
                        لا توجد محادثات بعد
                      </p>
                    ) : (
                      threads.data?.map((thread) => (
                        <div
                          key={thread.id}
                          className={cn(
                            "mb-1 flex items-center gap-1 rounded-xl px-1",
                            thread.id === activeThread ? "bg-accent" : "hover:bg-accent/60",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => selectThread(thread.id)}
                            className="min-w-0 flex-1 truncate px-3 py-2.5 text-start text-sm text-foreground"
                          >
                            {thread.title}
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`حذف ${thread.title}`}
                            onClick={() => removeThread(thread.id)}
                          >
                            <X className="size-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
