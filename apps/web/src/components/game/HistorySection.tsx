import { type Game, PERIOD_CHOICES } from "@holdem-knight/core";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronDown } from "lucide-react";
import {
  blindsChip,
  CURRENCY_ORDER,
  FilterBar,
  type FilterChip,
  ratioChip,
} from "@/components/FilterBar";
import { GameListRow } from "@/components/game/GameListRow";
import { OPTION_MARKS } from "@/components/game/GameOptions";
import { TextMenu } from "@/components/TextMenu";
import { useGameSummaries } from "@/data/summaries";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { dayOf } from "@/lib/game-day";
import {
  clearedView,
  DEFAULT_HISTORY_STATE,
  GAME_OPTIONS,
  type HistoryState,
  type HistoryView,
  historyChoices,
  historyGames,
  parseHistoryState,
} from "@/lib/game-history";
import { blindsKey, type IncomeFilter, ratioKey } from "@/lib/income-filter";
import { periodName } from "@/lib/period-names";
import { useStoredState } from "@/lib/stored-state";

/** The options a listed game may have on, each in its own color while it is on. */
const OPTION_SWITCHES = GAME_OPTIONS.map((option) => ({
  value: option,
  label: OPTION_MARKS[option].label,
  className: OPTION_MARKS[option].className,
}));

export const chevronClass = (open: boolean) =>
  cn("size-5 text-muted transition-transform", open && "rotate-180");

interface FoldHeadingProps {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}

/** A section's heading, which folds and unfolds it: the title with its number of games. */
export function FoldHeading({ title, count, open, onToggle }: FoldHeadingProps) {
  return (
    <h2>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-11 w-full items-center justify-between px-1 font-medium"
      >
        <span>
          {title} ({count})
        </span>
        <ChevronDown className={chevronClass(open)} aria-hidden />
      </button>
    </h2>
  );
}

/** Kept 36px wide so the three icons at the end of the heading sit close together. */
const iconButton = "grid h-11 w-9 shrink-0 place-items-center text-muted";

/**
 * Settled games, which come back the way they were left: unfolded at first. Folded, the heading
 * has only their number. Unfolded, the heading carries the period after the title, with the
 * number of games listed, and the order and the fold at the right; under it the filter bar, then
 * the list.
 */
export function HistorySection({
  games,
  title = t.gamePages.list.pastGames,
  storageKey = "games-list.history.2",
  initial = DEFAULT_HISTORY_STATE,
  playerId,
  narrowedTo,
}: {
  games: readonly Game[];
  title?: string;
  /** Where the section keeps how it was left: one key for each page that has one */
  storageKey?: string;
  /** How it is before it has been left any way */
  initial?: HistoryState;
  /** Each game shows this player's result in place of the organizer's */
  playerId?: string;
  /**
   * The currency, ratio and blinds chosen above the section, as chosen, in place of its own: its
   * bar then has only the unsettled switch and the options.
   */
  narrowedTo?: IncomeFilter;
}) {
  const [state, setState] = useStoredState(storageKey, initial, parseHistoryState);
  // Whether a game is settled up is read from its summary
  const { data: summaries } = useGameSummaries();
  const { open } = state;
  // Narrowed from above, the section's own currency, ratio and blinds are not read
  const view: HistoryView = narrowedTo
    ? { ...state.view, currency: "all", ratio: undefined, blinds: undefined }
    : state.view;
  const listed = narrowedTo
    ? games.filter(
        (game) =>
          game.currency === narrowedTo.currency &&
          (!narrowedTo.ratio || ratioKey(game) === narrowedTo.ratio) &&
          (!narrowedTo.blinds || blindsKey(game) === narrowedTo.blinds),
      )
    : games;
  const setOpen = (next: boolean) => setState({ ...state, open: next });
  const change = (part: Partial<HistoryView>) =>
    setState({ ...state, view: { ...state.view, ...part } });

  if (!open) {
    return (
      <section>
        <FoldHeading
          title={title}
          count={listed.length}
          open={false}
          onToggle={() => setOpen(true)}
        />
      </section>
    );
  }

  const today = dayOf(Date.now());
  const shown = historyGames(listed, view, today, summaries);
  // Each period is listed with the number of games it would show under the filters in force
  const periods = PERIOD_CHOICES.map((value) => ({
    value,
    label: `${periodName(value, today)} (${
      value === view.period
        ? shown.length
        : historyGames(listed, { ...view, period: value }, today, summaries).length
    })`,
  }));
  const choices = historyChoices(listed, view, today);

  const unsettled: FilterChip = {
    kind: "toggle",
    label: t.gamePages.list.unsettled,
    on: view.onlyUnsettled,
    onChange: (onlyUnsettled) => change({ onlyUnsettled }),
  };
  const options: FilterChip = {
    // Every option starts on. Switching one off leaves out the games that have it
    kind: "multi",
    label: t.ui.filterBar.options,
    values: OPTION_SWITCHES,
    on: view.options,
    onChange: (on) => change({ options: GAME_OPTIONS.filter((option) => on.includes(option)) }),
  };
  const ratio = ratioChip(choices, view.ratio, view.currency, (ratio) => change({ ratio }));
  const blinds = blindsChip(choices, view.blinds, (blinds) => change({ blinds }));
  const cleared = clearedView(state.view);

  return (
    <section>
      {/* The title, the period and the number share one baseline, whatever font each falls to */}
      <div className="flex min-h-11 items-baseline font-medium">
        <h2 className="shrink-0">
          <button
            type="button"
            aria-expanded
            onClick={() => setOpen(false)}
            className="min-h-11 pl-1"
          >
            {title}
          </button>
        </h2>
        <span aria-hidden className="px-1.5 text-muted">
          ·
        </span>
        <TextMenu
          label={t.gamePages.list.played}
          options={periods}
          value={view.period}
          onChange={(period) => change({ period })}
        />
        <div className="ml-auto flex shrink-0 self-center">
          <button
            type="button"
            aria-label={
              view.newestFirst
                ? t.gamePages.list.sortedByTimeNewestFirst
                : t.gamePages.list.sortedByTimeOldestFirst
            }
            onClick={() => change({ newestFirst: !view.newestFirst })}
            className={cn(iconButton, !view.newestFirst && "text-highlight")}
          >
            {view.newestFirst ? (
              <ArrowDownWideNarrow className="size-5" aria-hidden />
            ) : (
              <ArrowUpNarrowWide className="size-5" aria-hidden />
            )}
          </button>
          {/* Pulled out so its chevron lines up with the ones on the sections above */}
          <button
            type="button"
            aria-label={t.gamePages.list.collapsePastGames}
            onClick={() => setOpen(false)}
            className={cn(iconButton, "-mr-1")}
          >
            <ChevronDown className={chevronClass(true)} aria-hidden />
          </button>
        </div>
      </div>
      <FilterBar
        {...(!narrowedTo && {
          currency: {
            value: view.currency,
            // On 牌局 the games of every currency can be listed together
            options: CURRENCY_ORDER,
            // Another currency has its own ratios and blinds
            onChange: (currency) => change({ currency, ratio: undefined, blinds: undefined }),
          },
        })}
        // Five chips and 清除 do not fit one line at a phone's width: the two used most come first,
        // the rest on a second row. Narrowed from above, the section's own two fit one line
        {...(narrowedTo
          ? { filters: [unsettled, options] }
          : { filters: [unsettled, blinds], secondRow: [ratio, options] })}
        // Narrowed from above, only the section's own two filters go back
        onClear={() =>
          change(
            narrowedTo
              ? { onlyUnsettled: cleared.onlyUnsettled, options: cleared.options }
              : cleared,
          )
        }
      />
      {shown.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-2">
          {shown.map((game) => (
            <GameListRow key={game.id} game={game} {...(playerId !== undefined && { playerId })} />
          ))}
        </ul>
      ) : (
        <p className="px-1 py-2 text-sm text-muted">
          {games.length > 0 ? t.gamePages.list.noGamesMatch : t.gamePages.list.noGamesYet}
        </p>
      )}
    </section>
  );
}
