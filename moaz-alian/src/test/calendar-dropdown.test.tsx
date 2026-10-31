import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Calendar } from "@/components/ui/calendar";

vi.mock("@/components/ui/field-select", () => ({
  FieldSelect: ({ open, onOpenChange, "aria-label": label }: {
    open: boolean; onOpenChange: (open: boolean) => void; "aria-label": string;
  }) => <button aria-label={label} aria-expanded={open} onClick={() => onOpenChange(!open)} />,
}));

afterEach(cleanup);

it("opens only one calendar dropdown at a time", () => {
  render(<Calendar mode="single" captionLayout="dropdown" defaultMonth={new Date(2026, 9, 30)}
    labels={{ labelMonthDropdown: () => "Month", labelYearDropdown: () => "Year" }} />);
  const month = screen.getByRole("button", { name: "Month" });
  const year = screen.getByRole("button", { name: "Year" });
  fireEvent.click(year);
  expect(year).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(month);
  expect(month).toHaveAttribute("aria-expanded", "true");
  expect(year).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(year);
  expect(year).toHaveAttribute("aria-expanded", "true");
  expect(month).toHaveAttribute("aria-expanded", "false");
});