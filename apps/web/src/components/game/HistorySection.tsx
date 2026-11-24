import { type Currency, type Game, PERIOD_CHOICES } from "@holdem-knight/core";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Check, ChevronDown, Funnel } from "lucide-react";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { GameListRow } from "@/components/game/GameListRow";
import { OPTION_MARKS } from "@/components/game/GameOptions";
import { TextMenu } from "@/components/TextMenu";
import { useGameSummaries } from "@/data/summaries";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { dayOf } from "@/lib/game-day";
import {
  DEFAULT_HISTORY_STATE,
  GAME_OPTIONS,
  type HistoryState,
  type HistoryView,
  historyChoices,
  historyGames,
  isFiltered,
  parseHistoryState,
} from "@/lib/game-history";
import { periodName } from "@/lib/period-names";
import { useStoredState } from "@/lib/stored-state";

/** Stands for no ratio or no blinds chosen, in a menu */
const ANY = "any";

/** Each currency is shown by its mark alone, and named after the animal for a reader. */
const CURRENCY_NAMES: readonly { readonly value: Currency; readonly name: string }[] = [
  { value: "CNY", name: t.gamePages.list.panda },
  { value: "AUD", name: t.gamePages.list.kangaroo },
];

const CURRENCIES = [
  { value: "all" as const, label: t.gamePages.list.all },
  ...CURRENCY_NAMES.map(({ value, name }) => ({
    value,
    name,
    label: <CurrencyIcon currency={value} className="size-4.5" />,
  })),
];

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

interface HistoryFiltersProps {
  view: HistoryView;
  /** The ratios and blinds there are to narrow to */
  choices: ReturnType<typeof historyChoices>;
  onChange: (part: Partial<HistoryView>) => void;
}

/** The option's switch is 28px of text, and the tap target reaching past it is 44px. */
const optionSwitch = "relative px-2 font-medium after:absolute after:-inset-y-3";

/**
 * What narrows history: the currency, the chip ratio and the blinds as menus on one line, then the
 * options a listed game may have on, each in its own color until it is switched off, and last
 * a switch that lists only the games still owed transfers.
 */
function HistoryFilters({ view, choices, onChange }: HistoryFiltersProps) {
  const allOptions = view.options.length === GAME_OPTIONS.length;
  const ratio = choices.ratios.find(({ value }) => value === view.ratio);
  const blinds = choices.blinds.find(({ value }) => value === view.blinds);
  return (
    <div className="mb-2 rounded-xl border border-line px-2.5 text-sm">
      <div className="flex items-center justify-between gap-3">
        <TextMenu
          label={t.gamePages.list.currency}
          caption={t.gamePages.list.currency}
          options={CURRENCIES}
          value={view.currency}
          // Another currency has its own ratios and blinds
          onChange={(currency) => onChange({ currency, ratio: undefined, blinds: undefined })}
        />
        <TextMenu
          label={t.me.income.ratio}
          caption={t.me.income.ratio}
          options={[
            { value: ANY, label: t.me.income.any },
            ...choices.ratios.map(({ value, chips }) => ({ value, label: `${chips} : 1` })),
          ]}
          value={ratio?.value ?? ANY}
          onChange={(value) => onChange({ ratio: value === ANY ? undefined : value })}
          className="tabular-nums"
        />
        <TextMenu
          label={t.me.income.blinds}
          caption={t.me.income.blinds}
          options={[
            { value: ANY, label: t.me.income.any },
            ...choices.blinds.map(({ value, name }) => ({ value, label: name })),
          ]}
          value={blinds?.value ?? ANY}
          onChange={(value) => onChange({ blinds: value === ANY ? undefined : value })}
          align="right"
          className="tabular-nums"
        />
      </div>
      {/* Every option starts on. Switching one off leaves out the games that have it */}
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset does not lay its legend out in a line */}
      <div
        role="group"
        aria-label={t.gamePages.list.options}
        className="flex min-h-11 items-center"
      >
        <span className="w-14 shrink-0 text-muted">{t.gamePages.list.options}</span>
        {GAME_OPTIONS.map((option) => {
          const on = view.options.includes(option);
          const { label, className } = OPTION_MARKS[option];
          return (
            <button
              key={option}
              type="button"
              aria-pressed={on}
              onClick={() =>
                onChange({
                  // Kept in the fixed order, whatever order they were tapped in
                  options: GAME_OPTIONS.filter((each) =>
                    each === option ? !on : view.options.includes(each),
                  ),
                })
              }
              className={cn(optionSwitch, on ? className : "text-muted line-through")}
            >
              {label}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={allOptions}
          aria-label={
            allOptions ? t.gamePages.list.turnAllOptionsOff : t.gamePages.list.turnAllOptionsOn
          }
          onClick={() => onChange({ options: allOptions ? [] : GAME_OPTIONS })}
          className={cn(optionSwitch, "-mr-2 ml-auto", allOptions ? "text-text" : "text-muted")}
        >
          All
        </button>
      </div>
      {/* Off from the start. On lists only the games still owed transfers, in the order chosen */}
      <button
        type="button"
        aria-pressed={view.onlyUnsettled}
        onClick={() => onChange({ onlyUnsettled: !view.onlyUnsettled })}
        className={cn(
          "flex min-h-11 items-center gap-1 font-medium",
          view.onlyUnsettled ? "text-highlight" : "text-muted",
        )}
      >
        {t.gamePages.list.unsettled}
        {view.onlyUnsettled && <Check className="size-4" strokeWidth={2.5} aria-hidden />}
      </button>
    </div>
  );
}

/** Kept 36px wide so the three icons at the end of the heading sit close together. */
const iconButton = "grid h-11 w-9 shrink-0 place-items-center text-muted";

/**
 * Settled games, which come back the way they were left: unfolded at first. Folded, the heading
 * has only their number. Unfolded, it carries what narrows and orders the list: the period after
 * the title, with the number of games listed, then the filter and the order at the right, next to
 * the fold.
 */
export function HistorySection({
  games,
  title = t.gamePages.list.pastGames,
  storageKey = "games-list.history.2",
  initial = DEFAULT_HISTORY_STATE,
  playerId,
}: {
  games: readonly Game[];
  title?: string;
  /** Where the section keeps how it was left: one key for each page that has one */
  storageKey?: string;
  /** How it is before it has been left any way */
  initial?: HistoryState;
  /** Each game shows this player's result in place of the organizer's */
  playerId?: string;
}) {
  const [state, setState] = useStoredState(storageKey, initial, parseHistoryState);
  const { open, filtering, view } = state;
  // Whether a game is settled up is read from its summary
  const { data: summaries } = useGameSummaries();
  const setOpen = (next: boolean) => setState({ ...state, open: next });
  const change = (part: Partial<HistoryView>) => setState({ ...state, view: { ...view, ...part } });

  if (!open) {
    return (
      <section>
        <FoldHeading
          title={title}
          count={games.length}
          open={false}
          onToggle={() => setOpen(true)}
        />
      </section>
    );
  }

  const today = dayOf(Date.now());
  const shown = historyGames(games, view, today, summaries);
  // Each period is listed with the number of games it would show under the filters in force
  const periods = PERIOD_CHOICES.map((value) => ({
    value,
    label: `${periodName(value, today)} (${
      value === view.period
        ? shown.length
        : historyGames(games, { ...view, period: value }, today, summaries).length
    })`,
  }));
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
          {/* Filled while the filters are on show, and gold while any of them is set */}
          <button
            type="button"
            aria-label={t.gamePages.list.filter}
            aria-expanded={filtering}
            onClick={() => setState({ ...state, filtering: !filtering })}
            className={cn(
              iconButton,
              filtering && "text-text",
              isFiltered(view) && "text-highlight",
            )}
          >
            <Funnel className={cn("size-5", filtering && "fill-current")} aria-hidden />
          </button>
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
      {filtering && (
        <HistoryFilters
          view={view}
          choices={historyChoices(games, view, today)}
          onChange={change}
        />
      )}
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
