import {
  buyOffer,
  type Card,
  contestedStakes,
  dealCard,
  declineOffer,
  formatCard,
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
import { ChevronDown, Plus, X } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { formatCardText } from "@/lib/cards";
import { formatSignedChips } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { CardPicker } from "./CardPicker";
import { DeadMoneyDialog } from "./DeadMoneyDialog";
import { HandSummary } from "./HandSummary";
import type { InsuranceSeat } from "./InsuranceCalculator";
import type { Decisions } from "./LeaderQuote";
import { Modal } from "./Modal";
import { PlayerChipsDialog } from "./PlayerChipsDialog";
import { PotColumns, potName } from "./PotColumns";
import { PotInsurance } from "./PotInsurance";
import { type PotShare, PotShares } from "./PotShares";
import { SeatPicker } from "./SeatPicker";

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
  seats: readonly InsuranceSeat[];
  /** Hands out the seats in order instead of asking who is all-in. */
  autoSeat: boolean;
  /** The hand in progress, to carry on from. */
  open: InsuranceHand | undefined;
  createHand: () => InsuranceHand;
  store: HandStore | undefined;
  seat: SeatChips | undefined;
}

/** The player being added through seat, chips and cards, or the one part of a player being changed. */
type Adding =
  | { readonly stage: "seat" }
  | { readonly stage: "chips"; readonly entry: InsuranceHandPlayer }
  | {
      readonly stage: "cards";
      readonly entry: InsuranceHandPlayer;
      /** The card tapped, to change that one. */
      readonly replace?: number;
    }
  | { readonly stage: "more" }
  /** Another seat takes over this player's chips and cards. */
  | { readonly stage: "swap"; readonly entry: InsuranceHandPlayer };

const STREET_TEXT = { turn: "转牌", river: "河牌" } as const;

/** The cards taken, less the ones being picked again. */
const withoutCards = (used: ReadonlySet<Card>, free: readonly Card[]) =>
  new Set([...used].filter((card) => !free.includes(card)));

const blankPlayer = (playerId: string): InsuranceHandPlayer => ({
  playerId,
  chips: 0,
  cover: false,
  cards: [],
});

const chipText = (chips: number) => chips.toLocaleString("zh-CN");
const percentText = (share: number) => `${(share * 100).toFixed(1)}%`;

const primaryClass =
  "min-h-12 w-full rounded-xl bg-accent font-semibold text-accent-text disabled:opacity-40";
const secondaryClass = "min-h-11 w-full rounded-xl border border-line font-medium";

/** A card, or a question mark in its place. `solid` draws the empty place as a card that must come. */
export function CardFace({ card, solid = false }: { card: Card | null; solid?: boolean }) {
  const red = card !== null && /[hd]/.test(formatCard(card)[1] ?? "");
  return (
    <span
      className={cn(
        "grid h-11 w-9 place-items-center rounded-md border text-sm font-semibold tabular-nums",
        card !== null && "border-line bg-bg",
        card === null &&
          (solid ? "border-line bg-surface text-muted" : "border-dashed border-line text-muted"),
        red && "text-loss",
      )}
    >
      {card === null ? "?" : formatCardText(card)}
    </span>
  );
}

const BOARD_PLACES = [0, 1, 2, 3, 4] as const;

/** Five places: dealt cards, then question marks. */
export function BoardCards({ cards }: { cards: readonly Card[] }) {
  return (
    <span className="flex gap-1" role="img" aria-label={`公共牌已发 ${cards.length} 张`}>
      {BOARD_PLACES.map((place) => (
        <CardFace key={place} card={cards[place] ?? null} />
      ))}
    </span>
  );
}

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

/** Dead money as a chip stack, tapped to enter it. It lights up once there is some. */
function DeadMoney({ chips, onEdit }: { chips: number; onEdit: (() => void) | undefined }) {
  const lit = chips > 0;
  const className = cn(
    "mt-2 flex min-h-11 w-fit items-center gap-2 rounded-xl border px-3",
    lit
      ? "border-highlight bg-highlight/10 text-highlight"
      : "border-dashed border-line text-muted",
  );
  const content = (
    <>
      <ChipStack lit={lit} />
      <span className="text-sm">死钱</span>
      {lit && <span className="text-lg font-semibold tabular-nums">{chipText(chips)}</span>}
    </>
  );
  if (!onEdit) return <div className={className}>{content}</div>;
  return (
    <button type="button" aria-label="编辑死钱" onClick={onEdit} className={className}>
      {content}
    </button>
  );
}

/** Where a player stands, under their name: a leader is lit and shows only the chance to win. */
interface StandingNote {
  readonly leading: boolean;
  readonly text: string;
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

/** One player: name, chips and cards. A part with a handler is tapped to change just that part. */
function PlayerRow({
  name,
  player,
  note,
  onSeat,
  onChips,
  onCard,
  children,
}: {
  name: string;
  player: InsuranceHandPlayer;
  /** Missing until the hands can be compared. */
  note: StandingNote | undefined;
  /** Missing where the seat is given rather than picked. */
  onSeat?: (() => void) | undefined;
  onChips?: (() => void) | undefined;
  onCard?: ((place: number) => void) | undefined;
  children?: ReactNode;
}) {
  const chips = player.cover ? "Cover" : chipText(player.chips);
  const label = (
    <>
      <span className="flex min-w-0 items-center gap-0.5 font-medium">
        <span className="truncate">{name}</span>
        {onSeat && <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />}
      </span>
      {note && (
        <span
          className={cn(
            "truncate text-xs tabular-nums",
            note.leading ? "font-semibold text-accent" : "text-muted",
          )}
        >
          {note.text}
        </span>
      )}
    </>
  );
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border p-2 transition-colors",
        note?.leading ? "border-accent bg-accent/10" : "border-line bg-surface",
      )}
    >
      <div className="min-w-0 flex-1">
        {onSeat ? (
          <button
            type="button"
            aria-label={`更换${name}`}
            onClick={onSeat}
            className="flex min-h-11 max-w-full flex-col justify-center text-left"
          >
            {label}
          </button>
        ) : (
          <div className="flex min-h-11 flex-col justify-center">{label}</div>
        )}
      </div>
      {onChips ? (
        <button
          type="button"
          aria-label={`修改${name}的筹码`}
          onClick={onChips}
          className="min-h-11 shrink-0 rounded-lg border border-line bg-bg px-2 font-semibold tabular-nums"
        >
          {chips}
        </button>
      ) : (
        <span className="shrink-0 font-semibold tabular-nums">{chips}</span>
      )}
      <span className={cn("flex shrink-0", !onCard && "gap-1")}>
        {player.cards.map((card, place) =>
          onCard ? (
            <button
              key={card}
              type="button"
              aria-label={`更换${name}的${formatCardText(card)}`}
              onClick={() => onCard(place)}
              className="grid min-h-11 min-w-11 place-items-center"
            >
              <CardFace card={card} />
            </button>
          ) : (
            <CardFace key={card} card={card} />
          ),
        )}
      </span>
      {children}
    </div>
  );
}

function MoreDialog({
  number,
  onAdd,
  onDone,
}: {
  number: number;
  onAdd: () => void;
  onDone: () => void;
}) {
  return (
    <Modal title="还有玩家吗？" onClose={onDone}>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={onAdd} className={secondaryClass}>
          添加玩家 {number}
        </button>
        <button type="button" onClick={onDone} className={primaryClass}>
          结束
        </button>
      </div>
    </Modal>
  );
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

/** One all-in from the players to the last card. Every change is kept, so it survives leaving the page. */
export function InsuranceHandFlow({
  rule,
  seats,
  autoSeat,
  open,
  createHand,
  store,
  seat,
}: InsuranceHandFlowProps) {
  const [hand, setHand] = useState(() => open ?? createHand());
  const [adding, setAdding] = useState<Adding>();
  const [editingDead, setEditingDead] = useState(false);
  const [pickingStreet, setPickingStreet] = useState<"flop" | "turn">();
  const [finishing, setFinishing] = useState(false);

  const nameOf = (id: string) => seats.find((s) => s.id === id)?.name ?? "未知玩家";
  const totals = potTotals(handPotEntries(hand));
  const usedCards = new Set([...hand.players.flatMap((p) => p.cards), ...hand.board]);
  const street = nextStreet(hand.board);

  const offers = useMemo(() => (hand.step === "buy" ? handOffers(hand, rule) : []), [hand, rule]);
  // Dead money and decisions leave these two as they were, so they do not deal the runouts again
  const { players, board } = hand;
  const standings = useMemo(() => handStandings({ players, board }), [players, board]);
  // Hands saved before the board moved onto this screen can still be on the street step
  const entering = hand.step === "players" || hand.step === "start";
  // Whoever is in the pot prices everything sold, so the pot stays as it is once anything is
  const editable = hand.purchases.length === 0 && (entering || hand.step === "buy");
  const complete = playersReady(hand.players) && hand.board.length >= 3;
  const potCount = new Set(offers.map((o) => o.potIndex)).size;
  // Side pots are drawn pot by pot; a single pot keeps the ring
  const breakdown = complete ? handPotBreakdown(hand) : [];
  // While buying, a lone pot is drawn in its own insurance block, so the overview would repeat it
  const overview = complete && (breakdown.length > 1 || offers.length === 0);

  function update(next: InsuranceHand) {
    setHand(next);
    store?.save(next);
  }

  function reset() {
    setHand(createHand());
    setAdding(undefined);
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

  /** Starts on the next player: at the seat picker, or straight at the chips of the first free seat. */
  function addPlayer(takenSeats: readonly string[]) {
    const free = autoSeat ? seats.find(({ id }) => !takenSeats.includes(id)) : undefined;
    setAdding(free ? { stage: "chips", entry: blankPlayer(free.id) } : { stage: "seat" });
  }

  function savePlayer(entry: InsuranceHandPlayer) {
    const known = hand.players.some((p) => p.playerId === entry.playerId);
    const players = known
      ? hand.players.map((p) => (p.playerId === entry.playerId ? entry : p))
      : [...hand.players, entry];
    // Offers turned down were for the pot as it was
    update({ ...hand, players, declined: [] });
    if (!entry.cover) store?.enterStack(entry.playerId, entry.chips);
    if (known) setAdding(undefined);
    else if (players.length === 1) addPlayer(players.map((p) => p.playerId));
    else setAdding(players.length < seats.length ? { stage: "more" } : undefined);
  }

  /** Seats another player in this one's place, with the chips and cards already entered. */
  function swapPlayer(from: InsuranceHandPlayer, playerId: string) {
    const players = hand.players.map((p) => (p === from ? { ...from, playerId } : p));
    update({ ...hand, players, declined: [] });
    if (!from.cover) store?.enterStack(playerId, from.chips);
    setAdding(undefined);
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
        onSelect: editable ? () => setAdding({ stage: "chips", entry: player }) : undefined,
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

  /** A player's row. While the players can change, each part opens its own edit. */
  function playerRow(player: InsuranceHandPlayer, children?: ReactNode) {
    return (
      <PlayerRow
        name={nameOf(player.playerId)}
        player={player}
        note={standingNote(standings, player.playerId, hand.board.length < 5)}
        onSeat={
          editable && !autoSeat ? () => setAdding({ stage: "swap", entry: player }) : undefined
        }
        onChips={editable ? () => setAdding({ stage: "chips", entry: player }) : undefined}
        onCard={
          editable ? (replace) => setAdding({ stage: "cards", entry: player, replace }) : undefined
        }
      >
        {children}
      </PlayerRow>
    );
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

  const taken = hand.players.map((p) => p.playerId);
  const entry = adding && "entry" in adding ? adding.entry : undefined;
  const entered = entry !== undefined && taken.includes(entry.playerId);
  const nextNumber = hand.players.length + 1;

  return (
    <>
      {hand.step !== "summary" && (
        <>
          <section aria-labelledby="hand-pot-title" className="mt-3">
            <h2 id="hand-pot-title" className="mb-2 font-semibold">
              底池信息
            </h2>
            <div className="flex items-start gap-1.5">
              <StreetCards
                label="翻牌"
                cards={hand.board.slice(0, 3)}
                count={3}
                onPick={editable ? () => setPickingStreet("flop") : undefined}
              />
              <Plus className="mt-6 size-4 shrink-0 text-muted" aria-hidden />
              <StreetCards
                label={hand.board.length > 3 ? "转牌" : "转牌 · 可不选"}
                cards={hand.board.slice(3, 4)}
                count={1}
                optional
                disabled={hand.board.length < 3}
                onPick={editable ? () => setPickingStreet("turn") : undefined}
              />
              {hand.board.length === 5 && (
                <>
                  <Plus className="mt-6 size-4 shrink-0 text-muted" aria-hidden />
                  <StreetCards label="河牌" cards={hand.board.slice(4)} count={1} />
                </>
              )}
            </div>
            <DeadMoney
              chips={totals.deadChips}
              onEdit={editable ? () => setEditingDead(true) : undefined}
            />
          </section>

          <h2 className="mt-3 mb-1 text-sm text-muted">池内玩家</h2>
          <ul className="flex flex-col gap-2">
            {hand.players.map((player) => (
              <li key={player.playerId}>
                {playerRow(
                  player,
                  entering && (
                    <button
                      type="button"
                      aria-label={`删除${nameOf(player.playerId)}`}
                      onClick={() =>
                        update({
                          ...hand,
                          players: hand.players.filter((p) => p !== player),
                        })
                      }
                      className="grid size-11 shrink-0 place-items-center rounded-lg border border-line"
                    >
                      <X className="size-5" aria-hidden />
                    </button>
                  ),
                )}
              </li>
            ))}
          </ul>
          {entering && hand.players.length < seats.length && (
            <button
              type="button"
              aria-label="添加玩家"
              onClick={() => addPlayer(taken)}
              className="mt-2 grid min-h-14 w-full place-items-center rounded-xl border border-dashed border-line text-highlight"
            >
              <Plus className="size-6" aria-hidden />
            </button>
          )}

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
              {totals.uncalledChips > 0 && (
                <p className="mt-1 text-sm text-muted">
                  未被跟注的 {chipText(totals.uncalledChips)} 退回，不计入。
                </p>
              )}
            </div>
          )}
        </>
      )}

      {entering &&
        (complete ? (
          <button
            type="button"
            onClick={() => update({ ...hand, step: "buy" })}
            className={cn(primaryClass, "mt-3")}
          >
            计算保险
          </button>
        ) : (
          <p className="mt-3 text-sm text-muted">
            {playersReady(hand.players)
              ? "再选好翻牌，就可以计算保险。"
              : "先录入至少两位玩家的筹码和手牌。"}
          </p>
        ))}

      {hand.step === "buy" && street && (
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
          {hand.purchases.length === 0 && (
            <button
              type="button"
              onClick={() => update({ ...hand, declined: [], step: "players" })}
              className={cn(secondaryClass, "mt-2")}
            >
              返回增减玩家
            </button>
          )}
        </>
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

      {hand.players.length > 0 && hand.step !== "summary" && (
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

      {adding?.stage === "seat" && (
        <SeatPicker
          seats={seats}
          takenSeats={taken}
          onPick={({ id }) => setAdding({ stage: "chips", entry: blankPlayer(id) })}
          onClose={() => setAdding(undefined)}
        />
      )}

      {adding?.stage === "swap" && (
        <SeatPicker
          seats={seats}
          takenSeats={taken}
          onPick={({ id }) => swapPlayer(adding.entry, id)}
          onClose={() => setAdding(undefined)}
        />
      )}

      {adding?.stage === "chips" && entry && (
        <PlayerChipsDialog
          name={nameOf(entry.playerId)}
          chips={entry.chips}
          cover={entry.cover}
          coverTaken={hand.players.some((p) => p.cover && p.playerId !== entry.playerId)}
          onConfirm={(chips) => {
            const next = { ...entry, ...chips };
            // A player already in the pot changes chips alone; a new one goes on to the cards
            if (entered) savePlayer(next);
            else setAdding({ stage: "cards", entry: next });
          }}
          onCancel={() => setAdding(undefined)}
        />
      )}

      {adding?.stage === "cards" && entry && (
        <CardPicker
          title={`${nameOf(entry.playerId)}：${entered ? "更换手牌" : "选择两张手牌"}`}
          count={2}
          usedCards={withoutCards(usedCards, entry.cards)}
          initial={entry.cards}
          replace={adding.replace}
          onConfirm={(cards) => savePlayer({ ...entry, cards })}
          onCancel={() => setAdding(undefined)}
        />
      )}

      {adding?.stage === "more" && (
        <MoreDialog
          number={nextNumber}
          onAdd={() => addPlayer(taken)}
          onDone={() => setAdding(undefined)}
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
