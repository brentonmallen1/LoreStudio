import { Node, mergeAttributes } from "@tiptap/core";
import type { NodeViewRendererProps } from "@tiptap/core";
import { api } from "../../api/client";
import { SHORTCUTS, editorKey } from "../../lib/keyboard/shortcuts";

// Module-level callback for showing the asset picker to insert an image.
let _onInsertImage: (() => void) | null = null;

export function setInlineImageInsertCallback(cb: () => void) {
  _onInsertImage = cb;
}

/**
 * TipTap Node that stores an asset ID and renders as an authenticated image block.
 * Stored as: <figure data-asset-id="..." data-alt="..." data-width="..." />
 */
export const InlineImageExtension = Node.create({
  name: "inlineImage",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      assetId: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-asset-id"),
        renderHTML: (attrs) => ({ "data-asset-id": attrs.assetId }),
      },
      alt: {
        default: "",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-alt"),
        renderHTML: (attrs) => ({ "data-alt": attrs.alt }),
      },
      width: {
        default: "100%",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-width") ?? "100%",
        renderHTML: (attrs) => ({ "data-width": attrs.width }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "figure[data-asset-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes(HTMLAttributes, { class: "inline-image-node" })];
  },

  addNodeView() {
    return (props: NodeViewRendererProps) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { node, selected } = props as any;
      const wrapper = document.createElement("figure");
      wrapper.setAttribute("data-asset-id", node.attrs.assetId ?? "");
      wrapper.setAttribute("data-alt", node.attrs.alt ?? "");
      wrapper.setAttribute("data-width", node.attrs.width ?? "100%");
      wrapper.className = `inline-image-node${selected ? " selected" : ""}`;
      wrapper.style.cssText = "margin: 1em 0; display: block; cursor: pointer;";

      const img = document.createElement("img");
      if (node.attrs.assetId) {
        img.src = api.assetFileUrl(node.attrs.assetId as string);
      }
      img.alt = (node.attrs.alt as string) ?? "";
      img.style.cssText = `max-width: ${(node.attrs.width as string) ?? "100%"}; display: block; border-radius: 4px;`;

      wrapper.appendChild(img);

      return {
        dom: wrapper,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        update(updatedNode: any) {
          if (updatedNode.type.name !== "inlineImage") return false;
          if (updatedNode.attrs.assetId !== node.attrs.assetId) {
            img.src = updatedNode.attrs.assetId ? api.assetFileUrl(updatedNode.attrs.assetId as string) : "";
          }
          img.alt = (updatedNode.attrs.alt as string) ?? "";
          img.style.maxWidth = (updatedNode.attrs.width as string) ?? "100%";
          return true;
        },
      };
    };
  },

  addKeyboardShortcuts() {
    return {
      [editorKey(SHORTCUTS.insertImage.combo)]: () => {
        _onInsertImage?.();
        return true;
      },
    };
  },
});

/**
 * Inserts an inline image node at current cursor position.
 */
export function insertInlineImage(
  editor: ReturnType<typeof import("@tiptap/react").useEditor>,
  assetId: string,
  alt: string,
) {
  editor
    ?.chain()
    .focus()
    .insertContent({ type: "inlineImage", attrs: { assetId, alt, width: "100%" } })
    .run();
}
