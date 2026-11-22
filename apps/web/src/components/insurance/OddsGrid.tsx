import { parseOdds } from "@holdem-knight/core";
import { Plus, X } from "lucide-react";
import { useId } from "react";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { formatOddsText, selectOnFocus } from "@/lib/number-input";

export const sameOdds = (a: readonly (number | null)[], b: readonly (number | null)[]) =>
  a.length === b.length && a.every((odds, i) => odds === b[i]);

/** Odds as typed are all valid once there is at least one and each reads as odds. */
export const validOdds = (draft: readonly string[]) =>
  draft.length > 0 && draft.every((value) => parseOdds(value) !== null);

interface OddsGridProps {
  /** The odds as typed, one for each number of outs from 1 up */
  draft: readonly string[];
  onChange: (draft: string[]) => void;
  /** Shows the odds without letting them change */
  readOnly?: boolean;
}

/**
 * The cells of an odds table being edited: the odds for each number of outs, with the last one
 * removable and one more to add. A cell that does not read as odds is outlined.
 */
export function OddsGrid({ draft, onChange, readOnly = false }: OddsGridProps) {
  const id = useId();
  const last = draft.length - 1;
  const setCell = (index: number, value: string) =>
    onChange(draft.map((old, i) => (i === index ? value : old)));

  return (
    <div className="grid grid-cols-4 gap-2">
      {draft.map((value, i) => {
        const invalid = parseOdds(value) === null;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: each cell is the place for that many outs
          <div key={i} className="min-w-0">
            <div className="flex h-5 items-center justify-between text-xs text-muted">
              <label htmlFor={`${id}-${i + 1}`}>{i + 1} outs</label>
              {!readOnly && i === last && last > 0 && (
                <button
                  type="button"
                  aria-label={t.insurance.oddsGrid.deleteOuts(i + 1)}
                  onClick={() => onChange(draft.slice(0, -1))}
                  className="relative z-10 -my-3 -mr-1.5 grid h-11 w-8 place-items-center"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              )}
            </div>
            <input
              id={`${id}-${i + 1}`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={value}
              readOnly={readOnly}
              aria-invalid={invalid ? true : undefined}
              onChange={(event) => setCell(i, event.target.value)}
              onFocus={(event) => !readOnly && selectOnFocus(event.currentTarget)}
              onBlur={() => setCell(i, formatOddsText(value))}
              // Enter would submit a form around the table
              onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
              className={cn(
                "mt-1 min-h-11 w-full min-w-0 rounded-lg border bg-bg px-1 text-center tabular-nums outline-none focus:border-highlight",
                invalid ? "border-highlight" : "border-line",
              )}
            />
          </div>
        );
      })}
      {!readOnly && (
        <div className="flex items-end">
          <button
            type="button"
            aria-label={t.insurance.oddsGrid.addARow}
            onClick={() => onChange([...draft, draft.at(-1) ?? "1"])}
            className="grid min-h-11 w-full place-items-center rounded-lg border border-dashed border-line text-muted"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
