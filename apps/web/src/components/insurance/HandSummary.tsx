import {
  handResult,
  type InsuranceHand,
  insuranceTopUp,
  type PlayerHandResult,
  type PremiumBuyIn,
  parseChips,
  playerHandResults,
  premiumBuyIns,
  streetEntered,
  streetInsurance,
  streetLeaders,
} from "@holdem-knight/core";
import { Check, Pencil, X } from "lucide-react";
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

/** A name, then three figures: each street's insurance, and the column everything is added up in. */
const ROW = "grid grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] gap-x-1.5";

/** A figure of the table's upper part, the size of the name beside it. */
const FIGURE = "text-right text-sm whitespace-nowrap tabular-nums";

/** A signed figure in the color of a win or a loss. */
function Figure({ chips, strong = false }: { chips: number; strong?: boolean }) {
  return (
    <span
      className={cn(
        FIGURE,
        strong ? "font-semibold" : "font-medium",
        chips === 0 ? "text-muted" : TONE_CLASS[netTone(chips)],
      )}
    >
      {formatSignedChips(chips)}
    </span>
  );
}

const STREETS = ["turn", "river"] as const;

/**
 * A street's insurance as the two lines of its column: the figure, and a word under it.
 *
 * A street whose card was entered with the board never had insurance and is struck out. For a
 * player who bought, the figure is what the cover came to, with whether it hit; one who was ahead
 * and bought nothing, by choice or with too many outs to be sold a cover, is said not to buy, and
 * one who was behind is said to be. For the insurance itself the figure is its own side of every
 * cover, with whoever it paid named under it.
 */
function streetLines(
  hand: InsuranceHand,
  street: (typeof STREETS)[number],
  playerId: string | undefined,
  nameOf: (id: string) => string,
): readonly [ReactNode, ReactNode] {
  const { handSummary: text } = t.insurance;
  const word = (content: ReactNode) => <span className={cn(FIGURE, "text-muted")}>{content}</span>;
  if (streetEntered(hand, street)) return [word("—"), null];
  const bought = streetInsurance(hand, street, playerId);
  if (playerId === undefined) {
    if (!bought) return [<Figure key="figure" chips={0} />, null];
    const paid = bought.paidPlayerIds.map(nameOf).join(t.common.listSeparator);
    return [
      <Figure key="figure" chips={-bought.chips} />,
      <span
        key="word"
        className={cn(FIGURE, "truncate", bought.hit ? "text-highlight" : "text-muted")}
      >
        {bought.hit ? text.paidTo(paid) : text.missed}
      </span>,
    ];
  }
  if (!bought) {
    return [
      word(streetLeaders(hand, street).includes(playerId) ? text.notBuying : text.behind),
      null,
    ];
  }
  return [
    <Figure key="figure" chips={bought.chips} />,
    <span key="word" className={cn(FIGURE, bought.hit ? "text-highlight" : "text-muted")}>
      {bought.hit ? text.hit : text.missed}
    </span>,
  ];
}

/**
 * The upper part of a row: on the first line the name, each street's figure and the insurance's
 * total, and on the second, level with the foot of the hole cards, each street's word.
 */
function RowTop({
  hand,
  playerId,
  nameOf,
  name,
  under,
  totalChips,
}: {
  hand: InsuranceHand;
  /** Missing for the insurance's own row. */
  playerId?: string;
  nameOf: (id: string) => string;
  name: ReactNode;
  /** Under the name: a player's hole cards. */
  under?: ReactNode;
  totalChips: number;
}) {
  const [turn, river] = STREETS.map((street) => streetLines(hand, street, playerId, nameOf));
  return (
    <div className={cn(ROW, "items-end gap-y-1")}>
      {name}
      {turn?.[0]}
      {river?.[0]}
      <Figure chips={totalChips} strong />
      <span className="flex min-h-6 gap-0.5 text-xs font-semibold tabular-nums">{under}</span>
      {turn?.[1] ?? <span />}
      {river?.[1] ?? <span />}
      <span />
    </div>
  );
}

/** A line across a row that fades out at both ends, between its insurance and its chips. */
function Divider() {
  return (
    <div
      aria-hidden
      className="my-2 h-px bg-linear-to-r from-transparent via-line to-transparent"
    />
  );
}

/** Said in full under a row: chips that have to be bought for the hand to be paid. */
function BuyInNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-xs font-medium text-highlight">
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

const MARK = "grid size-5 shrink-0 place-items-center rounded-full";

/** Whether a pot was won, as a small round mark before its name. */
function WonMark({ won }: { won: boolean }) {
  const { handSummary: text } = t.insurance;
  return (
    <span className={cn(MARK, won ? "bg-win/15 text-win" : "bg-loss/15 text-loss")}>
      <span className="sr-only">{won ? text.won : text.lost}</span>
      {won ? (
        <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
      ) : (
        <X className="size-3.5" strokeWidth={2.5} aria-hidden />
      )}
    </span>
  );
}

/**
 * One line of a row's lower part: a mark, a name, and in the last column what it adds to the
 * chips the player ends with.
 */
function ChipLine({
  mark,
  label,
  struck = false,
  children,
}: {
  mark?: ReactNode;
  label: string;
  /** For a pot the player is not in */
  struck?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn(ROW, "min-h-7 items-center text-[0.8125rem]")}>
      <span className="col-span-2 flex items-center gap-1.5">
        {mark ?? <span className="size-5 shrink-0" />}
        <span className={cn(struck ? "text-muted line-through" : "text-text")}>{label}</span>
      </span>
      <span className="col-span-2 text-right font-medium whitespace-nowrap tabular-nums">
        {children}
      </span>
    </div>
  );
}

function PlayerRow({
  hand,
  result,
  nameOf,
  buyIn,
  handChips,
  sync,
}: {
  hand: InsuranceHand;
  result: PlayerHandResult;
  nameOf: (id: string) => string;
  buyIn: PremiumBuyIn | undefined;
  handChips: number | undefined;
  /** Whether these chips go to the game, and how that is changed. Missing where they cannot. */
  sync: { readonly on: boolean; readonly onChange: (on: boolean) => void } | undefined;
}) {
  const { playerId, cover, insuranceChips, potShares, refundChips, stackChips } = result;
  const cards = hand.players.find((p) => p.playerId === playerId)?.cards ?? [];
  const stackAfter = buyIn?.stackChips ?? stackChips;
  const { handSummary: text, potColumns } = t.insurance;
  const notApplicable = <span className="text-muted">{text.notApplicable}</span>;
  return (
    <li className="border-t border-line px-3 pt-2 pb-1">
      <RowTop
        hand={hand}
        playerId={playerId}
        nameOf={nameOf}
        name={<span className="truncate text-sm font-semibold">{nameOf(playerId)}</span>}
        under={cards.map((card) => <SmallCard key={card} card={card} />)}
        totalChips={insuranceChips}
      />
      <Divider />
      {/* Every pot of the hand: what the player took from it, nothing in red where it was lost,
          and struck out where the player has no chips in it */}
      {potShares.map((chips, index) => {
        const label = index === 0 ? potColumns.mainPot : potColumns.sidePot(index);
        return chips === null ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the pots are in a fixed order
          <ChipLine key={index} label={label} struck>
            <span className="text-muted">{text.notIn}</span>
          </ChipLine>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: the pots are in a fixed order
          <ChipLine key={index} mark={<WonMark won={chips > 0} />} label={label}>
            <span className={chips > 0 ? "text-win" : "text-loss"}>
              {chips > 0 ? `+${chipText(chips)}` : 0}
            </span>
          </ChipLine>
        );
      })}
      {/* Chips that were never in the betting. A cover has more behind than the hand knows */}
      <ChipLine
        mark={
          cover ? (
            <span className={cn(MARK, "bg-win text-xs font-bold text-bg")}>C</span>
          ) : undefined
        }
        label={text.chipsBehind}
      >
        {cover ? (
          notApplicable
        ) : (
          <span className={cn(refundChips === 0 && "text-muted")}>{chipText(refundChips)}</span>
        )}
      </ChipLine>
      {/* The chips the player ends with, and whether they go to the game */}
      <div className={cn(ROW, "min-h-11 items-center text-[0.8125rem]")}>
        <span className="col-span-2 flex items-center">
          {sync && stackAfter !== null && (
            <label className="flex min-h-11 items-center gap-1.5">
              <span className="grid size-5 shrink-0 place-items-center">
                <input
                  type="checkbox"
                  checked={sync.on}
                  onChange={(event) => sync.onChange(event.target.checked)}
                  className="size-4 accent-[var(--accent)]"
                />
              </span>
              <span className={cn(!sync.on && "text-muted")}>{text.syncToTheGame}</span>
            </label>
          )}
        </span>
        <span className="col-span-2 flex items-baseline justify-end gap-2 whitespace-nowrap">
          <span className="text-muted">{text.totalChips}</span>
          {stackAfter === null ? (
            notApplicable
          ) : (
            <span className="font-semibold tabular-nums">{chipText(stackAfter)}</span>
          )}
        </span>
      </div>
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
 * The insurance's own figures after the hand, each to be put right in place and neither moving the
 * other: its Buy-ins, a tap on − or + taking or adding one, and its chips, which a tap selects
 * whole to type over.
 */
function SeatFigures({
  hands,
  canTakeOne,
  chips,
  onStep,
  onChips,
}: {
  hands: number;
  /** False at one Buy-in. */
  canTakeOne: boolean;
  chips: number;
  onStep: (by: number) => void;
  onChips: (chips: number) => void;
}) {
  // What is being typed, until the field is left
  const [typed, setTyped] = useState<string>();
  const { handSummary: text } = t.insurance;
  const shown = typed ?? chipText(chips);
  return (
    <div className="flex min-h-11 items-center justify-between gap-2 text-xs">
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
          value={shown}
          // As wide as what it holds, with nothing drawn around it
          style={{ width: `${Math.max(1, shown.length)}ch` }}
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
          className="h-9 min-w-0 bg-transparent text-right text-[0.8125rem] font-semibold text-text tabular-nums outline-none"
        />
        <Pencil className="size-3 shrink-0 text-highlight" strokeWidth={1.75} aria-hidden />
      </label>
    </div>
  );
}

/**
 * Everything the hand comes to, for the organizer to accept before it reaches the table: the
 * board by street, as the page shows it while the hand is entered, then one table with a row for
 * each player and one for the insurance: each street's insurance, and a last column that adds the
 * insurance to what came from each pot. At its foot are the chips the player ends with, and in a
 * game a box for whether those go to the game. Under the insurance's figures are its Buy-ins and
 * chips after the hand, both to be put right in place. Chips that have to be bought are said under
 * their row.
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
  // Buy-ins added or given back by hand, counted from those the insurance needs, and its chips
  // where typed over. The two are apart: the Buy-ins are a record put right, not chips moved
  const [extraHands, setExtraHands] = useState(0);
  const [seatTyped, setSeatTyped] = useState<number>();
  const seatExtraChips = seat ? extraHands * seat.handChips : 0;
  const seatHands = seat ? (seat.boughtChips + needed) / seat.handChips + extraHands : 0;
  const seatAfter = seatTyped ?? (seat ? seat.stackChips + seatChips + needed : 0);
  const [confirming, setConfirming] = useState(false);
  const { handSummary: text } = t.insurance;
  const { board } = hand;

  const confirm = () =>
    onConfirm({
      syncPlayerIds: synced.map(({ playerId }) => playerId),
      seatExtraChips,
      // Buy-ins put right leave the chips as they are shown
      ...((seatTyped !== undefined || extraHands !== 0) && { seatStackChips: seatAfter }),
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
        <div className={cn(ROW, "px-3 py-2 text-right text-xs whitespace-nowrap text-muted")}>
          <span className="text-left">{t.common.player}</span>
          <span>{text.turnInsurance}</span>
          <span>{text.riverInsurance}</span>
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
                nameOf={nameOf}
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
          <li className="border-t border-line px-3 pt-2 pb-1">
            <RowTop
              hand={hand}
              nameOf={nameOf}
              name={
                <span className="truncate text-sm font-semibold text-highlight">
                  {t.common.insurance}
                </span>
              }
              totalChips={seatChips}
            />
            {seat && (
              <SeatFigures
                hands={seatHands}
                canTakeOne={seatHands > 1}
                chips={seatAfter}
                onStep={(by) => setExtraHands(extraHands + by)}
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
