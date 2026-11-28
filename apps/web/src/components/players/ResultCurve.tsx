import {
  type Cents,
  CURRENCIES,
  cents,
  type GameSummary,
  multiply,
  playerCurve,
  playerReport,
} from "@holdem-knight/core";
import { Check, ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { Modal } from "@/components/insurance/Modal";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { formatGameMoney } from "@/lib/currency";
import { blindsKey, filterChoices, type IncomeFilter, ratioKey } from "@/lib/income-filter";
import { useCountUp, useEntered } from "@/lib/motion";
import { ResultHead } from "./ResultHead";

type Money = (value: Cents, signed?: boolean) => string;

const toneOf = (value: number) => (value > 0 ? "text-win" : value < 0 ? "text-loss" : "");

const parts = (day: string) => day.split("-").map(Number) as [number, number, number];
const dayName = (day: string) => t.me.income.day(parts(day)[1], parts(day)[2]);
const shortDay = (day: string) => `${parts(day)[1]}/${parts(day)[2]}`;
const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const toDay = (year: number, month: number, date: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;

/**
 * A day from its year, month and day as typed in three fields: `2026-11-18`. Nothing where a part
 * is not a whole number, the year is not four digits, or the day is not on the calendar.
 */
export function composeDay(year: string, month: string, date: string): string | undefined {
  const typed = [year, month, date].map((part) => part.trim());
  if (!typed.every((part) => /^\d+$/.test(part)) || typed[0]?.length !== 4) return undefined;
  const [y, m, d] = typed.map(Number) as [number, number, number];
  if (m < 1 || m > 12 || d < 1 || d > daysIn(y, m)) return undefined;
  return toDay(y, m, d);
}

/**
 * Round amounts to mark an axis with, about three steps of them, from at or under the lowest
 * value to at or over the highest. Each step is 1, 2 or 5 times a power of ten, in cents.
 */
export function axisTicks(low: number, high: number): number[] {
  // Amounts are in cents: no step is finer than one whole unit
  const rough = Math.max((high - low) / 3, 100);
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 5, 10].find((m) => m * power >= rough) ?? 10) * power;
  const ticks = [Math.floor(low / step) * step];
  // Up to the first mark at or over the highest value, and two marks at the least
  while ((ticks.at(-1) ?? 0) < high || ticks.length < 2) ticks.push((ticks.at(-1) ?? 0) + step);
  return ticks;
}

/**
 * A smooth line through points that never overshoots them: between two games the curve stays
 * between their values, so it shows no gain or loss that was not there (a monotone cubic).
 */
function smoothPath(points: readonly (readonly [number, number])[]): string {
  if (points.length < 3) {
    return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");
  }
  const slopes = points.slice(1).map(([x, y], i) => {
    const [px, py] = points[i] as readonly [number, number];
    return (y - py) / (x - px);
  });
  const tangents = points.map((_, i) => {
    const before = slopes[i - 1];
    const after = slopes[i];
    if (before === undefined) return after ?? 0;
    if (after === undefined) return before;
    // Flat at a peak or a dip, and never steeper than either side allows
    if (before * after <= 0) return 0;
    return (2 * before * after) / (before + after);
  });
  return points
    .map(([x, y], i) => {
      if (i === 0) return `M${x} ${y}`;
      const [px, py] = points[i - 1] as readonly [number, number];
      const third = (x - px) / 3;
      return `C${px + third} ${py + (tangents[i - 1] ?? 0) * third} ${x - third} ${
        y - (tangents[i] ?? 0) * third
      } ${x} ${y}`;
    })
    .join(" ");
}

/**
 * The days and the tick each player's curve was left with, kept while the app is open so the page
 * is as it was left when it is come back to from a game.
 */
const left = new Map<
  string,
  { from: string | undefined; to: string | undefined; withCharges: boolean }
>();

/**
 * The player's running result, game by game, from one day to another: from their first game to
 * now until other days are picked after the title. It is narrowed by the currency, ratio and
 * blinds the page's bar has chosen, as the card over it is. Under the title what the stretch came to, what it came
 * to after the charges paid in it, whose tick draws that as a second line, and the charges. The axes are
 * marked with a few amounts and days, and the line ends in a dot at where the player stands. The
 * curve is drawn again from the left whenever its days or its games change.
 */
export function ResultCurve({
  preview = false,
  ...props
}: CurveProps & {
  /**
   * As a preview inside a link to the player's page: the same card from the first game to now in
   * the default currency, its title as text with the currency's mark, and no control in it. It
   * neither reads nor keeps how the curve was left, and is narrowed by nothing.
   */
  preview?: boolean;
}) {
  return preview ? <CurveCard {...props} /> : <KeptCurve {...props} />;
}

interface CurveProps {
  playerId: string;
  /** Every settled game the player was in */
  summaries: readonly GameSummary[];
  today: string;
  /** The games the page's bar narrows to. Missing for the default currency and any ratio and blinds */
  filter?: IncomeFilter;
}

/** The days picked and the tick, as the player's page keeps them. */
interface Kept {
  readonly from: string | undefined;
  readonly setFrom: (day: string | undefined) => void;
  readonly to: string | undefined;
  readonly setTo: (day: string | undefined) => void;
  readonly withCharges: boolean;
  readonly setWithCharges: (on: boolean) => void;
}

/** The curve of the player's page, as it was left. */
function KeptCurve(props: CurveProps) {
  const { playerId } = props;
  // A day picked, or missing for the first game and for now
  const [from, setFrom] = useState(() => left.get(playerId)?.from);
  const [to, setTo] = useState(() => left.get(playerId)?.to);
  const [withCharges, setWithCharges] = useState(() => left.get(playerId)?.withCharges ?? false);
  left.set(playerId, { from, to, withCharges });
  return <CurveCard {...props} kept={{ from, setFrom, to, setTo, withCharges, setWithCharges }} />;
}

function CurveCard({
  playerId,
  summaries,
  today,
  filter,
  kept,
}: CurveProps & {
  /** Missing for the preview: from the first game to now, no second line */
  kept?: Kept;
}) {
  const view: Partial<IncomeFilter> = (kept && filter) || {};
  const from = kept?.from;
  const to = kept?.to;
  const withCharges = kept?.withCharges ?? false;
  const [picking, setPicking] = useState<"from" | "to">();
  const fill = useId();

  // The currencies the player has games in, in the app's own order. Panda points come up first
  const currencies = CURRENCIES.filter((c) => summaries.some((s) => s.currency === c));
  const currency =
    view.currency && currencies.includes(view.currency)
      ? view.currency
      : (currencies.find((c) => c === "CNY") ?? currencies[0] ?? "CNY");
  // A ratio or blinds kept from before that the player's games do not have counts as no choice
  const offered = filterChoices(summaries, currency);
  const ratio = offered.ratios.find(({ value }) => value === view.ratio)?.value;
  const blinds = offered.blinds.find(({ value }) => value === view.blinds)?.value;
  const narrowed = summaries.filter(
    (s) =>
      s.currency === currency &&
      (!ratio || ratioKey(s) === ratio) &&
      (!blinds || blindsKey(s) === blinds),
  );
  const money: Money = (value, signed = false) =>
    formatGameMoney(value, currency, signed ? "exceptZero" : "auto");

  const points = playerCurve(playerReport(narrowed, playerId, currency).games);
  const earliest = points[0]?.summary.day ?? today;
  const start = points.findIndex(({ summary }) => summary.day >= (from ?? earliest));
  const shown =
    start < 0 ? [] : points.slice(start).filter(({ summary }) => summary.day <= (to ?? today));
  // The stretch starts from nothing: what was won before it is no part of it
  const before = start > 0 ? points[start - 1] : undefined;
  const end = shown.at(-1);
  const totals = [0, ...shown.map((point) => point.total - (before?.total ?? 0))];
  const afters = [0, ...shown.map((point) => point.afterCharges - (before?.afterCharges ?? 0))];
  const result = cents(totals.at(-1) ?? 0);
  const after = cents(afters.at(-1) ?? 0);
  const wage = cents((end?.wage ?? 0) - (before?.wage ?? 0));
  const tableFee = cents((end?.tableFee ?? 0) - (before?.tableFee ?? 0));
  // Whole amounts on the way, and the cents only of the amount arrived at
  const whole = (running: Cents, arrived: Cents) =>
    running === arrived ? arrived : cents(Math.round(running / 100) * 100);
  // A game is won where the running total rose over it
  const won = totals.filter((total, i) => i > 0 && total > (totals[i - 1] ?? 0)).length;

  // Drawn afresh for other days or other games, and the figures run to their new values
  const drawKey = [from, to, currency, ratio, blinds].join();
  const drawn = useEntered(drawKey);
  const resultShown = cents(Math.round(useCountUp(result, { duration: 700 })));
  const afterShown = cents(Math.round(useCountUp(after, { duration: 700 })));

  // Both lines have their room whether the second shows or not, so ticking it moves nothing
  const values = [...totals, ...afters];
  const ticks = axisTicks(Math.min(0, ...values), Math.max(0, ...values));
  const [low, high] = [ticks[0] ?? 0, ticks.at(-1) ?? 1];
  // In a box 100 wide and 100 tall, which the chart stretches to its own shape
  const x = (index: number) => (index / Math.max(1, totals.length - 1)) * 100;
  const y = (value: number) => ((high - value) / (high - low)) * 100;
  const line = (series: readonly number[]) =>
    smoothPath(series.map((value, i) => [x(i), y(value)] as const));
  const tone = toneOf(result) || "text-muted";
  const middle = shown[Math.floor((shown.length - 1) / 2)];
  const revealClass =
    "transition-[clip-path] ease-out motion-reduce:transition-none [clip-path:inset(-1rem_100%_-1rem_0)]";
  const revealed = "[clip-path:inset(-1rem_-1rem_-1rem_0)]";

  return (
    <section
      className={cn(kept && "mt-3", "rounded-2xl border border-line bg-surface px-4 pt-1 pb-3")}
    >
      {kept ? (
        // The title, then from which day to which: a tap on either opens the days to pick from
        <div className="flex min-w-0 items-center text-sm">
          <h2 className="shrink-0 text-muted">{t.players.playerPage.curve}</h2>
          <span className="mx-1.5 text-muted" aria-hidden>
            ·
          </span>
          <DayButton label={t.players.playerPage.rangeStart} onClick={() => setPicking("from")}>
            {dayName(from ?? earliest)}
          </DayButton>
          <span className="mx-1.5 text-muted">{t.players.playerPage.to}</span>
          <DayButton label={t.players.playerPage.rangeEnd} onClick={() => setPicking("to")}>
            {to ? dayName(to) : t.players.playerPage.now}
          </DayButton>
        </div>
      ) : (
        // As text: the whole card is one link, so nothing in it is a target of its own
        <div className="flex min-h-11 min-w-0 items-center text-sm">
          <h2 className="shrink-0 text-muted">{t.players.playerPage.curve}</h2>
          <span className="mx-1.5 text-muted" aria-hidden>
            ·
          </span>
          <span className="truncate font-medium">
            {t.me.playerFace.sinceFirst(dayName(earliest))}
          </span>
          <CurrencyIcon currency={currency} className="ml-2 size-4.5 shrink-0 text-muted" />
        </div>
      )}

      {/* Right under the title, laid out as the card over this one is */}
      <ResultHead
        result={result}
        shown={whole(resultShown, result)}
        games={shown.length}
        won={won}
        average={shown.length > 0 ? multiply(result, 1 / shown.length, "half-up") : cents(0)}
        wage={wage}
        tableFee={tableFee}
        money={money}
      />
      {/* Always there on the player's page. Its tick draws it as a second line */}
      {kept && (
        <button
          type="button"
          aria-pressed={withCharges}
          aria-label={t.players.playerPage.showAfterCharges}
          onClick={() => kept.setWithCharges(!withCharges)}
          className="-mb-1 flex min-h-11 items-center gap-2 text-sm"
        >
          <span className="text-muted">{t.players.playerPage.afterCharges}</span>
          <span className="text-highlight tabular-nums">
            {money(whole(afterShown, after), true)}
          </span>
          <span
            className={cn(
              "grid size-5 place-items-center rounded-md border transition-colors",
              withCharges ? "border-highlight bg-highlight text-accent-text" : "border-muted",
            )}
          >
            {withCharges && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
          </span>
        </button>
      )}

      {shown.length === 0 ? (
        <p className="grid h-36 place-items-center text-sm text-muted">
          {t.players.playerPage.noGames}
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-[3rem_1fr] grid-rows-[8rem_1.25rem] gap-x-1.5">
          {/* A few round amounts up the side */}
          <div className="relative text-[11px] text-muted tabular-nums" aria-hidden>
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute right-0 -translate-y-1/2 whitespace-nowrap"
                style={{ top: `${y(tick)}%` }}
              >
                {money(cents(tick))}
              </span>
            ))}
          </div>
          <div className="relative">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 size-full overflow-visible"
              aria-hidden
            >
              {ticks.map((tick) => (
                <line
                  key={tick}
                  x1="0"
                  x2="100"
                  y1={y(tick)}
                  y2={y(tick)}
                  vectorEffect="non-scaling-stroke"
                  strokeWidth="1"
                  // The line of nothing won or lost stands out from the rest
                  className={tick === 0 ? "stroke-muted/70" : "stroke-line"}
                  strokeDasharray={tick === 0 ? undefined : "2 4"}
                />
              ))}
            </svg>
            {/* Made again for other days or games, so it is drawn from the left each time */}
            <div
              key={drawKey}
              className={cn("absolute inset-0 duration-1000", revealClass, drawn && revealed)}
            >
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                role="img"
                aria-label={t.players.playerPage.curve}
                className={cn("size-full overflow-visible", tone)}
              >
                <defs>
                  <linearGradient id={fill} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
                    <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Shaded between the line and nothing won or lost */}
                <path d={`${line(totals)} L100 ${y(0)} L0 ${y(0)} Z`} fill={`url(#${fill})`} />
                <path
                  d={line(totals)}
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                  strokeWidth="2"
                  strokeLinecap="round"
                  stroke="currentColor"
                />
              </svg>
              {/* Where the player stands at the end of the stretch */}
              <span
                className={cn(
                  "absolute right-0 size-2.5 translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-current",
                  tone,
                )}
                style={{ top: `${y(result)}%` }}
                aria-hidden
              />
            </div>
            {/* The line after charges is drawn in from the left when ticked, and back out again */}
            <div
              key={`${drawKey}charges`}
              className={cn(
                "absolute inset-0 duration-700",
                revealClass,
                withCharges && drawn && revealed,
              )}
              aria-hidden
            >
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="size-full overflow-visible"
                aria-hidden
              >
                <path
                  d={line(afters)}
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  strokeLinecap="round"
                  className="stroke-highlight"
                />
              </svg>
              <span
                className="absolute right-0 size-2 translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-highlight"
                style={{ top: `${y(after)}%` }}
              />
            </div>
          </div>
          <span />
          {/* A few days along the foot: the first game, one in the middle and the last */}
          <div
            className="flex items-end justify-between text-[11px] text-muted tabular-nums"
            aria-hidden
          >
            <span>{shown[0] && shortDay(shown[0].summary.day)}</span>
            {shown.length > 2 && middle && <span>{shortDay(middle.summary.day)}</span>}
            {shown.length > 1 && end && <span>{shortDay(end.summary.day)}</span>}
          </div>
        </div>
      )}

      {kept && picking && (
        <DayDialog
          title={
            picking === "from" ? t.players.playerPage.rangeStart : t.players.playerPage.rangeEnd
          }
          day={(picking === "from" ? from : to) ?? (picking === "from" ? earliest : today)}
          years={[parts(earliest)[0], parts(today)[0]]}
          // The stretch cannot end before it starts
          {...(picking === "from" ? { notAfter: to ?? today } : { notBefore: from ?? earliest })}
          reset={picking === "from" ? t.players.playerPage.earliest : t.players.playerPage.now}
          onPick={(day) => {
            if (picking === "from") kept.setFrom(day);
            else kept.setTo(day);
            setPicking(undefined);
          }}
          onClose={() => setPicking(undefined)}
        />
      )}
    </section>
  );
}

/** A day shown as text with a chevron, which opens the days to pick from. */
function DayButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={`${label}${t.common.colon}${children}`}
      onClick={onClick}
      className="flex min-h-11 items-center gap-1 font-medium"
    >
      {children}
      <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
    </button>
  );
}

/**
 * One part of a day, typed or picked. A tap on the number selects it all for typing over; a tap
 * on the chevron opens the list. The list is the device's own, laid unseen over the chevron.
 */
function PartField({
  label,
  unit,
  value,
  options,
  invalid,
  onChange,
}: {
  label: string;
  /** After the number, such as 年 */
  unit: string;
  value: string;
  options: readonly number[];
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className={cn(
        "flex min-h-11 items-center rounded-xl border bg-surface pl-2 focus-within:border-highlight",
        invalid ? "border-loss" : "border-line",
      )}
    >
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
        aria-invalid={invalid || undefined}
        value={value}
        onFocus={(event) => event.target.select()}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-0 min-w-0 flex-1 bg-transparent text-text tabular-nums outline-none"
      />
      <span className="shrink-0 text-xs text-muted">{unit}</span>
      <span className="relative grid h-11 w-8 shrink-0 place-items-center">
        <ChevronDown className="size-4 text-muted" aria-hidden />
        <select
          aria-label={label}
          tabIndex={-1}
          // Empty while what is typed is not one of the choices
          value={options.includes(Number(value)) ? Number(value) : ""}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 size-full opacity-0"
        >
          <option value="" disabled />
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </span>
    </div>
  );
}

/**
 * Picks a day by its year, month and day, each typed or picked from a list. A day that is not on
 * the calendar, or on the wrong side of the other end of the stretch, says so and cannot be
 * confirmed.
 */
function DayDialog({
  title,
  day,
  years,
  notBefore,
  notAfter,
  reset,
  onPick,
  onClose,
}: {
  title: string;
  day: string;
  /** The first and the last year on offer */
  years: readonly [number, number];
  notBefore?: string;
  notAfter?: string;
  /** What the button that goes back to the day picked by itself says */
  reset: string;
  /** Called with nothing for the day picked by itself */
  onPick: (day: string | undefined) => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState(() => parts(day).map(String) as [string, string, string]);
  const [year, month, date] = typed;
  const picked = composeDay(year, month, date);
  const issue =
    picked === undefined
      ? t.players.playerPage.dayInvalid
      : notBefore !== undefined && picked < notBefore
        ? t.players.playerPage.dayBeforeStart
        : notAfter !== undefined && picked > notAfter
          ? t.players.playerPage.dayAfterEnd
          : undefined;
  const range = (first: number, last: number) =>
    Array.from({ length: last - first + 1 }, (_, i) => first + i);
  // As many days as the month typed has, or the most a month can have while it is not one
  const monthDays =
    /^\d{4}$/.test(year.trim()) && Number(month) >= 1 && Number(month) <= 12
      ? daysIn(Number(year), Number(month))
      : 31;
  const bad = picked === undefined;

  return (
    <Modal title={title} onClose={onClose}>
      <div className="grid grid-cols-3 gap-2">
        <PartField
          label={t.players.playerPage.year}
          unit={t.players.playerPage.year}
          value={year}
          options={range(years[0], years[1])}
          invalid={bad}
          onChange={(value) => setTyped([value, month, date])}
        />
        <PartField
          label={t.players.playerPage.month}
          unit={t.players.playerPage.month}
          value={month}
          options={range(1, 12)}
          invalid={bad}
          onChange={(value) => setTyped([year, value, date])}
        />
        <PartField
          label={t.players.playerPage.date}
          unit={t.players.playerPage.date}
          value={date}
          options={range(1, monthDays)}
          invalid={bad}
          onChange={(value) => setTyped([year, month, value])}
        />
      </div>
      {/* Its room is kept, so the buttons do not move as it comes and goes */}
      <p role="alert" className="min-h-6 pt-1 text-xs text-loss">
        {issue}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onPick(undefined)}
          className="min-h-11 rounded-xl border border-line px-2 text-sm font-medium"
        >
          {reset}
        </button>
        <button
          type="button"
          disabled={issue !== undefined}
          onClick={() => onPick(picked)}
          className="min-h-11 rounded-xl bg-accent px-2 text-sm font-medium text-accent-text disabled:opacity-50"
        >
          {t.common.confirm}
        </button>
      </div>
    </Modal>
  );
}
