import {
  type Cents,
  type ChargeWaiver,
  cents,
  chargeStatuses,
  chargesFrom,
  chipsToCents,
  type Game,
  gameRecord,
  type LedgerEvent,
  summarizeByPlayer,
} from "@holdem-knight/core";
import { ChevronRight } from "lucide-react";
import { type FormEvent, useState } from "react";
import { formatSeatTime, gameMinuteOfDay } from "@/lib/charges";
import { formatSignedChips, netColor } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { formatGameAmount, formatGameMoney } from "@/lib/currency";
import { FormDialog } from "./FormDialog";
import {
  ColumnTitles,
  columnsClass,
  Line,
  labelClass,
  type ResultLine,
  TotalChip,
} from "./ResultCards";

/** A record longer than this starts folded. */
const MAX_OPEN_RECORDS = 8;

/** What happened, in the color it is told apart by. */
const ACTIONS = {
  sit: ["上桌", "text-highlight"],
  add: ["补码", "text-win"],
  back: ["退码", "text-loss"],
  away: ["离桌", "text-muted"],
  return: ["回桌", "text-muted"],
  settle: ["结算", "text-highlight"],
} as const;

interface RecordRow {
  readonly id: string;
  readonly action: keyof typeof ACTIONS;
  /** The Buy-ins this row moved. */
  readonly moved?: string;
  /** Missing on the row for the settlement being confirmed. */
  readonly at?: number;
  /** Buy-ins held after the row, where it changes them. */
  readonly total?: string;
}

interface LeaveDialogProps {
  game: Game;
  events: readonly LedgerEvent[];
  playerId: string;
  name: string;
  saving: boolean;
  saveFailed: boolean;
  /** Lets the player off a charge, or charges it again, as on the settlement page. */
  onWaive: (key: ChargeWaiver, waived: boolean) => void;
  /** `leftAt` is when the dialog opened, so the charges shown are the charges made. */
  onSubmit: (chips: number, leftAt: number) => void;
  onClose: () => void;
}

/**
 * A player's result before they leave the table, as their card on the settlement page: chips and
 * cash, their Buy-in record, the time sat with the wages and table fee it comes to, and the total.
 * The Buy-ins and chips are the ones on the game page, which is where they are changed. The charges
 * are worked out once, for the moment the dialog opened, and stay still while it is open. Closing
 * it without leaving changes nothing, so the time goes on counting.
 */
export function LeaveDialog({
  game,
  events,
  playerId,
  name,
  saving,
  saveFailed,
  onWaive,
  onSubmit,
  onClose,
}: LeaveDialogProps) {
  const { handChips, chipRatio: ratio, currency } = game;
  const [openedAt] = useState(Date.now);
  const player = summarizeByPlayer(events).find((p) => p.playerId === playerId);
  const boughtChips = player?.boughtChips ?? 0;
  const chips = player?.stackChips ?? 0;
  const net = chips + (player?.cashedOutChips ?? 0) - boughtChips;
  const cash = chipsToCents(net, ratio);
  const money = (value: Cents) => formatGameMoney(value, currency);
  /** Buy-ins where the game counts them, chips where it does not. */
  const count = (value: number) =>
    handChips === undefined ? value.toLocaleString("zh-CN") : String(value / handChips);

  // Charged as of the moment the dialog opened, which is also when the player is recorded leaving
  const statuses =
    game.tableFee || game.wage
      ? chargeStatuses(game, events, { now: openedAt, minuteOfDay: gameMinuteOfDay(game) })
      : [];
  const status = statuses.find((s) => s.playerId === playerId);
  // Wages first, then the table fee, as on the settlement page
  const charges = chargesFrom(game, statuses)
    .filter((c) => c.playerId === playerId)
    .toSorted((x, y) => Number(x.kind === "table_fee") - Number(y.kind === "table_fee"));
  const due = charges.filter((c) => !c.waived).reduce((total, c) => total + c.amount, 0);
  const billedMinutes = status?.wageParts.reduce((all, part) => all + part.minutes, 0) ?? 0;

  const chargeLines = charges.map((charge): ResultLine => {
    const { kind, part, hourly, minutes, amount, waived } = charge;
    const label =
      kind === "table_fee"
        ? `台费 ${money(amount)}/人`
        : hourly === undefined || minutes === undefined
          ? "工资"
          : `工资 ${money(hourly)}/时 × ${formatSeatTime(minutes * 60_000)}`;
    return {
      key: `${kind}-${part ?? ""}`,
      label,
      amount: cents(-amount),
      tone: "charge",
      waiver: {
        waived,
        disabled: saving,
        onChange: (off) => onWaive(part ? { playerId, kind, part } : { playerId, kind }, off),
      },
    };
  });
  const { tableFee } = game;
  const shortFee: ResultLine[] =
    tableFee && status && !charges.some((c) => c.kind === "table_fee")
      ? [
          {
            key: "table_fee",
            label: `台费 ${money(tableFee.amount)}/人 · 未满 ${tableFee.minMinutes} 分钟`,
            tone: "charge",
          },
        ]
      : [];

  // The Buy-in record: sitting down, topping up, handing back, and time away that ended in a return
  const entries = gameRecord(events).filter((entry) => entry.playerId === playerId);
  let held = 0;
  const rows: RecordRow[] = entries.flatMap((entry, index): RecordRow[] => {
    const { id, kind, chips: moved, occurredAt: at } = entry;
    const change = count(moved);
    switch (kind) {
      case "buy_in":
        held += moved;
        return [{ id, at, action: "sit", moved: change, total: count(held) }];
      case "rebuy":
        held += moved;
        return [{ id, at, action: "add", moved: change, total: count(held) }];
      case "reduce":
      case "remove":
        held -= moved;
        return [{ id, at, action: "back", moved: change, total: count(held) }];
      case "cash_out":
        // A leave still in effect is a settlement, which has its own row
        return entries[index + 1]?.kind === "return" ? [{ id, at, action: "away" }] : [];
      case "return":
        return [{ id, at, action: "return" }];
      default:
        // Stack changes and insurance are in the game record, not the Buy-in record
        return [];
    }
  });
  // The settlement being confirmed closes the record, with the chips taken out and their value
  const settleRow: RecordRow = { id: "settle", action: "settle", total: count(boughtChips) };
  const timesBought = rows.filter((r) => r.action === "sit" || r.action === "add").length;
  const [recordOpen, setRecordOpen] = useState(rows.length <= MAX_OPEN_RECORDS);

  /** The day shows on the first row and again on the first row of each later day. */
  function dayOf(row: RecordRow, previous: RecordRow | undefined) {
    if (row.at === undefined) return "";
    const day = new Date(row.at).getDate();
    const before = previous?.at === undefined ? undefined : new Date(previous.at).getDate();
    return day === before ? "" : `${day}日`;
  }

  function timeOf({ at }: RecordRow) {
    if (at === undefined) return "";
    const time = new Date(at);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${pad(time.getHours())}:${pad(time.getMinutes())}`;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(chips, openedAt);
  }

  return (
    <FormDialog
      title="结算并下桌"
      submitLabel="确认下桌"
      wide
      saving={saving}
      saveFailed={saveFailed}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <div className="flex flex-col gap-1">
        <ColumnTitles first="玩家" />
        <section
          aria-label={name}
          className="overflow-hidden rounded-xl border border-line text-sm"
        >
          <div className={cn(columnsClass, "min-h-11 bg-accent/15 px-2")}>
            <span className="truncate font-medium">{name}</span>
            <span className="text-center">
              {handChips === undefined ? "—" : boughtChips / handChips}
            </span>
            <span className="text-right">{chips.toLocaleString("zh-CN")}</span>
            <span className={cn("text-right", netColor(net))}>{formatSignedChips(net)}</span>
            <span className={cn("text-right whitespace-nowrap", netColor(cash))}>
              {formatGameAmount(cash, currency, cash === 0 ? "auto" : "exceptZero")}
            </span>
          </div>
          <div className="@container px-2">
            {/*
              The record's lines sit in the card's columns: Buy-ins under Buy-in, chips under 筹码.
              A card under 21.625rem, on the smallest phones, has no room for a line's time before
              the Buy-in column, so the time moves to the 水上/下 column, which these lines leave empty.
            */}
            <button
              type="button"
              aria-expanded={recordOpen}
              onClick={() => setRecordOpen(!recordOpen)}
              className={cn(columnsClass, "min-h-7 w-full text-left text-xs text-muted")}
            >
              <span className="flex items-center gap-2 whitespace-nowrap">
                <ChevronRight
                  className={cn("size-4 shrink-0 transition-transform", recordOpen && "rotate-90")}
                  aria-hidden
                />
                <span>
                  共 {timesBought} 次<span className="hidden @[21.625rem]:inline">带入</span>
                </span>
              </span>
              <span className="text-center">
                {handChips === undefined ? "—" : count(boughtChips)}
              </span>
              <span className="text-right">{boughtChips.toLocaleString("zh-CN")}</span>
              <span />
              <span className="text-right whitespace-nowrap">
                {formatGameAmount(chipsToCents(boughtChips, ratio), currency)}
              </span>
            </button>
            {recordOpen && (
              <ul className="pb-1 text-xs">
                {[...rows, settleRow].map((row, index, all) => {
                  const [action, tone] = ACTIONS[row.action];
                  const settling = row.action === "settle";
                  return (
                    <li key={row.id} className={cn(columnsClass, "min-h-6")}>
                      {/* The day takes the arrow's place and the time keeps its space when empty */}
                      <span className="flex items-center whitespace-nowrap">
                        <span className="w-6 shrink-0 text-[0.6875rem] tracking-tight text-muted">
                          {dayOf(row, all[index - 1])}
                        </span>
                        <span className="hidden w-10 shrink-0 pr-1 text-right text-muted @[21.625rem]:block">
                          {timeOf(row)}
                        </span>
                        <span className={cn("font-medium", tone)}>{action}</span>
                        {row.moved && <span className="pl-1">{row.moved}</span>}
                      </span>
                      <span className="text-center">
                        {handChips === undefined ? "" : row.total}
                      </span>
                      <span className="text-right">
                        {settling && chips.toLocaleString("zh-CN")}
                      </span>
                      <span className="text-right text-muted @[21.625rem]:invisible">
                        {timeOf(row)}
                      </span>
                      <span className="text-right whitespace-nowrap">
                        {settling && formatGameAmount(chipsToCents(chips, ratio), currency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {status && (
              <p className="flex min-h-7 items-center pl-6 text-xs text-muted">
                在桌 {formatSeatTime(status.seatedMs)}
                {game.wage && ` · 计费 ${formatSeatTime(billedMinutes * 60_000)}`}
              </p>
            )}
            {[...chargeLines, ...shortFee].map((line) => (
              <Line key={line.key} line={line} currency={currency} />
            ))}
            <div className={cn(columnsClass, "min-h-11 border-t border-accent")}>
              <span className={cn(labelClass, "font-semibold")}>合计</span>
              <span className="text-right whitespace-nowrap">
                <TotalChip total={cents(cash - due)} currency={currency} />
              </span>
            </div>
          </div>
        </section>
      </div>
    </FormDialog>
  );
}
