import {
  handResult,
  type InsuranceHand,
  insuranceTopUp,
  type PlayerHandResult,
  type PremiumBuyIn,
  playerHandResults,
  premiumBuyIns,
  type StreetInsurance,
  streetInsurance,
} from "@holdem-knight/core";
import { type ReactNode, useState } from "react";
import { t } from "@/i18n";
import { formatSignedChips } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { netTone, TONE_CLASS } from "@/lib/tone";
import { CardFace } from "./CardFace";
import { SectionTitle } from "./HandSections";
import type { SeatChips } from "./InsuranceHandFlow";
import { Modal } from "./Modal";

const chipText = (chips: number) => chips.toLocaleString("zh-CN");

/** The board in one line, each street's cards under its name. */
function StreetCards({ board }: { board: readonly number[] }) {
  const streets = [
    { name: t.insurance.handSummary.flop, cards: board.slice(0, 3) },
    { name: t.common.turn, cards: board.slice(3, 4) },
    { name: t.common.river, cards: board.slice(4, 5) },
  ];
  return (
    <div className="flex justify-center gap-3">
      {streets.map(({ name, cards }) => (
        <div key={name} className="flex flex-col items-center gap-1">
          <span className="text-xs text-muted">{name}</span>
          <span className="flex gap-1">
            {cards.map((card) => (
              <CardFace key={card} card={card} />
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A name, then four figures: the pot, each street's insurance, and what they come to. */
const ROW = "grid grid-cols-[minmax(0,1.25fr)_repeat(4,minmax(0,1fr))] gap-x-1.5 px-3";

/** A signed figure in the color of a win or a loss, with a word or a figure under it in small. */
function Figure({
  chips,
  under,
  strong = false,
}: {
  chips: number | undefined;
  under?: ReactNode;
  strong?: boolean;
}) {
  return (
    <span className="flex min-w-0 flex-col items-end">
      <span
        className={cn(
          "text-[0.8125rem] whitespace-nowrap tabular-nums",
          strong ? "font-semibold" : "font-medium",
          chips === undefined ? "text-muted" : TONE_CLASS[netTone(chips)],
        )}
      >
        {chips === undefined ? "—" : formatSignedChips(chips)}
      </span>
      {under !== undefined && (
        <span className="text-[0.6875rem] whitespace-nowrap text-muted tabular-nums">{under}</span>
      )}
    </span>
  );
}

/** A street's insurance for whoever bought it, with whether it hit; a dash where none was bought. */
function StreetFigure({ street, seat }: { street: StreetInsurance | undefined; seat?: boolean }) {
  if (!street) return <Figure chips={undefined} />;
  const word = street.hit ? t.insurance.handSummary.hit : t.insurance.handSummary.missed;
  return (
    <Figure
      // The seat's side of the same result
      chips={seat ? -street.chips : street.chips}
      under={<span className={cn(street.hit && "text-highlight")}>{word}</span>}
    />
  );
}

/** Said in full under a row: chips that have to be bought for the hand to be paid. */
function BuyInNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="col-span-full mt-1 text-xs font-medium text-highlight">
      {children}
    </p>
  );
}

function PlayerRow({
  hand,
  result,
  name,
  buyIn,
  handChips,
  showStack,
}: {
  hand: InsuranceHand;
  result: PlayerHandResult;
  name: string;
  buyIn: PremiumBuyIn | undefined;
  handChips: number | undefined;
  /** Whether the chips the player ends with go to the game, and so are worth showing. */
  showStack: boolean;
}) {
  const { playerId, netChips, insuranceChips, stackChips } = result;
  const cards = hand.players.find((p) => p.playerId === playerId)?.cards ?? [];
  const stackAfter = buyIn?.stackChips ?? stackChips;
  return (
    <li className={cn(ROW, "items-start border-t border-line py-2")}>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-sm font-semibold">{name}</span>
        <span className="flex gap-0.5 text-xs font-semibold tabular-nums">
          {cards.map((card) => (
            <SmallCard key={card} card={card} />
          ))}
        </span>
      </span>
      {/* The hand apart from its insurance: what came from the pots, less what went in */}
      <Figure chips={netChips - insuranceChips} />
      <StreetFigure street={streetInsurance(hand, "turn", playerId)} />
      <StreetFigure street={streetInsurance(hand, "river", playerId)} />
      <Figure
        chips={netChips}
        strong
        under={
          showStack && stackAfter !== null
            ? t.insurance.handSummary.stackAfter(chipText(stackAfter))
            : undefined
        }
      />
      {buyIn && handChips !== undefined && (
        <BuyInNote>
          {t.insurance.handSummary.needsABuyIn(
            buyIn.buyInChips / handChips,
            chipText(buyIn.buyInChips),
          )}
        </BuyInNote>
      )}
    </li>
  );
}

/** A hole card as its two characters, small enough to sit under a name in the table. */
function SmallCard({ card }: { card: number }) {
  return (
    <span className="[&>span]:h-6 [&>span]:w-6 [&>span]:rounded [&>span]:text-[0.6875rem]">
      <CardFace card={card} />
    </span>
  );
}

/**
 * Everything the hand comes to, for the organizer to accept before it reaches the table: the
 * board by street, then one table with a row for each player and one for the insurance, the pot
 * and each street's insurance side by side. Chips that have to be bought are said under their row.
 */
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
  /** `syncStacks` is whether the players' chips go to the game with the insurance. */
  onConfirm: (syncStacks: boolean) => void;
}) {
  const { premiumChips, payoutChips, seatChips } = handResult(hand);
  const topUp = seat
    ? insuranceTopUp(seat.stackChips + premiumChips, payoutChips, seat.handChips)
    : 0;
  const results = playerHandResults(hand);
  const seated = results.filter(({ playerId }) => seatedIds.includes(playerId));
  // In a game, on unless the organizer would sooner count the chips at the table
  const [syncStacks, setSyncStacks] = useState(true);
  const sync = recording && syncStacks;
  // A premium is short only against the chips the hand leaves, which are set only when synced
  const buyIns = sync && seat ? premiumBuyIns(seated, seat.handChips) : [];
  const [confirming, setConfirming] = useState(false);
  const { handSummary: text } = t.insurance;

  return (
    <section aria-labelledby="hand-summary">
      <SectionTitle id="hand-summary" title={text.handSummary} />
      <StreetCards board={hand.board} />

      <div className="mt-3 rounded-xl border border-line bg-surface pb-1">
        <div className={cn(ROW, "py-2 text-right text-xs text-muted")}>
          <span className="text-left">{t.common.player}</span>
          <span>{text.pot}</span>
          <span>{t.common.turn}</span>
          <span>{t.common.river}</span>
          <span>{text.total}</span>
        </div>
        <ul>
          {results.map((result) => (
            <PlayerRow
              key={result.playerId}
              hand={hand}
              result={result}
              name={nameOf(result.playerId)}
              buyIn={buyIns.find((b) => b.playerId === result.playerId)}
              handChips={seat?.handChips}
              showStack={sync || !recording}
            />
          ))}
          <li className={cn(ROW, "items-start border-t border-line py-2")}>
            <span className="truncate text-sm font-semibold text-highlight">
              {t.common.insurance}
            </span>
            <Figure chips={undefined} />
            <StreetFigure street={streetInsurance(hand, "turn")} seat />
            <StreetFigure street={streetInsurance(hand, "river")} seat />
            <Figure
              chips={seatChips}
              strong
              under={
                seat ? text.stackAfter(chipText(seat.stackChips + seatChips + topUp)) : undefined
              }
            />
            {topUp > 0 && seat && (
              <BuyInNote>{text.seatBuysIn(topUp / seat.handChips, chipText(topUp))}</BuyInNote>
            )}
          </li>
        </ul>
      </div>

      {recording && (
        <label className="mt-2 flex min-h-11 items-center gap-2 px-1 text-sm">
          <input
            type="checkbox"
            checked={syncStacks}
            onChange={(event) => setSyncStacks(event.target.checked)}
            className="size-5 shrink-0 accent-[var(--accent)]"
          />
          <span className="font-medium">{text.syncChips}</span>
          {!syncStacks && <span className="text-xs text-muted">{text.insuranceOnly}</span>}
        </label>
      )}

      <div className={cn("grid grid-cols-2 gap-2", !recording && "mt-3")}>
        <button
          type="button"
          onClick={onBack}
          className="min-h-12 rounded-xl border border-line font-medium"
        >
          {text.previousStep}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => (buyIns.length > 0 ? setConfirming(true) : onConfirm(sync))}
          className="min-h-12 rounded-xl bg-accent font-semibold text-accent-text disabled:opacity-40"
        >
          {recording ? text.confirmAndReturnToTheGame : text.recalculate}
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
              onClick={() => onConfirm(sync)}
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
