import {
  type Charge,
  type ChargeClock,
  type Currency,
  cents,
  formatOdds,
  formatRakeNumber,
  type Game,
  type RakeAmount,
  type RakeRounding,
  type RakeRule,
  type Timestamp,
  type WagePart,
  type WageRounding,
  type WageRule,
  type WageUnitMinutes,
} from "@holdem-knight/core";
import { t } from "@/i18n";
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
  1: t.lib.charges.byTheMinute,
  15: t.lib.charges.by15Min,
  30: t.lib.charges.by30Min,
  60: t.lib.charges.perHour,
};

export const RAKE_ROUNDING_NAMES: Record<RakeRounding, string> = {
  nearest: t.lib.charges.round,
  down: t.lib.charges.roundDown,
  up: t.lib.charges.roundUp,
};

/**
 * A rake rule in short parts: the percentage, the cap, and the rounding. A rule from before rake
 * had settings rounds down to whole chips.
 */
function rakeRuleParts(rule: RakeRule): string[] {
  const { cap, roundTo, rounding } = rule;
  const amount = ({ unit, amount: value }: RakeAmount) =>
    `${formatRakeNumber(value)}${unit === "chips" ? t.lib.charges.chips : unit === "smallBlinds" ? " SB" : " BB"}`;
  return [
    t.lib.charges.ofThePot(formatRakeNumber(rule.percent)),
    cap ? t.lib.charges.cap(amount(cap)) : t.lib.charges.noCap,
    rounding === undefined || roundTo === undefined
      ? t.lib.charges.under1ChipIsDropped
      : t.lib.charges.to(amount(roundTo), RAKE_ROUNDING_NAMES[rounding]),
  ];
}

export const ROUNDING_NAMES: Record<WageRounding, string> = {
  nearest: t.lib.charges.round,
  up: t.lib.charges.roundUp,
  down: t.lib.charges.roundDown,
};

/** A rate in a few words: 基础, 22点–6点, 0点起 or 开局6小时后. */
function wagePartName(rule: WageRule, part: WagePart) {
  const hours = (from: number, to: number | undefined) =>
    to === undefined ? t.lib.charges.from00(from) : t.lib.charges.n0000(from, to);
  if (part === "base") return t.lib.charges.base;
  if (part === "adjusted") {
    const { adjustment } = rule;
    if (adjustment?.kind === "time_of_day") return hours(adjustment.fromHour, adjustment.toHour);
    return adjustment ? t.lib.charges.hrIntoTheGame(adjustment.afterHours) : t.lib.charges.adjusted;
  }
  const index = Number(part.slice(part.indexOf("-") + 1)) - 1;
  if (part.startsWith("time-")) {
    const segment = rule.timeSegments?.[index];
    return segment ? hours(segment.fromHour, segment.toHour) : part;
  }
  const segment = rule.afterStartSegments?.[index];
  return segment ? t.lib.charges.hrIntoTheGame(segment.afterHours) : part;
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
export const oddsText = (outs: number, hundredths: number) =>
  t.lib.charges.pays(outs, formatOdds(hundredths));

/** Outs whose odds a game's rules name, where the table has them. */
const SHOWN_OUTS = [1, 3, 8, 9];

/**
 * The game's insurance, wages and table fee in brief, in that order as on the line under a game
 * page's title, for the settings the settlement page shows. Insurance names whether tie cards count, whether a hit hands back the premium,
 * and the odds for a few outs. Only wage rates some player was charged at are named, so a segment
 * the game never reached is left out.
 */
export function gameRuleLines(
  { insurance, wage, tableFee, rake }: Pick<Game, "insurance" | "wage" | "tableFee" | "rake">,
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
      label: t.common.insurance,
      rows: [
        [
          t.lib.charges.tieCardsAsOuts(
            insurance.tieOuts === "include" ? t.lib.charges.count : t.lib.charges.dontCount,
          ),
          t.lib.charges.aHitThePremium(
            insurance.refundPremium ? t.lib.charges.refunds : t.lib.charges.keeps,
          ),
        ],
        odds,
      ],
      oddsHundredths: insurance.oddsHundredths,
    });
  }
  if (wage) {
    const used = new Map<WagePart, number>();
    for (const { part, hourly } of charges) {
      if (part !== undefined && hourly !== undefined) used.set(part, hourly);
    }
    if (used.size === 0) used.set("base", wage.hourly);
    const rates = [...used]
      .sort(([a], [b]) => partOrder(a).localeCompare(partOrder(b)))
      .map(([part, hourly]) => t.lib.charges.hr(wagePartName(wage, part), money(hourly)));
    const rounding = wage.rounding ?? (wage.roundUp ? "up" : "down");
    const how = [UNIT_NAMES[wage.unitMinutes ?? 1], ROUNDING_NAMES[rounding]];
    lines.push({ label: t.common.dealerWage, rows: [[...rates, ...how]] });
  }
  if (tableFee) {
    const least =
      tableFee.minMinutes > 0 ? [t.lib.charges.afterMinAtTheTable(tableFee.minMinutes)] : [];
    lines.push({
      label: t.common.timeCharge,
      rows: [[t.lib.charges.player(money(tableFee.amount)), ...least]],
    });
  }
  if (rake) lines.push({ label: t.common.rake, rows: [rakeRuleParts(rake)] });
  return lines;
}

const UNIT_LENGTH: Record<number, string> = {
  1: t.lib.charges.n1Min,
  15: t.lib.charges.n15Min,
  30: t.lib.charges.n30Min,
  60: t.lib.charges.n1Hr,
};
const UNIT_CHARGE: Record<number, string> = {
  1: t.lib.charges.byTheMinute2,
  15: t.lib.charges.by15Minutes,
  30: t.lib.charges.by30Minutes,
  60: t.lib.charges.byTheHour,
};

/** How a wage rule charges time, without its subject: 按每 30 分钟计费，不足 30 分钟的部分四舍五入. */
function wageUnitNote({ unitMinutes = 1, rounding, roundUp }: WageRule) {
  const length = UNIT_LENGTH[unitMinutes] ?? "";
  const mode = rounding ?? (roundUp ? "up" : "down");
  const rest =
    mode === "nearest"
      ? t.lib.charges.aPartUnderIsRounded(length)
      : mode === "up"
        ? t.lib.charges.aPartUnderCountsAs(length, length)
        : t.lib.charges.aPartUnderIsFree(length);
  return t.lib.charges.charged(UNIT_CHARGE[unitMinutes] ?? "", rest);
}

/** What time counts toward the table fee and wages. */
export const CHARGE_CLOCK_RULE = t.lib.charges.onlyTimeAtTheTableWhile;

/**
 * The game's charging rules in plain words for the players: how wages are charged and rounded
 * and what happens across two rates, then the table fee. Each line is short enough for the
 * shared image.
 */
export function chargeRuleSections(
  { wage, tableFee }: Pick<Game, "wage" | "tableFee">,
  currency: Currency,
): { title: string; lines: string[] }[] {
  const rates = (wage?.timeSegments?.length ?? 0) + (wage?.afterStartSegments?.length ?? 0);
  const sections: { title: string; lines: string[] }[] = [];
  if (wage) {
    const across = wage.rounding && rates > 0 ? [t.lib.charges.aBlockThatSpansTwoRates] : [];
    sections.push({ title: t.common.dealerWage, lines: [wageUnitNote(wage), ...across] });
  }
  if (tableFee) {
    const least =
      tableFee.minMinutes > 0 ? t.lib.charges.onlyAfterMinAtTheTable(tableFee.minMinutes) : "";
    sections.push({
      title: t.common.timeCharge,
      lines: [t.lib.charges.perPlayer(formatGameMoney(cents(tableFee.amount), currency), least)],
    });
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
  return hours === 0
    ? t.lib.charges.min(rest)
    : t.lib.charges.hrMin(hours, String(rest).padStart(2, "0"));
}
