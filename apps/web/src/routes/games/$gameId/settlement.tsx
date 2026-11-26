import {
  type ChargeWaiver,
  cents,
  chipDifference,
  chooseCollector,
  chooseInsuranceInSplit,
  chooseRakeInSplit,
  type Game,
  INSURANCE_PLAYER_ID,
  isTransferDone,
  type LedgerEvent,
  markReceived,
  markTransfers,
  netOf,
  ORGANIZER_COLLECTOR,
  planTransfers,
  RAKE_PLAYER_ID,
  reviseGame,
  type SettledBooks,
  settleBooks,
  settleGame,
  type Transfer,
  waiveCharge,
} from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, Share2, Undo2 } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { BuyInRecord } from "@/components/game/BuyInRecord";
import { chargeLines, organizerIncomeLines } from "@/components/game/chargeLines";
import { GameBlindsCash, GameOptionLine, GameTitle } from "@/components/game/GameOptions";
import { GameRules, hasGameRules } from "@/components/game/GameRules";
import {
  InsuranceRow,
  RakeRow,
  type ResultCard,
  ResultCards,
  type ResultLine,
} from "@/components/game/ResultCards";
import { SettlementSummary } from "@/components/game/SettlementSummary";
import { imageCard, imageHeader, imageRecord } from "@/components/game/settlementImage";
import type { TransferPlan } from "@/components/game/TransferPlanPicker";
import { Transfers } from "@/components/game/Transfers";
import { InfoButton } from "@/components/InfoButton";
import { Modal } from "@/components/insurance/Modal";
import { Page } from "@/components/Page";
import { organizerNameOf } from "@/data";
import { useGame } from "@/data/games";
import { useLedger } from "@/data/ledger";
import { usePlayers } from "@/data/players";
import { useSaveSettlement } from "@/data/summaries";
import { t } from "@/i18n";
import { CHARGE_CLOCK_RULE, chargeClock, chargeRuleSections } from "@/lib/charges";
import { formatSignedChips } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { formatGameAmount, formatGameMoney } from "@/lib/currency";
import { gameInitialsOf, gameNameOf } from "@/lib/player-name";
import { type ImageSeat, renderSettlementImage } from "@/lib/settlement-image";
import { shareFile } from "@/lib/share";
import { netTone } from "@/lib/tone";

export const Route = createFileRoute("/games/$gameId/settlement")({
  component: SettlementPage,
  // Opened from 收益, the page leads back there instead of to the table
  validateSearch: (
    search: Record<string, unknown>,
  ): { from?: "income" | "transfers" | "player"; player?: string; open?: "transfers" } => ({
    ...(search.from === "income" || search.from === "transfers"
      ? { from: search.from }
      : search.from === "player" && typeof search.player === "string"
        ? { from: "player" as const, player: search.player }
        : {}),
    // Reached from a line of a transfer: the page starts at its transfers
    ...(search.open === "transfers" && { open: "transfers" as const }),
  }),
});

/**
 * The button the page points at when a tap cannot do what it asks: 确认结算 while the results are
 * still open, 修改对局结果 once they are confirmed. A new one each time, so a second tap points again.
 */
interface Nudge {
  readonly target: "confirm" | "revise";
  readonly at: number;
}

/** How long the ring stays around the button. */
const NUDGE_MS = 2400;

function NudgeRing({ at }: { at: number }) {
  return (
    <span
      key={at}
      aria-hidden
      className="pointer-events-none absolute -inset-1 animate-nudge rounded-2xl ring-2 ring-highlight"
    />
  );
}

function SettlementPage() {
  const { gameId } = Route.useParams();
  const { data: game } = useGame(gameId);
  const { data: events } = useLedger(gameId);
  const { data: players } = usePlayers();

  const [rulesOpen, setRulesOpen] = useState(false);
  const [nudge, setNudge] = useState<Nudge>();

  if (!game || !events || !players) return null;

  // Settled in one place, which a settled game's summary is kept from too (ADR 0049)
  const books = settleBooks(game, events, chargeClock(game));
  const { ledger, charges } = books;
  const ruleSections = chargeRuleSections(game, game.currency);
  const nameOf = gameNameOf(players, game, events);
  const initialsOf = gameInitialsOf(players);
  const seated = ledger
    .filter((p) => p.seated && p.playerId !== INSURANCE_PLAYER_ID)
    .map((p) => nameOf(p.playerId));
  const difference = chipDifference(ledger);

  return (
    <Page
      title={<GameTitle game={game} />}
      titleNote={<GameBlindsCash game={game} />}
      subtitle={
        <GameOptionLine
          game={game}
          settings={{ kind: "view", open: rulesOpen, onToggle: () => setRulesOpen(!rulesOpen) }}
        />
      }
      actions={
        // The emblem, no taller than the title and the line under it
        <img src="/emblem-on-dark.svg" alt="" className="h-12 w-auto shrink-0" />
      }
    >
      {/* The game's settings, to read only: they are changed from the game page */}
      {rulesOpen && (
        <section
          aria-label={t.common.settings}
          className="mb-3 flex items-start justify-between gap-2 rounded-xl border border-line bg-surface px-3 pt-2 pb-1"
        >
          {hasGameRules(game) ? (
            <GameRules game={game} charges={charges} />
          ) : (
            <p className="pb-1 text-xs text-muted">
              {t.gamePages.settlement.thisGameHasNoInsuranceDealer}
            </p>
          )}
          {ruleSections.length > 0 && (
            <InfoButton title={t.gamePages.settlement.charges} small>
              <div className="flex flex-col gap-2 text-sm">
                {ruleSections.map(({ title, lines }) => (
                  <section key={title}>
                    <h4 className="font-medium">{title}</h4>
                    {lines.map((line) => (
                      <p key={line} className="text-muted">
                        {line}
                      </p>
                    ))}
                  </section>
                ))}
                <p className="text-xs text-muted">{CHARGE_CLOCK_RULE}</p>
              </div>
            </InfoButton>
          )}
        </section>
      )}
      {seated.length > 0 ? (
        <Notice gameId={gameId}>
          {t.gamePages.settlement.stillAtTheTableEveryoneHas(
            seated.length,
            seated.join(t.common.listSeparator),
          )}
        </Notice>
      ) : (
        <>
          <SettlementSummary
            game={game}
            ledger={ledger}
            difference={difference}
            onLocked={() => setNudge({ target: "revise", at: Date.now() })}
          />
          {difference === 0 || game.imbalanceHandling ? (
            <SettlementResult
              game={game}
              books={books}
              events={events}
              nameOf={nameOf}
              initialsOf={initialsOf}
              nudge={nudge}
              onNudge={setNudge}
            />
          ) : (
            <p className="mt-3 text-sm text-muted">
              {t.gamePages.settlement.chooseAboveHowToHandleThe}
            </p>
          )}
        </>
      )}
    </Page>
  );
}

function Notice({ gameId, children }: { gameId: string; children: ReactNode }) {
  return (
    <div role="status" className="rounded-xl border border-highlight bg-surface p-4">
      <p>{children}</p>
      <Link
        to="/games/$gameId"
        params={{ gameId }}
        className="mt-2 inline-flex min-h-11 items-center text-highlight"
      >
        {t.gamePages.settlement.backToTheLedger}
      </Link>
    </div>
  );
}

interface SettlementResultProps {
  game: Game;
  books: SettledBooks;
  events: readonly LedgerEvent[];
  nameOf: (playerId: string) => string;
  initialsOf: (playerId: string, name: string) => string;
  nudge: Nudge | undefined;
  onNudge: (nudge: Nudge | undefined) => void;
}

function SettlementResult({
  game,
  books,
  events,
  nameOf,
  initialsOf,
  nudge,
  onNudge,
}: SettlementResultProps) {
  const { ledger, statuses, charges, outcome, chipNets, nets } = books;
  const { difference } = outcome;
  const seat = ledger.find((p) => p.playerId === INSURANCE_PLAYER_ID);
  const ownerId = books.insuranceOwnerId;
  const rakeSeat = ledger.find((p) => p.playerId === RAKE_PLAYER_ID);
  const { currency, status, handChips, createdAt } = game;
  // An organizer who plays has chips under the organizer's own ID, and stays on the organizer's card
  const host = ledger.find((p) => p.playerId === ORGANIZER_COLLECTOR);
  // A settled game saved here has its summary kept with it
  const saveGame = useSaveSettlement(events);
  const [sharing, setSharing] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  // A game with insurance or charges opens on its transfers, which then go through the organizer
  const { from, player: backPlayerId, open: opensOn } = Route.useSearch();
  // A game with insurance or charges opens on its transfers, and so does one opened from a
  // transfer's line
  const [transfersOpen, setTransfersOpen] = useState(
    () => opensOn === "transfers" || hasGameRules(game),
  );
  // Reached from a transfer's line, the page starts at its foot, where the transfers are
  useEffect(() => {
    if (opensOn !== "transfers") return;
    const frame = requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight));
    return () => cancelAnimationFrame(frame);
  }, [opensOn]);
  const [revising, setRevising] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const manageRef = useRef<HTMLButtonElement>(null);
  // Anything not yet confirmed is still being settled, however the page was reached
  const settled = status === "settled";

  useEffect(() => {
    if (!nudge) return;
    // 确认结算 only has to come into view. 修改对局结果 sits over 积分管理, which goes to the bottom
    if (nudge.target === "confirm") {
      confirmRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else {
      manageRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    }
    const timer = window.setTimeout(() => onNudge(undefined), NUDGE_MS);
    return () => window.clearTimeout(timer);
  }, [nudge, onNudge]);

  const point = (target: Nudge["target"]) => onNudge({ target, at: Date.now() });

  const separateInsurance = ownerId === INSURANCE_PLAYER_ID;

  /** The transfers of the plan a game has, which may be this game with another plan chosen. */
  const transfersOf = (of: Game) => planTransfers(of, nets);
  /** A settled game is complete while every transfer of its plan is in: none at all counts too. */
  const filed = (of: Game) =>
    markReceived(
      of,
      transfersOf(of).every((transfer) => isTransferDone(of, transfer)),
    );

  const { collectorId, transfers } = books;
  const planName = collectorId
    ? t.gamePages.settlement.collector(nameOf(collectorId))
    : t.gamePages.settlement.fewestTransfers;

  const organizerNet = nets.find((p) => p.playerId === ORGANIZER_COLLECTOR)?.net;
  // The insurance result before any split. Its share of a split is a line of its own
  const insuranceBefore = netOf(chipNets, INSURANCE_PLAYER_ID);
  function insuranceLine(id: string): ResultLine[] {
    if (insuranceBefore === 0 || id !== ownerId) return [];
    return [
      {
        key: "insurance",
        label: t.common.insurance,
        amount: insuranceBefore,
        tone: "adjustment",
        group: t.common.insurance,
      },
    ];
  }

  const splitting = game.imbalanceHandling === "split" && difference !== 0;
  /** Someone's share of a split, as an amount. */
  const splitLine = (key: string, label: string, share: number): ResultLine => ({
    key,
    label,
    amount: cents(share),
    tone: "adjustment",
    group: t.gamePages.settlement.share,
  });
  /**
   * A seat's share of a split, which the organizer switches on. Off, it is struck through with no
   * amount, since the seat takes no share. Only a seat on the side being split has the line. A seat
   * that has to share, with no player on its side, shows its share and cannot be switched off.
   */
  function seatSplitLine(
    seatId: string,
    label: string,
    on: boolean,
    choose: (game: Game, on: boolean) => Game,
  ): ResultLine[] {
    const before = netOf(chipNets, seatId);
    if (!splitting || before * difference <= 0) return [];
    const share = netOf(outcome.nets, seatId) - before;
    const forced = !on && share !== 0;
    const line = on || forced ? splitLine(`split-${seatId}`, label, share) : undefined;
    return [
      {
        ...(line ?? {
          key: `split-${seatId}`,
          label,
          tone: "adjustment",
          group: t.gamePages.settlement.share,
        }),
        waiver: {
          waived: !on && !forced,
          disabled: saveGame.isPending || forced,
          locked: settled,
          onChange: (waived) =>
            settled ? point("revise") : saveGame.mutate(choose(game, !waived)),
        },
      },
    ];
  }
  const insuranceSplit = seatSplitLine(
    INSURANCE_PLAYER_ID,
    t.gamePages.settlement.splitTheDifferenceInsurance,
    game.insuranceInSplit === true,
    chooseInsuranceInSplit,
  );
  const rakeSplit = seatSplitLine(
    RAKE_PLAYER_ID,
    t.gamePages.settlement.splitTheDifferenceRake,
    game.rakeInSplit === true,
    chooseRakeInSplit,
  );

  // Once settled a charge cannot change: the tap points at the button that opens the results again
  const waiving = {
    disabled: saveGame.isPending,
    locked: settled,
    onWaive: (key: ChargeWaiver, waived: boolean) =>
      settled ? point("revise") : saveGame.mutate(waiveCharge(game, key, waived)),
  };
  const record = (playerId: string) => (
    <BuyInRecord game={game} events={events} playerId={playerId} />
  );

  const playerCards = ledger
    .filter((p) => p.playerId !== INSURANCE_PLAYER_ID || separateInsurance)
    .filter((p) => p.playerId !== RAKE_PLAYER_ID)
    .filter((p) => p.playerId !== ORGANIZER_COLLECTOR)
    .map((player): ResultCard => {
      const { playerId } = player;
      const base = netOf(chipNets, playerId);
      const share = netOf(outcome.nets, playerId) - base;
      // The insurance seat on its own row has the switch; a player has their share as it is
      const split: ResultLine[] =
        playerId === INSURANCE_PLAYER_ID
          ? insuranceSplit
          : share === 0
            ? []
            : [splitLine("split", t.gamePages.settlement.splitTheDifference, share)];
      const name = nameOf(playerId);
      return {
        id: playerId,
        name,
        initials: initialsOf(playerId, name),
        hands: handChips === undefined ? "—" : String(player.boughtChips / handChips),
        chips: player.cashedOutChips.toLocaleString("zh-CN"),
        netChips: player.cashedOutChips - player.boughtChips,
        base,
        record: record(playerId),
        // What the chips come to first, then the charges, then what changes the result after them
        lines: [
          ...chargeLines(game, statuses, charges, playerId, waiving),
          ...split,
          ...insuranceLine(playerId),
          // A player who takes the insurance result has its share of a split under it
          ...(playerId === ownerId && playerId !== INSURANCE_PLAYER_ID ? insuranceSplit : []),
        ],
        total: netOf(nets, playerId),
        collapsible: true,
      };
    });

  // What handling the difference adds to the organizer, beyond their own chips if they play
  const covered =
    netOf(outcome.nets, ORGANIZER_COLLECTOR) - (host ? netOf(chipNets, ORGANIZER_COLLECTOR) : 0);
  const coveredLine: ResultLine =
    game.imbalanceHandling === "organizer"
      ? {
          key: "difference",
          label:
            covered < 0
              ? t.gamePages.settlement.coverTheDifference
              : t.gamePages.settlement.keepTheDifference,
          amount: cents(covered),
          tone: "adjustment",
          group: t.gamePages.settlement.difference,
        }
      : splitLine("split", t.gamePages.settlement.splitTheDifference, covered);
  const receivesCharges = books.chargeRecipientId === ORGANIZER_COLLECTOR;
  // The insurance seat sits on the organizer's card as on the game page, when its result is theirs
  const insuranceSeat = seat &&
    ownerId === ORGANIZER_COLLECTOR && {
      hands: handChips === undefined ? "—" : String(seat.boughtChips / handChips),
      chips: seat.cashedOutChips.toLocaleString("zh-CN"),
      netChips: seat.cashedOutChips - seat.boughtChips,
      amount: insuranceBefore,
    };
  // The rake seat sits under the insurance seat, as on the game page, with what it took before
  // any split. Its share of a split is one of the organizer's lines
  const rakeTaken = rakeSeat && {
    chips: rakeSeat.cashedOutChips,
    amount: netOf(chipNets, RAKE_PLAYER_ID),
  };
  const insuranceRow = insuranceSeat && <InsuranceRow {...insuranceSeat} currency={currency} />;
  const rakeRow = rakeTaken && <RakeRow {...rakeTaken} currency={currency} />;
  // What an organizer can receive besides insurance, always in this order
  // then the shares of a split: their own as a player, the insurance seat's and the rake's
  const organizerLines: ResultLine[] = [
    ...organizerIncomeLines(game, charges, receivesCharges),
    ...(covered === 0 ? [] : [coveredLine]),
    ...(ownerId === ORGANIZER_COLLECTOR ? insuranceSplit : []),
    ...rakeSplit,
  ];
  const organizerCard: ResultCard[] =
    organizerNet === undefined
      ? []
      : [
          {
            id: ORGANIZER_COLLECTOR,
            name: organizerNameOf(game),
            hands: !host || handChips === undefined ? "—" : String(host.boughtChips / handChips),
            chips: host ? host.cashedOutChips.toLocaleString("zh-CN") : "—",
            ...(host && {
              netChips: host.cashedOutChips - host.boughtChips,
              base: netOf(chipNets, ORGANIZER_COLLECTOR),
              record: record(ORGANIZER_COLLECTOR),
            }),
            ...((insuranceRow || rakeRow) && {
              pinned: (
                <>
                  {insuranceRow}
                  {rakeRow}
                </>
              ),
            }),
            lines: organizerLines,
            total: organizerNet,
            collapsible: true,
          },
        ];

  // The plans in the order they are listed: the optimal one, the organizer, then the players
  const plans: TransferPlan[] = [
    { collectorId: undefined, label: t.gamePages.settlement.fewestTransfers },
    ...[ORGANIZER_COLLECTOR, ...playerCards.map(({ id }) => id)]
      .filter((id) => id !== INSURANCE_PLAYER_ID)
      .map((id) => ({ collectorId: id, label: t.gamePages.settlement.collector2(nameOf(id)) })),
  ];

  /** The seats on the organizer's card, as the image draws them. */
  function seatsInImage(): ImageSeat[] {
    const money = (amount: number) =>
      formatGameAmount(cents(amount), currency, amount === 0 ? "auto" : "exceptZero");
    return [
      ...(insuranceSeat
        ? [
            {
              kind: "insurance" as const,
              name: t.common.insurance,
              hands: insuranceSeat.hands,
              chips: insuranceSeat.chips,
              net: {
                text: formatSignedChips(insuranceSeat.netChips),
                tone: netTone(insuranceSeat.netChips),
              },
              amount: { text: money(insuranceSeat.amount), tone: "highlight" as const },
            },
          ]
        : []),
      ...(rakeTaken
        ? [
            {
              kind: "rake" as const,
              name: t.common.rake,
              hands: "",
              chips: rakeTaken.chips.toLocaleString("zh-CN"),
              net: { text: formatSignedChips(rakeTaken.chips), tone: "win" as const },
              amount: { text: money(rakeTaken.amount), tone: "win" as const },
            },
          ]
        : []),
    ];
  }

  /**
   * Shares an image laid out like this page. With no one named it is the whole game: every card
   * folded, then the transfers. For one player it is the game's header, their card opened with
   * their Buy-in record, and only the transfers they are part of.
   */
  async function handleShare(personId?: string) {
    setSharing(true);
    setShareFailed(false);
    try {
      const person = playerCards.find(({ id }) => id === personId);
      const isOrganizer = (card: ResultCard) => card.id === ORGANIZER_COLLECTOR;
      const inImage = (card: ResultCard) =>
        imageCard(card, game, {
          ...(isOrganizer(card) && { seats: seatsInImage() }),
          // Only the opened card of one person lists the record
          ...(person &&
            card.record !== undefined && { record: imageRecord(game, events, card.id) }),
        });
      const shown = person
        ? transfers.filter(({ from, to }) => from === person.id || to === person.id)
        : transfers;
      const image = await renderSettlementImage({
        header: imageHeader(game, ledger, chipDifference(ledger)),
        heading: person ? undefined : t.game.resultCards.gameSummary,
        groups: person
          ? [
              {
                title: t.common.player,
                cards: [inImage(person)],
              },
            ]
          : [
              { title: t.game.resultCards.host, cards: organizerCard.map(inImage) },
              { title: t.common.player, cards: playerCards.map(inImage) },
            ].filter(({ cards }) => cards.length > 0),
        expanded: person !== undefined,
        transfers: {
          title: t.gamePages.settlement.transfers(planName),
          rows: shown.map(({ from, to, amount }) => ({
            from: nameOf(from),
            to: nameOf(to),
            amount: formatGameMoney(amount, currency),
          })),
        },
      });
      const date = new Date(createdAt);
      const day = [date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-");
      await shareFile(
        image,
        person
          ? t.gamePages.settlement.playerSettlementPng(day, person.name)
          : t.gamePages.settlement.settlementPng(day),
      );
    } catch {
      setShareFailed(true);
    } finally {
      setSharing(false);
    }
  }

  /** A share button on the total line of a player's opened card, for the image of their result. */
  const withShare = (card: ResultCard): ResultCard => ({
    ...card,
    action: (
      <button
        type="button"
        aria-label={t.game.transfers.share(card.name)}
        disabled={sharing}
        onClick={() => handleShare(card.id)}
        className="-my-1 flex size-11 shrink-0 items-center justify-center text-muted disabled:opacity-60"
      >
        <Share2 className="size-4" strokeWidth={1.75} aria-hidden />
      </button>
    ),
  });

  function revise() {
    setRevising(false);
    onNudge(undefined);
    saveGame.mutate(reviseGame(game));
  }

  /** Transfers already marked as received would no longer match, so they go, once the organizer agrees. */
  function handleRevise() {
    if (transfers.some((transfer) => isTransferDone(game, transfer))) setRevising(true);
    else revise();
  }

  function handleConfirm() {
    onNudge(undefined);
    saveGame.mutate(filed(settleGame(game, Date.now())));
  }

  return (
    <>
      <ResultCards
        organizer={organizerCard[0]}
        cards={playerCards.map(withShare)}
        currency={currency}
      />

      {/* The step that closes the game comes first, set apart from the cards by a rule */}
      <div className="mt-5 border-t border-line pt-4">
        <div className="flex gap-2">
          {settled ? (
            <button
              type="button"
              disabled={saveGame.isPending}
              onClick={handleRevise}
              className="relative min-h-12 min-w-0 flex-1 rounded-xl border border-line px-4 font-medium disabled:opacity-60"
            >
              {t.gamePages.settlement.editResult}
              {nudge?.target === "revise" && <NudgeRing at={nudge.at} />}
            </button>
          ) : (
            <button
              ref={confirmRef}
              type="button"
              disabled={saveGame.isPending}
              onClick={handleConfirm}
              className="relative min-h-12 min-w-0 flex-1 scroll-mt-4 scroll-mb-24 rounded-xl bg-accent px-4 font-semibold text-accent-text disabled:opacity-60"
            >
              {t.gamePages.settlement.confirmSettlement}
              {nudge?.target === "confirm" && <NudgeRing at={nudge.at} />}
            </button>
          )}
          <Link
            to="/games/$gameId"
            params={{ gameId: game.id }}
            className="flex min-h-12 shrink-0 items-center gap-1 rounded-xl border border-line px-3 text-sm font-medium"
          >
            <Undo2 className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
            {t.gamePages.settlement.backToTheTable}
          </Link>
        </div>
        {saveGame.isError && (
          <p role="alert" className="mt-2 text-sm text-highlight">
            {t.common.couldntSaveTryAgain}
          </p>
        )}
      </div>

      {/* Then what is shared with the players: the image, and the transfers, which open under the row */}
      <section className="mt-2 pb-8">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={sharing}
            onClick={() => handleShare()}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line px-2 font-medium disabled:opacity-60"
          >
            <Share2 className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
            {t.gamePages.settlement.makeImage}
          </button>
          {/* Clear of the bar at the bottom of a phone when the page scrolls it to the bottom */}
          <button
            ref={manageRef}
            type="button"
            aria-expanded={transfersOpen}
            onClick={() => setTransfersOpen(!transfersOpen)}
            className="flex min-h-12 scroll-mb-24 items-center justify-center gap-1 rounded-xl border border-line bg-surface px-2 font-medium whitespace-nowrap"
          >
            {t.gamePages.settlement.transfers2}
            <ChevronDown
              className={cn(
                "size-5 shrink-0 text-muted transition-transform",
                transfersOpen && "rotate-180",
              )}
              aria-hidden
            />
          </button>
        </div>
        {shareFailed && (
          <p role="alert" className="mt-2 text-sm text-highlight">
            {t.gamePages.settlement.couldntMakeTheImageTryAgain}
          </p>
        )}
        {transfersOpen && (
          // The plan can change at any stage, and the ticks once the results are confirmed
          <Transfers
            game={game}
            transfers={transfers}
            plans={plans}
            collectorId={collectorId}
            nameOf={nameOf}
            disabled={saveGame.isPending}
            backTo={from}
            backPlayerId={backPlayerId}
            sharing={sharing}
            // A transfer's image is the player's own result, to send to them: the payer's, or
            // the receiver's where the organizer is the one who pays
            onShare={(transfer?: Transfer) =>
              handleShare(transfer?.from === ORGANIZER_COLLECTOR ? transfer.to : transfer?.from)
            }
            onChoosePlan={(next) => saveGame.mutate(filed(chooseCollector(game, next)))}
            onMark={(marked, done) =>
              saveGame.mutate(filed(markTransfers(game, marked, done, Date.now())))
            }
            onUnsettled={() => point("confirm")}
          />
        )}
      </section>

      {revising && (
        <Modal title={t.gamePages.settlement.editResult} onClose={() => setRevising(false)}>
          <p className="text-sm">{t.gamePages.settlement.transfersHaveBeenMarkedDeleteThose}</p>
          <button
            type="button"
            onClick={revise}
            className="mt-3 min-h-11 w-full rounded-xl bg-accent font-semibold text-accent-text"
          >
            {t.common.ok}
          </button>
          <button
            type="button"
            onClick={() => setRevising(false)}
            className="mt-2 min-h-11 w-full rounded-xl border border-line font-medium"
          >
            {t.common.cancel}
          </button>
        </Modal>
      )}
    </>
  );
}
