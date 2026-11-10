import { type Card, makeCard, RANKS, SUITS } from "@holdem-knight/core";
import { useState } from "react";
import { formatCardText, isRedSuit, suitSymbol } from "@/lib/cards";
import { cn } from "@/lib/cn";
import { Modal } from "./Modal";

interface CardPickerProps {
  title: string;
  /** How many cards to choose. */
  count: number;
  /** Cards already on the table, which cannot be picked twice */
  usedCards: ReadonlySet<Card>;
  initial?: readonly Card[];
  /** The place among `initial` to change first, for swapping one card of a full set. */
  replace?: number | undefined;
  /** Lets the pick be confirmed with nothing chosen, for cards that may be left out. */
  optional?: boolean;
  onConfirm: (cards: readonly Card[]) => void;
  onCancel: () => void;
}

/** The cards by place, and the place the next pick goes to. Null when every place is taken and stays so. */
interface Picked {
  readonly places: readonly (Card | null)[];
  readonly next: number | null;
}

function firstEmpty(places: readonly (Card | null)[]) {
  const place = places.indexOf(null);
  return place === -1 ? null : place;
}

/**
 * One column per suit, one row per rank, so every card keeps a 44px target on a phone.
 *
 * Choosing fresh fills the places in order and then stops. Swapping starts at one place and moves
 * on to the ones after it, staying on the last: an earlier card changes only once it is tapped off.
 */
export function CardPicker({
  title,
  count,
  usedCards,
  initial = [],
  replace,
  optional = false,
  onConfirm,
  onCancel,
}: CardPickerProps) {
  // A single card is always swapped by the next pick
  const swapping = replace !== undefined || count === 1;
  const [{ places, next }, setPicked] = useState<Picked>(() => {
    const start = Array.from({ length: count }, (_, place) => initial[place] ?? null);
    return { places: start, next: replace ?? firstEmpty(start) ?? (swapping ? 0 : null) };
  });
  const chosen = places.filter((card) => card !== null);

  function toggle(card: Card) {
    const place = places.indexOf(card);
    if (place !== -1) {
      setPicked({ places: places.with(place, null), next: place });
    } else if (next !== null) {
      const filled = places.with(next, card);
      const after = swapping ? Math.min(next + 1, count - 1) : firstEmpty(filled);
      setPicked({ places: filled, next: after });
    }
  }

  return (
    <Modal title={title} onClose={onCancel}>
      {replace !== undefined && next !== null && (
        <p className="mb-2 text-sm text-muted">
          正在换第 {next + 1} 张。要换另一张，先点一下它取消选择。
        </p>
      )}
      <div className="grid grid-cols-4 gap-1">
        {RANKS.toReversed().flatMap((rank) =>
          SUITS.map((suit) => {
            const card = makeCard(rank, suit);
            const selected = places.includes(card);
            // The card the next pick takes the place of
            const leaving = replace !== undefined && next !== null && places[next] === card;
            return (
              <button
                key={card}
                type="button"
                disabled={usedCards.has(card)}
                aria-pressed={selected}
                aria-label={formatCardText(card)}
                onClick={() => toggle(card)}
                className={cn(
                  "min-h-11 rounded-lg border font-semibold tabular-nums disabled:opacity-25",
                  selected
                    ? leaving
                      ? "border-2 border-dashed border-accent bg-accent/10"
                      : "border-accent bg-accent text-accent-text"
                    : "border-line",
                  (!selected || leaving) && isRedSuit(suit) && "text-loss",
                )}
              >
                {rank === "T" ? "10" : rank}
                {suitSymbol(suit)}
              </button>
            );
          }),
        )}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-xl border border-line font-medium"
        >
          取消
        </button>
        <button
          type="button"
          disabled={chosen.length !== count && !(optional && chosen.length === 0)}
          onClick={() => onConfirm(chosen)}
          className="min-h-11 rounded-xl bg-accent font-semibold text-accent-text disabled:opacity-40"
        >
          {optional && chosen.length === 0 ? "不选" : `确认（${chosen.length}/${count}）`}
        </button>
      </div>
    </Modal>
  );
}
