import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

/**
 * Layout-matched loading skeletons.
 *
 * Rules that keep them cheap and hydration-safe:
 * - CSS-only pulse animation (no timers, no JS state).
 * - Deterministic widths (no Math.random in render, so SSR and client agree).
 * - Same aspect ratios and paddings as the real components, so nothing shifts
 *   when real content swaps in.
 */

/** Fixed width pattern cycled per row; looks organic but is fully deterministic. */
const ROW_WIDTHS = ["w-full", "w-[92%]", "w-[85%]", "w-[70%]", "w-[96%]", "w-[55%]"];

function Lines({ rows, className = "space-y-2.5" }: { rows: number; className?: string }) {
  return (
    <div className={className} aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={`h-3 ${ROW_WIDTHS[i % ROW_WIDTHS.length]}`} />
      ))}
    </div>
  );
}

/** Screen-reader announcement wrapper for every skeleton screen. */
function Busy({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/* ---------- Public content cards ---------- */

export function MediaCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface" aria-hidden>
      <Skeleton className="aspect-video w-full grow rounded-none border-b border-border" />
      <div className="flex flex-col p-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-2 h-5 w-3/4" />
        <Skeleton className="mt-1.5 h-3 w-full" />
        <Skeleton className="mt-1.5 h-3 w-2/3" />
        <div className="mt-auto flex items-center gap-3 pt-3">
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}

export function BookCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface" aria-hidden>
      <Skeleton className="aspect-[2/3] w-full grow rounded-none border-b border-border" />
      <div className="flex flex-col p-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-2 h-5 w-2/3" />
        <div className="mt-auto flex items-center justify-between pt-3">
          <Skeleton className="h-4 w-14 rounded-full" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
    </div>
  );
}

export function ExploreCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-5" aria-hidden>
      <div className="flex items-start justify-between">
        <Skeleton className="size-6 rounded-md" />
        <Skeleton className="h-3 w-6" />
      </div>
      <Skeleton className="mt-6 h-4 w-2/3" />
      <Skeleton className="mt-2 h-3 w-full" />
      <Skeleton className="mt-4 h-3 w-16" />
    </div>
  );
}

export function CardGridSkeleton({
  count = 9,
  variant = "media",
  grid = "grid gap-6 sm:grid-cols-2 lg:grid-cols-3",
}: {
  count?: number;
  variant?: "media" | "book" | "explore";
  grid?: string;
}) {
  return (
    <div className={grid} aria-hidden>
      {Array.from({ length: count }, (_, i) =>
        variant === "book" ? <BookCardSkeleton key={i} /> : variant === "explore" ? <ExploreCardSkeleton key={i} /> : <MediaCardSkeleton key={i} />,
      )}
    </div>
  );
}

/* ---------- Page-level public skeletons ---------- */

export function PageHeroSkeleton() {
  return (
    <section className="hero-band">
      <div className="container-editorial py-10 md:py-14">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-10 w-64 md:h-12 md:w-80" />
        <Skeleton className="mt-5 h-0.5 w-40 rounded-full" />
        <Skeleton className="mt-5 h-3 w-full max-w-2xl" />
        <Skeleton className="mt-2 h-3 w-2/3 max-w-xl" />
      </div>
    </section>
  );
}

/** Listing pages (/videos, /books, /articles, /research, /categories). */
export function ListingSkeleton({ grid = "md:grid-cols-3", variant = "media" }: { grid?: string; variant?: "media" | "book" }) {
  return (
    <Busy label="جارٍ التحميل…">
      <PageHeroSkeleton />
      <div className="container-editorial section-y-sm">
        <div className="mb-6 flex flex-wrap items-center gap-2" aria-hidden>
          <Skeleton className="h-9 w-36 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 flex-1 min-w-40 rounded-xl" />
        </div>
        <CardGridSkeleton count={9} variant={variant} grid={`grid gap-5 sm:grid-cols-2 ${grid}`} />
      </div>
    </Busy>
  );
}

/** Home page: hero band, featured row, explore grid, books shelf. */
export function HomeSkeleton() {
  return (
    <Busy label="جارٍ التحميل…">
      <section className="home-hero hero-band relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 bg-surface" />
        <div className="home-hero-content container-editorial relative flex items-end">
          <div className="w-full max-w-2xl">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-4 h-12 w-full max-w-xl md:h-14" />
            <Skeleton className="mt-3 h-12 w-3/4 max-w-lg md:h-14" />
            <Skeleton className="mt-6 h-3 w-full max-w-xl" />
            <Skeleton className="mt-2 h-3 w-2/3 max-w-md" />
            <Skeleton className="mt-8 h-14 w-full max-w-xl rounded-xl" />
            <div className="mt-6 flex gap-3" aria-hidden>
              <Skeleton className="h-11 w-36 rounded-full" />
              <Skeleton className="h-11 w-32 rounded-full" />
            </div>
          </div>
        </div>
      </section>
      <div className="container-editorial section-y">
        <Skeleton className="h-4 w-32" aria-hidden />
        <div className="mt-6">
          <CardGridSkeleton count={4} grid="grid gap-6 md:grid-cols-2 lg:grid-cols-4" />
        </div>
        <Skeleton className="mt-14 h-4 w-36" aria-hidden />
        <div className="mt-6">
          <CardGridSkeleton count={8} variant="explore" grid="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" />
        </div>
        <Skeleton className="mt-14 h-4 w-28" aria-hidden />
        <div className="mt-6">
          <CardGridSkeleton count={5} variant="book" grid="grid gap-5 sm:grid-cols-3 lg:grid-cols-5" />
        </div>
      </div>
    </Busy>
  );
}

/** Detail pages (/videos/$slug, /books/$slug, /articles/$slug, /research/$slug, /categories/$id). */
export function DetailSkeleton() {
  return (
    <Busy label="جارٍ التحميل…">
      <div className="container-editorial section-y">
        <Skeleton className="h-3 w-44" aria-hidden />
        <Skeleton className="mt-4 h-10 w-2/3 md:h-12" aria-hidden />
        <div className="mt-4 flex gap-2" aria-hidden>
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="mt-8 aspect-video w-full rounded-2xl" aria-hidden />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-4 w-2/3" />
            </div>
          ))}
        </div>
        <div className="mt-8 max-w-3xl" aria-hidden>
          <Lines rows={7} />
        </div>
      </div>
      <div className="container-editorial pb-16">
        <Skeleton className="h-4 w-32" aria-hidden />
        <div className="mt-6">
          <CardGridSkeleton count={3} />
        </div>
      </div>
    </Busy>
  );
}

/** Text-first pages (/about). */
export function ContentPageSkeleton() {
  return (
    <Busy label="جارٍ التحميل…">
      <div className="container-editorial section-y max-w-3xl">
        <Skeleton className="h-10 w-2/3 md:h-12" aria-hidden />
        <Skeleton className="mt-5 h-0.5 w-40 rounded-full" aria-hidden />
        <div className="mt-8" aria-hidden>
          <Lines rows={8} />
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2" aria-hidden>
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-5">
              <Skeleton className="h-4 w-1/2" />
              <div className="mt-3">
                <Lines rows={3} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Busy>
  );
}

/* ---------- Dashboard skeletons ---------- */

/** Row list matching dashboard content/users lists. */
export function RowsSkeleton({ rows = 8, chips = 2 }: { rows?: number; chips?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface" role="status" aria-busy="true">
      <span className="sr-only">جارٍ التحميل…</span>
      <ul className="divide-y divide-border" aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex items-center gap-4 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-1/2 max-w-64" />
              <Skeleton className="mt-1.5 h-3 w-1/3 max-w-48" />
            </div>
            <div className="flex shrink-0 gap-1.5">
              {Array.from({ length: chips }, (_, j) => (
                <Skeleton key={j} className="h-7 w-16 rounded-lg" />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Table body rows matching the debates table (render inside <TableBody>).
 * Must not wrap rows in a <div> — invalid HTML inside <tbody> and causes hydration warnings.
 */
export function TableRowsSkeleton({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <TableRow
          key={r}
          className="align-top"
          {...(r === 0 ? { role: "status" as const, "aria-busy": true as const } : {})}
        >
          {Array.from({ length: columns }, (_, c) => (
            <TableCell key={c}>
              <div className="space-y-1.5" aria-hidden>
                {r === 0 && c === 0 && <span className="sr-only">جارٍ التحميل…</span>}
                <Skeleton className={`h-3.5 ${ROW_WIDTHS[(r + c) % ROW_WIDTHS.length]}`} />
                {c === 0 && <Skeleton className="h-3 w-1/2" />}
              </div>
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/** Settings form placeholder matching the pages editor. */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <span className="sr-only">جارٍ التحميل…</span>
      <div aria-hidden>
        <Skeleton className="h-8 w-56" />
      </div>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-2" aria-hidden>
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-10 w-full rounded-lg" />
          {i % 2 === 0 && <Skeleton className="h-10 w-2/3 rounded-lg" />}
        </div>
      ))}
      <div className="flex gap-2" aria-hidden>
        <Skeleton className="h-10 w-28 rounded-full" />
        <Skeleton className="h-10 w-24 rounded-full" />
      </div>
    </div>
  );
}

/** Full dashboard shell: sidebar, header, page heading and list. */
export function DashboardShellSkeleton() {
  return (
    <div className="flex min-h-screen w-full bg-background" role="status" aria-busy="true">
      <span className="sr-only">جارٍ التحميل…</span>
      <div className="hidden w-60 shrink-0 border-e border-border bg-sidebar p-3 md:block" aria-hidden>
        <Skeleton className="h-9 w-full rounded-lg" />
        <div className="mt-4 space-y-1.5">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className={`h-8 ${i % 3 === 0 ? "w-4/5" : "w-full"} rounded-lg`} />
          ))}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex h-14 items-center gap-3 border-b border-border px-3 sm:px-5" aria-hidden>
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="ms-auto h-6 w-16 rounded-full" />
        </div>
        <div className="mx-auto w-full max-w-6xl p-3 sm:p-6" aria-hidden>
          <Skeleton className="h-8 w-52" />
          <Skeleton className="mt-2 h-3 w-72" />
          <div className="mt-6">
            <RowsSkeleton rows={6} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Neutral route-level pending fallback (router default). */
export function RoutePendingSkeleton() {
  return (
    <Busy label="جارٍ التحميل…">
      <div className="container-editorial section-y">
        <Skeleton className="h-10 w-64 md:h-12" aria-hidden />
        <div className="mt-8">
          <CardGridSkeleton count={6} />
        </div>
      </div>
    </Busy>
  );
}
