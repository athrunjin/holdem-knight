import { type Card, formatCard } from "@holdem-knight/core";
import { t } from "@/i18n";
import { formatCardText } from "@/lib/cards";
import { cn } from "@/lib/cn";

/** A card, or a question mark in its place. `solid` draws the empty place as a card that must come. */
export function CardFace({ card, solid = false }: { card: Card | null; solid?: boolean }) {
  const red = card !== null && /[hd]/.test(formatCard(card)[1] ?? "");
  return (
    <span
      className={cn(
        "grid h-11 w-9 place-items-center rounded-md border text-sm font-semibold tabular-nums",
        card !== null && "border-line bg-bg",
        card === null &&
          (solid ? "border-line bg-surface text-muted" : "border-dashed border-line text-muted"),
        red && "text-loss",
      )}
    >
      {card === null ? "?" : formatCardText(card)}
    </span>
  );
}

export const BOARD_PLACES = [0, 1, 2, 3, 4] as const;

/** Five places: dealt cards, then question marks. */
export function BoardCards({ cards }: { cards: readonly Card[] }) {
  return (
    <span
      className="flex gap-1"
      role="img"
      aria-label={t.insurance.cardFace.boardCardsDealt(cards.length)}
    >
      {BOARD_PLACES.map((place) => (
        <CardFace key={place} card={cards[place] ?? null} />
      ))}
    </span>
  );
}
