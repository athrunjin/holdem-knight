import { type Card, formatOdds } from "@holdem-knight/core";
import { useState } from "react";
import { formatCardText } from "@/lib/cards";
import { cn } from "@/lib/cn";
import { formatOddsText } from "@/lib/number-input";
import { CardFace } from "./CardFace";
import { Modal } from "./Modal";

interface OutsManagerProps {
  /** Which cards these are: 主池 反超 Outs 管理 */
  title: string;
  /** 反超 or 平分 */
  kindText: string;
  /** Every card of the offer, in the order they are shown */
  cards: readonly Card[];
  /** The cards given up so far */
  skipped: readonly Card[];
  /** The odds for a count of cards, in hundredths. Undefined beyond the odds table. */
  oddsOf: (count: number) => number | undefined;
  onConfirm: (skipped: readonly Card[]) => void;
  onCancel: () => void;
}

const moveClass =
  "min-h-11 rounded-xl border px-5 font-medium transition-colors disabled:border-line disabled:text-muted disabled:opacity-50";

/** The cards of one part, each a button that picks it out or lets it go again. */
function CardRow({
  cards,
  picked,
  empty,
  onToggle,
}: {
  cards: readonly Card[];
  picked: readonly Card[];
  /** What the part says while it holds no cards */
  empty: string;
  onToggle: (card: Card) => void;
}) {
  if (cards.length === 0) return <p className="py-3 text-sm text-muted">{empty}</p>;
  return (
    <ul className="flex flex-wrap">
      {cards.map((card) => {
        const on = picked.includes(card);
        return (
          <li key={card}>
            <button
              type="button"
              aria-label={formatCardText(card)}
              aria-pressed={on}
              onClick={() => onToggle(card)}
              className="grid h-12 w-10 place-items-center"
            >
              <span
                className={cn(
                  "rounded-md transition-shadow",
                  on && "ring-2 ring-highlight ring-offset-2 ring-offset-surface",
                )}
              >
                <CardFace card={card} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The cards of one offer in two parts: those the cover is bought on, and those given up. A tap
 * picks a card out, any number of them, and the button under its part moves the cards picked to
 * the other part. At least one card stays bought. Nothing is kept until 确认.
 *
 * Giving up is all it does for now: buying some of the cards apart from the rest comes later.
 */
export function OutsManager({
  title,
  kindText,
  cards,
  skipped,
  oddsOf,
  onConfirm,
  onCancel,
}: OutsManagerProps) {
  const [given, setGiven] = useState<readonly Card[]>(skipped);
  // Cards picked out to move. A card is in one part only, so one list serves both.
  const [picked, setPicked] = useState<readonly Card[]>([]);
  const [notice, setNotice] = useState<string>();

  const bought = cards.filter((card) => !given.includes(card));
  const givenUp = cards.filter((card) => given.includes(card));
  const pickedBought = bought.filter((card) => picked.includes(card));
  const pickedGiven = givenUp.filter((card) => picked.includes(card));
  const odds = oddsOf(bought.length);
  const changed = given.length !== skipped.length || given.some((card) => !skipped.includes(card));

  function toggle(card: Card) {
    setNotice(undefined);
    setPicked(picked.includes(card) ? picked.filter((c) => c !== card) : [...picked, card]);
  }

  function giveUp() {
    if (pickedBought.length >= bought.length) {
      setNotice("最少保留一张 Outs，如不想购买可在保险主界面选择");
      return;
    }
    setGiven([...given, ...pickedBought]);
    setPicked(pickedGiven);
  }

  function buyBack() {
    setGiven(given.filter((card) => !pickedGiven.includes(card)));
    setPicked(pickedBought);
    setNotice(undefined);
  }

  function cancel() {
    if (changed && !window.confirm("取消本次修改？")) return;
    onCancel();
  }

  const total = <span className="font-normal text-muted"> / {cards.length}</span>;

  return (
    <Modal title={title} onClose={onCancel}>
      <section aria-label={`购买的${kindText} Outs`}>
        <h3 className="font-semibold tabular-nums">
          {kindText} {bought.length}
          {total} · {odds === undefined ? "超出赔率表" : `赔 ${formatOddsText(formatOdds(odds))}`}
        </h3>
        <CardRow cards={bought} picked={picked} empty="" onToggle={toggle} />
        <div className="flex justify-end">
          <button
            type="button"
            disabled={pickedBought.length === 0}
            onClick={giveUp}
            className={cn(moveClass, "border-highlight text-highlight")}
          >
            弃买
          </button>
        </div>
      </section>

      <section aria-label="弃买的 Outs" className="mt-2 border-t border-line pt-2">
        <h3 className="font-semibold tabular-nums">
          弃买 · {givenUp.length}
          {total}
        </h3>
        <CardRow cards={givenUp} picked={picked} empty="没有弃买的 Outs" onToggle={toggle} />
        <div className="flex justify-end">
          <button
            type="button"
            disabled={pickedGiven.length === 0}
            onClick={buyBack}
            className={cn(moveClass, "border-accent bg-accent text-accent-text")}
          >
            购买
          </button>
        </div>
      </section>

      {notice && (
        <p role="alert" className="mt-2 text-sm text-highlight">
          {notice}
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={cancel}
          className="min-h-11 rounded-xl border border-line font-medium"
        >
          取消
        </button>
        <button
          type="button"
          onClick={() => onConfirm(givenUp)}
          className="min-h-11 rounded-xl bg-accent font-semibold text-accent-text"
        >
          确认
        </button>
      </div>
    </Modal>
  );
}
