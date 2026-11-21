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
import { t } from "@/i18n";
import { formatSignedChips } from "@/lib/chips";
import { BoardCards, CardFace } from "./CardFace";
import type { SeatChips } from "./InsuranceHandFlow";
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
        <Line label={t.insurance.handSummary.takesFromThePot}>{chipText(potChips)}</Line>
        {refundChips > 0 && (
          <Line label={t.insurance.handSummary.uncalledBetReturned}>{chipText(refundChips)}</Line>
        )}
        <Line label={t.insurance.handSummary.insurancePL}>{formatSignedChips(insuranceChips)}</Line>
        {buyIn && handChips !== undefined && (
          <Line label={t.insurance.handSummary.needsABuyIn}>
            {t.insurance.handSummary.text(buyIn.buyInChips / handChips, chipText(buyIn.buyInChips))}
          </Line>
        )}
        <Line label={t.insurance.handSummary.stackBehind}>
          {stackAfter === null ? t.insurance.handSummary.coverDoesntApply : chipText(stackAfter)}
        </Line>
      </dl>
      {shortChips > 0 && (
        <p className="mt-1 text-sm text-highlight">
          {t.insurance.handSummary.shortForThePremiumConfirmingNeeds(chipText(shortChips))}
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
    <section aria-label={t.insurance.handSummary.handSummary}>
      <h2 className="mt-3 mb-2 font-semibold">{t.insurance.handSummary.handSummary}</h2>
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
      <section
        aria-label={t.common.insurance}
        className="mt-2 rounded-xl border border-line bg-surface p-3"
      >
        <h3 className="font-semibold">{t.common.insurance}</h3>
        <dl className="mt-1 flex flex-col gap-1">
          <Line label={t.insurance.handSummary.handPL}>{formatSignedChips(seatChips)}</Line>
          {topUp > 0 && (
            <Line label={t.insurance.handSummary.automaticBuyIn}>{chipText(topUp)}</Line>
          )}
          {seat && (
            <Line label={t.insurance.handSummary.stackBehind}>
              {chipText(seat.stackChips + seatChips + topUp)}
            </Line>
          )}
        </dl>
      </section>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onBack}
          className="min-h-12 rounded-xl border border-line font-medium"
        >
          {t.insurance.handSummary.previousStep}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => (buyIns.length > 0 ? setConfirming(true) : onConfirm())}
          className="min-h-12 rounded-xl bg-accent font-semibold text-accent-text disabled:opacity-40"
        >
          {recording
            ? t.insurance.handSummary.confirmAndReturnToTheGame
            : t.insurance.handSummary.recalculate}
        </button>
      </div>
      {confirming && seat && (
        <Modal
          title={t.insurance.handSummary.automaticBuyInNeeded}
          onClose={() => setConfirming(false)}
        >
          <p role="alert" className="font-medium text-highlight">
            {t.insurance.handSummary.thesePlayersCantPayTheirPremium}
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {buyIns.map(({ playerId, shortChips, buyInChips, stackChips }) => (
              <li key={playerId} className="rounded-xl border border-line bg-bg p-3">
                <p className="font-semibold">
                  {t.insurance.handSummary.buyInsChips(
                    nameOf(playerId),
                    buyInChips / seat.handChips,
                    chipText(buyInChips),
                  )}
                </p>
                <p className="text-sm text-muted tabular-nums">
                  {t.insurance.handSummary.premiumOwedStackAfterBuyIn(
                    chipText(shortChips),
                    chipText(stackChips),
                  )}
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
              {t.common.cancel}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onConfirm}
              className="min-h-11 rounded-xl bg-accent font-semibold text-accent-text disabled:opacity-40"
            >
              {t.insurance.handSummary.confirmBuyIn}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
