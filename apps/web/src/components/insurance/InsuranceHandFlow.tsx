import {
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
import { useMemo, useState } from "react";
import { formatSignedChips } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { BOARD_PLACES, CardFace } from "./CardFace";
import { CardPicker } from "./CardPicker";
import { DeadMoneyDialog } from "./DeadMoneyDialog";
import { HandPlayerRow, type StandingNote } from "./HandPlayerRow";
import { HandSummary } from "./HandSummary";
import type { InsuranceSeat } from "./InsuranceCalculator";
import type { Decisions } from "./LeaderQuote";
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

const STREET_TEXT = { turn: "转牌", river: "河牌" } as const;

/** The cards taken, less the ones being picked again. */
const withoutCards = (used: ReadonlySet<Card>, free: readonly Card[]) =>
  new Set([...used].filter((card) => !free.includes(card)));

/** A player as they sit down in a hand: the chips they have at the table, and no cards yet. */
const seatedPlayer = ({ id, chips = 0 }: InsuranceSeat): InsuranceHandPlayer => ({
  playerId: id,
  chips,
  cover: false,
  cards: [],
});

/** A hand needs two players, and starts with two. */
const MIN_PLAYERS = 2;

/** The first players of the table who are not in the hand yet, in the table's order. */
function nextPlayers(
  players: readonly InsuranceHandPlayer[],
  seats: readonly InsuranceSeat[],
  count: number,
): InsuranceHandPlayer[] {
  const taken = players.map((p) => p.playerId);
  return seats
    .filter(({ id }) => !taken.includes(id))
    .slice(0, Math.max(0, count))
    .map(seatedPlayer);
}

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
      aria-label={empty ? `选择${label}` : `修改${label}`}
      disabled={disabled}
      onClick={onPick}
      className={cn(frame, "disabled:opacity-40")}
    >
      {content}
    </button>
  );
}

/** Three chips in a stack: outlines while empty, filled once there is dead money. */
function ChipStack({ lit }: { lit: boolean }) {
  // Opaque fills, so each chip hides the one under it
  const side = lit ? "color-mix(in srgb, currentColor 35%, var(--bg))" : "var(--bg)";
  const face = lit ? "color-mix(in srgb, currentColor 60%, var(--bg))" : "var(--bg)";
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-7 shrink-0"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      {[15, 10.5, 6].map((top) => (
        <g key={top}>
          <path d={`M4 ${top}v3.5a8 3 0 0 0 16 0v-3.5`} fill={side} />
          <ellipse cx="12" cy={top} rx="8" ry="3" fill={face} />
        </g>
      ))}
    </svg>
  );
}

/**
 * Dead money, framed like a street of the board: the chip stack with its name underneath. It
 * lights up once there is some, and the name gives the amount.
 */
function DeadMoney({ chips, onEdit }: { chips: number; onEdit: (() => void) | undefined }) {
  const lit = chips > 0;
  const className = cn(
    "flex shrink-0 flex-col items-center gap-1 rounded-xl border-2 px-2 pt-2 pb-1",
    lit
      ? "border-highlight bg-highlight/10 text-highlight"
      : "border-dashed border-line text-muted",
  );
  const content = (
    <>
      <span className="grid h-11 place-items-center">
        <ChipStack lit={lit} />
      </span>
      <span className="text-xs whitespace-nowrap tabular-nums">
        {lit ? `死钱 ${chipText(chips)}` : "死钱"}
      </span>
    </>
  );
  if (!onEdit) return <div className={className}>{content}</div>;
  return (
    <button type="button" aria-label="编辑死钱" onClick={onEdit} className={className}>
      {content}
    </button>
  );
}

/**
 * A section's name, a little larger than the text, in the middle of the page with a line at
 * either side on its own middle, each fading out toward the edge. Its arrow, right after the
 * name, puts the section back as it started.
 */
function SectionTitle({
  id,
  title,
  reset,
}: {
  id?: string;
  title: string;
  /** Missing where the section can no longer change */
  reset?: { readonly label: string; readonly onReset: () => void } | undefined;
}) {
  return (
    // A place the arrow's width at either side of the name, so the name stays in the middle
    <div className="mb-2 flex min-h-11 items-center">
      <span aria-hidden className="h-px flex-1 bg-linear-to-r from-transparent to-line" />
      <span aria-hidden className="w-9 shrink-0" />
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {reset ? (
        <button
          type="button"
          aria-label={reset.label}
          onClick={reset.onReset}
          className="grid h-11 w-9 shrink-0 place-items-center text-muted"
        >
          <RotateCcw className="size-4.5" strokeWidth={1.75} aria-hidden />
        </button>
      ) : (
        <span aria-hidden className="w-9 shrink-0" />
      )}
      <span aria-hidden className="h-px flex-1 bg-linear-to-l from-transparent to-line" />
    </div>
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
      <h2 className="font-semibold">{STREET_TEXT[street]}保险结算</h2>
      {purchases.length === 0 && <p className="mt-1 text-sm text-muted">这条街没有投保。</p>}
      <ul className="divide-y divide-line">
        {purchases.map((purchase) => (
          <li key={purchase.id} className="py-2">
            <p className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate font-medium">{nameOf(purchase.playerId)}</span>
              <span className={cn("shrink-0 font-semibold", purchase.hit && "text-highlight")}>
                {purchase.hit ? `命中 · 赔付 ${chipText(purchase.payoutChips)}` : "未中"}
              </span>
            </p>
            <p className="text-sm text-muted tabular-nums">
              {purchase.outs.length} outs · 保费 {chipText(purchase.premiumChips)}
            </p>
          </li>
        ))}
      </ul>
      {last && (
        <p className="mt-2 border-t border-line pt-2 text-sm">
          本手保费 {chipText(result.premiumChips)} · 赔付 {chipText(result.payoutChips)} · 保险盈亏{" "}
          <span className="font-semibold">{formatSignedChips(result.seatChips)}</span>
        </p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={onChangeCard} className={secondaryClass}>
          改这张牌
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onConfirm}
          className="min-h-11 rounded-xl bg-accent font-semibold text-accent-text disabled:opacity-40"
        >
          确认结算
        </button>
      </div>
    </section>
  );
}

/** What a hand still needs before its insurance can be priced, in the order it is entered. */
function missingParts(hand: InsuranceHand, nameOf: (id: string) => string): string[] {
  return [
    ...(hand.board.length < 3 ? ["翻牌"] : []),
    ...(hand.players.length < MIN_PLAYERS ? ["两位玩家"] : []),
    ...hand.players.flatMap((player) => {
      const parts = [
        ...(player.cover || player.chips > 0 ? [] : ["筹码"]),
        ...(player.cards.length === 2 ? [] : ["手牌"]),
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
  const [kept, setHand] = useState(() => open ?? createHand());
  const [pickingCards, setPickingCards] = useState<{ playerId: string; replace?: number }>();
  const [editingDead, setEditingDead] = useState(false);
  const [pickingStreet, setPickingStreet] = useState<"flop" | "turn">();
  const [finishing, setFinishing] = useState(false);
  // Why a tap on the plus added nobody
  const [notice, setNotice] = useState<string>();

  const hand = withFirstPlayers(kept, seats);
  const nameOf = (id: string) => seats.find((s) => s.id === id)?.name ?? "未知玩家";
  const totals = potTotals(handPotEntries(hand));
  const usedCards = new Set([...hand.players.flatMap((p) => p.cards), ...hand.board]);
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
  // Side pots are drawn pot by pot; a single pot keeps the ring
  const breakdown = complete ? handPotBreakdown(hand) : [];
  // While buying, a lone pot is drawn in its own insurance block, so the overview would repeat it
  const overview = complete && (breakdown.length > 1 || offers.length === 0);
  // Something has been entered, so there is a hand to give up
  const started = kept.players.length > 0 || kept.board.length > 0 || kept.pools.length > 0;

  function update(next: InsuranceHand) {
    setHand(next);
    setNotice(undefined);
    store?.save(next);
  }

  function reset() {
    setHand(createHand());
    setPickingCards(undefined);
    setNotice(undefined);
  }

  function discard() {
    if (!window.confirm("放弃这手保险？已录入的内容不会保留。")) return;
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
  });

  /** Adds the next player of the table, or says that nobody is left to add. */
  function addPlayer() {
    const [next] = nextPlayers(hand.players, seats, 1);
    if (next) update({ ...hand, players: [...hand.players, next], declined: [] });
    else setNotice(store ? "桌上没有更多玩家了。" : "玩家已经加满了。");
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
    });
  }

  /** Changes the cards entered for the board. Cards dealt through the hand are settled as they come. */
  function saveBoard(next: readonly Card[]) {
    update({ ...hand, board: next, declined: [] });
    setPickingStreet(undefined);
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
        label: "死钱",
        chips: totals.deadChips,
        onSelect: editable ? () => setEditingDead(true) : undefined,
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

  const picking = pickingCards && hand.players.find((p) => p.playerId === pickingCards.playerId);
  const missing = missingParts(hand, nameOf);

  return (
    <>
      {hand.step !== "summary" && (
        <>
          <section aria-labelledby="hand-pot-title" className="mt-1">
            <SectionTitle
              id="hand-pot-title"
              title="底池信息"
              reset={
                editable
                  ? {
                      label: "清空底池信息",
                      onReset: () => update({ ...hand, board: [], pools: [], declined: [] }),
                    }
                  : undefined
              }
            />
            <div className="flex flex-wrap items-stretch justify-center gap-1.5">
              <StreetCards
                label="翻牌"
                cards={hand.board.slice(0, 3)}
                count={3}
                onPick={editable ? () => setPickingStreet("flop") : undefined}
              />
              <StreetCards
                label={hand.board.length > 3 ? "转牌" : "转牌·可选"}
                cards={hand.board.slice(3, 4)}
                count={1}
                optional
                disabled={hand.board.length < 3}
                onPick={editable ? () => setPickingStreet("turn") : undefined}
              />
              {hand.board.length === 5 && (
                <StreetCards label="河牌" cards={hand.board.slice(4)} count={1} />
              )}
              <span aria-hidden className="mx-1 w-px self-stretch bg-line" />
              <DeadMoney
                chips={totals.deadChips}
                onEdit={editable ? () => setEditingDead(true) : undefined}
              />
            </div>
          </section>

          <section aria-labelledby="hand-players-title" className="mt-3">
            <SectionTitle
              id="hand-players-title"
              title="池内玩家"
              reset={
                editable
                  ? {
                      label: "重置池内玩家",
                      onReset: () =>
                        update({
                          ...hand,
                          players: nextPlayers([], seats, MIN_PLAYERS),
                          declined: [],
                        }),
                    }
                  : undefined
              }
            />
            {seats.length < MIN_PLAYERS && (
              <p className="mb-2 text-sm text-muted">桌上至少要有两位玩家，才能算保险。</p>
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
                              // The cards entered stay with the row. At a table the chips are
                              // the new player's own; away from one, the chips typed stay too.
                              onSeat: (id) =>
                                update(
                                  withPlayer(playerId, {
                                    playerId: id,
                                    ...(store && {
                                      chips: seats.find((s) => s.id === id)?.chips ?? 0,
                                    }),
                                  }),
                                ),
                              // Kept and sent to the table once the field is left, not on every digit
                              onChips: (chips) => setHand(withPlayer(playerId, { chips })),
                              onChipsDone: () => commitChips(playerId),
                              onCover: (cover) => setCover(playerId, cover),
                              onCards: (replace) =>
                                setPickingCards(
                                  replace === undefined ? { playerId } : { playerId, replace },
                                ),
                              onRemove:
                                index >= MIN_PLAYERS
                                  ? () =>
                                      update({
                                        ...hand,
                                        players: hand.players.filter((p) => p !== player),
                                        declined: [],
                                      })
                                  : undefined,
                            }
                          : undefined
                      }
                    />
                  </li>
                );
              })}
            </ul>
            {editable && (
              <button
                type="button"
                aria-label="添加玩家"
                onClick={addPlayer}
                className="mt-2 grid min-h-11 w-full place-items-center rounded-xl border border-dashed border-line text-highlight"
              >
                <Plus className="size-5" aria-hidden />
              </button>
            )}
            {notice && (
              <p role="status" className="mt-1 text-sm text-muted">
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
          <SectionTitle id="hand-insurance-title" title="保险信息" />
          {!pricing && (
            <p className="text-sm text-muted">
              {missing.length > 0
                ? `还差：${missing.join("、")}。填好后这里直接显示保险。`
                : "只能有一位玩家 Cover，至少两位玩家才能算保险。"}
            </p>
          )}
          {pricing && !street && <p className="text-sm text-muted">公共牌已发完，没有保险可买。</p>}
          {pricing && street && (
            <>
              {offers.map((offer) => (
                <PotInsurance
                  key={offer.key}
                  offer={offer}
                  label={potName(offer.potIndex, potCount)}
                  nameOf={nameOf}
                  rule={rule}
                  decisions={decisions}
                />
              ))}
              <button
                type="button"
                disabled={store !== undefined && !offersDecided(hand, offers)}
                onClick={() => update({ ...hand, step: "deal" })}
                className={cn(primaryClass, "mt-3")}
              >
                选择{STREET_TEXT[street]}
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
          放弃这手
        </button>
      )}

      {editingDead && (
        <DeadMoneyDialog
          pools={hand.pools.map(String)}
          onConfirm={(next) => {
            update({ ...hand, pools: next.map(Number), declined: [] });
            setEditingDead(false);
          }}
          onCancel={() => setEditingDead(false)}
        />
      )}

      {pickingCards && picking && (
        <CardPicker
          title={`${nameOf(picking.playerId)}：${
            picking.cards.length === 2 ? "更换手牌" : "选择两张手牌"
          }`}
          count={2}
          usedCards={withoutCards(usedCards, picking.cards)}
          initial={picking.cards}
          replace={pickingCards.replace}
          onConfirm={(cards) => {
            update(withPlayer(picking.playerId, { cards }));
            setPickingCards(undefined);
          }}
          onCancel={() => setPickingCards(undefined)}
        />
      )}

      {pickingStreet === "flop" && (
        <CardPicker
          title="选择三张翻牌"
          count={3}
          usedCards={withoutCards(usedCards, hand.board.slice(0, 3))}
          initial={hand.board.slice(0, 3)}
          onConfirm={(flop) => saveBoard([...flop, ...hand.board.slice(3)])}
          onCancel={() => setPickingStreet(undefined)}
        />
      )}

      {pickingStreet === "turn" && (
        <CardPicker
          title="选择转牌"
          count={1}
          optional
          usedCards={withoutCards(usedCards, hand.board.slice(3, 4))}
          initial={hand.board.slice(3, 4)}
          onConfirm={(turn) => saveBoard([...hand.board.slice(0, 3), ...turn])}
          onCancel={() => setPickingStreet(undefined)}
        />
      )}

      {hand.step === "deal" && (
        <CardPicker
          title={`选择${street ? STREET_TEXT[street] : "公共牌"}`}
          count={1}
          usedCards={usedCards}
          onConfirm={([card]) => card !== undefined && update(dealCard(hand, card))}
          onCancel={() => update({ ...hand, step: "buy" })}
        />
      )}
    </>
  );
}
