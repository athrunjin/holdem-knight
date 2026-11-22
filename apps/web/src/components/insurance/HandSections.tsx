import type { InsuranceHandPlayer } from "@holdem-knight/core";
import { RotateCcw } from "lucide-react";
import { type ReactNode, type Ref, useId, useRef, useState } from "react";
import { ChipStack } from "@/components/ChipStack";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { selectOnFocus } from "@/lib/number-input";
import type { InsuranceSeat } from "./InsuranceCalculator";

/**
 * What the two ways of working out insurance share on the page: the section titles, dead money
 * and the players a pot starts with.
 */

/** A pot needs two players, and starts with two. */
export const MIN_PLAYERS = 2;

/** Dead money a pot starts with, wherever it is opened from, until the organizer sets it. */
export const PRESET_DEAD_CHIPS = 1000;

const chipText = (chips: number) => chips.toLocaleString("zh-CN");

/** A player as they sit down: the chips they have at the table, and no cards yet. */
export const seatedPlayer = ({ id, chips = 0 }: InsuranceSeat): InsuranceHandPlayer => ({
  playerId: id,
  chips,
  cover: false,
  cards: [],
});

/** The first players of the table who are not in the pot yet, in the table's order. */
export function nextPlayers(
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
 * A section's name, a little larger than the text, in the middle of the page with a line at
 * either side on its own middle, each fading out toward the edge.
 */
export function SectionTitle({ id, title }: { id: string; title: string }) {
  return (
    <div className="mb-2 flex min-h-11 items-center gap-3">
      <span aria-hidden className="h-px flex-1 bg-linear-to-r from-transparent to-line" />
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      <span aria-hidden className="h-px flex-1 bg-linear-to-l from-transparent to-line" />
    </div>
  );
}

/**
 * The arrow that clears the pot's section. It sits by the edge of the page, between the title's
 * line and the first frame under it, so nothing else moves. Its parent must be `relative`.
 */
export function SectionReset({ label, onReset }: { label: string; onReset: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onReset}
      className="absolute -top-9 -left-2 grid size-9 place-items-center text-muted"
    >
      <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden />
    </button>
  );
}

/** A small ring in the middle of the page under the players, with a 44px place to tap around it. */
export function RoundAction({
  label,
  onSelect,
  children,
}: {
  label: string;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onSelect}
      className="mx-auto mt-1 grid size-11 place-items-center text-highlight"
    >
      <span className="grid size-7 place-items-center rounded-full border border-line">
        {children}
      </span>
    </button>
  );
}

/** The most digits dead money takes, as a player's chips do. */
const MAX_DEAD_DIGITS = 7;

/** How dead money is typed while the pot can still change. */
export interface DeadMoneyEdits {
  /** Called with every digit typed, and with the amount as it stands when Enter confirms it unchanged */
  onChips: (chips: number) => void;
  /** Called once the field is left after that */
  onDone: () => void;
}

/**
 * Dead money, framed like a street of the board: the chip stack with its name and its amount
 * underneath, one under the other. The amount a pot starts with is framed in dashed light green until the organizer
 * sets it, and from then on like the flop. With `edits` the amount is typed in place: a tap
 * anywhere on the frame selects it, and digits typed replace it.
 */
export function DeadMoney({
  chips,
  preset,
  edits,
  inputRef,
}: {
  chips: number;
  /** Still the amount a pot starts with */
  preset: boolean;
  /** Missing once the pot can no longer change, when the amount only shows */
  edits: DeadMoneyEdits | undefined;
  /** The field, for a tap on dead money elsewhere on the page to land in */
  inputRef?: Ref<HTMLInputElement>;
}) {
  const id = useId();
  // The digits as typed, while the field has the focus
  const [draft, setDraft] = useState<string>();
  const changed = useRef(false);
  const text = draft ?? chipText(chips);
  // The stack, the name and the amount one under the other: as tall as a street of the board, and
  // narrow enough for six digits to stay on the board's line once the river is on it
  const className = cn(
    "flex shrink-0 flex-col items-center rounded-xl border-2 px-2 pt-2 pb-1",
    preset ? "border-dashed border-win/50 text-win" : "border-line bg-surface",
  );
  const stack = <ChipStack lit={chips > 0} />;
  const name = (
    <span className={cn("text-xs leading-4", !preset && "text-muted")}>{t.common.deadMoney}</span>
  );
  const amountClass = "h-[22px] text-base leading-[22px] font-semibold tabular-nums";
  if (!edits) {
    return (
      <div className={className}>
        {stack}
        {name}
        <span className={cn(amountClass, !preset && "text-text")}>{chipText(chips)}</span>
      </div>
    );
  }
  return (
    <label htmlFor={id} className={cn(className, "cursor-text focus-within:border-highlight")}>
      {stack}
      {name}
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        enterKeyHint="done"
        aria-label={t.common.deadMoney}
        value={text}
        // As wide as what it holds, so the frame fits the amount
        style={{ width: `${Math.max(1, text.length)}ch` }}
        onFocus={(event) => {
          changed.current = false;
          setDraft(String(chips));
          selectOnFocus(event.currentTarget);
        }}
        onChange={(event) => {
          const digits = event.target.value
            .replace(/\D/g, "")
            .replace(/^0+(?=\d)/, "")
            .slice(0, MAX_DEAD_DIGITS);
          setDraft(digits);
          changed.current = true;
          edits.onChips(Number(digits));
        }}
        onBlur={() => {
          // Left as it was found, there is nothing to keep
          if (changed.current) edits.onDone();
          setDraft(undefined);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          // Enter on the amount a pot starts with makes it the organizer's own
          if (!changed.current) {
            changed.current = true;
            edits.onChips(chips);
          }
          event.currentTarget.blur();
        }}
        className={cn(
          amountClass,
          "min-w-0 bg-transparent text-center outline-none",
          !preset && "text-text",
        )}
      />
    </label>
  );
}
