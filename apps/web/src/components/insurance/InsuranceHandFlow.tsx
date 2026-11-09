import {
  buyOffer,
  type Card,
  dealCard,
  declineOffer,
  formatCard,
  type HandOffer,
  handOffers,
  handPotEntries,
  handResult,
  type InsuranceHand,
  type InsuranceHandPlayer,
  type InsuranceRule,
  nextStreet,
  offersDecided,
  type PotTotals,
  playersReady,
  potTotals,
  reviseOffer,
  soldOuts,
  undoDeal,
} from "@holdem-knight/core";
import { Plus, X } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { formatCardText } from "@/lib/cards";
import { formatSignedChips } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { CardPicker } from "./CardPicker";
import { DeadMoneyDialog } from "./DeadMoneyDialog";
import { HandSummary } from "./HandSummary";
import type { InsuranceSeat } from "./InsuranceCalculator";
import { type Decisions, LeaderQuote } from "./LeaderQuote";
import { Modal } from "./Modal";
import { PlayerChipsDialog } from "./PlayerChipsDialog";
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
  /** The hand in progress, to carry on from. */
  open: InsuranceHand | undefined;
  createHand: () => InsuranceHand;
  store: HandStore | undefined;
  seat: SeatChips | undefined;
}

/** The player being added or changed, through seat, chips and cards. */
type Adding =
  | { readonly stage: "seat" }
  | { readonly stage: "chips" | "cards"; readonly entry: InsuranceHandPlayer }
  | { readonly stage: "more" };

const STREET_TEXT = { turn: "转牌", river: "河牌" } as const;

const chipText = (chips: number) => chips.toLocaleString("zh-CN");
const percentText = (share: number) => `${(share * 100).toFixed(1)}%`;

const primaryClass =
  "min-h-12 w-full rounded-xl bg-accent font-semibold text-accent-text disabled:opacity-40";
const secondaryClass = "min-h-11 w-full rounded-xl border border-line font-medium";

export function CardFace({ card }: { card: Card | null }) {
  const red = card !== null && /[hd]/.test(formatCard(card)[1] ?? "");
  return (
    <span
      className={cn(
        "grid h-11 w-9 place-items-center rounded-md border text-sm font-semibold tabular-nums",
        card === null ? "border-dashed border-line text-muted" : "border-line bg-bg",
        red && "text-loss",
      )}
    >
      {card === null ? "?" : formatCardText(card)}
    </span>
  );
}

/** Five places: dealt cards, then question marks. `dealt` draws the shape before cards are known. */
export function BoardCards({ cards, dealt = 0 }: { cards?: readonly Card[]; dealt?: number }) {
  const shown = cards?.length ?? dealt;
  return (
    <span className="flex gap-1" role="img" aria-label={`公共牌已发 ${shown} 张`}>
      {[0, 1, 2, 3, 4].map((place) =>
        cards === undefined && place < dealt ? (
          <span key={place} className="h-11 w-9 rounded-md border border-line bg-accent/70" />
        ) : (
          <CardFace key={place} card={cards?.[place] ?? null} />
        ),
      )}
    </span>
  );
}

export function PotSummary({ totals, onEditDead }: { totals: PotTotals; onEditDead: () => void }) {
  return (
    <section aria-label="底池合计" className="mt-3 rounded-xl border border-line bg-surface p-3">
      <dl className="grid grid-cols-2 gap-2">
        <div>
          <dt className="text-sm text-muted">有效总底池</dt>
          <dd className="text-xl font-semibold tabular-nums">{chipText(totals.effectiveChips)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">死钱（已含在内）</dt>
          <dd className="flex items-center justify-between gap-2">
            <span className="text-xl font-semibold tabular-nums">{chipText(totals.deadChips)}</span>
            <button
              type="button"
              aria-label="编辑死钱"
              onClick={onEditDead}
              className="grid size-11 shrink-0 place-items-center rounded-lg border border-line text-highlight"
            >
              <Plus className="size-5" aria-hidden />
            </button>
          </dd>
        </div>
      </dl>
      {totals.uncalledChips > 0 && (
        <p className="mt-1 text-sm text-muted">
          未被跟注的 {chipText(totals.uncalledChips)} 退回，不计入。
        </p>
      )}
    </section>
  );
}

function PlayerRow({
  name,
  stake,
  player,
  children,
}: {
  name: string;
  stake: string;
  player: InsuranceHandPlayer;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-surface p-2">
      <p className="min-w-0 flex-1">
        <span className="block truncate font-medium">{name}</span>
        <span className="block text-sm text-muted tabular-nums">{stake}</span>
      </p>
      <span className="flex gap-1">
        {player.cards.map((card) => (
          <CardFace key={card} card={card} />
        ))}
      </span>
      {children}
    </div>
  );
}

function PotCard({
  offers,
  nameOf,
  rule,
  decisions,
}: {
  offers: readonly HandOffer[];
  nameOf: (id: string) => string;
  rule: InsuranceRule;
  decisions: Decisions | undefined;
}) {
  const [first] = offers;
  if (!first) return null;
  const { pot, potIndex } = first;
  return (
    <section className="mt-3 rounded-xl border border-line bg-surface p-3">
      <h3 className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{potIndex === 0 ? "主池" : `边池 ${potIndex}`}</span>
        <span className="font-semibold tabular-nums">{chipText(pot.amountChips)}</span>
      </h3>
      <p className="text-sm text-muted">
        {pot.playerIds.map((id) => `${nameOf(id)} ${percentText(pot.equity[id] ?? 0)}`).join(" · ")}
      </p>
      {offers.map(({ key, leader, input }) => (
        <div key={key} className="mt-2 border-t border-line pt-2">
          <p className="font-medium">
            {nameOf(leader.playerId)} 领先
            {pot.leaders.length > 1 && "（并列）"}
            <span className="ml-1 text-sm font-normal text-muted">
              投入 {chipText(leader.stakeChips)} · 可得 {chipText(leader.shareChips)}
            </span>
          </p>
          <p className="text-sm">
            反超牌 <span className="font-semibold">{soldOuts(rule, leader)}</span> 张
            {leader.tieCards.length > 0 &&
              `，平分牌 ${leader.tieCards.length} 张${rule.tieOuts === "include" ? "（已计入）" : "（不计入）"}`}
          </p>
          <ul className="text-sm text-muted">
            {leader.byOpponent.map(({ playerId, cards }) => (
              <li key={playerId}>
                {nameOf(playerId)} {cards.length} 张：{cards.map(formatCardText).join(" ")}
              </li>
            ))}
            {leader.tieCards.length > 0 && (
              <li>平分：{leader.tieCards.map(formatCardText).join(" ")}</li>
            )}
          </ul>
          <LeaderQuote
            id={key}
            decisionKey={key}
            input={input}
            playerId={leader.playerId}
            saving={undefined}
            decisions={decisions}
          />
        </div>
      ))}
    </section>
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

function StartStep({ onBack, onChoose }: { onBack: () => void; onChoose: (count: 3 | 4) => void }) {
  const option = "flex w-full items-center justify-between gap-2 rounded-xl border p-3 text-left";
  return (
    <>
      <h2 className="mt-3 mb-2 font-semibold">现在发到哪一条街？</h2>
      <div className="flex flex-col gap-2">
        <button type="button" disabled className={cn(option, "border-line opacity-50")}>
          <span>
            <span className="block font-medium">翻牌未发出</span>
            <span className="block text-sm text-muted">开发中</span>
          </span>
          <BoardCards dealt={0} />
        </button>
        <button
          type="button"
          onClick={() => onChoose(3)}
          className={cn(option, "border-line bg-surface")}
        >
          <span className="font-medium">翻牌已发出</span>
          <BoardCards dealt={3} />
        </button>
        <button
          type="button"
          onClick={() => onChoose(4)}
          className={cn(option, "border-line bg-surface")}
        >
          <span className="font-medium">转牌已发出</span>
          <BoardCards dealt={4} />
        </button>
      </div>
      <button type="button" onClick={onBack} className={cn(secondaryClass, "mt-3")}>
        返回修改玩家
      </button>
    </>
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
  open,
  createHand,
  store,
  seat,
}: InsuranceHandFlowProps) {
  const [hand, setHand] = useState(() => open ?? createHand());
  const [adding, setAdding] = useState<Adding>();
  const [editingDead, setEditingDead] = useState(false);
  const [boardCount, setBoardCount] = useState<3 | 4>();
  const [finishing, setFinishing] = useState(false);

  const nameOf = (id: string) => seats.find((s) => s.id === id)?.name ?? "未知玩家";
  const totals = potTotals(handPotEntries(hand));
  const usedCards = new Set([...hand.players.flatMap((p) => p.cards), ...hand.board]);
  const street = nextStreet(hand.board);

  const offers = useMemo(() => (hand.step === "buy" ? handOffers(hand, rule) : []), [hand, rule]);
  const pots = [...new Set(offers.map((o) => o.potIndex))].map((index) =>
    offers.filter((o) => o.potIndex === index),
  );

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

  function savePlayer(entry: InsuranceHandPlayer) {
    const known = hand.players.some((p) => p.playerId === entry.playerId);
    const players = known
      ? hand.players.map((p) => (p.playerId === entry.playerId ? entry : p))
      : [...hand.players, entry];
    update({ ...hand, players });
    if (!entry.cover) store?.enterStack(entry.playerId, entry.chips);
    if (known) setAdding(undefined);
    else if (players.length === 1) setAdding({ stage: "seat" });
    else setAdding(players.length < seats.length ? { stage: "more" } : undefined);
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
  const entry = adding?.stage === "chips" || adding?.stage === "cards" ? adding.entry : undefined;
  const nextNumber = hand.players.length + 1;

  return (
    <>
      {hand.step !== "players" && hand.step !== "summary" && (
        <section aria-label="这手牌" className="mt-3 flex flex-col gap-1">
          {hand.players.map((player) => (
            <PlayerRow
              key={player.playerId}
              name={nameOf(player.playerId)}
              stake={player.cover ? "Cover" : chipText(player.chips)}
              player={player}
            />
          ))}
          <p className="mt-1 text-sm text-muted tabular-nums">
            有效总底池 {chipText(totals.effectiveChips)} · 死钱 {chipText(totals.deadChips)}
          </p>
          {hand.step !== "start" && <BoardCards cards={hand.board} />}
        </section>
      )}

      {hand.step === "players" && (
        <>
          <h2 className="mt-3 mb-1 text-sm text-muted">池内玩家</h2>
          <ul className="flex flex-col gap-2">
            {hand.players.map((player) => (
              <li key={player.playerId}>
                <PlayerRow
                  name={nameOf(player.playerId)}
                  stake={player.cover ? "Cover" : chipText(player.chips)}
                  player={player}
                >
                  <button
                    type="button"
                    aria-label={`修改${nameOf(player.playerId)}`}
                    onClick={() => setAdding({ stage: "chips", entry: player })}
                    className="min-h-11 shrink-0 rounded-lg border border-line px-2 text-sm font-medium"
                  >
                    修改
                  </button>
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
                </PlayerRow>
              </li>
            ))}
          </ul>
          {hand.players.length < seats.length && (
            <button
              type="button"
              aria-label="添加玩家"
              onClick={() => setAdding({ stage: "seat" })}
              className="mt-2 grid min-h-14 w-full place-items-center rounded-xl border border-dashed border-line text-highlight"
            >
              <Plus className="size-6" aria-hidden />
            </button>
          )}
          <PotSummary totals={totals} onEditDead={() => setEditingDead(true)} />
          {playersReady(hand.players) && (
            <button
              type="button"
              onClick={() => update({ ...hand, step: "start" })}
              className={cn(primaryClass, "mt-3")}
            >
              录入公共牌并计算
            </button>
          )}
        </>
      )}

      {hand.step === "start" && (
        <StartStep onBack={() => update({ ...hand, step: "players" })} onChoose={setBoardCount} />
      )}

      {hand.step === "buy" && street && (
        <>
          <h2 className="mt-3 font-semibold">{STREET_TEXT[street]}保险</h2>
          {pots.map((potOffers) => (
            <PotCard
              key={potOffers[0]?.potIndex}
              offers={potOffers}
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
              onClick={() => update({ ...hand, board: [], declined: [], step: "start" })}
              className={cn(secondaryClass, "mt-2")}
            >
              重选公共牌
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
            update({ ...hand, pools: next.map(Number) });
            setEditingDead(false);
          }}
          onCancel={() => setEditingDead(false)}
        />
      )}

      {adding?.stage === "seat" && (
        <SeatPicker
          seats={seats}
          takenSeats={taken}
          onPick={({ id }) =>
            setAdding({
              stage: "chips",
              entry: { playerId: id, chips: 0, cover: false, cards: [] },
            })
          }
          onClose={() => setAdding(undefined)}
        />
      )}

      {adding?.stage === "chips" && entry && (
        <PlayerChipsDialog
          name={nameOf(entry.playerId)}
          chips={entry.chips}
          cover={entry.cover}
          coverTaken={hand.players.some((p) => p.cover && p.playerId !== entry.playerId)}
          onConfirm={(chips) => setAdding({ stage: "cards", entry: { ...entry, ...chips } })}
          onCancel={() => setAdding(undefined)}
        />
      )}

      {adding?.stage === "cards" && entry && (
        <CardPicker
          title={`${nameOf(entry.playerId)}：选择两张手牌`}
          count={2}
          usedCards={new Set([...usedCards].filter((card) => !entry.cards.includes(card)))}
          initial={entry.cards}
          onConfirm={(cards) => savePlayer({ ...entry, cards })}
          onCancel={() => setAdding(undefined)}
        />
      )}

      {adding?.stage === "more" && (
        <MoreDialog
          number={nextNumber}
          onAdd={() => setAdding({ stage: "seat" })}
          onDone={() => setAdding(undefined)}
        />
      )}

      {boardCount && (
        <CardPicker
          title={boardCount === 3 ? "选择三张翻牌" : "选择翻牌和转牌"}
          count={boardCount}
          usedCards={usedCards}
          onConfirm={(board) => {
            update({ ...hand, board, step: "buy" });
            setBoardCount(undefined);
          }}
          onCancel={() => setBoardCount(undefined)}
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
