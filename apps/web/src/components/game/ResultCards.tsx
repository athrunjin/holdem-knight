import { type Cents, type Currency, cents } from "@holdem-knight/core";
import { ChevronRight } from "lucide-react";
import { type ReactNode, useState } from "react";
import { MiniSwitch } from "@/components/MiniSwitch";
import { breakable, formatSignedChips, netColor } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { formatGameAmount } from "@/lib/currency";

/**
 * Shared by the column titles and every row under them, so all amounts share one right edge.
 * The columns give the name all the room they can: Buy-ins have two digits, and chips, the win or
 * loss and the amount have exactly six, where a card's row of figures touch. Five are close and
 * four sit easily. Longer figures wrap in a card's first row, as a long name does.
 * Buy-ins and chips are centered, and the win or loss and the amount end at the right. On screens
 * from 24rem wide the Buy-in column's cell, the second of a row that has more, keeps clear of the
 * chips by two digits' width. Narrower phones have no room to spare for that.
 */
export const columnsClass =
  "grid grid-cols-[minmax(0,1fr)_2.25rem_3.25rem_3.8125rem_6.1875rem] items-center tabular-nums min-[24rem]:grid-cols-[minmax(0,1fr)_3.125rem_3.25rem_3.8125rem_6.1875rem] min-[24rem]:[&>:nth-child(2):not(:last-child)]:pr-3.5";
/** A name in a card's first row: two lines before it is cut short. */
export const nameClass = "line-clamp-2 leading-tight [overflow-wrap:anywhere]";
/** A figure in a card's first row, which wraps sooner than run into the next column. */
export const figureClass = "leading-tight [overflow-wrap:anywhere]";
/** The text of a detail line or the total, across the first four columns. */
export const labelClass = "col-span-4 flex min-w-0 items-center gap-2";

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
type SummaryGroup = (typeof SUMMARY_GROUPS)[number];

export interface ResultCard {
  readonly id: string;
  readonly name: string;
  readonly hands: string;
  readonly chips: string;
  /** Missing for an organizer who is not playing, which shows a dash. */
  readonly netChips?: number;
  /** The result from the chips, before the lines. Missing shows a dash. */
  readonly base?: Cents;
  /** The person's Buy-in record, over the lines. Missing for an organizer who is not playing. */
  readonly record?: ReactNode;
  /** Rows under the first one that stay in view however the card is folded: the insurance seat. */
  readonly pinned?: ReactNode;
  readonly lines: readonly ResultLine[];
  readonly total: Cents;
  /** Whether the card folds to one row with a summary line. */
  readonly collapsible?: boolean;
  /**
   * Tappable figures in place of `hands` and `chips`, on the game page. With either, the first row
   * is no longer one button: the name, the win or loss and the amount each fold the card.
   */
  readonly handsCell?: ReactNode;
  readonly chipsCell?: ReactNode;
  /** A button on the 合计 line, before the amount. */
  readonly action?: ReactNode;
}

function TotalChip({ total, currency }: { total: Cents; currency: Currency }) {
  return (
    <span
      className={cn(
        "inline-block rounded-md px-1 py-0.5 font-semibold",
        netColor(total),
        total > 0 ? "bg-win/15" : total < 0 ? "bg-loss/15" : "bg-muted/15",
      )}
    >
      {breakable(formatGameAmount(total, currency, "exceptZero"))}
    </span>
  );
}

/** The total under a card's lines, with an action for whoever the card is about before the amount. */
export function TotalLine({
  total,
  currency,
  action,
}: {
  total: Cents;
  currency: Currency;
  action?: ReactNode;
}) {
  return (
    <div className={cn(columnsClass, "min-h-11 border-t border-accent")}>
      <span className={cn(labelClass, "justify-between font-semibold")}>
        合计
        {action}
      </span>
      <span className="text-right whitespace-nowrap">
        <TotalChip total={total} currency={currency} />
      </span>
    </div>
  );
}

/** The titles over a group of cards, in the cards' columns. */
export function ColumnTitles({ first }: { first: string }) {
  return (
    <div className={cn(columnsClass, "px-2 text-xs text-muted")}>
      <span>{first}</span>
      <span className="text-center">Buy-in</span>
      <span className="text-center">筹码</span>
      <span className="text-right">水上/下</span>
      <span className="text-right">金额</span>
    </div>
  );
}

/**
 * The insurance seat on the organizer's card, as the game page shows it: its own row in the card's
 * columns, in the highlight color. Here it is only read, so its name leads nowhere.
 */
export function InsuranceRow({
  hands,
  chips,
  netChips,
  amount,
  currency,
}: {
  hands: string;
  chips: string;
  netChips: number;
  amount: Cents;
  currency: Currency;
}) {
  return (
    <div className={cn(columnsClass, "min-h-11 text-xs")}>
      <span className="truncate text-highlight">保险</span>
      <span className="text-center">{hands}</span>
      <span className={cn(figureClass, "text-center")}>{breakable(chips)}</span>
      <span className={cn(figureClass, "text-right", netColor(netChips))}>
        {breakable(formatSignedChips(netChips))}
      </span>
      <span className="text-right whitespace-nowrap text-highlight">
        {formatGameAmount(amount, currency, amount === 0 ? "auto" : "exceptZero")}
      </span>
    </div>
  );
}

/** One line under a card's row, with a box to waive it where it is a charge the organizer can drop. */
export function Line({ line, currency }: { line: ResultLine; currency: Currency }) {
  const { label, amount, tone, waiver } = line;
  if (line.note) {
    return <p className="flex min-h-6 items-center pl-6 text-xs text-muted">{label}</p>;
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
      <div className={cn(columnsClass, "min-h-6 text-xs")}>
        <span className={labelClass}>
          <span className="size-4 shrink-0" aria-hidden />
          <span className={cn("truncate", text)}>{label}</span>
        </span>
        {amountText}
      </div>
    );
  }
  // The whole line toggles the charge. Every line is as tall as a line of the Buy-in record over it
  return (
    <label
      className={cn(columnsClass, "min-h-6 cursor-pointer text-xs has-disabled:cursor-default")}
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
 * A collapsed card's line: each group's total from the left, then 合计 at the right with the final
 * result picked out, as large as the amount over it, since that row shows only what the chips come
 * to.
 */
function Summary({
  card,
  currency,
  divided,
}: {
  card: ResultCard;
  currency: Currency;
  /** A faint rule over the line, where a pinned row sits above it. */
  divided: boolean;
}) {
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
  // With no items the row over the line already shows the result, unless it has none from chips
  if (items.length === 0 && card.base !== undefined) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-x-3 pb-1.5 whitespace-nowrap tabular-nums",
        divided ? "border-t border-line pt-1.5" : "pt-0.5",
      )}
    >
      <p className="flex min-w-0 flex-wrap gap-x-3 text-xs">
        {items.map(({ group, value, tone }) => (
          <span key={group} className={tone === "charge" ? "text-muted" : "text-highlight"}>
            {group} {value}
          </span>
        ))}
      </p>
      <span className="flex shrink-0 items-center gap-1 text-muted">
        合计
        <TotalChip total={card.total} currency={currency} />
      </span>
    </div>
  );
}

/**
 * One person's card: a tinted row with their chips and result, then their Buy-in record, the
 * adjustments to the result and a total. A card that folds shows the row and a one-line summary.
 */
export function PersonCard({
  card,
  currency,
  open = false,
  onToggle,
  summary = true,
}: {
  card: ResultCard;
  currency: Currency;
  /** Only a card that folds takes these. */
  open?: boolean;
  onToggle?: () => void;
  /** False folds the card to its first row alone, without the line of charges and the total. */
  summary?: boolean;
}) {
  const { name, hands, chips, netChips, base, record, pinned, lines, total } = card;
  const { handsCell, chipsCell } = card;
  const hasBody = lines.length > 0 || record !== undefined;
  const folds = card.collapsible === true && hasBody;
  const expanded = hasBody && (open || !folds);
  const tappable = handsCell !== undefined || chipsCell !== undefined;
  const nameCell = (
    <>
      {folds && (
        <ChevronRight
          className={cn(
            "-ml-1 size-4 shrink-0 text-muted transition-transform",
            open && "rotate-90",
          )}
          aria-hidden
        />
      )}
      <span className={nameClass}>{name}</span>
    </>
  );
  const net = netChips === undefined ? "—" : breakable(formatSignedChips(netChips));
  const netTone = netChips === undefined ? "text-muted" : netColor(netChips);
  // Always what the chips come to. An organizer who is not playing has none, so a dash
  const amount =
    base === undefined ? (
      <span className="text-muted">—</span>
    ) : (
      <span className={netColor(base)}>
        {breakable(formatGameAmount(base, currency, "exceptZero"))}
      </span>
    );
  const cells = (
    <>
      <span className="flex min-w-0 items-center font-medium">{nameCell}</span>
      <span className="text-center">{hands}</span>
      <span className={cn(figureClass, "text-center")}>{breakable(chips)}</span>
      <span className={cn(figureClass, "text-right", netTone)}>{net}</span>
      <span className={cn(figureClass, "text-right")}>{amount}</span>
    </>
  );
  const rowClass = cn(columnsClass, "min-h-9 w-full bg-accent/15 px-2 py-1 text-left");
  const foldButton = (className: string, children: ReactNode) => (
    <button type="button" aria-expanded={open} onClick={onToggle} className={className}>
      {children}
    </button>
  );
  const foldCellClass = cn(figureClass, "min-h-11 text-right tabular-nums");

  return (
    <section
      aria-label={name}
      className="overflow-hidden rounded-xl border border-line bg-surface text-sm"
    >
      {tappable ? (
        // The row is a little shorter than a 44px target, and so is everything tappable in it
        <div className={cn(columnsClass, "min-h-9 w-full bg-accent/15 px-2 [&_button]:min-h-9")}>
          {foldButton("flex min-h-11 min-w-0 items-center text-left font-medium", nameCell)}
          {handsCell ?? <span className="text-center">{hands}</span>}
          {chipsCell ?? <span className={cn(figureClass, "text-center")}>{breakable(chips)}</span>}
          {foldButton(cn(foldCellClass, netTone), net)}
          {foldButton(foldCellClass, amount)}
        </div>
      ) : folds ? (
        foldButton(rowClass, cells)
      ) : (
        <div className={rowClass}>{cells}</div>
      )}
      {/* Open: the record, the pinned rows, then the lines, a faint rule between each */}
      <div className="@container px-2">
        {expanded && record}
        {pinned !== undefined && (
          <div className={cn(expanded && record !== undefined && "border-t border-line")}>
            {pinned}
          </div>
        )}
        {folds && !open && summary && (
          <Summary card={card} currency={currency} divided={pinned !== undefined} />
        )}
        {expanded && (
          <>
            <div
              className={cn(
                (record !== undefined || pinned !== undefined) &&
                  lines.length > 0 &&
                  "border-t border-line",
              )}
            >
              {lines.map((line) => (
                <Line key={line.key} line={line} currency={currency} />
              ))}
            </div>
            <TotalLine total={total} currency={currency} action={card.action} />
          </>
        )}
      </div>
    </section>
  );
}

/**
 * Settlement results as one card per person. Cards fold to their row and a one-line summary, and the 明细
 * switch opens them all, or closes them once all are open. An organizer with anything to receive
 * comes first under a title row of their own, and the players follow under theirs.
 */
export function ResultCards({
  organizer,
  cards,
  currency,
}: {
  organizer?: ResultCard | undefined;
  cards: readonly ResultCard[];
  currency: Currency;
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const everyone = organizer ? [organizer, ...cards] : cards;
  // Every card that folds, as the card itself decides: one with lines or a Buy-in record
  const foldable = everyone.filter(
    (card) => card.collapsible && (card.lines.length > 0 || card.record !== undefined),
  );
  const allOpen = foldable.length > 0 && foldable.every((card) => open.has(card.id));

  function toggle(id: string) {
    const next = new Set(open);
    if (!next.delete(id)) next.add(id);
    setOpen(next);
  }
  const card = (person: ResultCard) => (
    <PersonCard
      key={person.id}
      card={person}
      currency={currency}
      open={open.has(person.id)}
      onToggle={() => toggle(person.id)}
    />
  );

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="-mb-2 flex min-h-11 items-center justify-between gap-2">
        <h3 className="font-semibold">对局总览</h3>
        {foldable.length > 0 && (
          <MiniSwitch
            label="明细"
            checked={allOpen}
            onChange={(on) => setOpen(new Set(on ? foldable.map(({ id }) => id) : []))}
          />
        )}
      </div>
      {organizer && (
        <>
          <ColumnTitles first="组织者" />
          {card(organizer)}
        </>
      )}
      <ColumnTitles first="玩家" />
      {cards.map(card)}
    </div>
  );
}
