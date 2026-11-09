import type { Cents, Currency } from "@holdem-knight/core";
import { formatSignedChips, netColor } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { formatGameMoney } from "@/lib/currency";

/** Shared by the column titles and every row under them, so all amounts share one right edge. */
const columnsClass =
  "grid grid-cols-[minmax(0,1fr)_1.5rem_3.25rem_3.5rem_5.75rem] items-center tabular-nums";
/** The text of a detail line or the total, across the first four columns. */
const labelClass = "col-span-4 flex min-w-0 items-center gap-2";

/** One adjustment under a person's name: a charge, insurance, or a share of a difference. */
export interface ResultLine {
  readonly key: string;
  readonly label: string;
  /** Missing shows a dash, for a charge that does not apply. */
  readonly amount?: Cents;
  /** Charges are muted, other adjustments use the highlight color. */
  readonly tone: "charge" | "adjustment";
  /** A charge the organizer can let the player off. */
  readonly waiver?: {
    readonly waived: boolean;
    readonly disabled: boolean;
    readonly onChange: (waived: boolean) => void;
  };
}

export interface ResultCard {
  readonly id: string;
  readonly name: string;
  readonly hands: string;
  readonly chips: string;
  /** Missing for the organizer, who has no chips. */
  readonly netChips?: number;
  /** The result from the chips, before the lines. Missing shows a dash. */
  readonly base?: Cents;
  readonly lines: readonly ResultLine[];
  readonly total: Cents;
}

function TotalChip({ total, currency }: { total: Cents; currency: Currency }) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 font-semibold",
        netColor(total),
        total > 0 ? "bg-win/15" : total < 0 ? "bg-loss/15" : "bg-muted/15",
      )}
    >
      {formatGameMoney(total, currency, "exceptZero")}
    </span>
  );
}

function Line({ line, currency }: { line: ResultLine; currency: Currency }) {
  const { label, amount, tone, waiver } = line;
  const off = waiver?.waived === true;
  const text = off
    ? "text-muted line-through"
    : tone === "charge"
      ? "text-muted"
      : "text-highlight";
  const value =
    amount === undefined
      ? "—"
      : formatGameMoney(amount, currency, amount === 0 ? "auto" : "exceptZero");
  const amountText = <span className={cn("text-right whitespace-nowrap", text)}>{value}</span>;

  if (!waiver) {
    return (
      <div className={cn(columnsClass, "min-h-7 text-xs")}>
        <span className={labelClass}>
          <span className="size-4 shrink-0" aria-hidden />
          <span className={cn("truncate", text)}>{label}</span>
        </span>
        {amountText}
      </div>
    );
  }
  // The whole line toggles the charge, so the tap target is the full row
  return (
    <label
      className={cn(columnsClass, "min-h-11 cursor-pointer text-xs has-disabled:cursor-default")}
    >
      <span className={labelClass}>
        <input
          type="checkbox"
          checked={!off}
          disabled={waiver.disabled}
          onChange={(event) => waiver.onChange(!event.target.checked)}
          className="size-4 shrink-0 accent-[var(--accent)]"
        />
        <span className={cn("truncate", text)}>{label}</span>
      </span>
      {amountText}
    </label>
  );
}

/**
 * Settlement results as one card per person: a tinted row with their chips and result, then the
 * adjustments to it and a total. A person with no adjustments shows their total in the row itself.
 */
export function ResultCards({
  cards,
  currency,
}: {
  cards: readonly ResultCard[];
  currency: Currency;
}) {
  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className={cn(columnsClass, "px-2 text-xs text-muted")}>
        <span>玩家</span>
        <span className="text-right">手</span>
        <span className="text-right">筹码</span>
        <span className="text-right">水上/下</span>
        <span className="text-right">金额</span>
      </div>
      {cards.map(({ id, name, hands, chips, netChips, base, lines, total }) => (
        <section
          key={id}
          aria-label={name}
          className="overflow-hidden rounded-xl border border-line bg-surface text-sm"
        >
          <div className={cn(columnsClass, "min-h-11 bg-accent/15 px-2")}>
            <h3 className="truncate font-medium">{name}</h3>
            <span className="text-right">{hands}</span>
            <span className="text-right">{chips}</span>
            <span
              className={cn(
                "text-right",
                netChips === undefined ? "text-muted" : netColor(netChips),
              )}
            >
              {netChips === undefined ? "—" : formatSignedChips(netChips)}
            </span>
            <span className="text-right whitespace-nowrap">
              {lines.length === 0 ? (
                <TotalChip total={total} currency={currency} />
              ) : base === undefined ? (
                <span className="text-muted">—</span>
              ) : (
                <span className={netColor(base)}>
                  {formatGameMoney(base, currency, "exceptZero")}
                </span>
              )}
            </span>
          </div>
          {lines.length > 0 && (
            <div className="px-2">
              {lines.map((line) => (
                <Line key={line.key} line={line} currency={currency} />
              ))}
              <div className={cn(columnsClass, "min-h-11 border-t border-accent")}>
                <span className={cn(labelClass, "font-semibold")}>合计</span>
                <span className="text-right whitespace-nowrap">
                  <TotalChip total={total} currency={currency} />
                </span>
              </div>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
