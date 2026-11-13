import { chipsToCents, type Game } from "@holdem-knight/core";
import { Link } from "@tanstack/react-router";
import { ArrowLeftRight, Calculator, Check, Timer, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Modal } from "@/components/insurance/Modal";
import { cn } from "@/lib/cn";
import { formatGameAmount } from "@/lib/currency";

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
function formatStart(time: number) {
  const date = new Date(time);
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const weekday = date.toLocaleDateString("zh-CN", { weekday: "short" });
  return `${day} ${weekday} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Whose game it is and when it started, over the boxes on the game page and the settlement page.
 * The organizer's ID stands in until organizers have names (M6).
 */
export function GameHostLine({ game }: { game: Pick<Game, "organizerId" | "createdAt"> }) {
  return (
    <p className="mt-1 flex items-baseline gap-1.5 text-sm whitespace-nowrap text-muted tabular-nums">
      <span className="truncate text-lg leading-tight font-semibold text-white">
        {game.organizerId}
      </span>
      <span className="shrink-0">· {formatStart(game.createdAt)}</span>
    </p>
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
 * figure is short, and smaller in step with its length, measured against the box. `beside` is the
 * room a label on the same line takes. Six digits with cents fit a third of a 393 wide phone.
 */
function Figure({ text, beside = "0rem" }: { text: string; beside?: string }) {
  // A character of these figures is at most 0.58 of the type size wide
  const fit = `calc((100cqw - ${beside}) / ${(text.length * 0.58).toFixed(2)})`;
  return (
    <span
      style={{ fontSize: `min(1rem, ${fit})` }}
      className="font-semibold whitespace-nowrap tabular-nums"
    >
      {text}
    </span>
  );
}

/** A figure a tap on its box switches between cash, shown first, and chips. */
function useCashOrChips(game: Pick<Game, "chipRatio" | "currency">) {
  const [inChips, setInChips] = useState(false);
  const show = (chips: number) =>
    inChips
      ? chips.toLocaleString("zh-CN")
      : formatGameAmount(chipsToCents(chips, game.chipRatio), game.currency);
  return {
    show,
    hint: `，点按切换为${inChips ? "金额" : "筹码"}`,
    toggle: () => setInChips(!inChips),
  };
}

/** The mark of a box that switches what it shows, after its label. The whole box takes the tap. */
const switchMark = <ArrowLeftRight className="ml-1 size-2.5 shrink-0" aria-hidden />;

type TileGame = Pick<Game, "chipRatio" | "currency" | "handChips">;

/** Everything bought in: how many Buy-ins, then their cash value or, after a tap, their chips. */
export function BuyInTile({ game, boughtChips }: { game: TileGame; boughtChips: number }) {
  const { show, hint, toggle } = useCashOrChips(game);
  const { handChips } = game;
  return (
    <button type="button" onClick={toggle} className={tileClass}>
      <span className={labelClass}>
        总 Buy-in{handChips !== undefined && ` · ${boughtChips / handChips}`}
        {switchMark}
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
  const { show, hint, toggle } = useCashOrChips(game);
  if (balanceChips === 0) {
    return (
      <div className={cn(tileClass, "flex items-center justify-center gap-1 text-win")}>
        <span className="font-semibold whitespace-nowrap">筹码配平</span>
        <Check className="size-4 shrink-0" aria-hidden />
      </div>
    );
  }
  return (
    <button type="button" onClick={toggle} className={cn(tileClass, "text-loss")}>
      <span className="flex items-center justify-center text-xs whitespace-nowrap">
        未配平
        <X className="ml-0.5 size-3.5" aria-hidden />
      </span>
      <span className="flex items-baseline justify-center gap-1">
        <span className="text-[0.6875rem] whitespace-nowrap">{balanceChips > 0 ? "多" : "少"}</span>
        <Figure text={show(Math.abs(balanceChips))} beside="1rem" />
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
  const [callTimeOpen, setCallTimeOpen] = useState(false);
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
        算保险
      </Link>
      <span className="my-2 w-px bg-line" aria-hidden />
      <button type="button" onClick={() => setCallTimeOpen(true)} className={actionClass}>
        <Timer className="size-4" aria-hidden />
        Call time
      </button>
      {callTimeOpen && (
        <Modal title="Call time" onClose={() => setCallTimeOpen(false)}>
          <p className="text-sm text-muted">这个功能还在开发中。</p>
          <button
            type="button"
            onClick={() => setCallTimeOpen(false)}
            className="mt-3 min-h-11 w-full rounded-xl border border-line font-medium"
          >
            关闭
          </button>
        </Modal>
      )}
    </div>
  );
}
