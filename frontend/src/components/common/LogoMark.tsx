import source from "./lorestudio-mark.svg?raw";

// The master logo (docs/images/lorestudio-logo.svg, copied here by `just icons`): its one path
// and its square box. Drawn in currentColor, so it takes the colour of whatever holds it, in
// every palette, light or dark.
const viewBox = /viewBox="([^"]+)"/.exec(source)?.[1] ?? "0 0 100 100";
const d = /<path[^>]* d="([^"]+)"/.exec(source)?.[1] ?? "";

/** The LoreStudio mark: an open book with a quill. Decorative unless given a `title`. */
export default function LogoMark({
  size = 24,
  title,
  className,
}: {
  size?: number | string;
  title?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox={viewBox}
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <path fill="currentColor" fillRule="evenodd" d={d} />
    </svg>
  );
}
