import { type Card, makeCard, RANKS, SUITS } from "@holdem-knight/core";
import { RotateCcw } from "lucide-react";
import { TextMenu } from "@/components/TextMenu";
import { t } from "@/i18n";
import { formatCardText, isRedSuit, suitSymbol } from "@/lib/cards";
import { cn } from "@/lib/cn";
import { Modal } from "./Modal";

/** Something of a hand that takes cards: the flop, the turn, or a player's two. */
export interface CardTarget {
  readonly id: string;
  /** In the list: 翻牌, 转牌, or the player's name */
  readonly label: string;
  /** How many cards it takes */
  readonly count: number;
  readonly cards: readonly Card[];
  /** The few characters that mark its cards on the grid: 翻, 转, 王1 */
  readonly mark: string;
  /** Cards of the board are marked in the chip gold, a player's in green */
  readonly tone: "board" | "player";
  /** Cannot be picked for yet, as the turn before the flop is in */
  readonly disabled?: boolean;
  /** Shown gray in the list, as a card that may be left out */
  readonly faint?: boolean;
}

interface HandCardPickerProps {
  targets: readonly CardTarget[];
  /** The target being picked for */
  active: string;
  onActive: (id: string) => void;
  /** Called with a target's cards at every tap that changes them: there is nothing to confirm */
  onCards: (id: string, cards: readonly Card[]) => void;
  /** Takes every card of every target back */
  onReset: () => void;
  onClose: () => void;
  /**
   * Picks for the active target only, for a card dealt through the hand: the other targets show
   * whose the cards are and cannot be gone to or cleared, and the pick is kept by 确认, with 取消
   * beside it.
   */
  locked?: { readonly onCancel: () => void };
}

/**
 * The marks of the players of a pot: the first character of a name, or its first two letters where
 * it starts with a letter or a digit. Players who would share a mark are numbered: 王1 王2, Ki1 Ki2.
 */
export function playerMarks(names: readonly string[]): string[] {
  const bases = names.map((name) => {
    const text = name.trim();
    return /^[\x20-\x7e]/.test(text) ? text.replace(/\s/g, "").slice(0, 2) : ([...text][0] ?? "");
  });
  const seen = new Map<string, number>();
  return bases.map((base) => {
    if (bases.filter((other) => other === base).length < 2) return base;
    const number = (seen.get(base) ?? 0) + 1;
    seen.set(base, number);
    return `${base}${number}`;
  });
}

const TONE = {
  board: {
    own: "border-highlight bg-highlight/15",
    other: "border-highlight/70",
    mark: "text-highlight",
  },
  player: { own: "border-win bg-win/15", other: "border-win/70", mark: "text-win" },
} as const;

/**
 * Every card of a hand picked in one place. The title is a menu of what takes cards, each with how
 * many it has of how many it takes; one column per suit and one row per rank keep every card a
 * 44px target on a phone.
 *
 * A tap is the pick: it is kept at once, so moving to another target or leaving loses nothing, and
 * a target may be left short. A card taken is framed and marked with whose it is, bright for the
 * target being picked for and dim for the others. A tap on a card of the target lets it go; one
 * card more than it takes is not picked until one is let go, except for a single card, which the
 * next pick replaces.
 */
export function HandCardPicker({
  targets,
  active,
  onActive,
  onCards,
  onReset,
  onClose,
  locked,
}: HandCardPickerProps) {
  const target = targets.find(({ id }) => id === active) ?? targets[0];
  if (!target) return null;
  const ownerOf = (card: Card) => targets.find(({ cards }) => cards.includes(card));

  function toggle(card: Card) {
    if (!target) return;
    const { id, cards, count } = target;
    if (cards.includes(card))
      onCards(
        id,
        cards.filter((c) => c !== card),
      );
    else if (count === 1) onCards(id, [card]);
    else if (cards.length < count) onCards(id, [...cards, card]);
  }

  return (
    <Modal
      title={
        <span className="-my-2 flex items-center justify-between gap-2">
          <TextMenu
            label={t.insurance.handCardPicker.pickCardsFor}
            options={targets.map(({ id, label, cards, count, disabled, faint }) => ({
              value: id,
              name: t.insurance.handCardPicker.ofPicked(label, cards.length, count),
              chosen: `${label}${t.common.openParen}${cards.length}/${count}${t.common.closeParen}`,
              // The name keeps a width of its own, so the counts line up down the list
              label: (
                <span
                  className={cn(
                    "flex w-44 items-center justify-between gap-3",
                    faint && "opacity-60",
                  )}
                >
                  <span className="truncate">{label}</span>
                  <span className="shrink-0 tabular-nums">
                    ({cards.length}/{count})
                  </span>
                </span>
              ),
              ...(disabled && { disabled: true }),
            }))}
            value={target.id}
            onChange={onActive}
            disabled={locked !== undefined}
            className="font-semibold disabled:opacity-100 [&:disabled>svg]:hidden"
          />
          {!locked && (
            <button
              type="button"
              aria-label={t.insurance.handCardPicker.clearAllPickedCards}
              onClick={onReset}
              className="-mr-2 grid size-11 shrink-0 place-items-center text-muted"
            >
              <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden />
            </button>
          )}
        </span>
      }
      onClose={locked ? locked.onCancel : onClose}
    >
      <div className="grid grid-cols-4 gap-1">
        {RANKS.toReversed().flatMap((rank) =>
          SUITS.map((suit) => {
            const card = makeCard(rank, suit);
            const owner = ownerOf(card);
            const own = owner?.id === target.id;
            const tone = owner && TONE[owner.tone];
            return (
              <button
                key={card}
                type="button"
                // A card of another target stays where it is until it is let go there
                disabled={(owner !== undefined && !own) || target.disabled}
                aria-pressed={own}
                aria-label={
                  owner
                    ? `${formatCardText(card)}${t.common.comma}${owner.label}`
                    : formatCardText(card)
                }
                onClick={() => toggle(card)}
                className={cn(
                  "relative min-h-11 rounded-lg border font-semibold tabular-nums",
                  isRedSuit(suit) && "text-loss",
                  !tone && "border-line",
                  tone && (own ? cn("border-2", tone.own) : cn(tone.other, "opacity-45")),
                )}
              >
                {rank === "T" ? "10" : rank}
                {suitSymbol(suit)}
                {owner && tone && (
                  <span
                    className={cn(
                      "absolute top-0.5 right-1 text-[9px] leading-none font-semibold",
                      tone.mark,
                    )}
                  >
                    {owner.mark}
                  </span>
                )}
              </button>
            );
          }),
        )}
      </div>
      <div className={cn("mt-2 grid gap-2", locked && "grid-cols-2")}>
        {locked && (
          <button
            type="button"
            onClick={locked.onCancel}
            className="min-h-11 rounded-xl border border-line font-medium"
          >
            {t.common.cancel}
          </button>
        )}
        <button
          type="button"
          // A card dealt is kept only once it is there to keep
          disabled={locked !== undefined && target.cards.length < target.count}
          onClick={onClose}
          className="min-h-11 rounded-xl bg-accent font-semibold text-accent-text disabled:opacity-40"
        >
          {t.insurance.handCardPicker.confirm(target.cards.length, target.count)}
        </button>
      </div>
    </Modal>
  );
}
