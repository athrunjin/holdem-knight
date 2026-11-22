import { chipsToCents, type Game } from "@holdem-knight/core";
import { Link } from "@tanstack/react-router";
import { Calculator, Check, Timer, X } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { ChipStack } from "@/components/ChipStack";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { organizerNameOf } from "@/data";
import { localeTag, t } from "@/i18n";
import { cn } from "@/lib/cn";
import { formatGameMoney } from "@/lib/currency";

/** One of the three boxes under a game page's header, with its text centered. */
const tileClass =
  "@container min-w-0 rounded-xl border border-line bg-surface px-1 py-1.5 text-center";
const labelClass = "flex items-center justify-center text-xs whitespace-nowrap text-muted";

/**
 * The three boxes in a row. The last is a little wider: it holds a label and a figure on one line
 * where the first holds a figure alone.
 */
export function GameTiles({ children }: { children: ReactNode }) {
  return <div className="mt-2 grid grid-cols-[1fr_1fr_1.2fr] gap-2">{children}</div>;
}

/** `2026-11-09 周一 19:00` in local time. */
export function formatStart(time: number) {
  const date = new Date(time);
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const weekday = date.toLocaleDateString(localeTag, { weekday: "short" });
  return `${day} ${weekday} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Whose game it is and when it started, over the boxes on the game page and the settlement page.
 * The organizer goes by the name of their space.
 */
export function GameHostLine({
  game,
  end,
}: {
  game: Pick<Game, "organizerId" | "createdAt">;
  /** Small text at the right end of the line, over the last box. */
  end?: ReactNode;
}) {
  return (
    // Everything ends on one line at the bottom, with a little more room before the boxes
    <div className="mt-1 mb-1 flex items-end justify-between gap-2 pb-0.5 leading-none">
      <p className="flex min-w-0 items-end gap-1.5 text-sm leading-none whitespace-nowrap text-muted tabular-nums">
        <span className="truncate text-lg leading-none font-semibold text-white">
          {organizerNameOf(game)}
        </span>
        <span className="shrink-0 pb-px">· {formatStart(game.createdAt)}</span>
      </p>
      {end}
    </div>
  );
}

/** A box with a label over a value. */
export function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={tileClass}>
      <span className={labelClass}>{label}</span>
      <span className="block font-semibold tabular-nums">{children}</span>
    </div>
  );
}

/**
 * A figure that always fits its box on one line: type as large as the text around it while the
 * figure is short, and smaller in step with its length, measured against the box. `lead` is a
 * one-character word before it, in the same type. Six digits with cents fit a third of a 393 wide
 * phone. Cents show only where there are some.
 */
function Figure({ text, lead }: { text: string; lead?: string }) {
  // A character of these figures is at most 0.58 of the type size wide; the word and its gap, 1.3
  const width = text.length * 0.58 + (lead ? 1.3 : 0);
  const fit = `calc(100cqw / ${width.toFixed(2)})`;
  return (
    <span
      style={{ fontSize: `min(1rem, ${fit})` }}
      className="font-semibold whitespace-nowrap tabular-nums"
    >
      {lead && <span className="mr-[0.25em]">{lead}</span>}
      {text}
    </span>
  );
}

/**
 * A figure a tap on its box switches between cash, shown first, and chips. The box's top right
 * corner shows which, as the currency's mark or a chip, set over the box so it keeps its size.
 * Where the label reaches the corner the mark is left out, and the tap still switches.
 */
function useCashOrChips(game: Pick<Game, "chipRatio" | "currency">) {
  const [inChips, setInChips] = useState(false);
  const [crowded, setCrowded] = useState(false);
  const labelRef = useRef<HTMLSpanElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);

  // Measured, since the label's length and the box's width both vary. `invisible` keeps the
  // mark's place, so the measure does not change with the answer
  useLayoutEffect(() => {
    const label = labelRef.current;
    const mark = markRef.current;
    const box = label?.parentElement;
    if (!label || !mark || !box) return;
    const measure = () => {
      const range = document.createRange();
      range.selectNodeContents(label);
      const text = range.getBoundingClientRect();
      const corner = mark.getBoundingClientRect();
      // A little air between the two counts as touching
      setCrowded(text.right + 2 > corner.left && text.top < corner.bottom);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
    // After every render: the label changes with the ledger, and the box may only now be shown
  });

  const show = (chips: number) =>
    inChips
      ? chips.toLocaleString("zh-CN")
      : formatGameMoney(chipsToCents(chips, game.chipRatio), game.currency);
  const markClass = "size-3 text-muted";
  return {
    show,
    labelRef,
    hint: t.game.gameTiles.tapToShow(inChips ? t.common.amount : t.common.chips),
    toggle: () => setInChips(!inChips),
    mark: (
      <span
        ref={markRef}
        aria-hidden
        className={cn("absolute top-1 right-1 flex", crowded && "invisible")}
      >
        {inChips ? (
          <ChipStack ground="var(--surface)" className={markClass} />
        ) : (
          <CurrencyIcon currency={game.currency} className={markClass} />
        )}
      </span>
    ),
  };
}

type TileGame = Pick<Game, "chipRatio" | "currency" | "handChips">;

/** Everything bought in: how many Buy-ins, then their cash value or, after a tap, their chips. */
export function BuyInTile({ game, boughtChips }: { game: TileGame; boughtChips: number }) {
  const { show, labelRef, hint, toggle, mark } = useCashOrChips(game);
  const { handChips } = game;
  return (
    <button type="button" onClick={toggle} className={cn(tileClass, "relative")}>
      {mark}
      <span ref={labelRef} className={labelClass}>
        {t.game.gameTiles.totalBuyIn(
          handChips === undefined ? "" : ` · ${boughtChips / handChips}`,
        )}
      </span>
      <span className="block">
        <Figure text={show(boughtChips)} />
      </span>
      <span className="sr-only">{hint}</span>
    </button>
  );
}

/**
 * Whether the chips on the table add up. Balanced, it says so on one line in green. Out, it says
 * so in red over how far and which way: more chips on the table than were bought, or fewer. A tap
 * switches that figure between cash and chips, apart from the Buy-in box.
 */
export function BalanceTile({ game, balanceChips }: { game: TileGame; balanceChips: number }) {
  const { show, labelRef, hint, toggle, mark } = useCashOrChips(game);
  if (balanceChips === 0) {
    return (
      <div className={cn(tileClass, "flex items-center justify-center gap-1 text-win")}>
        <span className="font-semibold whitespace-nowrap">{t.game.gameTiles.chipBalance}</span>
        <Check className="size-4 shrink-0" aria-hidden />
      </div>
    );
  }
  return (
    <button type="button" onClick={toggle} className={cn(tileClass, "relative text-loss")}>
      {mark}
      <span ref={labelRef} className="flex items-center justify-center text-xs whitespace-nowrap">
        {t.game.gameTiles.notBalanced}
        <X className="ml-0.5 size-3.5" aria-hidden />
      </span>
      <span className="block">
        <Figure
          text={show(Math.abs(balanceChips))}
          lead={balanceChips > 0 ? t.game.gameTiles.over : t.game.gameTiles.short}
        />
      </span>
      <span className="sr-only">{hint}</span>
    </button>
  );
}

/** What the organizer reaches for during play: the insurance calculator, and calling time. */
export function TableActionsTile({
  gameId,
  insuranceOn,
}: {
  gameId: string;
  insuranceOn: boolean;
}) {
  const actionClass =
    "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 whitespace-nowrap";
  return (
    <div className={cn(tileClass, "flex items-stretch p-0 text-[0.6875rem] font-medium")}>
      <Link
        to="/games/$gameId/insurance"
        params={{ gameId }}
        className={cn(actionClass, !insuranceOn && "text-muted")}
      >
        <Calculator className="size-4" aria-hidden />
        {t.game.gameTiles.insure}
      </Link>
      <span className="my-2 w-px bg-line" aria-hidden />
      <Link to="/games/$gameId/call-time" params={{ gameId }} className={actionClass}>
        <Timer className="size-4" aria-hidden />
        Call Time
      </Link>
    </div>
  );
}
