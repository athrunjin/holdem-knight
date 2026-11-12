import {
  handResult,
  type InsuranceHand,
  insuranceTopUp,
  type PlayerHandResult,
  type PremiumBuyIn,
  playerHandResults,
  premiumBuyIns,
} from "@holdem-knight/core";
import { type ReactNode, useState } from "react";
import { formatSignedChips } from "@/lib/chips";
import { BoardCards, CardFace, type SeatChips } from "./InsuranceHandFlow";
import { Modal } from "./Modal";

const chipText = (chips: number) => chips.toLocaleString("zh-CN");

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

function PlayerResult({
  result,
  name,
  cards,
  buyIn,
  handChips,
}: {
  result: PlayerHandResult;
  name: string;
  cards: readonly number[];
  buyIn: PremiumBuyIn | undefined;
  handChips: number | undefined;
}) {
  const { netChips, potChips, refundChips, insuranceChips, stackChips, shortChips } = result;
  const stackAfter = buyIn?.stackChips ?? stackChips;
  return (
    <li className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{name}</span>
          <span className={"block text-xl font-semibold tabular-nums"}>
            {formatSignedChips(netChips)}
          </span>
        </p>
        <span className="flex gap-1">
          {cards.map((card) => (
            <CardFace key={card} card={card} />
          ))}
        </span>
      </div>
      <dl className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
        <Line label="从底池拿走">{chipText(potChips)}</Line>
        {refundChips > 0 && <Line label="退回未跟注">{chipText(refundChips)}</Line>}
        <Line label="保险盈亏">{formatSignedChips(insuranceChips)}</Line>
        {buyIn && handChips !== undefined && (
          <Line label="需 Buy-in">
            {buyIn.buyInChips / handChips} 个（{chipText(buyIn.buyInChips)}）
          </Line>
        )}
        <Line label="后手">{stackAfter === null ? "Cover 不适用" : chipText(stackAfter)}</Line>
      </dl>
      {shortChips > 0 && (
        <p className="mt-1 text-sm text-highlight">
          还差 {chipText(shortChips)} 保费，确认时需要 Buy-in。
        </p>
      )}
    </li>
  );
}

/** Everything the hand comes to, for the organizer to accept before it reaches the table. */
export function HandSummary({
  hand,
  nameOf,
  seat,
  recording,
  seatedIds,
  saving,
  onBack,
  onConfirm,
}: {
  hand: InsuranceHand;
  nameOf: (id: string) => string;
  seat: SeatChips | undefined;
  recording: boolean;
  /** Players still at the table, the only ones who can buy in. */
  seatedIds: readonly string[];
  saving: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const { premiumChips, payoutChips, seatChips } = handResult(hand);
  const topUp = seat
    ? insuranceTopUp(seat.stackChips + premiumChips, payoutChips, seat.handChips)
    : 0;
  const results = playerHandResults(hand);
  const seated = results.filter(({ playerId }) => seatedIds.includes(playerId));
  const buyIns = recording && seat ? premiumBuyIns(seated, seat.handChips) : [];
  const [confirming, setConfirming] = useState(false);

  return (
    <section aria-label="本手总结">
      <h2 className="mt-3 mb-2 font-semibold">本手总结</h2>
      <BoardCards cards={hand.board} />
      <ul className="mt-3 flex flex-col gap-2">
        {results.map((result) => (
          <PlayerResult
            key={result.playerId}
            result={result}
            name={nameOf(result.playerId)}
            cards={hand.players.find((p) => p.playerId === result.playerId)?.cards ?? []}
            buyIn={buyIns.find((b) => b.playerId === result.playerId)}
            handChips={seat?.handChips}
          />
        ))}
      </ul>
      <section aria-label="保险" className="mt-2 rounded-xl border border-line bg-surface p-3">
        <h3 className="font-semibold">保险</h3>
        <dl className="mt-1 flex flex-col gap-1">
          <Line label="本手盈亏">{formatSignedChips(seatChips)}</Line>
          {topUp > 0 && <Line label="自动 Buy-in">{chipText(topUp)}</Line>}
          {seat && <Line label="后手">{chipText(seat.stackChips + seatChips + topUp)}</Line>}
        </dl>
      </section>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onBack}
          className="min-h-12 rounded-xl border border-line font-medium"
        >
          返回上一步
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => (buyIns.length > 0 ? setConfirming(true) : onConfirm())}
          className="min-h-12 rounded-xl bg-accent font-semibold text-accent-text disabled:opacity-40"
        >
          {recording ? "确认并返回牌局" : "重新计算"}
        </button>
      </div>
      {confirming && seat && (
        <Modal title="需要自动 Buy-in" onClose={() => setConfirming(false)}>
          <p role="alert" className="font-medium text-highlight">
            以下玩家不够支付保费，确认后会增加 Buy-in。
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {buyIns.map(({ playerId, shortChips, buyInChips, stackChips }) => (
              <li key={playerId} className="rounded-xl border border-line bg-bg p-3">
                <p className="font-semibold">
                  {nameOf(playerId)} · {buyInChips / seat.handChips} 个 Buy-in（
                  {chipText(buyInChips)} 筹码）
                </p>
                <p className="text-sm text-muted tabular-nums">
                  欠保费 {chipText(shortChips)} · Buy-in 后后手 {chipText(stackChips)}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="min-h-11 rounded-xl border border-line font-medium"
            >
              取消
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onConfirm}
              className="min-h-11 rounded-xl bg-accent font-semibold text-accent-text disabled:opacity-40"
            >
              确认 Buy-in
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
