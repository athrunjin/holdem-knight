import {
  type Cents,
  CURRENCIES,
  type Currency,
  cents,
  type Game,
  type GameSummary,
  inPeriod,
  type PeriodChoice,
  type Player,
  type PlayerGame,
  type PlayerPayments,
  type PlayerReport,
  periodOf,
  playerNumberText,
  playerPayments,
  playerReport,
  transferReport,
} from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { HistorySection } from "@/components/game/HistorySection";
import { InfoButton } from "@/components/InfoButton";
import { IncomeFilter } from "@/components/income/IncomeFilter";
import { Page } from "@/components/Page";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { ResultCurve } from "@/components/players/ResultCurve";
import { TextMenu } from "@/components/TextMenu";
import { PartyRow, TransferBack, useTransferDraft } from "@/components/transfers/TransferRows";
import { useGames } from "@/data/games";
import { usePlayers } from "@/data/players";
import { useGameSummaries } from "@/data/summaries";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { formatGameMoney } from "@/lib/currency";
import { dayOf } from "@/lib/game-day";
import { DEFAULT_HISTORY_STATE } from "@/lib/game-history";
import { blindsKey, filterChoices, ratioKey } from "@/lib/income-filter";
import { useListReturn } from "@/lib/list-return";
import { QuietMotion, useCountUp, useEntered, usePlaysIn, useQuietArrival } from "@/lib/motion";
import { periodName } from "@/lib/period-names";
import { useStoredState } from "@/lib/stored-state";

export const Route = createFileRoute("/players/$playerId")({
  component: PlayerPage,
});

const cardClass = "rounded-2xl border border-line bg-surface";

/** The latest games, however long ago: so many of them. The page opens on the last ten. */
const LASTS = { last5: 5, last10: 10 } as const;
type Last = keyof typeof LASTS;
/** The periods the page offers after them, the nearest only. */
const DATES = ["thisWeek", "lastWeek", "thisMonth", "lastMonth"] as const satisfies PeriodChoice[];
type Dates = (typeof DATES)[number];
type Shown = Last | Dates;
const SHOWN: readonly Shown[] = ["last5", "last10", ...DATES];
const isLast = (shown: Shown): shown is Last => shown in LASTS;

/** As many of the games shown as the row of bars has room for, the latest of them. */
const BARS = 20;

/** The games of this page are folded until they are asked for. */
const GAMES_FOLDED = { ...DEFAULT_HISTORY_STATE, open: false };

/** What the page shows, as it was left: the same for every player. */
interface View {
  readonly period: Shown;
  /** Missing for panda points, or the currency the player last played in */
  readonly currency?: Currency | undefined;
  /** A chip ratio or the blinds as `ratioKey` and `blindsKey` give them. Missing for any. */
  readonly ratio?: string | undefined;
  readonly blinds?: string | undefined;
}

const text = (value: unknown) => (typeof value === "string" ? value : undefined);

function parseView(stored: unknown): View | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { period, currency, ratio, blinds } = stored as Record<string, unknown>;
  const kept = SHOWN.find((choice) => choice === period);
  return (
    kept && {
      period: kept,
      currency: CURRENCIES.find((c) => c === currency),
      ratio: text(ratio),
      blinds: text(blinds),
    }
  );
}

function PlayerPage() {
  const { playerId } = Route.useParams();
  const { data: players, isPending } = usePlayers();
  const { data: summaries } = useGameSummaries();
  const { data: games } = useGames();

  if (isPending) return null;
  const player = players?.find(({ id }) => id === playerId);
  if (!player) {
    return (
      <Page title={t.players.title}>
        <p className="text-muted">{t.players.playerPage.thisPlayerCantBeFound}</p>
        <Link to="/players" className="mt-2 inline-flex min-h-11 items-center text-highlight">
          {t.players.playerPage.backToPlayers}
        </Link>
      </Page>
    );
  }

  return (
    <Page
      title={
        <span className="flex min-w-0 items-center gap-3">
          <PlayerAvatar id={player.id} name={player.name} size="lg" />
          <span className="min-w-0 truncate">{player.name}</span>
        </span>
      }
      titleNote={
        <span className="flex items-center gap-1 text-sm font-normal text-muted tabular-nums">
          {player.number !== undefined && playerNumberText(player.number)}
          <Link
            to="/players/$playerId/edit"
            params={{ playerId }}
            aria-label={t.players.playerPage.edit}
            className="grid size-11 place-items-center text-highlight"
          >
            <Pencil className="size-4" strokeWidth={1.75} aria-hidden />
          </Link>
          <InfoButton title={t.players.playerPage.result} small>
            <p className="text-sm text-muted">{t.players.playerPage.explain}</p>
          </InfoButton>
        </span>
      }
      actions={
        <Link
          to="/players"
          aria-label={t.players.playerPage.back}
          className="grid min-h-11 shrink-0 place-items-center"
        >
          {/* The emblem, as on the settlement page */}
          <img src="/emblem-on-dark.svg" alt="" className="h-12 w-auto" />
        </Link>
      }
    >
      {summaries === undefined ? (
        // While the games are read, the total's place stays empty for a moment
        <section className={cn(cardClass, "min-h-36")} />
      ) : (
        <History player={player} summaries={summaries} games={games ?? []} />
      )}
    </Page>
  );
}

type Money = (value: Cents, signed?: boolean) => string;

function History({
  player,
  summaries,
  games,
}: {
  player: Player;
  summaries: readonly GameSummary[];
  games: readonly Game[];
}) {
  const today = dayOf(Date.now());
  // Come back to from a game, the page is where it was left and nothing plays in again
  const returning = useListReturn(`/players/${player.id}`);
  const quiet = useQuietArrival(returning);
  const [view, setView] = useStoredState<View>("player.view.3", { period: "last10" }, parseView);

  // The currencies the player has games in, in the app's own order. Panda points come up first
  const played = summaries.filter((s) => s.players.some((p) => p.playerId === player.id));
  const currencies = CURRENCIES.filter((c) => played.some((s) => s.currency === c));
  const currency =
    view.currency && currencies.includes(view.currency)
      ? view.currency
      : (currencies.find((c) => c === "CNY") ?? currencies[0] ?? "CNY");
  const { period } = view;

  // A ratio or blinds kept from before that the games on offer do not have counts as no choice.
  // The latest games are taken after the filter, so what is on offer there is every game's
  const within = isLast(period)
    ? played
    : played.filter((s) => inPeriod(periodOf(period, today), s.day));
  const offered = filterChoices(within, currency);
  const ratio = offered.ratios.find(({ value }) => value === view.ratio)?.value;
  const blinds = offered.blinds.find(({ value }) => value === view.blinds)?.value;
  const narrowed = played
    .filter(
      (s) =>
        s.currency === currency &&
        (!ratio || ratioKey(s) === ratio) &&
        (!blinds || blindsKey(s) === blinds),
    )
    .toSorted((a, b) => b.startedAt - a.startedAt);

  const reportIn = (choice: Dates) =>
    playerReport(narrowed, player.id, currency, periodOf(choice, today));
  const report = isLast(period)
    ? playerReport(narrowed.slice(0, LASTS[period]), player.id, currency)
    : reportIn(period);
  const payments = playerPayments(summaries, player.id, currency);
  const money: Money = (value, signed = false) =>
    formatGameMoney(value, currency, signed ? "exceptZero" : "auto");
  const playKey = [player.id, period, currency, ratio, blinds].join();
  const change = (next: Partial<View>) => setView({ ...view, currency, ...next });

  return (
    <QuietMotion value={quiet}>
      <div className="pb-8">
        <section className={cn(cardClass, "px-4 pt-1 pb-3")}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center text-sm">
              <span className="shrink-0 text-muted">{t.players.playerPage.result}</span>
              <span className="mx-1.5 text-muted" aria-hidden>
                ·
              </span>
              {/* The latest games first, then each period with the number of games in it */}
              <TextMenu<Shown>
                label={t.me.income.period}
                options={[
                  // As many as there are, where that is fewer
                  ...(Object.keys(LASTS) as Last[]).map((last) => ({
                    value: last,
                    label: t.players.playerPage.lastGames(
                      Math.min(LASTS[last], narrowed.length) || LASTS[last],
                    ),
                  })),
                  ...DATES.map((choice) => ({
                    value: choice,
                    label: `${periodName(choice, today)} (${
                      choice === period ? report.games.length : reportIn(choice).games.length
                    })`,
                  })),
                ]}
                value={period}
                onChange={(choice) => change({ period: choice })}
                className="font-medium"
              />
            </div>
            <IncomeFilter
              applied={{ currency, ratio, blinds }}
              currencies={currencies.length > 0 ? currencies : [currency]}
              games={within}
              onApply={change}
            />
          </div>
          <Result report={report} money={money} playKey={playKey} />
        </section>

        {played.length > 0 && (
          // Narrowed by itself, apart from the card over it
          <ResultCurve key={player.id} playerId={player.id} summaries={played} today={today} />
        )}

        <Payments
          player={player}
          payments={payments}
          summaries={summaries}
          games={games}
          currency={currency}
          today={today}
        />

        {/* Folded until asked for, and narrowed and ordered as on the games page */}
        <div className="mt-5">
          <HistorySection
            games={games.filter(({ id }) => played.some((s) => s.id === id))}
            title={t.players.playerPage.gamesTitle}
            storageKey="player.history"
            initial={GAMES_FOLDED}
            playerId={player.id}
          />
        </div>
      </div>
    </QuietMotion>
  );
}

const toneOf = (value: number) => (value > 0 ? "text-win" : value < 0 ? "text-loss" : "");

/**
 * What the player won or lost over the games shown, as the page's one large figure, with its sign
 * and color. Under it how many games and how they went, a bar for each of them, and the charges
 * they paid, which are no part of the figure.
 */
function Result({
  report,
  money,
  playKey,
}: {
  report: PlayerReport;
  money: Money;
  playKey: string;
}) {
  const { games, result, won, average, wage, tableFee, share } = report;
  const playsIn = usePlaysIn(playKey);
  const shown = useCountUp(result, { duration: 800, resetKey: playKey });
  // Whole amounts on the way, and the cents only of the amount arrived at
  const figure = shown === result ? result : cents(Math.round(shown / 100) * 100);
  const charge = (label: string, amount: Cents) => (
    <span className="flex items-baseline justify-end gap-1.5">
      <span className="text-xs font-medium text-win">{label}</span>
      {money(amount)}
    </span>
  );

  return (
    <>
      {/* What they paid in charges stands beside the figure, and is no part of it */}
      <div className="flex items-end justify-between gap-3">
        <p className={cn("text-4xl font-semibold tracking-tight tabular-nums", toneOf(result))}>
          {money(figure, true)}
        </p>
        {(wage > 0 || tableFee > 0) && (
          <p className="flex shrink-0 flex-col pb-0.5 text-sm leading-tight tabular-nums">
            {wage > 0 && charge(t.common.dealerWage, wage)}
            {tableFee > 0 && charge(t.common.timeCharge, tableFee)}
          </p>
        )}
      </div>
      <p className="mt-1 text-sm text-muted tabular-nums">
        {t.players.playerPage.games(games.length)}
        {games.length > 0 && (
          <>
            {` · ${t.players.playerPage.won(won)} · `}
            {t.players.playerPage.average(money(average, true))}
          </>
        )}
      </p>
      {/* Made again for other games, so every bar grows from the line each time */}
      {games.length > 0 && <Bars key={playKey} games={games} money={money} playKey={playKey} />}
      {games.length > BARS && (
        <p className="text-right text-[11px] text-muted">{t.players.playerPage.barsShow(BARS)}</p>
      )}
      {/* Only where a difference was split with them, as 收益 has the organizer's: opening from its
          rule once the rest is in, and no part of the figure */}
      {share !== 0 && (
        <div
          key={playKey}
          className={cn("-mb-2 overflow-hidden", playsIn && "animate-unfold")}
          style={{ animationDelay: "1000ms" }}
        >
          <div className="mt-2 flex min-h-11 items-center justify-between gap-3 border-t border-line text-sm">
            <p>
              {t.players.playerPage.share}
              <span className="ml-2 text-xs text-muted">{t.players.playerPage.shareNote}</span>
            </p>
            <p className={cn("shrink-0 tabular-nums", toneOf(share))}>{money(share, true)}</p>
          </div>
        </div>
      )}
    </>
  );
}

/** The room over and under the bars for what is written at the best and the worst game, in rem */
const NOTE = 1.5;
/** How tall the bars are together, over and under the line, in rem */
const TALL = 4;

/**
 * A bar for each game shown, oldest at the left, on one line that runs the whole width: up from
 * it in green for a game won, down in red for one lost, each as tall as it is against the largest
 * among them. The line is drawn from the left first, the bars grow from it, and then a hairline
 * steps out of the best game and of the worst with its day and amount. A game that came to nothing
 * has no bar and no note, so a single game is noted once.
 */
function Bars({
  games,
  money,
  playKey,
}: {
  games: readonly PlayerGame[];
  money: Money;
  playKey: string;
}) {
  const grown = useEntered(playKey);
  const latest = games.slice(0, BARS).toReversed();
  const high = Math.max(0, ...latest.map(({ result }) => result));
  const low = Math.max(0, ...latest.map(({ result }) => -result));
  // The room under the line, as a part of what the bars have
  const under = high + low > 0 ? (low / (high + low)) * TALL : 0;
  const part = (amount: number, of: number) => `${grown && of > 0 ? (amount / of) * 100 : 0}%`;
  const best = high > 0 ? latest.findIndex(({ result }) => result === high) : -1;
  const worst = low > 0 ? latest.findIndex(({ result }) => result === -low) : -1;

  return (
    <div
      role="img"
      aria-label={t.players.playerPage.eachGame}
      className="relative mt-1"
      style={{ height: `${TALL + NOTE * 2}rem` }}
    >
      {best >= 0 && (
        <BarNote
          game={latest[best]}
          at={best}
          of={latest.length}
          side="over"
          shown={grown}
          money={money}
        />
      )}
      <ul
        className="absolute inset-x-0 flex items-stretch gap-1"
        style={{ top: `${NOTE}rem`, height: `${TALL}rem` }}
      >
        {latest.map(({ summary, result }) => (
          <li key={summary.id} className="flex min-w-0 flex-1 flex-col items-center">
            <span
              className="flex w-full max-w-4 flex-col justify-end"
              style={{ height: `${TALL - under}rem` }}
            >
              <span
                className={cn("w-full rounded-t bg-win", barClass)}
                style={{ height: part(Math.max(0, result), high) }}
              />
            </span>
            <span className="flex w-full max-w-4 flex-col" style={{ height: `${under}rem` }}>
              <span
                className={cn("w-full rounded-b bg-loss", barClass)}
                style={{ height: part(Math.max(0, -result), low) }}
              />
            </span>
          </li>
        ))}
      </ul>
      {/* One line under every bar, drawn from the left before the bars grow from it */}
      <span
        className={cn(
          "absolute inset-x-0 h-px origin-left bg-line transition-transform duration-500 ease-out motion-reduce:transition-none",
          grown ? "scale-x-100" : "scale-x-0",
        )}
        style={{ top: `${NOTE + TALL - under}rem` }}
        aria-hidden
      />
      {worst >= 0 && (
        <BarNote
          game={latest[worst]}
          at={worst}
          of={latest.length}
          side="under"
          shown={grown}
          money={money}
        />
      )}
    </div>
  );
}

/** The bars wait for the line to be drawn. */
const barClass =
  "transition-[height] delay-300 duration-500 ease-out motion-reduce:transition-none";

/**
 * What is written at the best or the worst game: a hairline out of the end of its bar, then the
 * day and the amount, sliding outward once the bars have grown. It stands over its bar, and is
 * held inside the card where the bar is near an edge.
 */
function BarNote({
  game,
  at,
  of,
  side,
  shown,
  money,
}: {
  game: PlayerGame | undefined;
  at: number;
  of: number;
  side: "over" | "under";
  shown: boolean;
  money: Money;
}) {
  if (!game) return null;
  const [, month = 1, date = 1] = game.summary.day.split("-").map(Number);
  const center = ((at + 0.5) / of) * 100;
  const over = side === "over";
  // Near an edge the words start or end at the bar. Elsewhere they are centered on it
  const hold = center < 25 ? "start" : center > 75 ? "end" : "center";

  return (
    <span
      className={cn(
        "absolute flex items-center transition-[opacity,translate] delay-700 duration-300 ease-out motion-reduce:transition-none",
        over ? "top-0 flex-col" : "bottom-0 flex-col-reverse",
        hold === "start" ? "items-start" : hold === "end" ? "items-end" : "-translate-x-1/2",
        shown ? "opacity-100" : cn("opacity-0", over ? "translate-y-1.5" : "-translate-y-1.5"),
      )}
      style={{
        height: `${NOTE}rem`,
        ...(hold === "end" ? { right: `${100 - center}%` } : { left: `${center}%` }),
      }}
      aria-hidden
    >
      <span className="text-[11px] leading-none whitespace-nowrap tabular-nums">
        <span className="text-muted">
          {month}/{date}
        </span>
        <span className={cn("ml-1", toneOf(game.result))}>{money(game.result, true)}</span>
      </span>
      {/* The hairline between the words and the end of the bar */}
      <span className="w-px flex-1 bg-muted/60" />
    </span>
  );
}

/**
 * How the player stands with the organizer now, whatever the games shown above: the transfers
 * still to make and the bad debts, each ticked and confirmed here as on 转账, and how promptly they
 * have paid. With more than one transfer the lines are folded under their total.
 */
function Payments({
  player,
  payments,
  summaries,
  games,
  currency,
  today,
}: {
  player: Player;
  payments: PlayerPayments;
  summaries: readonly GameSummary[];
  games: readonly Game[];
  currency: Currency;
  today: string;
}) {
  const { draft, disabled } = useTransferDraft(games, summaries);
  const { timed, late, averageDays } = payments;
  const withPlayer = (state: "open" | "bad") =>
    transferReport(summaries, { currency, state }).parties.find(
      ({ partyId }) => partyId === player.id,
    );
  const open = withPlayer("open");
  const bad = withPlayer("bad");
  const money = (value: Cents) => formatGameMoney(value, currency);
  const playKey = `${player.id}${currency}`;

  return (
    <section className="mt-5">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2 className="font-medium">{t.players.playerPage.payments}</h2>
        {/* Only where the time of a tick was kept is there anything to say */}
        {timed > 0 && (
          <p className="text-xs text-muted tabular-nums">
            <span className={cn(late > 0 && "text-loss")}>
              {late > 0 ? t.players.playerPage.late(late) : t.players.playerPage.neverLate}
            </span>
            {averageDays !== undefined && ` · ${t.players.playerPage.averageDays(averageDays)}`}
          </p>
        )}
      </div>
      {!open && !bad ? (
        <p className="px-1 py-2 text-sm text-muted">{t.players.playerPage.nothingBetween}</p>
      ) : (
        // A line's icon leads to its game and back to this page
        <TransferBack value={{ from: "player", player: player.id }}>
          <ul>
            {open && (
              <PartyRow
                party={open}
                name={t.me.transfers.open}
                isPlayer={false}
                state="open"
                today={today}
                index={0}
                playKey={playKey}
                money={money}
                draft={draft}
                disabled={disabled}
              />
            )}
            {bad && (
              <PartyRow
                party={bad}
                name={t.common.badDebt}
                isPlayer={false}
                state="bad"
                today={today}
                index={1}
                playKey={playKey}
                money={money}
                draft={draft}
                disabled={disabled}
              />
            )}
          </ul>
        </TransferBack>
      )}
    </section>
  );
}
