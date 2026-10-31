import { format, isValid, parseISO } from "date-fns";

// Date-only values stay in local calendar time; never serialize through UTC.
export function parseDateValue(value?: string | null): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = parseISO(value);
  return isValid(date) && format(date, "yyyy-MM-dd") === value ? date : undefined;
}

export function serializeDateValue(date?: Date): string {
  return date && isValid(date) ? format(date, "yyyy-MM-dd") : "";
}
