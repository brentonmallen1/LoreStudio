import { Fragment } from "react";
import { parseTerms } from "../../lib/glossary/markup";
import type { TermId } from "../../lib/glossary";
import Term from "./Term";

/** Copy kept as data, with its `{{term:…}}` marks drawn as `Term`s (lib/glossary/markup.ts). */
export default function TermText({ text }: { text: string }) {
  return (
    <>
      {parseTerms(text).map((part, i) =>
        typeof part === "string" ? (
          <Fragment key={i}>{part}</Fragment>
        ) : (
          <Term key={i} id={part.id as TermId}>
            {part.text}
          </Term>
        ),
      )}
    </>
  );
}
