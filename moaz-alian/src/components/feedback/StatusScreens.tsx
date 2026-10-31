import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useRouter, useRouterState, type ErrorComponentProps } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Compass, Home, RefreshCw, Search, SearchX, WifiOff } from "lucide-react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

const QUICK_LINKS = [
  { to: "/videos", label: "الفيديوهات" },
  { to: "/books", label: "الكتب" },
  { to: "/articles", label: "المقالات" },
  { to: "/research", label: "الأبحاث" },
  { to: "/categories", label: "التصنيفات" },
] as const;

function Stage({ children, full, danger }: { children: ReactNode; full?: boolean | undefined; danger?: boolean | undefined }) {
  return (
    <section className={`status-stage ${full ? "status-stage-full" : ""}`}>
      <div className="status-grid" aria-hidden />
      <div className={`status-orb ${danger ? "status-orb-danger" : ""} size-72 -top-10 start-[8%]`} aria-hidden />
      <div className="status-orb size-80 bottom-0 end-[6%] [animation-delay:-4s]" aria-hidden />
      <div className="relative w-full max-w-2xl text-center">{children}</div>
    </section>
  );
}

function SearchBox() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) void navigate({ to: "/search", search: { q: q.trim() } });
  };
  return (
    <form onSubmit={submit} role="search" className="animate-rise-2 mx-auto mt-8 flex max-w-md items-center gap-2 rounded-full border border-border bg-surface p-1.5 ps-4 shadow-card focus-within:border-primary">
      <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ابحث في المكتبة…"
        aria-label="ابحث في المكتبة"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      <button type="submit" className="btn-gold rounded-full px-4 py-2 text-sm">بحث</button>
    </form>
  );
}

/** Site-wide 404 for unknown addresses. */
export function NotFoundScreen({ full }: { full?: boolean }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <Stage full={full}>
      <div className="status-ring" aria-hidden />
      <p className="animate-rise text-sm font-semibold text-primary">الصفحة غير موجودة</p>
      <h1 className="status-code animate-rise-1 select-none" aria-label="خطأ ٤٠٤">
        <span className="status-digit">٤</span>
        <span className="status-digit">٠</span>
        <span className="status-digit">٤</span>
      </h1>
      <p className="animate-rise-1 mt-4 text-2xl font-bold">يبدو أنك ضللت الطريق بين الرفوف</p>
      <p className="animate-rise-2 mx-auto mt-3 max-w-md leading-8 text-muted-foreground">
        العنوان <span dir="ltr" className="rounded bg-surface px-2 py-0.5 font-mono text-xs text-foreground">{decodeURIComponentSafe(path)}</span> غير موجود، ربما نُقل أو حُذف أو كُتب بشكل خاطئ.
      </p>
      <SearchBox />
      <div className="animate-rise-3 mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn-gold"><Home className="size-4" aria-hidden />الرئيسية</Link>
        <button type="button" onClick={() => history.back()} className="btn-outline"><ArrowRight className="size-4" aria-hidden />الصفحة السابقة</button>
      </div>
      <nav aria-label="أقسام المكتبة" className="animate-rise-3 mt-8 flex flex-wrap justify-center gap-2">
        {QUICK_LINKS.map((l) => <Link key={l.to} to={l.to} className="status-chip">{l.label}</Link>)}
      </nav>
    </Stage>
  );
}

/** 404 for a specific missing record (video, book…), with a way back to its section. */
export function MissingItemScreen({ label, listTo, listLabel }: { label: string; listTo: string; listLabel: string }) {
  return (
    <Stage>
      <div className="status-icon animate-rise mx-auto"><SearchX className="size-8" aria-hidden /></div>
      <h1 className="animate-rise-1 mt-6 text-3xl font-bold">{label} غير موجود</h1>
      <p className="animate-rise-2 mx-auto mt-3 max-w-md leading-8 text-muted-foreground">
        ربما تغيّر الرابط أو أُزيلت هذه المادة من المكتبة. جرّب البحث أو تصفّح {listLabel}.
      </p>
      <SearchBox />
      <div className="animate-rise-3 mt-8 flex flex-wrap justify-center gap-3">
        <a href={listTo} className="btn-gold"><Compass className="size-4" aria-hidden />تصفّح {listLabel}</a>
        <Link to="/" className="btn-outline"><Home className="size-4" aria-hidden />الرئيسية</Link>
      </div>
    </Stage>
  );
}

function decodeURIComponentSafe(s: string) {
  try { return decodeURIComponent(s); } catch { return s; }
}

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return online;
}

function isNetworkError(error: unknown) {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed|timeout/i.test(msg);
}

/** Error boundary screen: friendly message, retry that re-runs loaders, offline awareness, reference code. */
export function ErrorScreen({ error, reset, full, boundary = "route_error" }: ErrorComponentProps & { full?: boolean; boundary?: string }) {
  const router = useRouter();
  const online = useOnline();
  const [retrying, setRetrying] = useState(false);
  const code = useMemo(() => Math.random().toString(36).slice(2, 8).toUpperCase(), []);
  const network = !online || isNetworkError(error);

  useEffect(() => {
    console.error(error);
    reportLovableError(error, { boundary, ref: code });
  }, [error, boundary, code]);

  const retry = async () => {
    setRetrying(true);
    try {
      await router.invalidate();
      reset();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Stage full={full} danger>
      <div className={`status-icon status-icon-danger status-shake mx-auto`}>
        {network ? <WifiOff className="size-8" aria-hidden /> : <AlertTriangle className="size-8" aria-hidden />}
      </div>
      <h1 className="animate-rise-1 mt-6 text-3xl font-bold">
        {network ? "تعذّر الاتصال" : "حدث خطأ غير متوقع"}
      </h1>
      <p className="animate-rise-2 mx-auto mt-3 max-w-md leading-8 text-muted-foreground" role="alert">
        {network
          ? online
            ? "لم نتمكن من الوصول إلى الخادم. تحقّق من اتصالك ثم أعد المحاولة."
            : "أنت غير متصل بالإنترنت حاليًا. سنكون جاهزين بمجرد عودة الاتصال."
          : "واجهت هذه الصفحة مشكلة أثناء التحميل. أبلغنا الفريق تلقائيًا، ويمكنك المحاولة مرة أخرى."}
      </p>
      <div className="animate-rise-3 mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={retry} disabled={retrying} className="btn-gold disabled:opacity-70">
          <RefreshCw className={`size-4 ${retrying ? "animate-spin" : ""}`} aria-hidden />
          {retrying ? "جارٍ إعادة المحاولة…" : "إعادة المحاولة"}
        </button>
        <a href="/" className="btn-outline"><Home className="size-4" aria-hidden />الرئيسية</a>
      </div>
      <p className="animate-rise-3 mt-6 text-xs text-muted-foreground">
        رمز المرجع: <span dir="ltr" className="font-mono">{code}</span>
      </p>
      {import.meta.env.DEV && error instanceof Error && (
        <details className="mx-auto mt-4 max-w-xl text-start text-xs">
          <summary className="cursor-pointer text-muted-foreground">تفاصيل تقنية</summary>
          <pre dir="ltr" className="mt-2 max-h-56 overflow-auto rounded-xl border border-border bg-surface p-3">{error.stack ?? error.message}</pre>
        </details>
      )}
    </Stage>
  );
}

/** Small banner shown while the visitor is offline. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="animate-rise fixed inset-x-0 bottom-4 z-50 mx-auto flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm shadow-card">
      <WifiOff className="size-4 text-destructive" aria-hidden />
      أنت غير متصل بالإنترنت — قد لا تتحدّث بعض المحتويات.
    </div>
  );
}
