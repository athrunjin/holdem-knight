import type { Card, InsuranceHandPlayer } from "@holdem-knight/core";
import { RotateCcw, X } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { TextMenu } from "@/components/TextMenu";
import { formatCardText } from "@/lib/cards";
import { cn } from "@/lib/cn";
import { selectOnFocus } from "@/lib/number-input";
import { CardFace } from "./CardFace";
import type { InsuranceSeat } from "./InsuranceCalculator";

/** Where a player stands, under their name: a leader is lit and shows only the chance to win. */
export interface StandingNote {
  readonly leading: boolean;
  /** Empty while there is nothing to say yet, and the row is only lit */
  readonly text: string;
}

/** The most digits a stake takes. Six still fit the row; a seventh is there for the rare stack. */
const MAX_CHIP_DIGITS = 7;

const chipText = (chips: number) => chips.toLocaleString("zh-CN");

/** What can be changed on a row while the players of a hand are still open. */
export interface HandPlayerEdits {
  /** Everyone at the table, in its order, to pick this row's player from */
  seats: readonly InsuranceSeat[];
  /** Players in the other rows, who cannot be picked twice */
  takenIds: readonly string[];
  onSeat: (playerId: string) => void;
  /** Called with every digit typed, then `onChipsDone` once the field is left */
  onChips: (chips: number) => void;
  onChipsDone: () => void;
  onCover: (cover: boolean) => void;
  /**
   * The small icon before the name: an arrow that clears what the row holds besides its chips, on
   * the rows a pot cannot do without, or a cross that takes the row away
   */
  lead: {
    readonly kind: "reset" | "remove";
    /** What it does, for a reader */
    readonly label: string;
    readonly onSelect: () => void;
  };
}

interface HandPlayerRowProps {
  name: string;
  player: InsuranceHandPlayer;
  /** Missing until the hands can be compared */
  note: StandingNote | undefined;
  /** Missing once the players are fixed, when the row only shows */
  edits: HandPlayerEdits | undefined;
  /** What ends the row: the player's two cards, or what stands for them where no cards are picked */
  children: ReactNode;
}

/** The stake as a field with no frame: a tap selects it, and digits typed replace it. */
function ChipsField({
  name,
  chips,
  onChips,
  onDone,
}: {
  name: string;
  chips: number;
  onChips: (chips: number) => void;
  onDone: () => void;
}) {
  // The digits as typed, while the field has the focus
  const [draft, setDraft] = useState<string>();
  // The stake when the field took the focus
  const found = useRef(chips);
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      enterKeyHint="done"
      aria-label={`${name}的筹码`}
      value={draft ?? chipText(chips)}
      onFocus={(event) => {
        found.current = chips;
        setDraft(String(chips));
        selectOnFocus(event.currentTarget);
      }}
      onChange={(event) => {
        const text = event.target.value
          .replace(/\D/g, "")
          .replace(/^0+(?=\d)/, "")
          .slice(0, MAX_CHIP_DIGITS);
        setDraft(text);
        onChips(Number(text));
      }}
      onBlur={() => {
        // Left as it was found, there is nothing to keep
        if (draft !== undefined && draft !== String(found.current)) onDone();
        setDraft(undefined);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className="h-11 w-full min-w-0 border-b border-transparent bg-transparent text-right font-semibold tabular-nums outline-none focus:border-highlight"
    />
  );
}

/** A player's two cards. With `onPick` each is a button that opens the cards at that place. */
export function HoleCards({
  name,
  cards: [first, second],
  onPick,
}: {
  name: string;
  cards: readonly Card[];
  /** Called with the place of the card tapped, where there is one. Missing when the cards only show. */
  onPick: ((place: number | undefined) => void) | undefined;
}) {
  const cards: readonly (Card | undefined)[] = [first, second];
  return (
    <span className={cn("flex shrink-0", !onPick && "gap-1")}>
      {cards.map((card, place) =>
        onPick ? (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: the two places of a hand
            key={place}
            type="button"
            aria-label={
              card === undefined ? `选择${name}的手牌` : `更换${name}的${formatCardText(card)}`
            }
            onClick={() => onPick(card === undefined ? undefined : place)}
            className="grid h-11 w-10 place-items-center"
          >
            <CardFace card={card ?? null} />
          </button>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: the two places of a hand
          <CardFace key={place} card={card ?? null} />
        ),
      )}
    </span>
  );
}

/**
 * One player of a pot on a line: the name, the stake and what ends the row, the two cards as a
 * rule. While the players are open, the name is a menu of the table, the stake is typed in place
 * and a small C marks the player as covering the others.
 */
export function HandPlayerRow({ name, player, note, edits, children }: HandPlayerRowProps) {
  const noteText = note?.text || undefined;
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-xl border px-2 py-1 transition-colors",
        note?.leading ? "border-accent bg-accent/10" : "border-line bg-surface",
      )}
    >
      {edits && (
        <button
          type="button"
          aria-label={edits.lead.label}
          onClick={edits.lead.onSelect}
          className="-mx-1 grid h-11 w-6 shrink-0 place-items-center text-muted"
        >
          {edits.lead.kind === "reset" ? (
            <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden />
          ) : (
            <X className="size-4" aria-hidden />
          )}
        </button>
      )}

      {/* The standing sits on the name's line, inside its 44px, so the row stays one line tall */}
      <div className="relative min-w-0 flex-1">
        {edits ? (
          <TextMenu
            label="玩家"
            options={[
              ...edits.seats.map((seat) => ({
                value: seat.id,
                label: seat.name,
                disabled: edits.takenIds.includes(seat.id),
              })),
              // Someone who has since left the table still shows by name until replaced
              ...(edits.seats.some((seat) => seat.id === player.playerId)
                ? []
                : [{ value: player.playerId, label: name }]),
            ]}
            value={player.playerId}
            onChange={(id) => id !== player.playerId && edits.onSeat(id)}
            className={cn("font-medium", noteText && "items-start pt-1 [&>svg]:mt-1")}
          />
        ) : (
          <span className={cn("flex min-h-11 font-medium", noteText ? "pt-1" : "items-center")}>
            <span className="truncate">{name}</span>
          </span>
        )}
        {note && noteText && (
          <span
            className={cn(
              "pointer-events-none absolute bottom-0.5 left-0 max-w-full truncate text-xs tabular-nums",
              note.leading ? "font-semibold text-accent" : "text-muted",
            )}
          >
            {noteText}
          </span>
        )}
      </div>

      <span className="flex h-11 w-[4.5rem] shrink-0 items-center justify-end font-semibold tabular-nums">
        {player.cover ? (
          <span className="text-win">Cover</span>
        ) : edits ? (
          <ChipsField
            name={name}
            chips={player.chips}
            onChips={edits.onChips}
            onDone={edits.onChipsDone}
          />
        ) : (
          chipText(player.chips)
        )}
      </span>
      {edits && (
        <button
          type="button"
          aria-label={`${name} Cover`}
          aria-pressed={player.cover}
          onClick={() => edits.onCover(!player.cover)}
          className="grid h-11 w-7 shrink-0 place-items-center"
        >
          <span
            className={cn(
              "grid size-6 place-items-center rounded-full border text-xs font-bold transition-colors",
              player.cover ? "border-win bg-win text-bg" : "border-line text-muted",
            )}
          >
            C
          </span>
        </button>
      )}

      {children}
    </div>
  );
}
