import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TableExplorer } from "./ui-primitives";

afterEach(cleanup);

// Mock next/link since we're not in a Next.js context
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const columns = ["Name", "Amount", "City"];
const rows = [
  ["Alice", "$500", "Boston"],
  ["Bob", "$1,200", "Denver"],
  ["Charlie", "$300", "Austin"],
  ["Diana", "$800", "Chicago"],
  ["Eve", "$950", "Seattle"],
];

describe("TableExplorer", () => {
  it("renders all columns as headers", () => {
    render(<TableExplorer columns={columns} rows={rows} />);
    expect(screen.getByText("Name")).toBeDefined();
    expect(screen.getByText("Amount")).toBeDefined();
    expect(screen.getByText("City")).toBeDefined();
  });

  it("renders rows within page size", () => {
    render(<TableExplorer columns={columns} rows={rows} pageSize={3} />);
    // Should show only first 3 rows
    expect(screen.getByText("Alice")).toBeDefined();
    expect(screen.getByText("Bob")).toBeDefined();
    expect(screen.getByText("Charlie")).toBeDefined();
    // Diana should NOT be visible on page 1
    expect(screen.queryByText("Diana")).toBeNull();
  });

  it("shows pagination controls when rows exceed page size", () => {
    render(<TableExplorer columns={columns} rows={rows} pageSize={3} />);
    expect(screen.getByText("Next")).toBeDefined();
    expect(screen.getByText("Last")).toBeDefined();
    expect(screen.getByText(/page 1 of 2/)).toBeDefined();
  });

  it("does not show pagination when rows fit on one page", () => {
    render(<TableExplorer columns={columns} rows={rows} pageSize={10} />);
    expect(screen.queryByText("Next")).toBeNull();
  });

  it("navigates to next page", () => {
    render(<TableExplorer columns={columns} rows={rows} pageSize={3} />);
    fireEvent.click(screen.getByText("Next"));
    // Page 2 should show Diana and Eve
    expect(screen.getByText("Diana")).toBeDefined();
    expect(screen.getByText("Eve")).toBeDefined();
    // Alice should no longer be visible
    expect(screen.queryByText("Alice")).toBeNull();
    expect(screen.getByText(/page 2 of 2/)).toBeDefined();
  });

  it("navigates back with Prev", () => {
    render(<TableExplorer columns={columns} rows={rows} pageSize={3} />);
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Prev"));
    expect(screen.getByText("Alice")).toBeDefined();
    expect(screen.getByText(/page 1 of 2/)).toBeDefined();
  });

  it("First and Last buttons work", () => {
    render(<TableExplorer columns={columns} rows={rows} pageSize={2} />);
    // Go to last page
    fireEvent.click(screen.getByText("Last"));
    expect(screen.getByText("Eve")).toBeDefined();
    expect(screen.getByText(/page 3 of 3/)).toBeDefined();
    // Go back to first page
    fireEvent.click(screen.getByText("First"));
    expect(screen.getByText("Alice")).toBeDefined();
    expect(screen.getByText(/page 1 of 3/)).toBeDefined();
  });

  it("sorts by column on click", () => {
    render(<TableExplorer columns={columns} rows={rows} pageSize={10} />);
    // Click "Name" to sort alphabetically ascending (already is)
    fireEvent.click(screen.getByText("Name"));
    const cells = screen.getAllByRole("row");
    // First data row (index 1, after header) should be Alice
    expect(cells[1].textContent).toContain("Alice");

    // Click again to sort descending
    fireEvent.click(screen.getByText("Name"));
    const cellsDesc = screen.getAllByRole("row");
    expect(cellsDesc[1].textContent).toContain("Eve");
  });

  it("sorts numerically when values look like numbers", () => {
    const numRows = [
      ["A", "100"],
      ["B", "50"],
      ["C", "200"],
    ];
    render(<TableExplorer columns={["Name", "Score"]} rows={numRows} pageSize={10} />);
    fireEvent.click(screen.getByText("Score"));
    const rows = screen.getAllByRole("row");
    // Ascending: 50, 100, 200
    expect(rows[1].textContent).toContain("50");
    expect(rows[2].textContent).toContain("100");
    expect(rows[3].textContent).toContain("200");
  });

  it("resets to page 1 when sort changes", () => {
    render(<TableExplorer columns={columns} rows={rows} pageSize={3} />);
    fireEvent.click(screen.getByText("Next")); // go to page 2
    expect(screen.getByText(/page 2/)).toBeDefined();
    fireEvent.click(screen.getByText("Name")); // sort — should reset to page 1
    expect(screen.getByText(/page 1/)).toBeDefined();
  });

  it("shows empty state when no rows", () => {
    render(<TableExplorer columns={columns} rows={[]} emptyState="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeDefined();
  });

  it("shows default empty state message", () => {
    render(<TableExplorer columns={columns} rows={[]} />);
    expect(screen.getByText("No data available.")).toBeDefined();
  });

  it("renders internal links as View buttons", () => {
    const rowsWithLinks = [["Test", "/members/abc"]];
    render(<TableExplorer columns={["Name", ""]} rows={rowsWithLinks} />);
    const link = screen.getByText("View");
    expect(link.closest("a")?.getAttribute("href")).toBe("/members/abc");
  });

  it("renders TableCellLink objects as links", () => {
    const rowsWithLinks = [[{ label: "See details", href: "/pacs/xyz" }]];
    render(<TableExplorer columns={["Link"]} rows={rowsWithLinks} />);
    const link = screen.getByText("See details");
    expect(link.closest("a")?.getAttribute("href")).toBe("/pacs/xyz");
  });

  it("does not sort action columns (empty header)", () => {
    render(<TableExplorer columns={["Name", ""]} rows={[["A", "/test"]]} pageSize={10} />);
    // The empty column header should not have a sort indicator
    const headers = screen.getAllByRole("columnheader");
    const actionHeader = headers[headers.length - 1];
    // Click should not trigger sort (no cursor-pointer class check, just verify no crash)
    fireEvent.click(actionHeader);
  });
});
