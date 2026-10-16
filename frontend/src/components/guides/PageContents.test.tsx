import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { IDENTITY_SECTIONS } from "../story/identitySections";
import PageContents from "./PageContents";

function Page() {
  const article = useRef<HTMLDivElement>(null);
  return (
    <>
      <PageContents
        article={article}
        guideKey="identity"
        items={IDENTITY_SECTIONS}
        address={false}
        jumpClassName="jump"
      />
      <div ref={article}>
        {IDENTITY_SECTIONS.map((s) => (
          <h2 key={s.id} id={s.id}>
            {s.text}
          </h2>
        ))}
      </div>
    </>
  );
}

describe("a page's contents given as items", () => {
  it("lists every section with its line, and offers the same as Jump to", async () => {
    render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    );
    await act(() => new Promise((r) => requestAnimationFrame(() => r(null))));
    const rail = screen.getByRole("navigation", { name: "On this page" });
    expect(rail.querySelectorAll("a")).toHaveLength(6);
    expect(screen.getByText("How is it told?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Jump to/ }));
    expect(screen.getAllByRole("option")).toHaveLength(6);
  });
});
