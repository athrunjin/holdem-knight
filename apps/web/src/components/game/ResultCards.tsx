import { type Cents, type Currency, cents } from "@holdem-knight/core";
import { ChevronRight } from "lucide-react";
import { type ReactNode, useState } from "react";
import { MiniSwitch } from "@/components/MiniSwitch";
import { formatSignedChips, netColor } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { formatGameAmount } from "@/lib/currency";

/** Shared by the column titles and every row under them, so all amounts share one right edge. */
const columnsClass =
  "grid grid-cols-[minmax(0,1fr)_1.5rem_3.25rem_3.5rem_6.25rem] items-center tabular-nums";
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
  /** Lines in the same group add up to one item when the card is collapsed. */
  readonly group?: SummaryGroup;
  /** Text only, with no amount: how the lines after it were worked out. */
  readonly note?: boolean;
  /** A charge the organizer can let the player off. */
  readonly waiver?: {
    readonly waived: boolean;
    readonly disabled: boolean;
    readonly onChange: (waived: boolean) => void;
  };
}

/** The items a collapsed card lists, left to right. */
const SUMMARY_GROUPS = ["差额", "分摊", "保险", "工资", "台费"] as const;
export type SummaryGroup = (typeof SUMMARY_GROUPS)[number];

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
  /** Whether the card folds to one row with a summary line. */
  readonly collapsible?: boolean;
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
      {formatGameAmount(total, currency, "exceptZero")}
    </span>
  );
}

function Line({ line, currency }: { line: ResultLine; currency: Currency }) {
  const { label, amount, tone, waiver } = line;
  if (line.note) {
    return <p className="flex min-h-7 items-center pl-6 text-xs text-muted">{label}</p>;
  }
  const off = waiver?.waived === true;
  const text = off
    ? "text-muted line-through"
    : tone === "charge"
      ? "text-muted"
      : "text-highlight";
  const value =
    amount === undefined
      ? "—"
      : formatGameAmount(amount, currency, amount === 0 ? "auto" : "exceptZero");
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
 * A collapsed card's line, right-aligned under the amount: each group's total, then the sum of
 * them all in gray. With a single item, that item takes the sum's place. The organizer has no
 * result from chips, so the sum would repeat the total and is left out.
 */
function Summary({ card, currency }: { card: ResultCard; currency: Currency }) {
  const items = SUMMARY_GROUPS.flatMap((group) => {
    const lines = card.lines.filter((l) => l.group === group && l.amount !== undefined);
    if (lines.length === 0) return [];
    const due = lines.filter((l) => !l.waiver?.waived);
    const amount = due.reduce((total, l) => total + (l.amount ?? 0), 0);
    const tone = lines[0]?.tone ?? "charge";
    const value =
      due.length === 0 ? "已免" : formatGameAmount(cents(amount), currency, "exceptZero");
    return [{ group, value, tone }];
  });
  if (items.length === 0) return null;
  const onlyCharges = items.every((item) => item.tone === "charge");
  const adjustment = cents(card.total - (card.base ?? 0));

  return (
    <p className="flex flex-wrap justify-end gap-x-3 px-2 pt-0.5 pb-1.5 text-xs whitespace-nowrap tabular-nums">
      {items.map(({ group, value, tone }) => (
        <span key={group} className={tone === "charge" ? "text-muted" : "text-highlight"}>
          {group} {value}
        </span>
      ))}
      {items.length > 1 && card.base !== undefined && (
        <span className="font-medium text-muted">
          {onlyCharges ? "含费" : "含调整"} {formatGameAmount(adjustment, currency, "exceptZero")}
        </span>
      )}
    </p>
  );
}

function Card({
  card,
  currency,
  open,
  onToggle,
}: {
  card: ResultCard;
  currency: Currency;
  open: boolean;
  onToggle: () => void;
}) {
  const { name, hands, chips, netChips, base, lines, total } = card;
  const folds = card.collapsible === true && lines.length > 0;
  const expanded = lines.length > 0 && (open || !folds);
  const cells = (
    <>
      <span className="flex min-w-0 items-center font-medium">
        {folds && (
          <ChevronRight
            className={cn(
              "-ml-1 size-4 shrink-0 text-muted transition-transform",
              open && "rotate-90",
            )}
            aria-hidden
          />
        )}
        <span className="truncate">{name}</span>
      </span>
      <span className="text-right">{hands}</span>
      <span className="text-right">{chips}</span>
      <span
        className={cn("text-right", netChips === undefined ? "text-muted" : netColor(netChips))}
      >
        {netChips === undefined ? "—" : formatSignedChips(netChips)}
      </span>
      <span className="text-right whitespace-nowrap">
        {!expanded ? (
          <TotalChip total={total} currency={currency} />
        ) : base === undefined ? (
          <span className="text-muted">—</span>
        ) : (
          <span className={netColor(base)}>{formatGameAmount(base, currency, "exceptZero")}</span>
        )}
      </span>
    </>
  );
  const rowClass = cn(columnsClass, "min-h-11 w-full bg-accent/15 px-2 text-left");

  return (
    <section
      aria-label={name}
      className="overflow-hidden rounded-xl border border-line bg-surface text-sm"
    >
      {folds ? (
        <button type="button" aria-expanded={open} onClick={onToggle} className={rowClass}>
          {cells}
        </button>
      ) : (
        <div className={rowClass}>{cells}</div>
      )}
      {folds && !open && <Summary card={card} currency={currency} />}
      {expanded && (
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
  );
}

/**
 * Settlement results as one card per person: a tinted row with their chips and result, then the
 * adjustments to it and a total. Cards fold to that row and a one-line summary, and the 明细
 * switch opens them all, or closes them once all are open. `details` shows above the cards while
 * all are open.
 */
export function ResultCards({
  cards,
  currency,
  details,
}: {
  cards: readonly ResultCard[];
  currency: Currency;
  details?: ReactNode;
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const foldable = cards.filter((card) => card.collapsible && card.lines.length > 0);
  const allOpen = foldable.length > 0 && foldable.every((card) => open.has(card.id));

  function toggle(id: string) {
    const next = new Set(open);
    if (!next.delete(id)) next.add(id);
    setOpen(next);
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex min-h-11 items-center justify-between gap-2">
        <h3 className="font-semibold">对局总览</h3>
        {foldable.length > 0 && (
          <MiniSwitch
            label="明细"
            checked={allOpen}
            onChange={(on) => setOpen(new Set(on ? foldable.map((card) => card.id) : []))}
          />
        )}
      </div>
      {allOpen && details}
      <div
        className={cn(
          columnsClass,
          allOpen && details ? "px-2" : "-mt-2 px-2",
          "text-xs text-muted",
        )}
      >
        <span>玩家</span>
        <span className="text-right">手</span>
        <span className="text-right">筹码</span>
        <span className="text-right">水上/下</span>
        <span className="text-right">金额</span>
      </div>
      {cards.map((card) => (
        <Card
          key={card.id}
          card={card}
          currency={currency}
          open={open.has(card.id)}
          onToggle={() => toggle(card.id)}
        />
      ))}
    </div>
  );
}
