import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, FlaskConical, ShieldCheck } from "lucide-react";

import { TYPE_LABELS, type ContentType } from "@/types/content";

export function SectionHeading({
  kicker,
  title,
  href,
  linkLabel,
}: {
  kicker?: string;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        {kicker && (
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-primary">{kicker}</p>
        )}
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
      </div>
      {href && linkLabel && (
        <Link to={href} className="shrink-0 text-sm font-medium text-primary hover:underline">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

export function TypeKicker({ type }: { type: ContentType }) {
  return (
    <span className="text-xs font-semibold tracking-wide text-primary">{TYPE_LABELS[type]}</span>
  );
}

export function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-gold-soft px-2 py-0.5 text-[11px] font-medium text-gold-soft">
      <FlaskConical className="size-3" aria-hidden />
      محتوى تجريبي
    </span>
  );
}

/** Content-metadata provenance tag — not an identity verification badge. */
export function SourceTag({ verified }: { verified: boolean }) {
  if (!verified) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <ShieldCheck className="size-3.5 text-primary" aria-hidden />
      موثّق من مصدر عام
    </span>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-14 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {hint && <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="مسار التنقل" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {it.to ? (
              <Link to={it.to} className="hover:text-primary">
                {it.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-foreground">
                {it.label}
              </span>
            )}
            {i < items.length - 1 && <ChevronLeft className="size-3.5" aria-hidden />}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return (
    <nav aria-label="التنقل بين الصفحات" className="mt-8 flex items-center justify-center gap-1.5">
      <button
        type="button"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        className="page-btn"
      >
        السابق
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          aria-current={p === page ? "page" : undefined}
          className="page-btn"
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        className="page-btn"
      >
        التالي
      </button>
    </nav>
  );
}
