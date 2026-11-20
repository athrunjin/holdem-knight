import { MODIFIED_MARK } from "@/lib/config-text";

/**
 * A config's name on a line: cut short where room runs out, with the mark that its values were
 * changed by hand always in full after it. It goes in a row that lays its children out in a line.
 */
export function ConfigName({ name, modified }: { name: string; modified: boolean }) {
  return (
    <>
      <span className="truncate">{name}</span>
      {modified && <span className="shrink-0 whitespace-pre">{MODIFIED_MARK}</span>}
    </>
  );
}
