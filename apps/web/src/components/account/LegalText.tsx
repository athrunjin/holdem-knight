import { TERMS_VERSION } from "@/lib/terms";
import { textLinkClass } from "./AuthParts";

/** The shape both documents of the `legal` catalog have, in every language. */
interface LegalDocument {
  effective: string;
  version: (version: string) => string;
  /** A block is a paragraph, or a bulleted list of its items */
  sections: readonly { heading: string; blocks: readonly (string | readonly string[])[] }[];
}

/** An email address in the text, without a full stop that ends its sentence. */
const EMAIL = /([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/;

/** A paragraph with any email address in it as a link to write to it. */
function Paragraph({ text }: { text: string }) {
  const parts = text.split(EMAIL);
  // An address on its own is a link of its own, at the height of a touch target
  if (parts.length === 3 && parts[0] === "" && parts[2] === "") {
    return (
      <p>
        <a href={`mailto:${text}`} className={textLinkClass}>
          {text}
        </a>
      </p>
    );
  }
  return (
    <p>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          // Inside a sentence it stays in the line: a 44px target would break the paragraph apart
          // biome-ignore lint/suspicious/noArrayIndexKey: the parts of a fixed text never move
          <a key={index} href={`mailto:${part}`} className="font-medium text-highlight">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </p>
  );
}

/**
 * The terms or the privacy policy: when it took effect and its version in a muted line, then its
 * numbered sections of paragraphs and bulleted lists, for reading at length on a phone.
 */
export function LegalText({ document }: { document: LegalDocument }) {
  return (
    <article className="flex flex-col gap-6 text-sm leading-6">
      <p className="-mt-2 flex flex-wrap gap-x-4 text-xs text-muted">
        <span>{document.effective}</span>
        <span>{document.version(TERMS_VERSION)}</span>
      </p>
      {document.sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-2">
          <h2 className="text-base font-medium">{section.heading}</h2>
          {section.blocks.map((block) =>
            typeof block === "string" ? (
              <Paragraph key={block} text={block} />
            ) : (
              <ul key={block[0]} className="flex list-disc flex-col gap-1 pl-5 marker:text-muted">
                {block.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ),
          )}
        </section>
      ))}
    </article>
  );
}
