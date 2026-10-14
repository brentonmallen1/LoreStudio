import { act, render } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { proseStarterKit } from "../starterKit";
import { LineOffer } from "./LineOffer";
import { LineOfferExtension } from "./LineOfferExtension";
import { ScriptElementAttribute } from "./ScriptElementExtension";

/** An offer about a line sits under that line, in the text's flow, and changes no text (doc 25). */
let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

const CONTENT =
  '<p data-el="heading">INT. COTTAGE</p><p data-el="action">Rain.</p><p data-el="heading">EXT. SEA</p>';

describe("LineOffer", () => {
  it("draws under the line it is about, and goes when there is nothing to offer", () => {
    editor = new Editor({
      element: document.createElement("div"),
      extensions: [proseStarterKit(), ScriptElementAttribute, LineOfferExtension],
      content: CONTENT,
    });
    const ed = editor;
    const before = ed.getHTML();
    let third = 0;
    ed.state.doc.forEach((_node, offset, index) => {
      if (index === 2) third = offset;
    });
    const { rerender } = render(
      <LineOffer editor={ed} id="split" pos={third}>
        <button>Start it here</button>
      </LineOffer>,
    );
    const offer = ed.view.dom.querySelector(".script-line-offer");
    expect(offer?.textContent).toBe("Start it here");
    // Right after the heading it is about, the last line.
    expect(offer?.previousElementSibling?.textContent).toBe("EXT. SEA");
    expect(ed.getHTML()).toBe(before);

    act(() =>
      rerender(
        <LineOffer editor={ed} id="split" pos={null}>
          <button>Start it here</button>
        </LineOffer>,
      ),
    );
    expect(ed.view.dom.querySelector(".script-line-offer")).toBeNull();
  });
});
