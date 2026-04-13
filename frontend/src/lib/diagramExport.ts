import { toPng, toSvg } from "html-to-image";

function getRFViewport(editorEl: HTMLElement): HTMLElement | null {
  return editorEl.querySelector(".react-flow__viewport") as HTMLElement | null;
}

export async function exportDiagramPng(editorEl: HTMLElement, filename: string): Promise<void> {
  const viewport = getRFViewport(editorEl);
  if (!viewport) return;
  const dataUrl = await toPng(viewport, { backgroundColor: "var(--color-surface, #fff)", pixelRatio: 2 });
  download(dataUrl, `${filename}.png`);
}

export async function exportDiagramSvg(editorEl: HTMLElement, filename: string): Promise<void> {
  const viewport = getRFViewport(editorEl);
  if (!viewport) return;
  const dataUrl = await toSvg(viewport, { backgroundColor: "var(--color-surface, #fff)" });
  download(dataUrl, `${filename}.svg`);
}

function download(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
