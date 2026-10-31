import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type FieldSelectOption = { value: string; label: string; disabled?: boolean };

/**
 * Reusable styled dropdown built on the shadcn Select primitive.
 * Use instead of a native <select> so every dashboard filter/field
 * shares the same look, RTL behavior and keyboard support.
 */
export function FieldSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled = false,
  dir,
  "aria-label": ariaLabel,
  open,
  onOpenChange,
  contentClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  options: FieldSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  dir?: "rtl" | "ltr" | undefined;
  "aria-label"?: string | undefined;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  contentClassName?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      {...(dir ? { dir } : {})}
      {...(open !== undefined ? { open } : {})}
      {...(onOpenChange ? { onOpenChange } : {})}
    >
      <SelectTrigger aria-label={ariaLabel} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} disabled={o.disabled ?? false}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
