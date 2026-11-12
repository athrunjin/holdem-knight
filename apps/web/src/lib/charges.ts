import {
  type Charge,
  type ChargeClock,
  type Currency,
  cents,
  formatOdds,
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

export interface GameRuleLine {
  readonly label: string;
  /** Settings side by side, one array per row. */
  readonly rows: readonly (readonly string[])[];
  /** Insurance only: the whole odds table, shown on request. */
  readonly oddsHundredths?: readonly number[];
}

/** Odds for a number of outs, such as 8赔3.5. */
export const oddsText = (outs: number, hundredths: number) => `${outs}赔${formatOdds(hundredths)}`;

/** Outs whose odds a game's rules name, where the table has them. */
const SHOWN_OUTS = [1, 3, 8, 9];

/**
 * The game's insurance, table fee and wages in brief, in that order, for the top of the
 * settlement cards. Insurance names whether tie cards count, whether a hit hands back the premium,
 * and the odds for a few outs. Only wage rates some player was charged at are named, so a segment
 * the game never reached is left out.
 */
export function gameRuleLines(
  { insurance, wage, tableFee }: Pick<Game, "insurance" | "wage" | "tableFee">,
  charges: readonly Charge[],
  currency: Currency,
): GameRuleLine[] {
  const money = (amount: number) => formatGameMoney(cents(amount), currency);
  const lines: GameRuleLine[] = [];
  if (insurance) {
    const odds = SHOWN_OUTS.flatMap((outs) => {
      const hundredths = insurance.oddsHundredths[outs - 1];
      return hundredths === undefined ? [] : [oddsText(outs, hundredths)];
    });
    // The odds take a row of their own, under the two switches
    lines.push({
      label: "保险",
      rows: [
        [
          `平分牌${insurance.tieOuts === "include" ? "算" : "不算"} outs`,
          `击中${insurance.refundPremium ? "退" : "不退"}保费`,
        ],
        odds,
      ],
      oddsHundredths: insurance.oddsHundredths,
    });
  }
  if (tableFee) {
    const least = tableFee.minMinutes > 0 ? [`在桌满 ${tableFee.minMinutes} 分钟`] : [];
    lines.push({ label: "台费", rows: [[`${money(tableFee.amount)}/人`, ...least]] });
  }
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
    lines.push({ label: "工资", rows: [[...rates, ...how]] });
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

/** How a wage rule charges time, without its subject: 按每 30 分钟计费，不足 30 分钟的部分四舍五入. */
function wageUnitNote({ unitMinutes = 1, rounding, roundUp }: WageRule) {
  const length = UNIT_LENGTH[unitMinutes];
  const mode = rounding ?? (roundUp ? "up" : "down");
  const rest =
    mode === "nearest"
      ? `不足 ${length}的部分四舍五入`
      : mode === "up"
        ? `不足 ${length}按 ${length}计`
        : `不足 ${length}的部分不计`;
  return `${UNIT_CHARGE[unitMinutes]}计费，${rest}`;
}

/** What time counts toward the table fee and wages. */
export const CHARGE_CLOCK_RULE = "只计对局计时器运行期间的在桌时间";

/**
 * The game's charging rules in plain words for the players: the table fee, then how wages are
 * charged and rounded and what happens across two rates. Each line is short enough for the
 * shared image.
 */
export function chargeRuleSections(
  { wage, tableFee }: Pick<Game, "wage" | "tableFee">,
  currency: Currency,
): { title: string; lines: string[] }[] {
  const rates = (wage?.timeSegments?.length ?? 0) + (wage?.afterStartSegments?.length ?? 0);
  const sections: { title: string; lines: string[] }[] = [];
  if (tableFee) {
    const least = tableFee.minMinutes > 0 ? `，在桌满 ${tableFee.minMinutes} 分钟才收` : "";
    sections.push({
      title: "台费",
      lines: [`每人 ${formatGameMoney(cents(tableFee.amount), currency)}${least}`],
    });
  }
  if (wage) {
    const across = wage.rounding && rates > 0 ? ["一段时间跨两种时薪时，按占时较长的时薪计"] : [];
    sections.push({ title: "工资", lines: [wageUnitNote(wage), ...across] });
  }
  return sections;
}

/** The same rules as lines of their own, each naming its subject, then what time counts. */
export function chargeRuleNotes(game: Pick<Game, "wage" | "tableFee">, currency: Currency) {
  const sections = chargeRuleSections(game, currency);
  if (sections.length === 0) return [];
  const named = sections.flatMap(({ title, lines }) =>
    lines.map((line, i) => (i === 0 ? `${title}${line}` : line)),
  );
  return [...named, CHARGE_CLOCK_RULE];
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

/** Counted time as `1:02:03`. */
export function formatClock(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(seconds / 60) % 60).padStart(2, "0");
  return `${Math.floor(seconds / 3600)}:${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Time at the table as hours and minutes, e.g. 2小时05分 or 45分. */
export function formatSeatTime(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours === 0 ? `${rest}分` : `${hours}小时${String(rest).padStart(2, "0")}分`;
}
