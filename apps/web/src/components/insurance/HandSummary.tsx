import {
  handResult,
  type InsuranceHand,
  insuranceTopUp,
  type PlayerHandResult,
  type PremiumBuyIn,
  parseChips,
  playerHandResults,
  premiumBuyIns,
  type StreetInsurance,
  streetInsurance,
} from "@holdem-knight/core";
import { Pencil } from "lucide-react";
import { type ReactNode, useState } from "react";
import { t } from "@/i18n";
import { formatSignedChips } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { numberTyped, selectOnFocus } from "@/lib/number-input";
import { netTone, TONE_CLASS } from "@/lib/tone";
import { CardFace } from "./CardFace";
import { SectionTitle, StreetCards } from "./HandSections";
import type { HandFinish, SeatChips } from "./InsuranceHandFlow";
import { Modal } from "./Modal";

const chipText = (chips: number) => chips.toLocaleString("zh-CN");

/** A name, then four figures: the pot, each street's insurance, and what they come to. */
const ROW = "grid grid-cols-[minmax(0,1.25fr)_repeat(4,minmax(0,1fr))] gap-x-1.5 px-3";

/** A signed figure in the color of a win or a loss, with a word under it in small. */
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
    <p role="alert" className="col-span-full text-xs font-medium text-highlight">
      {children}
    </p>
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

function PlayerRow({
  hand,
  result,
  name,
  buyIn,
  handChips,
  sync,
}: {
  hand: InsuranceHand;
  result: PlayerHandResult;
  name: string;
  buyIn: PremiumBuyIn | undefined;
  handChips: number | undefined;
  /** Whether these chips go to the game, and how that is changed. Missing where they cannot. */
  sync: { readonly on: boolean; readonly onChange: (on: boolean) => void } | undefined;
}) {
  const { playerId, netChips, insuranceChips, stackChips } = result;
  const cards = hand.players.find((p) => p.playerId === playerId)?.cards ?? [];
  const stackAfter = buyIn?.stackChips ?? stackChips;
  const { handSummary: text } = t.insurance;
  return (
    <li className={cn(ROW, "items-start border-t border-line pt-2 pb-1")}>
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
      <Figure chips={netChips} strong />
      {/* A line of its own under the results: the chips the player ends with, and whether they
          go to the game. A cover has more behind than the hand knows, so has neither */}
      {stackAfter !== null && (
        <div className="col-span-full flex min-h-11 items-center justify-end gap-3 text-xs">
          {sync && (
            <label className="flex min-h-11 items-center gap-1.5">
              <input
                type="checkbox"
                checked={sync.on}
                onChange={(event) => sync.onChange(event.target.checked)}
                className="size-4 shrink-0 accent-[var(--accent)]"
              />
              <span className={cn(!sync.on && "text-muted")}>{text.syncToTheGame}</span>
            </label>
          )}
          <span className="text-muted">
            {text.totalChips}{" "}
            <span className="font-semibold text-text tabular-nums">{chipText(stackAfter)}</span>
          </span>
        </div>
      )}
      {buyIn && handChips !== undefined && (
        <BuyInNote>
          {text.needsABuyIn(buyIn.buyInChips / handChips, chipText(buyIn.buyInChips))}
        </BuyInNote>
      )}
    </li>
  );
}

const stepClass =
  "grid h-11 w-9 shrink-0 place-items-center text-lg font-semibold text-highlight disabled:text-muted disabled:opacity-40";

/**
 * The insurance's own figures after the hand, each to be put right in place: its Buy-ins, a tap
 * on − or + taking or adding one, and its chips, which a tap selects whole to type over.
 */
function SeatFigures({
  hands,
  canTakeOne,
  chips,
  onStep,
  onChips,
}: {
  hands: number;
  /** False at the fewest Buy-ins that still pay the hand. */
  canTakeOne: boolean;
  chips: number;
  onStep: (by: number) => void;
  onChips: (chips: number) => void;
}) {
  // What is being typed, until the field is left
  const [typed, setTyped] = useState<string>();
  const { handSummary: text } = t.insurance;
  return (
    <div className="col-span-full flex min-h-11 items-center justify-between gap-2 text-xs">
      <span className="flex items-center text-muted">
        {text.totalBuyIn}
        <button
          type="button"
          aria-label={t.game.handsStepper.oneBuyInLess}
          disabled={!canTakeOne}
          onClick={() => onStep(-1)}
          className={cn(stepClass, "ml-1")}
        >
          −
        </button>
        <span className="min-w-5 text-center text-sm font-semibold text-text tabular-nums">
          {hands}
        </span>
        <button
          type="button"
          aria-label={t.game.handsStepper.oneBuyInMore}
          onClick={() => onStep(1)}
          className={stepClass}
        >
          +
        </button>
      </span>
      <label className="flex min-h-11 items-center gap-1 text-muted">
        {text.chips}
        <input
          aria-label={text.insuranceChips}
          inputMode="numeric"
          value={typed ?? chipText(chips)}
          onFocus={(event) => {
            setTyped(String(chips));
            selectOnFocus(event.currentTarget);
          }}
          onChange={(event) => setTyped(numberTyped(event.target.value, true))}
          onBlur={() => {
            const next = typed === undefined ? null : parseChips(typed);
            if (next !== null && next !== chips) onChips(next);
            setTyped(undefined);
          }}
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
          className="h-9 w-[4.5rem] rounded-lg border border-line bg-bg px-1.5 text-right text-sm font-semibold text-text tabular-nums"
        />
        <Pencil className="size-3 shrink-0" strokeWidth={1.75} aria-hidden />
      </label>
    </div>
  );
}

/**
 * Everything the hand comes to, for the organizer to accept before it reaches the table: the
 * board by street, as the page shows it while the hand is entered, then one table with a row for
 * each player and one for the insurance, the pot and each street's insurance side by side. Under
 * each player's results are the chips they end with, and in a game a box for whether those go to
 * the game. Under the insurance's are its Buy-ins and chips after the hand, both to be put right
 * in place. Chips that have to be bought are said under their row.
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
  /** Players still at the table, the only ones who can buy in or have their chips set. */
  seatedIds: readonly string[];
  saving: boolean;
  onBack: () => void;
  onConfirm: (choices: HandFinish) => void;
}) {
  const { premiumChips, payoutChips, seatChips } = handResult(hand);
  const needed = seat
    ? insuranceTopUp(seat.stackChips + premiumChips, payoutChips, seat.handChips)
    : 0;
  const results = playerHandResults(hand);
  const seated = results.filter(({ playerId }) => seatedIds.includes(playerId));
  // Everyone at the table to begin with; a tick taken off leaves that player's chips to be counted
  const [unsynced, setUnsynced] = useState<readonly string[]>([]);
  const synced = recording ? seated.filter(({ playerId }) => !unsynced.includes(playerId)) : [];
  // A premium is short only against the chips the hand leaves, which are set only when synced
  const buyIns = seat ? premiumBuyIns(synced, seat.handChips) : [];
  // Buy-ins added by hand beyond those the insurance needs, and its chips where typed over
  const [extraHands, setExtraHands] = useState(0);
  const [seatTyped, setSeatTyped] = useState<number>();
  const seatExtraChips = seat ? extraHands * seat.handChips : 0;
  const topUp = needed + seatExtraChips;
  const seatAfter = seat ? seat.stackChips + seatChips + topUp : 0;
  const [confirming, setConfirming] = useState(false);
  const { handSummary: text } = t.insurance;
  const { board } = hand;

  const confirm = () =>
    onConfirm({
      syncPlayerIds: synced.map(({ playerId }) => playerId),
      seatExtraChips,
      ...(seatTyped !== undefined && { seatStackChips: seatTyped }),
    });

  return (
    <section aria-labelledby="hand-summary">
      <SectionTitle id="hand-summary" title={text.handSummary} />
      <div className="flex justify-center gap-2">
        <StreetCards
          label={t.insurance.insuranceHandFlow.flop}
          cards={board.slice(0, 3)}
          count={3}
        />
        <StreetCards label={t.common.turn} cards={board.slice(3, 4)} count={1} />
        <StreetCards label={t.common.river} cards={board.slice(4, 5)} count={1} />
      </div>

      <div className="mt-3 rounded-xl border border-line bg-surface">
        <div className={cn(ROW, "py-2 text-right text-xs text-muted")}>
          <span className="text-left">{t.common.player}</span>
          <span>{text.pot}</span>
          <span>{t.common.turn}</span>
          <span>{t.common.river}</span>
          <span>{text.total}</span>
        </div>
        <ul>
          {results.map((result) => {
            const { playerId } = result;
            return (
              <PlayerRow
                key={playerId}
                hand={hand}
                result={result}
                name={nameOf(playerId)}
                buyIn={buyIns.find((b) => b.playerId === playerId)}
                handChips={seat?.handChips}
                sync={
                  recording && seatedIds.includes(playerId)
                    ? {
                        on: !unsynced.includes(playerId),
                        onChange: (on) =>
                          setUnsynced(
                            on ? unsynced.filter((id) => id !== playerId) : [...unsynced, playerId],
                          ),
                      }
                    : undefined
                }
              />
            );
          })}
          <li className={cn(ROW, "items-start border-t border-line pt-2 pb-1")}>
            <span className="truncate text-sm font-semibold text-highlight">
              {t.common.insurance}
            </span>
            <Figure chips={undefined} />
            <StreetFigure street={streetInsurance(hand, "turn")} seat />
            <StreetFigure street={streetInsurance(hand, "river")} seat />
            <Figure chips={seatChips} strong />
            {seat && (
              <SeatFigures
                hands={(seat.boughtChips + topUp) / seat.handChips}
                canTakeOne={extraHands > 0}
                chips={seatTyped ?? seatAfter}
                onStep={(by) => {
                  setExtraHands(Math.max(0, extraHands + by));
                  // The chips follow the Buy-ins again
                  setSeatTyped(undefined);
                }}
                onChips={setSeatTyped}
              />
            )}
            {needed > 0 && seat && (
              <BuyInNote>{text.seatBuysIn(needed / seat.handChips, chipText(needed))}</BuyInNote>
            )}
          </li>
        </ul>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
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
          onClick={() => (buyIns.length > 0 ? setConfirming(true) : confirm())}
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
              onClick={confirm}
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
