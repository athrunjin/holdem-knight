import {
  type Cents,
  CURRENCIES,
  type Currency,
  cents,
  daysBetween,
  type GameSummary,
  INCOME_ITEMS,
  type IncomeItem,
  type IncomeReport,
  inPeriod,
  type Player,
  playerNumberText,
  playerReport,
  transferReport,
} from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type RefObject, useEffect, useId, useRef, useState } from "react";
import { AccountCard } from "@/components/account/AccountCard";
import { IdentityHeader } from "@/components/account/Identity";
import { MyPlayerPicker } from "@/components/account/MyPlayerPicker";
import { BackupSection } from "@/components/BackupSection";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import {
  CollectedBar,
  IncomeRing,
  ITEM_FILLS,
  ITEM_NAMES,
  LOSS_FILL,
  type Money,
  PLAY_MS,
  runningFigure,
} from "@/components/income/IncomeParts";
import { Page } from "@/components/Page";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { NOTE, Result, TALL } from "@/components/players/ResultBars";
import { ResultCurve } from "@/components/players/ResultCurve";
import { ResultHead } from "@/components/players/ResultHead";
import { RoleSwitch, useRole } from "@/components/RoleSwitch";
import { TextMenu } from "@/components/TextMenu";
import { dayName, keyOf, LATE_DAYS, linesOf } from "@/components/transfers/TransferRows";
import { usePlayers } from "@/data/players";
import { useSession } from "@/data/session";
import { useGameSummaries } from "@/data/summaries";
import { LANGUAGES, type LanguageChoice, languageChoice, setLanguageChoice, t } from "@/i18n";
import { cn } from "@/lib/cn";
import { formatGameMoney } from "@/lib/currency";
import { dayOf } from "@/lib/game-day";
import { filterChoices } from "@/lib/income-filter";
import { QuietMotion, useCountUp, usePlaysIn } from "@/lib/motion";
import {
  type Counterpart,
  counterpartOf,
  type MyPlayerState,
  myLines,
  useMyPlayer,
} from "@/lib/my-player";
import { periodName } from "@/lib/period-names";
import { libraryNameOf, libraryNameText } from "@/lib/player-name";
import {
  currencyShown,
  INCOME_ITEMS_KEY,
  INCOME_VIEW_FALLBACK,
  INCOME_VIEW_KEY,
  incomeShown,
  parseIncomeItems,
  parseIncomeView,
  parseTransfersView,
  TRANSFERS_VIEW_FALLBACK,
  TRANSFERS_VIEW_KEY,
} from "@/lib/report-views";
import { useStoredState } from "@/lib/stored-state";

export const Route = createFileRoute("/me")({
  component: MePage,
});

const cardClass = "rounded-2xl border border-line bg-surface";

/**
 * A card's title line, as on 收益 and 转账: a muted name, `·`, then what it is of. With the
 * currency its figures are in, that currency's mark follows, muted: a mark only, not a control.
 */
function TitleLine({ name, of, currency }: { name: string; of: string; currency?: Currency }) {
  return (
    <p className="flex min-h-11 min-w-0 items-center text-sm">
      <span className="shrink-0 text-muted">{name}</span>
      <span className="mx-1.5 text-muted" aria-hidden>
        ·
      </span>
      <span className="truncate font-medium">{of}</span>
      {currency && <CurrencyIcon currency={currency} className="ml-2 size-4.5 text-muted" />}
    </p>
  );
}

const newestOf = (summaries: readonly GameSummary[]) =>
  summaries.reduce((a, b) => (b.startedAt > a.startedAt ? b : a));

/** Stands in for a figure while the summaries are read: about as wide as one usually is */
const FIGURE = "00,000";

/**
 * The income card's own structure with nothing in it, while the summaries are read: its title
 * line, the headline, the ring's row and the collected line, so nothing moves when it arrives.
 */
function IncomePlaceholder({ className }: { className: string }) {
  return (
    <section className={cn(className, "invisible")} aria-hidden>
      <TitleLine name={t.me.income.due} of={FIGURE} />
      <p className="text-4xl font-semibold tracking-tight tabular-nums">{FIGURE}</p>
      <div className="mt-3 flex items-center gap-4">
        <div className="size-24 shrink-0" />
        <ul className="flex min-w-0 flex-1 flex-col gap-1">
          {INCOME_ITEMS.map((item) => (
            <li key={item} className="min-h-6 text-sm" />
          ))}
        </ul>
      </div>
      <div className="mt-3 h-2" />
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 text-sm">
        <p className="flex min-h-11 items-center gap-2 whitespace-nowrap">
          {t.me.income.received} {FIGURE}
        </p>
        <p className="flex min-h-11 items-center gap-2 whitespace-nowrap">
          {t.me.income.unreceived} {FIGURE} · {t.me.income.unreceivedGames(10)}
        </p>
      </div>
    </section>
  );
}

/**
 * What 收益 would open on, as this browser keeps it: its period, currency, filters and items, or
 * this month in panda points (else the newest game's currency) with all four kinds where nothing
 * is kept. It reads the kept view and never writes it. The whole card leads to 收益.
 */
function IncomePreview({
  summaries,
  onPlayed,
}: {
  summaries: readonly GameSummary[] | undefined;
  onPlayed: () => void;
}) {
  const [view] = useStoredState(INCOME_VIEW_KEY, INCOME_VIEW_FALLBACK, parseIncomeView);
  const [items] = useStoredState<readonly IncomeItem[]>(
    INCOME_ITEMS_KEY,
    INCOME_ITEMS,
    parseIncomeItems,
  );
  const today = dayOf(Date.now());
  const card = cn(cardClass, "block px-4 pt-1 pb-3");

  // While the games are read, the card keeps its height empty
  if (summaries === undefined) return <IncomePlaceholder className={card} />;
  if (summaries.length === 0) {
    return (
      <Link to="/me/income" className={card}>
        <TitleLine name={t.me.income.due} of={periodName(view.period, today)} />
        <p className="pb-2 text-sm text-muted">{t.me.income.noneYet}</p>
      </Link>
    );
  }

  const { currency, period, days, ratio, blinds, report } = incomeShown(
    summaries,
    view,
    items,
    today,
  );
  // A ratio or blinds in force, written as 收益's filter writes them, after the period
  const offered = filterChoices(
    summaries.filter((s) => inPeriod(days, s.day)),
    currency,
  );
  const filters = [
    offered.ratios.find(({ value }) => value === ratio)?.chips,
    offered.blinds.find(({ value }) => value === blinds)?.name,
  ].flatMap((part, index) =>
    part === undefined ? [] : [index === 0 ? `${part} : 1` : String(part)],
  );

  return (
    <Link to="/me/income" className={card}>
      <TitleLine
        name={t.me.income.due}
        of={[`${periodName(period, today)} (${report.games.length})`, ...filters].join(" · ")}
        currency={currency}
      />
      <IncomeFigures
        report={report}
        items={items}
        money={(value) => formatGameMoney(value, currency)}
        playKey={[period, currency, ratio, blinds].join()}
        onPlayed={onPlayed}
      />
    </Link>
  );
}

/** The total, the ring with the four kinds beside it as plain text, and what is in of it. */
function IncomeFigures({
  report,
  items,
  money,
  playKey,
  onPlayed,
}: {
  report: IncomeReport;
  /** The kinds counted, as 收益 keeps them; one left out is struck out, as there */
  items: readonly IncomeItem[];
  money: Money;
  playKey: string;
  onPlayed: () => void;
}) {
  const { total, byItem, gamesByItem } = report;
  const figure = runningFigure(money);
  const playsIn = usePlaysIn(playKey);
  const totalShown = useCountUp(total, { duration: PLAY_MS, resetKey: playKey });
  // Once it has shown, it is there at once when the role is switched away and back
  useEffect(() => {
    onPlayed();
  }, [onPlayed]);

  return (
    <>
      <p
        className={cn(
          "text-4xl font-semibold tracking-tight tabular-nums",
          total < 0 && "text-loss",
        )}
      >
        {figure(totalShown, total)}
      </p>
      <div className="mt-3 flex items-center gap-4">
        <IncomeRing report={report} items={items} playKey={playKey} size="sm" />
        <ul aria-label={t.me.income.items} className="flex min-w-0 flex-1 flex-col gap-1">
          {INCOME_ITEMS.map((item, index) => {
            const amount = byItem[item];
            // A kind left out, or one none of the games had, is struck out, as on 收益
            const there = items.includes(item) && gamesByItem[item] > 0;
            const fill = amount < 0 ? LOSS_FILL : ITEM_FILLS[item];
            return (
              <li
                key={item + playKey}
                className={cn(
                  "flex min-h-6 items-center gap-1.5 text-sm",
                  playsIn && "animate-settle",
                )}
                style={{ animationDelay: `${150 + index * 200}ms` }}
              >
                <span
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    there ? fill.dot : "border border-muted",
                  )}
                  aria-hidden
                />
                <span
                  className={cn("min-w-0 flex-1 truncate", !there && "text-muted line-through")}
                >
                  {ITEM_NAMES[item]}
                </span>
                <span
                  className={cn(
                    "shrink-0 tabular-nums",
                    !there ? "text-muted line-through" : amount < 0 && "text-loss",
                  )}
                >
                  {money(amount)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <CollectedBar report={report} playKey={playKey} money={money} />
    </>
  );
}

/** How many of the people owing the most the card lists */
const SHOWN_PARTIES = 3;

/**
 * The transfers card's own structure with nothing in it, while the summaries are read: its title
 * line, the line of what is to come in and to go out, and the rows of the people owing the most.
 */
function TransfersPlaceholder({ className }: { className: string }) {
  return (
    <section className={cn(className, "invisible")} aria-hidden>
      <TitleLine name={t.me.transfers.title} of={t.me.transfers.open} />
      <p className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tracking-tight tabular-nums">{FIGURE}</span>
          <span className="text-sm whitespace-nowrap">
            {t.me.transfers.toCome} · {t.me.transfers.people(10)}
          </span>
        </span>
        <span className="text-sm whitespace-nowrap">
          {t.me.transfers.toPay} {FIGURE}
        </span>
      </p>
      {/* The rows of the people owing the most, 44px each */}
      <div className="mt-2" style={{ height: `${SHOWN_PARTIES * 2.75}rem` }} />
    </section>
  );
}

/**
 * The transfers still to make, as 转账 opens on them before anything is chosen: in the newest
 * game's currency, with what is to come in, what is to go out, and the people owing the most.
 * The whole card leads to 转账, so nothing inside it is a target of its own.
 */
function TransfersPreview({ summaries }: { summaries: readonly GameSummary[] | undefined }) {
  const { data: players = [] } = usePlayers();
  // The currency kept on 转账, read and never written; what is made and its period do not apply
  const [view] = useStoredState(TRANSFERS_VIEW_KEY, TRANSFERS_VIEW_FALLBACK, parseTransfersView);
  const card = cn(cardClass, "mt-3 block px-4 pt-1 pb-3");

  if (summaries === undefined) return <TransfersPlaceholder className={card} />;
  if (summaries.length === 0) {
    return (
      <Link to="/me/transfers" className={card}>
        <TitleLine name={t.me.transfers.title} of={t.me.transfers.open} />
        <p className="pb-2 text-sm text-muted">{t.me.transfers.noneYet}</p>
      </Link>
    );
  }

  const today = dayOf(Date.now());
  const newest = newestOf(summaries);
  // There is at least one game, so there is a currency
  const currency = currencyShown(summaries, view.currency) as Currency;
  const open = transferReport(summaries, { currency, state: "open" });
  const money = (value: number) => formatGameMoney(cents(value), currency);
  const nameOf = libraryNameOf(players, newest);
  const owing = open.parties.filter((party) => party.toOrganizer > 0).length;
  const owed = open.parties.filter((party) => party.net > 0).slice(0, SHOWN_PARTIES);
  const empty = open.parties.length === 0 && open.between.length === 0;

  return (
    <Link to="/me/transfers" className={card}>
      <TitleLine
        name={t.me.transfers.title}
        of={`${t.me.transfers.open} (${linesOf(open)})`}
        currency={currency}
      />
      {empty ? (
        <p className="pb-2 text-sm text-muted">{t.me.transfers.noneOpen}</p>
      ) : (
        <>
          {/* What is to go out gives way to the next line before anything else does */}
          <p className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="flex items-baseline gap-2">
              <span
                className={cn(
                  "text-4xl font-semibold tracking-tight tabular-nums",
                  open.toOrganizer > 0 && "text-highlight",
                )}
              >
                {money(open.toOrganizer)}
              </span>
              <span className="text-sm whitespace-nowrap text-muted">
                {t.me.transfers.toCome}
                {owing > 0 && ` · ${t.me.transfers.people(owing)}`}
              </span>
            </span>
            <span className="text-sm whitespace-nowrap">
              <span className="text-muted">{t.me.transfers.toPay}</span>
              <span className="ml-2 tabular-nums">{money(open.fromOrganizer)}</span>
            </span>
          </p>
          {owed.length > 0 && (
            <ul className="mt-2">
              {owed.map((party) => {
                const { name, number } = nameOf(party.partyId);
                const late = daysBetween(party.oldestDay, today) > LATE_DAYS;
                return (
                  <li key={party.partyId} className="flex min-h-11 items-center gap-3">
                    {/* A seat of the game, such as insurance, has no avatar, as on 转账 */}
                    {players.some(({ id }) => id === party.partyId) && (
                      <PlayerAvatar id={party.partyId} name={name} size="sm" />
                    )}
                    {/* The name gives way before the number does */}
                    <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                      <span className="truncate font-medium">{name}</span>
                      {number !== undefined && (
                        <span className="shrink-0 text-xs text-muted tabular-nums">{number}</span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "flex shrink-0 items-baseline gap-1.5",
                        late ? "text-loss" : "text-highlight",
                      )}
                    >
                      {late && <span className="text-xs">{t.me.transfers.overdue}</span>}
                      <span className="font-medium tabular-nums">{money(Math.abs(party.net))}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </Link>
  );
}

/**
 * The language of the interface: the device's, or one picked here, which takes effect at once and
 * is kept in this browser. Each language is listed under its own name, so it can be found by
 * someone who cannot read the one in use.
 */
function LanguageRow() {
  const options = [
    { value: "device" as LanguageChoice, label: t.me.language.device },
    ...Object.entries(LANGUAGES).map(([value, { name }]) => ({
      value: value as LanguageChoice,
      label: name,
    })),
  ];

  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-4">
      <p className="shrink-0 font-medium">{t.me.language.title}</p>
      <TextMenu
        label={t.me.language.title}
        options={options}
        value={languageChoice}
        onChange={setLanguageChoice}
        align="right"
        className="min-h-11"
      />
    </div>
  );
}

/** The language and the backups, as rows of one card. */
function SettingsList({ account }: { account: boolean }) {
  return (
    <section className={cn(cardClass, "mt-3")}>
      <LanguageRow />
      <BackupSection account={account} />
    </section>
  );
}

/** As many of the player's latest games as the bars card shows, as the player's page opens on */
const LAST_GAMES = 10;

/** The player's open lines the payments card lists, the oldest of them */
const SHOWN_LINES = 3;

const curveCard = cn(cardClass, "px-4 pt-1 pb-3");

/** What the player still pays at the left, and what is still paid to them at the right. */
function PaymentTotals({ toPay, toReceive }: { toPay: string; toReceive: string }) {
  return (
    <p className="flex flex-wrap items-baseline justify-between gap-x-3">
      <span className="flex items-baseline gap-2 whitespace-nowrap">
        <span className="text-sm text-muted">{t.me.playerFace.toPay}</span>
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{toPay}</span>
      </span>
      <span className="text-sm whitespace-nowrap">
        <span className="text-muted">{t.me.playerFace.toReceive}</span>
        <span className="ml-2 tabular-nums">{toReceive}</span>
      </span>
    </p>
  );
}

/**
 * The player's single games, as the player's page opens on them: the latest ten in the card's
 * currency, with no filter, their result and a bar for each. Not a link: its title is text.
 */
function LastGames({
  player,
  played,
  currency,
}: {
  player: Player;
  played: readonly GameSummary[];
  currency: Currency;
}) {
  // The player's games in this currency, newest first, as the player's page narrows them
  const narrowed = played
    .filter((s) => s.currency === currency)
    .toSorted((a, b) => b.startedAt - a.startedAt);
  const report = playerReport(narrowed.slice(0, LAST_GAMES), player.id, currency);
  const money = (value: Cents, signed = false) =>
    formatGameMoney(value, currency, signed ? "exceptZero" : "auto");

  return (
    <section className={cn(curveCard, "mt-3")}>
      <TitleLine
        name={t.players.playerPage.result}
        of={t.players.playerPage.lastGames(Math.min(LAST_GAMES, narrowed.length) || LAST_GAMES)}
        currency={currency}
      />
      <Result report={report} hideGames money={money} playKey={[player.id, currency].join()} />
    </section>
  );
}

/** Who a line of the player's is with, from their side */
function withWhom(counterpart: Counterpart, nameOf: (playerId: string) => string) {
  switch (counterpart.kind) {
    case "toOrganizer":
      return t.me.playerFace.toOrganizer;
    case "fromOrganizer":
      return t.me.playerFace.fromOrganizer;
    case "toPlayer":
      return t.me.playerFace.toPlayer(nameOf(counterpart.playerId));
    case "fromPlayer":
      return t.me.playerFace.fromPlayer(nameOf(counterpart.playerId));
  }
}

/**
 * What the player still has to pay or receive, from their side, as 转账 has it: what they pay the
 * organizer and what the organizer pays them, then the oldest of their open lines, including
 * those between them and another player, which are in neither total. The whole card leads to the
 * player's page, where they are ticked, so nothing inside it is a target of its own.
 */
function MyPayments({
  player,
  players,
  summaries,
  currency,
}: {
  player: Player;
  players: readonly Player[];
  summaries: readonly GameSummary[];
  currency: Currency;
}) {
  const today = dayOf(Date.now());
  const open = transferReport(summaries, { currency, state: "open" });
  const { party, lines } = myLines(open, player.id);
  const money = (value: Cents) => formatGameMoney(value, currency);
  const named = libraryNameOf(players);
  const nameOf = (playerId: string) => libraryNameText(named(playerId));

  return (
    <Link
      to="/players/$playerId"
      params={{ playerId: player.id }}
      className={cn(curveCard, "mt-3 block")}
    >
      <TitleLine
        name={t.players.playerPage.payments}
        of={lines.length > 0 ? `${t.me.transfers.open} (${lines.length})` : t.me.transfers.open}
        {...(lines.length > 0 && { currency })}
      />
      {lines.length === 0 ? (
        <p className="pb-2 text-sm text-muted">{t.players.playerPage.nothingBetween}</p>
      ) : (
        <>
          <PaymentTotals
            toPay={money(party?.toOrganizer ?? cents(0))}
            toReceive={money(party?.fromOrganizer ?? cents(0))}
          />
          <ul className="mt-1">
            {lines.slice(0, SHOWN_LINES).map((line) => {
              const late = daysBetween(line.day, today) > LATE_DAYS;
              return (
                <li key={keyOf(line)} className="flex min-h-11 items-center gap-2 text-sm">
                  <span className="shrink-0 whitespace-nowrap tabular-nums">
                    {dayName(line.day)}
                    <span className="ml-2 text-muted">
                      {line.smallBlindChips} / {line.bigBlindChips}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted">
                    {withWhom(counterpartOf(line, player.id), nameOf)}
                  </span>
                  <span className={cn("flex shrink-0 items-baseline gap-1.5", late && "text-loss")}>
                    {late && <span className="text-xs">{t.me.transfers.overdue}</span>}
                    <span className="tabular-nums">{money(line.amount)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Link>
  );
}

/**
 * The chosen player's own results and payments, in one currency for the three cards: panda points
 * where they have a settled game in them, else the first currency they have, as their page opens.
 */
function PlayerCards({
  player,
  players,
  summaries,
  onPlayed,
}: {
  player: Player;
  players: readonly Player[];
  summaries: readonly GameSummary[];
  onPlayed: () => void;
}) {
  const today = dayOf(Date.now());
  const played = summaries.filter((s) => s.players.some((p) => p.playerId === player.id));
  const currencies = CURRENCIES.filter((c) => played.some((s) => s.currency === c));
  const currency = currencies.find((c) => c === "CNY") ?? currencies[0] ?? "CNY";
  // Once it has shown, it is there at once when the role is switched away and back
  useEffect(() => {
    onPlayed();
  }, [onPlayed]);

  return (
    <>
      {played.length === 0 ? (
        <section className={cn(cardClass, "p-4")}>
          <p className="text-sm text-muted">{t.me.playerFace.noSettled}</p>
        </section>
      ) : (
        <>
          <Link
            to="/players/$playerId"
            params={{ playerId: player.id }}
            className="block rounded-2xl"
          >
            <ResultCurve preview playerId={player.id} summaries={played} today={today} />
          </Link>
          <LastGames player={player} played={played} currency={currency} />
        </>
      )}
      <MyPayments player={player} players={players} summaries={summaries} currency={currency} />
    </>
  );
}

/**
 * Whether the Player face is still reading the player, the players or the summaries it is drawn
 * from. No chosen player needs nothing read: its prompt shows at once.
 */
function playerFaceLoading(
  mine: MyPlayerState["mine"],
  summaries: readonly GameSummary[] | undefined,
  players: readonly Player[] | undefined,
) {
  if (mine.status === "none") return false;
  return mine.status === "loading" || summaries === undefined || players === undefined;
}

/**
 * The player's own face of 我的: until a player is chosen as oneself, a prompt to choose one;
 * then their results and payments, and under them who they are with a button to change it. The
 * cards play in once on arriving at 我的 for a player; switched away to the Host face and back,
 * they are there at once. Another player chosen plays them in again.
 */
function PlayerFace({
  myPlayer,
  played,
}: {
  myPlayer: MyPlayerState;
  /** The player whose cards have played since arriving at 我的 */
  played: RefObject<string | undefined>;
}) {
  const { mine, choose } = myPlayer;
  const { data: summaries } = useGameSummaries();
  const { data: players } = usePlayers();
  const [picking, setPicking] = useState(false);
  // Quiet only for the player already played in, until another is chosen
  const [quietFor, setQuietFor] = useState(() => played.current);
  // 更换 is read with whose player it changes
  const mineLine = useId();

  const picker = picking && (
    <MyPlayerPicker
      chosenId={mine.status === "chosen" ? mine.player.id : undefined}
      onChoose={(player) => {
        choose(player.id);
        setQuietFor(undefined);
        setPicking(false);
      }}
      onClose={() => setPicking(false)}
    />
  );

  if (mine.status === "none") {
    return (
      <section className={cn(cardClass, "flex flex-col items-start gap-3 p-4")}>
        <p className="text-sm text-muted">{t.me.playerFace.empty}</p>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="min-h-12 rounded-xl bg-accent px-6 font-semibold text-accent-text"
        >
          {t.me.playerFace.choose}
        </button>
        {picker}
      </section>
    );
  }
  // Nothing until what decides the cards' shape is read: how many games, lines and shares there
  // are cannot be known before, so a stand-in of another shape would jump. MePage holds what is
  // under the face back as long, so nothing moves when the cards arrive.
  if (mine.status !== "chosen" || summaries === undefined || players === undefined) return null;

  const { player } = mine;
  return (
    <QuietMotion value={quietFor === player.id}>
      <PlayerCards
        // Another player is drawn afresh, as on the player's page
        key={player.id}
        player={player}
        players={players}
        summaries={summaries}
        onPlayed={() => {
          played.current = player.id;
        }}
      />
      {/* In the cards' content column, as their title lines are */}
      <div className="mt-3 flex items-center justify-between gap-3 px-4 text-sm text-muted">
        {/* The name gives way before the number does */}
        <p id={mineLine} className="flex min-w-0 items-baseline gap-1.5">
          <span className="shrink-0">{t.me.playerFace.mine}</span>
          <span className="truncate">{player.name}</span>
          {player.number !== undefined && (
            <span className="shrink-0 tabular-nums">{playerNumberText(player.number)}</span>
          )}
        </p>
        <button
          type="button"
          aria-describedby={mineLine}
          onClick={() => setPicking(true)}
          className="min-h-11 min-w-11 shrink-0 text-right font-medium text-highlight"
        >
          {t.me.playerFace.change}
        </button>
      </div>
      {picker}
    </QuietMotion>
  );
}

/**
 * The previews of 收益 and 转账. The income card plays in once on arriving at 我的; switched away
 * to the player's face and back, it is there at once.
 */
function HostFace({ played }: { played: RefObject<boolean> }) {
  const { data: summaries } = useGameSummaries();
  const [quiet] = useState(() => played.current);

  return (
    <QuietMotion value={quiet}>
      <IncomePreview
        summaries={summaries}
        onPlayed={() => {
          played.current = true;
        }}
      />
      <TransfersPreview summaries={summaries} />
    </QuietMotion>
  );
}

function MePage() {
  const session = useSession();
  const [role, setRole] = useRole();
  // Called here only, and handed down: the header and the Player face share one state
  const myPlayer = useMyPlayer();
  const played = useRef(false);
  const playerPlayed = useRef<string | undefined>(undefined);
  // Read here as well, from the same cache, so what is under the Player face waits for it
  const { data: summaries } = useGameSummaries();
  const { data: players } = usePlayers();
  const holding = role === "player" && playerFaceLoading(myPlayer.mine, summaries, players);

  return (
    <Page
      title={t.me.title}
      heading={
        <div className="flex items-center justify-between">
          <IdentityHeader myPlayer={myPlayer} />
          <RoleSwitch role={role} onChange={setRole} />
        </div>
      }
    >
      {role === "host" ? (
        <HostFace played={played} />
      ) : (
        <PlayerFace myPlayer={myPlayer} played={playerPlayed} />
      )}
      {!holding && (
        <>
          <SettingsList account={session.status === "signed-in"} />
          {session.status === "signed-in" && (
            <div className="mt-3">
              <AccountCard userId={session.userId} email={session.email} />
            </div>
          )}
          <p className="mt-6 text-center text-xs text-muted">{t.me.version(__APP_VERSION__)}</p>
        </>
      )}
    </Page>
  );
}
