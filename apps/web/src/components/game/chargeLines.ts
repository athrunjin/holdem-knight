import {
  type Charge,
  type ChargeWaiver,
  cents,
  type Game,
  type PlayerChargeStatus,
  sum,
} from "@holdem-knight/core";
import { formatClock, formatSeatTime } from "@/lib/charges";
import { formatGameMoney } from "@/lib/currency";
import type { ResultLine } from "./ResultCards";

interface Waiving {
  /** While a save is under way. */
  readonly disabled: boolean;
  /** Once the game is settled: the boxes look locked, and `onWaive` gets the tap to say why. */
  readonly locked?: boolean;
  readonly onWaive: (key: ChargeWaiver, waived: boolean) => void;
  /** The player is still at the table, so a table fee not yet due says how long is left. */
  readonly live?: boolean;
}

/**
 * The lines for what one player is charged, on their settlement card: the time sat, to the second,
 * and the time charged, then wages at each rate and the table fee, each with a box to let the
 * player off it. A table fee they sat too short for, or have not sat long enough for yet, shows
 * with a dash.
 */
export function chargeLines(
  game: Pick<Game, "currency" | "tableFee" | "wage">,
  statuses: readonly PlayerChargeStatus[],
  charges: readonly Charge[],
  playerId: string,
  { disabled, locked = false, onWaive, live = false }: Waiving,
): ResultLine[] {
  const { currency, tableFee, wage } = game;
  const money = (value: number) => formatGameMoney(cents(value), currency);
  const status = statuses.find((s) => s.playerId === playerId);
  if (!status) return [];

  const billedMs = status.wageParts.reduce((all, part) => all + part.minutes, 0) * 60_000;
  const time: ResultLine = {
    key: "time",
    label: `在桌 ${formatClock(status.seatedMs)}${wage ? ` · 计费 ${formatSeatTime(billedMs)}` : ""}`,
    tone: "charge",
    note: true,
  };
  const line = (charge: Charge, label: string): ResultLine => {
    const { kind, part, amount, waived } = charge;
    return {
      key: `${kind}-${part ?? ""}`,
      label,
      amount: cents(-amount),
      tone: "charge",
      group: kind === "wage" ? "工资" : "台费",
      waiver: {
        waived,
        disabled,
        locked,
        onChange: (off) => onWaive(part ? { playerId, kind, part } : { playerId, kind }, off),
      },
    };
  };
  const own = charges.filter((c) => c.playerId === playerId);
  const wages = own
    .filter((c) => c.kind === "wage")
    .map((c) =>
      line(
        c,
        c.hourly === undefined || c.minutes === undefined
          ? "工资"
          : `工资 ${money(c.hourly)}/时 × ${formatSeatTime(c.minutes * 60_000)}`,
      ),
    );
  const fee = own.find((c) => c.kind === "table_fee");
  if (fee) return [time, ...wages, line(fee, `台费 ${money(fee.amount)}/人`)];
  if (!tableFee) return [time, ...wages];
  const short = live
    ? `台费 ${money(tableFee.amount)}/人 · 未满 差 ${Math.ceil(status.tableFeeShortMs / 60_000)} 分`
    : `台费 ${money(tableFee.amount)}/人 · 未满 ${tableFee.minMinutes} 分钟`;
  return [time, ...wages, { key: "table_fee", label: short, tone: "charge", group: "台费" }];
}

/**
 * What the organizer receives from the charges, on their card on both the game page and the
 * settlement page: wages, then the table fee as its price times how many pay it. A line with
 * nothing to receive shows a dash, so both always show.
 */
export function organizerIncomeLines(
  game: Pick<Game, "currency" | "tableFee">,
  charges: readonly Charge[],
  /** False when the charges go to someone else. */
  receives = true,
): ResultLine[] {
  const due = (kind: Charge["kind"]) =>
    receives ? charges.filter((c) => c.kind === kind && !c.waived) : [];
  const line = (group: "工资" | "台费", label: string, list: readonly Charge[]): ResultLine => {
    const amount = sum(list.map((c) => c.amount));
    const shown = { key: group, label, group, tone: "charge" as const };
    return amount === 0 ? shown : { ...shown, amount };
  };
  const fees = due("table_fee");
  const price = game.tableFee && formatGameMoney(cents(game.tableFee.amount), game.currency);
  return [
    line("工资", "工资", due("wage")),
    line("台费", price ? `台费 ${price}/人 × ${fees.length}` : "台费", fees),
  ];
}
