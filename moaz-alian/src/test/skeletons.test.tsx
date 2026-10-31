import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  CardGridSkeleton,
  ListingSkeleton,
  HomeSkeleton,
  DetailSkeleton,
  ContentPageSkeleton,
  RowsSkeleton,
  TableRowsSkeleton,
  FormSkeleton,
  DashboardShellSkeleton,
  RoutePendingSkeleton,
} from "@/components/skeletons";
import { Table, TableBody } from "@/components/ui/table";

/** Smoke test: every skeleton renders, announces itself, and stays deterministic. */
describe("skeletons", () => {
  it("renders each loading skeleton with a screen-reader status", () => {
    const views = [
      <ListingSkeleton key="l" />,
      <HomeSkeleton key="h" />,
      <DetailSkeleton key="d" />,
      <ContentPageSkeleton key="c" />,
      <RowsSkeleton key="r" />,
      <FormSkeleton key="f" />,
      <DashboardShellSkeleton key="s" />,
      <RoutePendingSkeleton key="p" />,
    ];
    for (const view of views) {
      const { container, unmount } = render(view);
      expect(container.querySelector('[role="status"][aria-busy="true"]')).not.toBeNull();
      unmount();
    }
  });

  it("renders table skeleton rows inside a table body", () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRowsSkeleton rows={3} columns={4} />
        </TableBody>
      </Table>,
    );
    expect(container.querySelectorAll("tr").length).toBe(3);
  });
});
