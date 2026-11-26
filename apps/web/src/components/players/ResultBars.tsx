import { type Cents, cents, type PlayerGame, type PlayerReport } from "@holdem-knight/core";
import { ResultHead } from "@/components/players/ResultHead";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { useCountUp, useEntered, usePlaysIn } from "@/lib/motion";

type Money = (value: Cents, signed?: boolean) => string;

/** As many of the games shown as the row of bars has room for, the latest of them. */
export const BARS = 20;

const toneOf = (value: number) => (value > 0 ? "text-win" : value < 0 ? "text-loss" : "");

/**
 * What the player won or lost over the games shown, as the page's one large figure, with its sign
 * and color. Under it how many games and how they went, a bar for each of them, and the charges
 * they paid, which are no part of the figure.
 */
export function Result({
  report,
  hideGames,
  money,
  playKey,
}: {
  report: PlayerReport;
  /** The title says how many games, as for the latest ten */
  hideGames: boolean;
  money: Money;
  playKey: string;
}) {
  const { games, result, won, average, wage, tableFee, share } = report;
  const playsIn = usePlaysIn(playKey);
  const shown = useCountUp(result, { duration: 800, resetKey: playKey });
  // Whole amounts on the way, and the cents only of the amount arrived at
  const figure = shown === result ? result : cents(Math.round(shown / 100) * 100);
  return (
    <>
      <ResultHead
        result={result}
        shown={figure}
        games={games.length}
        hideGames={hideGames}
        won={won}
        average={average}
        wage={wage}
        tableFee={tableFee}
        money={money}
      />
      {/* Made again for other games, so every bar grows from the line each time */}
      {games.length > 0 && <Bars key={playKey} games={games} money={money} playKey={playKey} />}
      {games.length > BARS && (
        <p className="text-right text-[11px] text-muted">{t.players.playerPage.barsShow(BARS)}</p>
      )}
      {/* Only where a difference was split with them, as 收益 has the organizer's: opening from its
          rule once the rest is in, and no part of the figure */}
      {share !== 0 && (
        <div
          key={playKey}
          className={cn("-mb-2 overflow-hidden", playsIn && "animate-unfold")}
          style={{ animationDelay: "1000ms" }}
        >
          <div className="mt-2 flex min-h-11 items-center justify-between gap-3 border-t border-line text-sm">
            <p>
              {t.players.playerPage.share}
              <span className="ml-2 text-xs text-muted">{t.players.playerPage.shareNote}</span>
            </p>
            <p className={cn("shrink-0 tabular-nums", toneOf(share))}>{money(share, true)}</p>
          </div>
        </div>
      )}
    </>
  );
}

/** The room over and under the bars for what is written at the best and the worst game, in rem */
export const NOTE = 1.5;
/** How tall the bars are together, over and under the line, in rem */
export const TALL = 4;

/**
 * A bar for each game shown, oldest at the left, on one line that runs the whole width: up from
 * it in green for a game won, down in red for one lost, each as tall as it is against the largest
 * among them. The line is drawn from the left first, the bars grow from it, and then a hairline
 * steps out of the best game and of the worst with its day and amount. A game that came to nothing
 * has no bar and no note, so a single game is noted once.
 */
export function Bars({
  games,
  money,
  playKey,
}: {
  games: readonly PlayerGame[];
  money: Money;
  playKey: string;
}) {
  const grown = useEntered(playKey);
  const latest = games.slice(0, BARS).toReversed();
  const high = Math.max(0, ...latest.map(({ result }) => result));
  const low = Math.max(0, ...latest.map(({ result }) => -result));
  // The room under the line, as a part of what the bars have
  const under = high + low > 0 ? (low / (high + low)) * TALL : 0;
  const part = (amount: number, of: number) => `${grown && of > 0 ? (amount / of) * 100 : 0}%`;
  const best = high > 0 ? latest.findIndex(({ result }) => result === high) : -1;
  const worst = low > 0 ? latest.findIndex(({ result }) => result === -low) : -1;

  return (
    <div
      role="img"
      aria-label={t.players.playerPage.eachGame}
      className="relative mt-3"
      style={{ height: `${TALL + NOTE * 2}rem` }}
    >
      {best >= 0 && (
        <BarNote
          game={latest[best]}
          at={best}
          of={latest.length}
          side="over"
          shown={grown}
          money={money}
        />
      )}
      <ul
        className="absolute inset-x-0 flex items-stretch gap-1"
        style={{ top: `${NOTE}rem`, height: `${TALL}rem` }}
      >
        {latest.map(({ summary, result }) => (
          <li key={summary.id} className="flex min-w-0 flex-1 flex-col items-center">
            <span
              className="flex w-full max-w-4 flex-col justify-end"
              style={{ height: `${TALL - under}rem` }}
            >
              <span
                className={cn("w-full rounded-t bg-win", barClass)}
                style={{ height: part(Math.max(0, result), high) }}
              />
            </span>
            <span className="flex w-full max-w-4 flex-col" style={{ height: `${under}rem` }}>
              <span
                className={cn("w-full rounded-b bg-loss", barClass)}
                style={{ height: part(Math.max(0, -result), low) }}
              />
            </span>
          </li>
        ))}
      </ul>
      {/* One line under every bar, drawn from the left before the bars grow from it */}
      <span
        className={cn(
          "absolute inset-x-0 h-px origin-left bg-line transition-transform duration-500 ease-out motion-reduce:transition-none",
          grown ? "scale-x-100" : "scale-x-0",
        )}
        style={{ top: `${NOTE + TALL - under}rem` }}
        aria-hidden
      />
      {worst >= 0 && (
        <BarNote
          game={latest[worst]}
          at={worst}
          of={latest.length}
          side="under"
          shown={grown}
          money={money}
        />
      )}
    </div>
  );
}

/** The bars wait for the line to be drawn. */
export const barClass =
  "transition-[height] delay-300 duration-500 ease-out motion-reduce:transition-none";

/**
 * What is written at the best or the worst game: a hairline out of the end of its bar, then the
 * day and the amount, sliding outward once the bars have grown. It stands over its bar, and is
 * held inside the card where the bar is near an edge.
 */
export function BarNote({
  game,
  at,
  of,
  side,
  shown,
  money,
}: {
  game: PlayerGame | undefined;
  at: number;
  of: number;
  side: "over" | "under";
  shown: boolean;
  money: Money;
}) {
  if (!game) return null;
  const [, month = 1, date = 1] = game.summary.day.split("-").map(Number);
  const center = ((at + 0.5) / of) * 100;
  const over = side === "over";
  // Near an edge the words start or end at the bar. Elsewhere they are centered on it
  const hold = center < 25 ? "start" : center > 75 ? "end" : "center";

  return (
    <span
      className={cn(
        "absolute flex items-center transition-[opacity,translate] delay-700 duration-300 ease-out motion-reduce:transition-none",
        over ? "top-0 flex-col" : "bottom-0 flex-col-reverse",
        hold === "start" ? "items-start" : hold === "end" ? "items-end" : "-translate-x-1/2",
        shown ? "opacity-100" : cn("opacity-0", over ? "translate-y-1.5" : "-translate-y-1.5"),
      )}
      style={{
        height: `${NOTE}rem`,
        ...(hold === "end" ? { right: `${100 - center}%` } : { left: `${center}%` }),
      }}
      aria-hidden
    >
      <span className="text-[11px] leading-none whitespace-nowrap tabular-nums">
        <span className="text-muted">
          {month}/{date}
        </span>
        <span className={cn("ml-1", toneOf(game.result))}>{money(game.result, true)}</span>
      </span>
      {/* The hairline between the words and the end of the bar */}
      <span className="w-px flex-1 bg-muted/60" />
    </span>
  );
}
