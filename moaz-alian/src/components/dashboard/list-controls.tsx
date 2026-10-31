import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, List } from "lucide-react";
import { FieldSelect, type FieldSelectOption } from "@/components/ui/field-select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Sort dropdown built on the shared FieldSelect so every list page stays consistent. */
export function SortSelect({ value, onChange, options, className }: {
  value: string;
  onChange: (value: string) => void;
  options: FieldSelectOption[];
  className?: string;
}) {
  return (
    <FieldSelect
      aria-label="الترتيب"
      dir="rtl"
      className={cn("h-9 w-auto min-w-40", className)}
      value={value}
      onChange={onChange}
      options={options}
    />
  );
}

/** Grid/list switch used by card-based list pages. */
export function ViewToggle({ view, onChange, className }: {
  view: "list" | "grid";
  onChange: (view: "list" | "grid") => void;
  className?: string;
}) {
  const opts = [
    { key: "list" as const, icon: List, label: "عرض قائمة" },
    { key: "grid" as const, icon: LayoutGrid, label: "عرض شبكة" },
  ];
  return (
    <div className={cn("flex shrink-0 self-center rounded-lg border border-border bg-surface p-1", className)} role="group" aria-label="طريقة العرض">
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-label={o.label}
          aria-pressed={view === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-md p-1.5 transition",
            view === o.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
          )}
        >
          <o.icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}

/** Filter chip; toggles one list filter on/off. */
export function FilterChip({ active, onClick, children }: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-sm transition",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

/** Slices a list into pages and clamps the page when filters shrink the list. */
export function usePaged<T>(list: T[], pageSize: number, resetKey: unknown) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  useEffect(() => {
    setPage(1);
  }, [resetKey]);
  const safe = Math.min(page, pageCount);
  return {
    page: safe,
    pageCount,
    items: list.slice((safe - 1) * pageSize, safe * pageSize),
    setPage,
  };
}

/** Pager footer shown only when there is more than one page. */
export function Pagination({ page, pageCount, onPage, total, unit = "مادة" }: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  total: number;
  unit?: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-5">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        صفحة {page.toLocaleString("ar-EG")} من {pageCount.toLocaleString("ar-EG")} • {total.toLocaleString("ar-EG")} {unit}
      </p>
      <div className="flex gap-1">
        <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronRight className="size-4" aria-hidden /> السابق
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
          التالي <ChevronLeft className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
