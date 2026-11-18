import { type Card, formatOdds } from "@holdem-knight/core";
import { ArrowLeftRight, Check, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { formatCardText } from "@/lib/cards";
import { formatOddsText } from "@/lib/number-input";
import { CardFace } from "./CardFace";
import { Modal } from "./Modal";

/** How the cards of one kind are sold: which are given up, and which are a second cover. */
export interface OutsPlan {
  readonly skipped: readonly Card[];
  readonly second: readonly Card[];
}

interface OutsManagerProps {
  /** Which cards these are: 主池 反超 Outs 管理 */
  title: string;
  /** 反超 or 平分 */
  kindText: string;
  /** Every card of the kind */
  cards: readonly Card[];
  /** How they are sold so far */
  plan: OutsPlan;
  /** The odds for a count of cards, in hundredths. Undefined beyond the odds table. */
  oddsOf: (count: number) => number | undefined;
  onConfirm: (plan: OutsPlan) => void;
  onCancel: () => void;
}

/** The parts a card can be in: the cover, the second cover where there is one, or given up. */
type Part = "first" | "second" | "given";

type Sort = "rank" | "suit";

const SORT_TEXT: Record<Sort, string> = { rank: "大小", suit: "花色" };

/** Cards are `rank * 4 + suit`: the highest rank first, or suit by suit with the highest first. */
const SORTS: Record<Sort, (a: Card, b: Card) => number> = {
  rank: (a, b) => Math.floor(b / 4) - Math.floor(a / 4) || (a % 4) - (b % 4),
  suit: (a, b) => (a % 4) - (b % 4) || Math.floor(b / 4) - Math.floor(a / 4),
};

const sameCards = (a: readonly Card[], b: readonly Card[]) =>
  a.length === b.length && a.every((card) => b.includes(card));

const actionClass =
  "min-h-11 rounded-xl border border-highlight px-3 font-medium text-highlight disabled:border-line disabled:text-muted disabled:opacity-50";
const pickClass =
  "min-h-11 rounded-xl border border-line px-3 text-sm font-medium disabled:text-muted disabled:opacity-50";

interface Action {
  readonly label: string;
  readonly enabled: boolean;
  readonly onSelect: () => void;
}

/**
 * One part of the cards: its heading with the order the cards are in, the cards, and under them
 * the buttons that pick cards out and the ones that move the cards picked.
 */
function PartSection({
  label,
  heading,
  cards,
  picked,
  empty,
  onPick,
  actions,
  onRemove,
}: {
  /** For a reader */
  label: string;
  heading: ReactNode;
  cards: readonly Card[];
  /** The cards picked out, of this part or any other */
  picked: readonly Card[];
  /** What the part says while it holds no cards */
  empty: string;
  /** Sets which of this part's cards are picked out */
  onPick: (cards: readonly Card[]) => void;
  /** At the right under the cards, in order */
  actions: readonly Action[];
  /** Takes the part away, by the bin at the end of its first line of cards */
  onRemove?: () => void;
}) {
  const [sort, setSort] = useState<Sort>("rank");
  const next: Sort = sort === "rank" ? "suit" : "rank";
  const shown = cards.toSorted(SORTS[sort]);
  const mine = cards.filter((card) => picked.includes(card));
  const all = cards.length > 0 && mine.length === cards.length;

  return (
    <section aria-label={label} className="border-t border-line pt-1 first:border-t-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold whitespace-nowrap tabular-nums">{heading}</h3>
        <button
          type="button"
          aria-label={`按${SORT_TEXT[sort]}排序，点击改为按${SORT_TEXT[next]}`}
          onClick={() => setSort(next)}
          className="-mr-1 flex min-h-11 shrink-0 items-center gap-1 px-1 text-sm text-muted"
        >
          {SORT_TEXT[sort]}
          <ArrowLeftRight className="size-3.5" aria-hidden />
        </button>
      </div>

      {cards.length === 0 ? (
        <p className="py-3 text-sm text-muted">{empty}</p>
      ) : (
        <div className="flex items-start">
          <ul className="flex min-w-0 flex-1 flex-wrap">
            {shown.map((card) => {
              const on = picked.includes(card);
              return (
                <li key={card}>
                  <button
                    type="button"
                    aria-label={formatCardText(card)}
                    aria-pressed={on}
                    onClick={() => onPick(on ? mine.filter((c) => c !== card) : [...mine, card])}
                    className="grid h-12 w-10 place-items-center"
                  >
                    {/*
                      A card picked out is framed in green with a tick on its corner. Both are
                      there or not, with nothing to fade in, so they show whatever the system
                      does about motion.
                    */}
                    <span className="relative">
                      <CardFace card={card} />
                      {on && (
                        <>
                          <span
                            aria-hidden
                            className="absolute -inset-0.5 rounded-lg border-2 border-win"
                          />
                          <span
                            aria-hidden
                            className="absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full bg-win text-bg"
                          >
                            <Check className="size-3" strokeWidth={3.5} />
                          </span>
                        </>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {onRemove && (
            <button
              type="button"
              aria-label={`删除${label}`}
              onClick={onRemove}
              className="grid size-12 shrink-0 place-items-center text-muted"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 pb-2">
        <button
          type="button"
          disabled={cards.length === 0}
          aria-pressed={all}
          onClick={() => onPick(all ? [] : cards)}
          className={pickClass}
        >
          全选
        </button>
        <button
          type="button"
          // Something to turn round: some of the cards picked, and not all of them
          disabled={mine.length === 0 || all}
          onClick={() => onPick(cards.filter((card) => !mine.includes(card)))}
          className={pickClass}
        >
          反选
        </button>
        <span className="flex-1" />
        {actions.map(({ label: text, enabled, onSelect }) => (
          <button
            key={text}
            type="button"
            disabled={!enabled}
            onClick={onSelect}
            className={actionClass}
          >
            {text}
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * The cards of one kind on a pot, and how they are sold. They start as one cover. Cards picked
 * out can be given up, or split off as a second cover priced on its own cards, and moved between
 * the parts afterwards. A second cover left without cards goes, and at least one card always
 * stays bought. Nothing is kept until 确认.
 */
export function OutsManager({
  title,
  kindText,
  cards,
  plan,
  oddsOf,
  onConfirm,
  onCancel,
}: OutsManagerProps) {
  const [given, setGiven] = useState<readonly Card[]>(plan.skipped);
  const [second, setSecond] = useState<readonly Card[]>(plan.second);
  // Cards picked out to move. A card is in one part only, so one list serves them all.
  const [picked, setPicked] = useState<readonly Card[]>([]);
  const [notice, setNotice] = useState<string>();

  const partOf = (card: Card): Part =>
    given.includes(card) ? "given" : second.includes(card) ? "second" : "first";
  const inPart = (part: Part) => cards.filter((card) => partOf(card) === part);
  const first = inPart("first");
  const split = second.length > 0;
  const pickedIn = (part: Part) => inPart(part).filter((card) => picked.includes(card));
  const changed = !sameCards(given, plan.skipped) || !sameCards(second, plan.second);

  /** Picks out exactly these cards of a part, leaving the other parts as they are. */
  function pick(part: Part, chosen: readonly Card[]) {
    setNotice(undefined);
    setPicked([...picked.filter((card) => partOf(card) !== part), ...chosen]);
  }

  /** Moves the cards picked in one part to another. The cards moved are picked no longer. */
  function move(from: Part, to: Part) {
    const moved = pickedIn(from);
    if (moved.length === 0) return;
    const nextGiven = [
      ...given.filter((c) => !moved.includes(c)),
      ...(to === "given" ? moved : []),
    ];
    let nextSecond = [
      ...second.filter((c) => !moved.includes(c)),
      ...(to === "second" ? moved : []),
    ];
    const sold = cards.filter((card) => !nextGiven.includes(card));
    if (sold.length === 0) {
      setNotice("最少保留一张 Outs，如不想购买可在保险主界面选择");
      return;
    }
    // With nothing left in the first cover, the second is the only one, and so the first
    if (sold.every((card) => nextSecond.includes(card))) nextSecond = [];
    setGiven(nextGiven);
    setSecond(nextSecond);
    setPicked(picked.filter((card) => !moved.includes(card)));
    setNotice(undefined);
  }

  /** Takes the second cover away: its cards are given up. */
  function removeSecond() {
    setGiven([...given, ...second]);
    setPicked(picked.filter((card) => !second.includes(card)));
    setSecond([]);
    setNotice(undefined);
  }

  function cancel() {
    if (changed && !window.confirm("取消本次修改？")) return;
    onCancel();
  }

  const total = <span className="font-normal text-muted"> / {cards.length}</span>;
  const oddsText = (count: number) => {
    const odds = oddsOf(count);
    return odds === undefined ? "超出赔率表" : `赔 ${formatOddsText(formatOdds(odds))}`;
  };
  const some = (part: Part) => pickedIn(part).length > 0;
  const giveUp = (part: Part): Action => ({
    label: "弃买",
    enabled: some(part),
    onSelect: () => move(part, "given"),
  });

  return (
    <Modal title={title} onClose={onCancel}>
      <PartSection
        label={split ? `${kindText} I` : kindText}
        heading={
          <>
            {kindText}
            {split && " I"} {first.length}
            {total} · {oddsText(first.length)}
          </>
        }
        cards={first}
        picked={picked}
        empty=""
        onPick={(chosen) => pick("first", chosen)}
        actions={[
          split
            ? { label: "池 II", enabled: some("first"), onSelect: () => move("first", "second") }
            : {
                label: "分开买",
                // A second cover takes some of the cards, never all of them
                enabled: some("first") && pickedIn("first").length < first.length,
                onSelect: () => move("first", "second"),
              },
          giveUp("first"),
        ]}
      />

      {split && (
        <PartSection
          label={`${kindText} II`}
          heading={
            <>
              {kindText} II {second.length}
              {total} · {oddsText(second.length)}
            </>
          }
          cards={inPart("second")}
          picked={picked}
          empty=""
          onPick={(chosen) => pick("second", chosen)}
          actions={[
            { label: "池 I", enabled: some("second"), onSelect: () => move("second", "first") },
            giveUp("second"),
          ]}
          onRemove={removeSecond}
        />
      )}

      <PartSection
        label="弃买"
        heading={
          <>
            弃买 · {given.length}
            {total}
          </>
        }
        cards={inPart("given")}
        picked={picked}
        empty="没有弃买的 Outs"
        onPick={(chosen) => pick("given", chosen)}
        actions={
          split
            ? [
                { label: "池 I", enabled: some("given"), onSelect: () => move("given", "first") },
                { label: "池 II", enabled: some("given"), onSelect: () => move("given", "second") },
              ]
            : [{ label: "购买", enabled: some("given"), onSelect: () => move("given", "first") }]
        }
      />

      {notice && (
        <p role="alert" className="mb-2 text-sm text-highlight">
          {notice}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={cancel}
          className="min-h-11 rounded-xl border border-line font-medium"
        >
          取消
        </button>
        <button
          type="button"
          onClick={() => onConfirm({ skipped: inPart("given"), second: inPart("second") })}
          className="min-h-11 rounded-xl bg-accent font-semibold text-accent-text"
        >
          确认
        </button>
      </div>
    </Modal>
  );
}
