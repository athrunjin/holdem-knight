import { chipsToCents, type Game, gameRecord, type LedgerEvent } from "@holdem-knight/core";
import { ChevronRight, LogIn, LogOut } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/cn";
import { formatGameAmount } from "@/lib/currency";
import { columnsClass } from "./ResultCards";

/** A record longer than this starts folded. */
const MAX_OPEN_RECORDS = 8;

/** What happened, in the color it is told apart by. */
const ACTIONS = {
  sit: ["上桌", "text-highlight"],
  add: ["补码", "text-win"],
  back: ["退码", "text-loss"],
  away: ["离桌", "text-muted"],
  return: ["回桌", "text-muted"],
  out: ["带出", "text-highlight"],
} as const;

interface RecordRow {
  readonly id: string;
  readonly action: keyof typeof ACTIONS;
  readonly at: number;
  /** The Buy-ins this row moved. */
  readonly moved?: string;
  /** Buy-ins held after the row, where it changes them. */
  readonly total?: string;
}

/** Chips or cash with a mark just left of them: green for what went in, gold for what comes out. */
function Marked({ out, children }: { out?: boolean; children: ReactNode }) {
  const Icon = out ? LogOut : LogIn;
  return (
    <span className="relative inline-block">
      <Icon
        className={cn(
          "absolute top-1/2 right-full mr-0.5 size-3 -translate-y-1/2",
          out ? "text-highlight" : "text-win",
        )}
        aria-hidden
      />
      {children}
    </span>
  );
}

function timeOf(at: number) {
  const time = new Date(at);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(time.getHours())}:${pad(time.getMinutes())}`;
}

/** One line of the record, in the card's columns. The day takes the folding arrow's place. */
function RecordLine({
  row,
  previous,
  chips,
  cash,
}: {
  row: RecordRow;
  /** The line before, whose day is not repeated. */
  previous: RecordRow | undefined;
  /** Only 带出 has chips and cash. */
  chips?: ReactNode;
  cash?: ReactNode;
}) {
  const [action, tone] = ACTIONS[row.action];
  const day = new Date(row.at).getDate();
  const sameDay = previous !== undefined && day === new Date(previous.at).getDate();
  return (
    <li className={cn(columnsClass, "min-h-6")}>
      <span className="flex items-center whitespace-nowrap">
        <span className="w-6 shrink-0 text-[0.625rem] tracking-tight text-muted">
          {sameDay ? "" : `${day}日`}
        </span>
        <span className="hidden w-9.5 shrink-0 text-muted @[22.5rem]:block">{timeOf(row.at)}</span>
        <span className={cn("font-medium", tone)}>{action}</span>
        {row.moved && <span className="pl-1">{row.moved}</span>}
      </span>
      <span className="text-center">{row.total}</span>
      <span className="text-center">{chips}</span>
      <span className="text-right text-muted @[22.5rem]:invisible">{timeOf(row.at)}</span>
      <span className="text-right whitespace-nowrap">{cash}</span>
    </li>
  );
}

interface BuyInRecordProps {
  game: Pick<Game, "handChips" | "chipRatio" | "currency">;
  events: readonly LedgerEvent[];
  playerId: string;
  /** The chips a player still at the table is about to take out. Missing reads their last leave. */
  leaving?: { readonly chips: number; readonly at: number };
}

/**
 * A player's Buy-ins under their row on a settlement card: a folding line with what they bought,
 * a line for each time they sat down, topped up, handed back or stepped away, and what they took
 * out. It sits in the card's columns: Buy-ins under Buy-in, chips under 筹码, cash under 金额.
 *
 * Text starts where a charge's text does, after its box, and what happened starts one time's width
 * further in, so 带入 and 带出 line up with 上桌 and 补码. A card under 22.5rem, on phones
 * narrower than about 400px, has no room for that width before the Buy-in column, so what would
 * fill it moves to the 水上/下 column, which these lines leave empty. The card must be a container.
 */
export function BuyInRecord({ game, events, playerId, leaving }: BuyInRecordProps) {
  const { handChips, chipRatio: ratio, currency } = game;
  /** Buy-ins where the game counts them, chips where it does not. */
  const count = (value: number) =>
    handChips === undefined ? value.toLocaleString("zh-CN") : String(value / handChips);
  const cash = (chips: number) => formatGameAmount(chipsToCents(chips, ratio), currency);

  const entries = gameRecord(events).filter((entry) => entry.playerId === playerId);
  let held = 0;
  let left = leaving;
  const rows = entries.flatMap((entry, index): RecordRow[] => {
    const { id, kind, chips, occurredAt: at } = entry;
    const moved = count(chips);
    switch (kind) {
      case "buy_in":
        held += chips;
        return [{ id, at, action: "sit", moved, total: count(held) }];
      case "rebuy":
        held += chips;
        return [{ id, at, action: "add", moved, total: count(held) }];
      case "reduce":
      case "remove":
        held -= chips;
        return [{ id, at, action: "back", moved, total: count(held) }];
      case "cash_out":
        // A leave still in effect is what the player took out, which closes the record
        if (entries[index + 1]?.kind === "return") return [{ id, at, action: "away" }];
        left ??= { chips, at };
        return [];
      case "return":
        return [{ id, at, action: "return" }];
      default:
        // Stack changes and insurance are in the game record, not the Buy-in record
        return [];
    }
  });
  const timesBought = rows.filter((r) => r.action === "sit" || r.action === "add").length;
  const [open, setOpen] = useState(rows.length <= MAX_OPEN_RECORDS);
  const times = (
    <>
      共<span className="px-0.5">{timesBought}</span>次
    </>
  );

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn(columnsClass, "min-h-7 w-full text-left text-xs text-muted")}
      >
        <span className="flex items-center whitespace-nowrap">
          <span className="flex w-6 shrink-0">
            <ChevronRight
              className={cn("size-4 transition-transform", open && "rotate-90")}
              aria-hidden
            />
          </span>
          <span className="hidden min-w-9.5 shrink-0 pr-0.5 @[22.5rem]:block">{times}</span>
          <span className="font-medium text-win">带入</span>
        </span>
        <span className="text-center">{handChips === undefined ? "—" : count(held)}</span>
        <span className="text-center">
          <Marked>{held.toLocaleString("zh-CN")}</Marked>
        </span>
        <span className="text-right @[22.5rem]:invisible">{times}</span>
        <span className="text-right whitespace-nowrap">
          <Marked>{cash(held)}</Marked>
        </span>
      </button>
      <ul className="pb-1 text-xs">
        {open &&
          rows.map((row, index) => (
            <RecordLine key={row.id} row={row} previous={rows[index - 1]} />
          ))}
        {/* In view however the record is folded */}
        {left && (
          <RecordLine
            row={{ id: "out", action: "out", at: left.at, total: count(held) }}
            previous={rows.at(-1)}
            chips={<Marked out>{left.chips.toLocaleString("zh-CN")}</Marked>}
            cash={<Marked out>{cash(left.chips)}</Marked>}
          />
        )}
      </ul>
    </>
  );
}
