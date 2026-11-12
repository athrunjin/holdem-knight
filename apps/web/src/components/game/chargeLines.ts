import {
  type Charge,
  type ChargeWaiver,
  cents,
  type Game,
  type PlayerChargeStatus,
} from "@holdem-knight/core";
import { formatClock, formatSeatTime } from "@/lib/charges";
import { formatGameMoney } from "@/lib/currency";
import type { ResultLine } from "./ResultCards";

interface Waiving {
  /** While a save is under way, or once the game is settled. */
  readonly disabled: boolean;
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
  { disabled, onWaive, live = false }: Waiving,
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
