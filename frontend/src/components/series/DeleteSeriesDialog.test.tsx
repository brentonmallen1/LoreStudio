import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeleteSeriesDialog from "./DeleteSeriesDialog";

const remove = vi.fn((_id: string, _books: string) => Promise.resolve());
vi.mock("../../api/series", () => ({
  seriesApi: { remove: (id: string, books: string) => remove(id, books) },
}));

const series = {
  id: "s1",
  name: "The Harrow Books",
  books: [
    { story_id: "b1", title: "The Last Lighthouse" },
    { story_id: "b2", title: "Low Water" },
  ],
};

describe("the Delete series dialog", () => {
  beforeEach(() => remove.mockClear());

  it("keeps the books by default", async () => {
    const onDeleted = vi.fn();
    render(<DeleteSeriesDialog series={series} onClose={() => {}} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete the series, keep the books" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("keep"));
    expect(remove).toHaveBeenCalledWith("s1", "keep");
  });

  it("deletes the books when that is chosen, and the button says so", async () => {
    const onDeleted = vi.fn();
    render(<DeleteSeriesDialog series={series} words={84012} onClose={() => {}} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByLabelText(/Delete the books too/));
    expect(screen.getByText(/about 84,000 words/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete the series and its 2 books" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("delete"));
    expect(remove).toHaveBeenCalledWith("s1", "delete");
  });
});
