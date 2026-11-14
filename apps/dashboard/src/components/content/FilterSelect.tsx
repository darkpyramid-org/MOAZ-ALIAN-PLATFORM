import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ALL = "__all__";

export type FilterOption = { value: string; label: string };

/** Shared filter dropdown built on the site Select; an empty value maps to the "all" option. */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
  disabled,
  title,
  className,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  options: FilterOption[];
  allLabel?: string | undefined;
  disabled?: boolean | undefined;
  title?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <Select
      dir="rtl"
      value={value || (allLabel ? ALL : (options[0]?.value ?? ""))}
      onValueChange={(v) => onChange(v === ALL ? undefined : v)}
      disabled={!!disabled}
    >
      <SelectTrigger
        aria-label={label}
        {...(title ? { title } : {})}
        className={cn("field-select md:w-auto md:min-w-44", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value={ALL}>{allLabel}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
