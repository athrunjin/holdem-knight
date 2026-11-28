import {
  type Cents,
  CURRENCIES,
  type Currency,
  type Game,
  type GameSummary,
  type PeriodChoice,
  type Player,
  type PlayerPayments,
  periodOf,
  playerNumberText,
  playerPayments,
  playerReport,
  transferReport,
} from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { blindsChip, FilterBar, ratioChip } from "@/components/FilterBar";
import { HistorySection } from "@/components/game/HistorySection";
import { InfoButton } from "@/components/InfoButton";
import { Page } from "@/components/Page";
import { OwnTag } from "@/components/players/OwnTag";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { Result } from "@/components/players/ResultBars";
import { ResultCurve } from "@/components/players/ResultCurve";
import { TextMenu } from "@/components/TextMenu";
import { PartyRow, TransferBack, useTransferDraft } from "@/components/transfers/TransferRows";
import { useGames } from "@/data/games";
import { isOwnRecord, usePlayers } from "@/data/players";
import { useGameSummaries } from "@/data/summaries";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { formatGameMoney } from "@/lib/currency";
import { dayOf } from "@/lib/game-day";
import { DEFAULT_HISTORY_STATE } from "@/lib/game-history";
import { blindsKey, filterChoices, ratioKey } from "@/lib/income-filter";
import { useListReturn } from "@/lib/list-return";
import { QuietMotion, useQuietArrival } from "@/lib/motion";
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
          {isOwnRecord(player) && <OwnTag className="mr-1" />}
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

  // The ratios and blinds of all the player's games in the currency are on offer, and one chosen
  // counts as chosen in every card: one whose games have none of it is empty. One kept from
  // before that no game has counts as no choice
  const offered = filterChoices(played, currency);
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
        {/* Over the result, the curve and the games, which it narrows together */}
        <FilterBar
          currency={{
            value: currency,
            options: currencies.length > 0 ? currencies : [currency],
            // Another currency has its own ratios and blinds
            onChange: (value) =>
              value !== "all" && change({ currency: value, ratio: undefined, blinds: undefined }),
          }}
          filters={[
            blindsChip(offered, blinds, (value) => change({ blinds: value })),
            ratioChip(offered, ratio, currency, (value) => change({ ratio: value })),
          ]}
          onClear={() => change({ ratio: undefined, blinds: undefined })}
          className="mb-1"
        />
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
          </div>
          <Result report={report} hideGames={isLast(period)} money={money} playKey={playKey} />
        </section>

        {played.length > 0 && (
          // Narrowed by the bar, as the card over it
          <ResultCurve
            key={player.id}
            playerId={player.id}
            summaries={played}
            today={today}
            filter={{ currency, ratio, blinds }}
          />
        )}

        {/* The host's own record is the organizer: what they pay or are paid is on 转账 (ADR 0051) */}
        {!isOwnRecord(player) && (
          <Payments
            player={player}
            payments={payments}
            summaries={summaries}
            games={games}
            currency={currency}
            today={today}
          />
        )}

        {/* Folded until asked for; narrowed by the bar at the top, then by its own, and ordered as on the games page */}
        <div className="mt-5">
          <HistorySection
            games={games.filter(({ id }) => played.some((s) => s.id === id))}
            title={t.players.playerPage.gamesTitle}
            storageKey="player.history"
            initial={GAMES_FOLDED}
            playerId={player.id}
            narrowedTo={{ currency, ratio, blinds }}
          />
        </div>
      </div>
    </QuietMotion>
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
