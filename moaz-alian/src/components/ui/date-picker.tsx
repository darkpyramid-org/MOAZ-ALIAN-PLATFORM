import * as React from "react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { parseDateValue, serializeDateValue } from "@/lib/date-value";

type DatePickerProps = {
  value?: string | null;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  dir?: "rtl" | "ltr";
};

export function DatePicker({
  value,
  onChange,
  id,
  name,
  placeholder,
  disabled,
  className,
  dir = "rtl",
  ...aria
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseDateValue(value);
  const locale = dir === "rtl" ? ar : enUS;
  const text =
    dir === "rtl"
      ? { placeholder: "اختر التاريخ", today: "اليوم", clear: "مسح التاريخ" }
      : { placeholder: "Pick a date", today: "Today", clear: "Clear date" };

  function choose(date?: Date) {
    onChange(serializeDateValue(date));
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {name && <input type="hidden" name={name} value={value ?? ""} disabled={disabled} />}
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          dir={dir}
          className={cn(
            "field h-10 w-full min-w-0 justify-start px-4 text-start font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
          {...aria}
        >
          <CalendarIcon aria-hidden="true" />
          <span className="truncate">
            {selected
              ? format(selected, "d MMMM yyyy", { locale })
              : (placeholder ?? text.placeholder)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        dir={dir}
        className="pointer-events-auto w-auto max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl p-0 shadow-float"
      >
        <Calendar
          mode="single"
          selected={selected}
          onSelect={choose}
          defaultMonth={selected ?? new Date()}
          locale={locale}
          dir={dir}
          captionLayout="dropdown"
          autoFocus
          formatters={{ formatMonthDropdown: (date) => format(date, "MMM", { locale }) }}
          labels={{
            labelMonthDropdown: () => (dir === "rtl" ? "الشهر" : "Month"),
            labelYearDropdown: () => (dir === "rtl" ? "السنة" : "Year"),
          }}
          className="pointer-events-auto"
        />
        <div className="flex items-center justify-between gap-2 border-t border-border p-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => choose(new Date())}>
            {text.today}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!value}
            onClick={() => choose()}
          >
            {text.clear}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
