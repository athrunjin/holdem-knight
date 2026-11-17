import type { InsuranceHandPlayer } from "@holdem-knight/core";
import { RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
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
 * Dead money, framed like a street of the board: the chip stack with its name and amount
 * underneath. The amount a pot starts with is framed in dashed light green until the organizer
 * sets it, and from then on like the flop.
 */
export function DeadMoney({
  chips,
  preset,
  onEdit,
}: {
  chips: number;
  /** Still the amount a pot starts with */
  preset: boolean;
  onEdit: (() => void) | undefined;
}) {
  const className = cn(
    "flex shrink-0 flex-col items-center gap-1 rounded-xl border-2 px-2 pt-2 pb-1",
    preset ? "border-dashed border-win/50 text-win" : "border-line bg-surface",
  );
  const content = (
    <>
      <span className="grid h-11 place-items-center">
        <ChipStack lit={chips > 0} />
      </span>
      <span className={cn("text-xs whitespace-nowrap tabular-nums", !preset && "text-muted")}>
        {chips > 0 ? `死钱 ${chipText(chips)}` : "死钱"}
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
