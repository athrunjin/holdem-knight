import {
  arrangeOuts,
  buyOffer,
  type Card,
  contestedStakes,
  dealCard,
  declineOffer,
  handOffers,
  handPotBreakdown,
  handPotEntries,
  handResult,
  handStandings,
  type InsuranceHand,
  type InsuranceHandPlayer,
  type InsuranceRule,
  nextStreet,
  offersDecided,
  playersReady,
  potTotals,
  reviseOffer,
  type Standings,
  undoDeal,
} from "@holdem-knight/core";
import { Plus, RotateCcw } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { t } from "@/i18n";
import { formatSignedChips } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { BOARD_PLACES, CardFace } from "./CardFace";
import { type CardTarget, HandCardPicker, playerMarks } from "./HandCardPicker";
import { HandPlayerRow, HoleCards, type StandingNote } from "./HandPlayerRow";
import {
  DeadMoney,
  MIN_PLAYERS,
  nextPlayers,
  PRESET_DEAD_CHIPS,
  RoundAction,
  SectionTitle,
} from "./HandSections";
import { HandSummary } from "./HandSummary";
import type { InsuranceSeat } from "./InsuranceCalculator";
import type { Decisions } from "./LeaderQuote";
import { OutsManager } from "./OutsManager";
import { PotColumns, potName } from "./PotColumns";
import { PotInsurance } from "./PotInsurance";
import { type PotShare, PotShares } from "./PotShares";

/** Keeps the hand. Missing for the standalone calculator, which records nothing. */
export interface HandStore {
  save: (hand: InsuranceHand) => void;
  /** A player's counted chips, which update the table at once. */
  enterStack: (playerId: string, chips: number) => void;
  discard: (handId: string) => void;
  finish: (hand: InsuranceHand) => Promise<void>;
}

/** The insurance seat now, to show where it will end up. */
export interface SeatChips {
  readonly stackChips: number;
  readonly handChips: number;
}

interface InsuranceHandFlowProps {
  rule: InsuranceRule;
  /** Everyone at the table, in its order. The first two start a hand, and the rest can be added. */
  seats: readonly InsuranceSeat[];
  /** The hand in progress, to carry on from. */
  open: InsuranceHand | undefined;
  createHand: () => InsuranceHand;
  store: HandStore | undefined;
  seat: SeatChips | undefined;
}

const STREET_TEXT = { turn: t.common.turn, river: t.common.river } as const;

/** The hand with the dead money it starts with, marked as not yet set. */
const withPresetPools = (hand: InsuranceHand): InsuranceHand => ({
  ...hand,
  pools: [PRESET_DEAD_CHIPS],
  presetPools: true,
});

/**
 * The hand with its first two players in place: the first two of the table, with the chips they
 * have there. Nothing is kept until the organizer changes something, so a table that changes
 * meanwhile still shows as it is.
 */
function withFirstPlayers(hand: InsuranceHand, seats: readonly InsuranceSeat[]): InsuranceHand {
  if (hand.step !== "players" && hand.step !== "start") return hand;
  const added = nextPlayers(hand.players, seats, MIN_PLAYERS - hand.players.length);
  return added.length === 0 ? hand : { ...hand, players: [...hand.players, ...added] };
}

const chipText = (chips: number) => chips.toLocaleString("zh-CN");
const percentText = (share: number) => `${(share * 100).toFixed(1)}%`;

const primaryClass =
  "min-h-12 w-full rounded-xl bg-accent font-semibold text-accent-text disabled:opacity-40";
const secondaryClass = "min-h-11 w-full rounded-xl border border-line font-medium";

/**
 * One street's cards in a frame, named underneath. A street that must be entered is framed solid;
 * one that may be left out is dashed until it has its card.
 */
function StreetCards({
  label,
  cards,
  count,
  optional = false,
  disabled = false,
  onPick,
}: {
  label: string;
  cards: readonly Card[];
  count: number;
  optional?: boolean;
  disabled?: boolean;
  /** Missing once the board can no longer change. */
  onPick?: (() => void) | undefined;
}) {
  const empty = cards.length === 0;
  const frame = cn(
    "flex shrink-0 flex-col items-center gap-1 rounded-xl border-2 px-2 pt-2 pb-1",
    empty && optional ? "border-dashed border-line" : "border-line bg-surface",
  );
  const content = (
    <>
      <span className="flex gap-1">
        {BOARD_PLACES.slice(0, count).map((place) => (
          <CardFace key={place} card={cards[place] ?? null} solid={!optional} />
        ))}
      </span>
      <span className="text-xs whitespace-nowrap text-muted">{label}</span>
    </>
  );
  if (!onPick) return <div className={frame}>{content}</div>;
  return (
    <button
      type="button"
      aria-label={
        empty
          ? t.insurance.insuranceHandFlow.select(label)
          : t.insurance.insuranceHandFlow.edit(label)
      }
      disabled={disabled}
      onClick={onPick}
      className={cn(frame, "disabled:opacity-40")}
    >
      {content}
    </button>
  );
}

/** A leader's chance to win stands alone. A player behind gets their outs for the next card before it. */
function standingNote(
  { players, exact }: Standings,
  playerId: string,
  cardsToCome: boolean,
): StandingNote | undefined {
  const standing = players.find((s) => s.playerId === playerId);
  if (!standing) return undefined;
  const { leading, equity, outs, tieCards } = standing;
  // A sampled chance is good to about a point, so it is shown to the point
  const chance = exact ? percentText(equity) : `${Math.round(equity * 100)}%`;
  if (leading || !cardsToCome) return { leading, text: chance };
  const cards = tieCards.length > 0 ? `${outs.length}+${tieCards.length}` : outs.length;
  return { leading, text: `Outs ${cards} · ${chance}` };
}

function SettleStep({
  hand,
  nameOf,
  saving,
  onChangeCard,
  onConfirm,
}: {
  hand: InsuranceHand;
  nameOf: (id: string) => string;
  saving: boolean;
  onChangeCard: () => void;
  onConfirm: () => void;
}) {
  const last = hand.board.length === 5;
  const street = last ? "river" : "turn";
  const purchases = hand.purchases.filter((p) => p.street === street);
  const result = handResult(hand);
  return (
    <section className="mt-3 rounded-xl border border-line bg-surface p-3">
      <h2 className="font-semibold">
        {t.insurance.insuranceHandFlow.insuranceSettlement(STREET_TEXT[street])}
      </h2>
      {purchases.length === 0 && (
        <p className="mt-1 text-sm text-muted">
          {t.insurance.insuranceHandFlow.noInsuranceOnThisStreet}
        </p>
      )}
      <ul className="divide-y divide-line">
        {purchases.map((purchase) => (
          <li key={purchase.id} className="py-2">
            <p className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate font-medium">{nameOf(purchase.playerId)}</span>
              <span className={cn("shrink-0 font-semibold", purchase.hit && "text-highlight")}>
                {purchase.hit
                  ? t.insurance.insuranceHandFlow.hitPayout(chipText(purchase.payoutChips))
                  : t.insurance.insuranceHandFlow.missed}
              </span>
            </p>
            <p className="text-sm text-muted tabular-nums">
              {purchase.tie
                ? t.insurance.insuranceHandFlow.tieOn(purchase.outs.length)
                : `${purchase.outs.length} outs`}{" "}
              {t.insurance.insuranceHandFlow.premium} {chipText(purchase.premiumChips)}
            </p>
          </li>
        ))}
      </ul>
      {last && (
        <p className="mt-2 border-t border-line pt-2 text-sm">
          {t.insurance.insuranceHandFlow.premiumThisHand} {chipText(result.premiumChips)}{" "}
          {t.insurance.insuranceHandFlow.payout} {chipText(result.payoutChips)}{" "}
          {t.insurance.insuranceHandFlow.insurancePL}{" "}
          <span className="font-semibold">{formatSignedChips(result.seatChips)}</span>
        </p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={onChangeCard} className={secondaryClass}>
          {t.insurance.insuranceHandFlow.changeThisCard}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onConfirm}
          className="min-h-11 rounded-xl bg-accent font-semibold text-accent-text disabled:opacity-40"
        >
          {t.insurance.insuranceHandFlow.confirm}
        </button>
      </div>
    </section>
  );
}

/** What a hand still needs before its insurance can be priced, in the order it is entered. */
function missingParts(hand: InsuranceHand, nameOf: (id: string) => string): string[] {
  return [
    ...(hand.board.length < 3 ? [t.insurance.insuranceHandFlow.flop] : []),
    ...(hand.players.length < MIN_PLAYERS ? [t.insurance.insuranceHandFlow.twoPlayers] : []),
    ...hand.players.flatMap((player) => {
      const parts = [
        ...(player.cover || player.chips > 0 ? [] : [t.common.chips]),
        ...(player.cards.length === 2 ? [] : [t.insurance.insuranceHandFlow.holeCards]),
      ];
      return parts.length > 0 ? [`${nameOf(player.playerId)}（${parts.join("、")}）`] : [];
    }),
  ];
}

/**
 * One all-in from the players to the last card. The pot and the players are entered on the page
 * itself, and the insurance shows under them as soon as there is enough to price it. Every change
 * is kept, so it survives leaving the page.
 */
export function InsuranceHandFlow({
  rule,
  seats,
  open,
  createHand,
  store,
  seat,
}: InsuranceHandFlowProps) {
  // A hand carried on from keeps its own dead money; a new one starts with the preset
  const [kept, setHand] = useState(() => open ?? withPresetPools(createHand()));
  // What cards are being picked for: 翻牌, 转牌 or a player, by its ID
  const [picking, setPicking] = useState<string>();
  // The card picked for the street being dealt, until it is confirmed
  const [dealt, setDealt] = useState<Card>();
  // A turn set aside while the flop is short of a card, to come back once it is whole again
  const heldTurn = useRef<Card | undefined>(undefined);
  // Dead money's field, where a tap on dead money in a pot's legend lands
  const deadRef = useRef<HTMLInputElement>(null);
  const [finishing, setFinishing] = useState(false);
  // The kind of card whose cards are open, by the key its covers share
  const [managing, setManaging] = useState<string>();
  // Why a tap on the plus added nobody
  const [notice, setNotice] = useState<string>();

  const hand = withFirstPlayers(kept, seats);
  const nameOf = (id: string) => seats.find((s) => s.id === id)?.name ?? t.common.unknownPlayer;
  const totals = potTotals(handPotEntries(hand));
  const street = nextStreet(hand.board);

  // Hands saved before the board moved onto this screen can still be on the street step
  const entering = hand.step === "players" || hand.step === "start";
  // Whoever is in the pot prices everything sold, so the pot stays as it is once anything is
  const editable = hand.purchases.length === 0 && (entering || hand.step === "buy");
  const complete = playersReady(hand.players) && hand.board.length >= 3;
  // Priced as soon as there is enough to price, with nothing to confirm first
  const pricing = complete && (entering || hand.step === "buy");

  const offers = useMemo(() => (pricing ? handOffers(hand, rule) : []), [pricing, hand, rule]);
  // The chips, dead money and decisions change none of this, so they do not deal the runouts again
  const { players, board } = hand;
  const cardsKey = players.map((p) => `${p.playerId}:${p.cards.join(",")}`).join("|");
  // biome-ignore lint/correctness/useExhaustiveDependencies: the players count only by who holds which cards
  const standings = useMemo(() => handStandings({ players, board }), [cardsKey, board]);
  const potCount = new Set(offers.map((o) => o.potIndex)).size;
  // A leader's offers on a pot share one block: the cards that overtake, then the tie cards
  const blocks = offers
    .filter((o, index) => {
      const before = offers[index - 1];
      return before?.potIndex !== o.potIndex || before.leader.playerId !== o.leader.playerId;
    })
    .map((first) => ({
      first,
      group: offers.filter(
        (o) => o.potIndex === first.potIndex && o.leader.playerId === first.leader.playerId,
      ),
    }));
  // Side pots are drawn pot by pot; a single pot keeps the ring
  const breakdown = complete ? handPotBreakdown(hand) : [];
  // While buying, a lone pot is drawn in its own insurance block, so the overview would repeat it
  const overview = complete && (breakdown.length > 1 || offers.length === 0);
  // Something has been entered, so there is a hand to give up
  const started =
    kept.players.length > 0 ||
    kept.board.length > 0 ||
    (kept.pools.length > 0 && !kept.presetPools);

  function update(next: InsuranceHand) {
    setHand(next);
    setNotice(undefined);
    store?.save(next);
  }

  function reset() {
    setHand(withPresetPools(createHand()));
    setPicking(undefined);
    setNotice(undefined);
  }

  function discard() {
    if (!window.confirm(t.insurance.insuranceHandFlow.dropThisHandsInsuranceWhatWas)) return;
    store?.discard(hand.id);
    reset();
  }

  async function confirmSettle() {
    update({ ...hand, step: hand.board.length < 5 ? "buy" : "summary" });
  }

  async function finish() {
    if (store) {
      setFinishing(true);
      try {
        await store.finish(hand);
        reset();
      } finally {
        setFinishing(false);
      }
    } else {
      reset();
    }
  }

  /** One player's row with something changed. Offers turned down were for the pot as it was. */
  const withPlayer = (playerId: string, change: Partial<InsuranceHandPlayer>): InsuranceHand => ({
    ...hand,
    players: hand.players.map((p) => (p.playerId === playerId ? { ...p, ...change } : p)),
    declined: [],
    skippedOuts: {},
  });

  /** Adds the next player of the table, or says that nobody is left to add. */
  function addPlayer() {
    const [next] = nextPlayers(hand.players, seats, 1);
    if (next)
      update({
        ...hand,
        players: [...hand.players, next],
        declined: [],
        skippedOuts: {},
        splitOuts: {},
      });
    else
      setNotice(
        store
          ? t.insurance.insuranceHandFlow.noMorePlayersAtTheTable
          : t.insurance.insuranceHandFlow.noRoomForMorePlayers,
      );
  }

  /** Counted chips are the player's true stack, so they go to the table once typing is done. */
  function commitChips(playerId: string) {
    const player = hand.players.find((p) => p.playerId === playerId);
    store?.save(hand);
    if (player && !player.cover && player.chips > 0) {
      store?.enterStack(playerId, player.chips);
    }
  }

  /** At most one player covers the others. The chips typed stay as they are under the cover. */
  function setCover(playerId: string, cover: boolean) {
    update({
      ...hand,
      players: hand.players.map((p) =>
        p.playerId === playerId ? { ...p, cover } : cover ? { ...p, cover: false } : p,
      ),
      declined: [],
      skippedOuts: {},
    });
  }

  /** Changes the cards entered for the board. Cards dealt through the hand are settled as they come. */
  function saveBoard(next: readonly Card[]) {
    update({ ...hand, board: next, declined: [], skippedOuts: {}, splitOuts: {} });
  }

  /**
   * Keeps the cards picked for the flop, the turn or a player, as they are picked. The turn stands
   * on a whole flop: while a flop card is being changed it is set aside, and comes back with the
   * third card unless it has been taken meanwhile.
   */
  function saveCards(id: string, cards: readonly Card[]) {
    if (id === "turn") {
      heldTurn.current = undefined;
      saveBoard([...hand.board.slice(0, 3), ...cards]);
    } else if (id === "flop") {
      const turn = hand.board[3] ?? heldTurn.current;
      const whole = cards.length === 3;
      heldTurn.current = whole ? undefined : turn;
      const free = turn !== undefined && !cards.includes(turn);
      saveBoard(whole && free && turn !== undefined ? [...cards, turn] : cards);
    } else {
      update(withPlayer(id, { cards }));
    }
  }

  /** Opens the cards for a target. A tap on a player's card lets that card go, to be picked again. */
  function pickFor(id: string, replace?: number) {
    const player = hand.players.find((p) => p.playerId === id);
    if (player && replace !== undefined) {
      update(withPlayer(id, { cards: player.cards.filter((_, place) => place !== replace) }));
    }
    setPicking(id);
  }

  /** The contested pot by who put it in, each with where they stand: leaders first, dead money last. */
  function potParts(): PotShare[] {
    const stakes = contestedStakes(handPotEntries(hand));
    const live = hand.players.map((player): PotShare => {
      const note = standingNote(standings, player.playerId, hand.board.length < 5);
      return {
        key: player.playerId,
        tone: note?.leading ? "leader" : "trailer",
        label: nameOf(player.playerId),
        chips: stakes[player.playerId] ?? 0,
        note: note?.text,
      };
    });
    return [
      ...live.filter((part) => part.tone === "leader"),
      ...live.filter((part) => part.tone !== "leader"),
      {
        key: "dead-money",
        tone: "dead",
        label: t.common.deadMoney,
        chips: totals.deadChips,
        onSelect: editable ? () => deadRef.current?.focus() : undefined,
      },
    ];
  }

  const decisions: Decisions | undefined = store && {
    get(key) {
      const purchase = hand.purchases.find((p) => p.offerKey === key);
      if (purchase) return { kind: "bought", purchaseId: purchase.id, ...purchase };
      return hand.declined.includes(key) ? { kind: "declined" } : undefined;
    },
    buy(key, { option, oddsHundredths }) {
      const offer = offers.find((o) => o.key === key);
      if (offer) update(buyOffer(hand, offer, crypto.randomUUID(), option, oddsHundredths));
    },
    decline: (key) => update(declineOffer(hand, key)),
    revise: (key) => update(reviseOffer(hand, key)),
  };

  const managed = offers.find((offer) => offer.baseKey === managing);
  const marks = playerMarks(hand.players.map((p) => nameOf(p.playerId)));
  const flopCards = hand.board.slice(0, 3);
  const targets: CardTarget[] = [
    {
      id: "flop",
      label: t.insurance.insuranceHandFlow.flop,
      count: 3,
      cards: flopCards,
      mark: t.insurance.insuranceHandFlow.flopShort,
      tone: "board",
    },
    {
      id: "turn",
      label: t.common.turn,
      count: 1,
      cards: hand.board.slice(3, 4),
      mark: t.insurance.insuranceHandFlow.turnShort,
      tone: "board",
      // The turn comes after a whole flop
      disabled: flopCards.length < 3,
      faint: true,
    },
    ...hand.players.map(
      (p, index): CardTarget => ({
        id: p.playerId,
        label: nameOf(p.playerId),
        count: 2,
        cards: p.cards,
        mark: marks[index] ?? "",
        tone: "player",
      }),
    ),
  ];
  const missing = missingParts(hand, nameOf);

  return (
    <>
      {hand.step !== "summary" && (
        <>
          <section aria-labelledby="hand-pot-title" className="mt-1">
            <SectionTitle id="hand-pot-title" title={t.insurance.insuranceHandFlow.pot} />
            <div className="relative flex flex-wrap items-stretch justify-center gap-1.5">
              {/* The arrow sits at the end of the flop's own name, and clears the board only */}
              <div className="relative flex">
                <StreetCards
                  label={t.insurance.insuranceHandFlow.flop}
                  cards={flopCards}
                  count={3}
                  onPick={editable ? () => pickFor("flop") : undefined}
                />
                {editable && (
                  <button
                    type="button"
                    aria-label={t.insurance.insuranceHandFlow.clearTheFlopAndTurn}
                    onClick={() => {
                      heldTurn.current = undefined;
                      saveBoard([]);
                    }}
                    className="absolute right-0 bottom-0 grid size-8 place-items-center text-muted"
                  >
                    <RotateCcw className="size-3.5" strokeWidth={1.75} aria-hidden />
                  </button>
                )}
              </div>
              <StreetCards
                label={
                  hand.board.length > 3 ? t.common.turn : t.insurance.insuranceHandFlow.turnOptional
                }
                cards={hand.board.slice(3, 4)}
                count={1}
                optional
                disabled={hand.board.length < 3}
                onPick={editable ? () => pickFor("turn") : undefined}
              />
              {hand.board.length === 5 && (
                <StreetCards label={t.common.river} cards={hand.board.slice(4)} count={1} />
              )}
              <span aria-hidden className="mx-1 w-px self-stretch bg-line" />
              <DeadMoney
                chips={totals.deadChips}
                preset={hand.presetPools === true}
                inputRef={deadRef}
                edits={
                  editable
                    ? {
                        // One amount, kept as it is typed and saved once the field is left. Typed
                        // or confirmed, it is the organizer's own from then on.
                        onChips: (chips) =>
                          setHand({
                            ...hand,
                            pools: chips > 0 ? [chips] : [],
                            presetPools: false,
                            declined: [],
                            skippedOuts: {},
                          }),
                        onDone: () => store?.save(hand),
                      }
                    : undefined
                }
              />
            </div>
          </section>

          <section aria-labelledby="hand-players-title" className="mt-3">
            <SectionTitle
              id="hand-players-title"
              title={t.insurance.insuranceHandFlow.playersInThePot}
            />
            {seats.length < MIN_PLAYERS && (
              <p className="mb-2 text-sm text-muted">
                {t.insurance.insuranceHandFlow.insuranceNeedsAtLeastTwoPlayers}
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {hand.players.map((player, index) => {
                const { playerId } = player;
                return (
                  <li key={playerId}>
                    <HandPlayerRow
                      name={nameOf(playerId)}
                      player={player}
                      note={standingNote(standings, playerId, hand.board.length < 5)}
                      edits={
                        editable
                          ? {
                              seats,
                              takenIds: hand.players
                                .filter((p) => p !== player)
                                .map((p) => p.playerId),
                              // At a table another player is another hand: their own chips, no
                              // cover and no cards. Away from one the name is only a label, and
                              // what was entered stays.
                              onSeat: (id) =>
                                update(
                                  withPlayer(playerId, {
                                    playerId: id,
                                    ...(store && {
                                      chips: seats.find((s) => s.id === id)?.chips ?? 0,
                                      cover: false,
                                      cards: [],
                                    }),
                                  }),
                                ),
                              // Kept and sent to the table once the field is left, not on every digit
                              onChips: (chips) => setHand(withPlayer(playerId, { chips })),
                              onChipsDone: () => commitChips(playerId),
                              onCover: (cover) => setCover(playerId, cover),
                              // The two a hand cannot do without are cleared; the rest go
                              lead:
                                index < MIN_PLAYERS
                                  ? {
                                      kind: "reset",
                                      label: t.insurance.insuranceHandFlow.clearSHoleCards(
                                        nameOf(playerId),
                                      ),
                                      onSelect: () =>
                                        update(withPlayer(playerId, { cards: [], cover: false })),
                                    }
                                  : {
                                      kind: "remove",
                                      label: t.insurance.insuranceHandFlow.delete(nameOf(playerId)),
                                      onSelect: () =>
                                        update({
                                          ...hand,
                                          players: hand.players.filter((p) => p !== player),
                                          declined: [],
                                          skippedOuts: {},
                                        }),
                                    },
                            }
                          : undefined
                      }
                    >
                      <HoleCards
                        name={nameOf(playerId)}
                        cards={player.cards}
                        onPick={editable ? (replace) => pickFor(playerId, replace) : undefined}
                      />
                    </HandPlayerRow>
                  </li>
                );
              })}
            </ul>
            {editable && (
              <RoundAction label={t.insurance.insuranceHandFlow.addAPlayer} onSelect={addPlayer}>
                <Plus className="size-4" aria-hidden />
              </RoundAction>
            )}
            {notice && (
              <p role="status" className="mt-1 text-center text-sm text-muted">
                {notice}
              </p>
            )}
          </section>

          {overview && (
            <div className="mt-3">
              {breakdown.length > 1 ? (
                <PotColumns
                  pots={breakdown}
                  nameOf={nameOf}
                  tiesSold={rule.tieOuts === "include"}
                  cardsToCome={hand.board.length < 5}
                />
              ) : (
                <PotShares parts={potParts()} look={hand.players.length > 3 ? "bar" : "ring"} />
              )}
            </div>
          )}
        </>
      )}

      {(entering || hand.step === "buy") && (
        <section aria-labelledby="hand-insurance-title" className="mt-3">
          <SectionTitle id="hand-insurance-title" title={t.insurance.insuranceHandFlow.insurance} />
          {!pricing && (
            <p className="text-sm text-muted">
              {missing.length > 0
                ? t.insurance.insuranceHandFlow.stillNeededInsuranceShowsHereOnce(
                    missing.join("、"),
                  )
                : t.insurance.insuranceHandFlow.onlyOnePlayerCanCoverAnd}
            </p>
          )}
          {pricing && !street && (
            <p className="text-sm text-muted">
              {t.insurance.insuranceHandFlow.theBoardIsCompleteSoThere}
            </p>
          )}
          {pricing && street && (
            <>
              {blocks.map(({ first, group }) => (
                <PotInsurance
                  key={first.key}
                  offers={group}
                  label={potName(first.potIndex, potCount)}
                  nameOf={nameOf}
                  rule={rule}
                  decisions={decisions}
                  onManage={(offer) => setManaging(offer.baseKey)}
                />
              ))}
              <button
                type="button"
                disabled={store !== undefined && !offersDecided(hand, offers)}
                onClick={() => update({ ...hand, step: "deal" })}
                className={cn(primaryClass, "mt-3")}
              >
                {t.insurance.insuranceHandFlow.record(STREET_TEXT[street])}
              </button>
            </>
          )}
        </section>
      )}

      {hand.step === "settle" && (
        <SettleStep
          hand={hand}
          nameOf={nameOf}
          saving={finishing}
          onChangeCard={() => update(undoDeal(hand))}
          onConfirm={confirmSettle}
        />
      )}

      {hand.step === "summary" && (
        <HandSummary
          hand={hand}
          nameOf={nameOf}
          seat={seat}
          recording={store !== undefined}
          seatedIds={seats.map(({ id }) => id)}
          saving={finishing}
          onBack={() => update({ ...hand, step: "settle" })}
          onConfirm={finish}
        />
      )}

      {started && hand.step !== "summary" && (
        <button
          type="button"
          onClick={discard}
          className="mt-2 min-h-11 w-full rounded-xl text-sm text-muted"
        >
          {t.insurance.insuranceHandFlow.dropThisHand}
        </button>
      )}

      {managed && (
        <OutsManager
          title={t.insurance.insuranceHandFlow.outs(
            potName(managed.potIndex, potCount),
            managed.kind === "tie" ? t.common.tie : t.common.outdraw,
          )}
          kindText={managed.kind === "tie" ? t.common.tie : t.common.outdraw}
          cards={managed.allOuts}
          plan={{
            skipped: managed.skippedOuts,
            second: offers.find((o) => o.baseKey === managing && o.part === 2)?.outs ?? [],
          }}
          oddsOf={(count) => rule.oddsHundredths[count - 1]}
          onConfirm={(plan) => {
            update(arrangeOuts(hand, managed.baseKey, plan));
            setManaging(undefined);
          }}
          onCancel={() => setManaging(undefined)}
        />
      )}

      {picking !== undefined && editable && (
        <HandCardPicker
          targets={targets}
          active={picking}
          onActive={setPicking}
          onCards={saveCards}
          onReset={() => {
            heldTurn.current = undefined;
            update({
              ...hand,
              board: [],
              players: hand.players.map((p) => ({ ...p, cards: [] })),
              declined: [],
              skippedOuts: {},
              splitOuts: {},
            });
          }}
          onClose={() => setPicking(undefined)}
        />
      )}

      {hand.step === "deal" && street && (
        // The card dealt through the hand, in the same picker: the cards already in show whose
        // they are and stay as they are, and the river is picked nowhere else
        <HandCardPicker
          targets={[
            ...targets,
            {
              id: "deal",
              label: STREET_TEXT[street],
              count: 1,
              cards: dealt === undefined ? [] : [dealt],
              mark:
                street === "turn"
                  ? t.insurance.insuranceHandFlow.turnShort
                  : t.insurance.insuranceHandFlow.riverShort,
              tone: "board",
            },
          ]}
          active="deal"
          onActive={() => {}}
          onCards={(_, cards) => setDealt(cards[0])}
          onReset={() => {}}
          onClose={() => {
            if (dealt === undefined) return;
            setDealt(undefined);
            update(dealCard(hand, dealt));
          }}
          locked={{
            onCancel: () => {
              setDealt(undefined);
              update({ ...hand, step: "buy" });
            },
          }}
        />
      )}
    </>
  );
}
