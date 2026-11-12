import {
  type Charge,
  type ChargeClock,
  type Currency,
  cents,
  type Game,
  type Timestamp,
  type WagePart,
  type WageRounding,
  type WageRule,
  type WageUnitMinutes,
} from "@holdem-knight/core";
import { formatGameMoney } from "./currency";

type MinuteOfDay = ChargeClock["minuteOfDay"];

/** The device's own time of day. */
function deviceMinuteOfDay(time: Timestamp) {
  const date = new Date(time);
  return date.getHours() * 60 + date.getMinutes();
}

const zoneClocks = new Map<string, MinuteOfDay | null>();

/** Time of day in an IANA time zone, or null for a zone this device does not know. */
function zoneMinuteOfDay(timeZone: string): MinuteOfDay | null {
  const known = zoneClocks.get(timeZone);
  if (known !== undefined) return known;
  let clock: MinuteOfDay | null = null;
  try {
    const format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    clock = (time) => {
      const parts = format.formatToParts(time);
      const value = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
      return (value("hour") % 24) * 60 + value("minute");
    };
  } catch {
    // An unknown zone, for example from a backup made on a newer system
  }
  zoneClocks.set(timeZone, clock);
  return clock;
}

/** The device's IANA time zone, kept on each new game (ADR 0027). */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Time of day where the game was started, so wage rates by time of day are the same on every
 * device. A game from before zones were kept uses this device's time.
 */
export function gameMinuteOfDay({ timeZone }: Pick<Game, "timeZone">): MinuteOfDay {
  return (timeZone && zoneMinuteOfDay(timeZone)) || deviceMinuteOfDay;
}

/** Open sessions run to the settlement time, or to now before settling. */
export function chargeClock(game: Pick<Game, "settledAt" | "timeZone">): ChargeClock {
  return { now: game.settledAt ?? Date.now(), minuteOfDay: gameMinuteOfDay(game) };
}

export const UNIT_NAMES: Record<WageUnitMinutes, string> = {
  1: "精确到分",
  15: "精确到15分",
  30: "精确到30分",
  60: "每小时",
};

export const ROUNDING_NAMES: Record<WageRounding, string> = {
  nearest: "四舍五入",
  up: "向上取整",
  down: "向下取整",
};

/** A rate in a few words: 基础, 22点–6点, 0点起 or 开局6小时后. */
function wagePartName(rule: WageRule, part: WagePart) {
  const hours = (from: number, to: number | undefined) =>
    to === undefined ? `${from}点起` : `${from}点–${to}点`;
  if (part === "base") return "基础";
  if (part === "adjusted") {
    const { adjustment } = rule;
    if (adjustment?.kind === "time_of_day") return hours(adjustment.fromHour, adjustment.toHour);
    return adjustment ? `开局${adjustment.afterHours}小时后` : "调整";
  }
  const index = Number(part.slice(part.indexOf("-") + 1)) - 1;
  if (part.startsWith("time-")) {
    const segment = rule.timeSegments?.[index];
    return segment ? hours(segment.fromHour, segment.toHour) : part;
  }
  const segment = rule.afterStartSegments?.[index];
  return segment ? `开局${segment.afterHours}小时后` : part;
}

/** Base first, then rates by time of day, then by game time. */
const partOrder = (part: WagePart) =>
  part === "base" ? "0" : part === "adjusted" || part.startsWith("time-") ? `1${part}` : `2${part}`;

/**
 * The game's wage and table fee settings in brief, for the top of the settlement details. Only
 * rates some player was charged at are named, so a segment the game never reached is left out.
 */
export function chargeSettingLines(
  { wage, tableFee }: Pick<Game, "wage" | "tableFee">,
  charges: readonly Charge[],
  currency: Currency,
): { label: string; items: string[] }[] {
  const money = (amount: number) => formatGameMoney(cents(amount), currency);
  const lines: { label: string; items: string[] }[] = [];
  if (wage) {
    const used = new Map<WagePart, number>();
    for (const { part, hourly } of charges) {
      if (part !== undefined && hourly !== undefined) used.set(part, hourly);
    }
    if (used.size === 0) used.set("base", wage.hourly);
    const rates = [...used]
      .sort(([a], [b]) => partOrder(a).localeCompare(partOrder(b)))
      .map(([part, hourly]) => `${wagePartName(wage, part)} ${money(hourly)}/时`);
    const rounding = wage.rounding ?? (wage.roundUp ? "up" : "down");
    const how = [UNIT_NAMES[wage.unitMinutes ?? 1], ROUNDING_NAMES[rounding]];
    lines.push({ label: "工资", items: [...rates, ...how] });
  }
  if (tableFee) {
    const least = tableFee.minMinutes > 0 ? [`在桌满 ${tableFee.minMinutes} 分钟`] : [];
    lines.push({ label: "台费", items: [`${money(tableFee.amount)}/人`, ...least] });
  }
  return lines;
}

const UNIT_LENGTH: Record<number, string> = {
  1: "1 分钟",
  15: "15 分钟",
  30: "30 分钟",
  60: "1 小时",
};
const UNIT_CHARGE: Record<number, string> = {
  1: "按分钟",
  15: "按每 15 分钟",
  30: "按每 30 分钟",
  60: "按每小时",
};

/** How a wage rule charges time, in a line short enough for the shared image. */
function wageUnitNote({ unitMinutes = 1, rounding, roundUp }: WageRule) {
  const length = UNIT_LENGTH[unitMinutes];
  const mode = rounding ?? (roundUp ? "up" : "down");
  const rest =
    mode === "nearest"
      ? `不足 ${length}的部分四舍五入`
      : mode === "up"
        ? `不足 ${length}按 ${length}计`
        : `不足 ${length}的部分不计`;
  return `工资${UNIT_CHARGE[unitMinutes]}计费，${rest}`;
}

/**
 * The game's charging rules in plain words for the players, one short line each: how wages are
 * charged and rounded, what happens across two rates, the table fee, and what time counts.
 */
export function chargeRuleNotes(
  { wage, tableFee }: Pick<Game, "wage" | "tableFee">,
  currency: Currency,
): string[] {
  if (!wage && !tableFee) return [];
  const rates = (wage?.timeSegments?.length ?? 0) + (wage?.afterStartSegments?.length ?? 0);
  const feeNote =
    tableFee &&
    `台费每人 ${formatGameMoney(cents(tableFee.amount), currency)}${
      tableFee.minMinutes > 0 ? `，在桌满 ${tableFee.minMinutes} 分钟才收` : ""
    }`;
  return [
    ...(wage ? [wageUnitNote(wage)] : []),
    ...(wage?.rounding && rates > 0 ? ["一段时间跨两种时薪时，按占时较长的时薪计"] : []),
    ...(feeNote ? [feeNote] : []),
    "只计对局计时器运行期间的在桌时间",
  ];
}

/** Each player's table fee and wages still charged, 0 when there is none or it was waived. */
export function chargesByPlayer(charges: readonly Charge[]) {
  const byPlayer = new Map<string, { tableFee: number; wage: number }>();
  for (const { playerId, kind, amount } of charges.filter((c) => !c.waived)) {
    const current = byPlayer.get(playerId) ?? { tableFee: 0, wage: 0 };
    byPlayer.set(
      playerId,
      kind === "table_fee"
        ? { ...current, tableFee: current.tableFee + amount }
        : { ...current, wage: current.wage + amount },
    );
  }
  return byPlayer;
}

/** Time at the table as hours and minutes, e.g. 2小时05分 or 45分. */
export function formatSeatTime(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours === 0 ? `${rest}分` : `${hours}小时${String(rest).padStart(2, "0")}分`;
}
