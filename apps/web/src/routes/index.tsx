import type { Currency, Game } from "@holdem-knight/core";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronDown, Funnel } from "lucide-react";
import { useState } from "react";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { GameListRow } from "@/components/game/GameListRow";
import { OPTION_MARKS } from "@/components/game/GameOptions";
import { InDevelopment } from "@/components/InDevelopment";
import { Page } from "@/components/Page";
import { TextMenu } from "@/components/TextMenu";
import { useGames } from "@/data/games";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import {
  DEFAULT_HISTORY_STATE,
  GAME_OPTIONS,
  type HistoryPeriod,
  type HistoryStage,
  type HistoryView,
  historyGames,
  isFiltered,
  parseHistoryState,
} from "@/lib/game-history";
import { parseBoolean, useStoredState } from "@/lib/stored-state";

export const Route = createFileRoute("/")({
  component: SessionsPage,
});

type Role = "host" | "player";

const ROLES: readonly { readonly role: Role; readonly label: string }[] = [
  { role: "host", label: "Host" },
  { role: "player", label: "Player" },
];

const STAGES: readonly { readonly value: HistoryStage; readonly label: string }[] = [
  { value: "all", label: t.gamePages.list.all },
  { value: "pending", label: t.gamePages.list.unsettled },
  { value: "complete", label: t.gamePages.list.settled },
];

const PERIODS: readonly { readonly value: HistoryPeriod; readonly label: string }[] = [
  { value: "all", label: t.gamePages.list.all },
  { value: "week", label: t.gamePages.list.pastWeek },
  { value: "month", label: t.gamePages.list.pastMonth },
];

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

const chevronClass = (open: boolean) =>
  cn("size-5 text-muted transition-transform", open && "rotate-180");

interface FoldHeadingProps {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}

/** A section's heading, which folds and unfolds it: the title with its number of games. */
function FoldHeading({ title, count, open, onToggle }: FoldHeadingProps) {
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

interface GameSectionProps {
  title: string;
  games: readonly Game[];
  /** Where the fold is kept between visits */
  storageKey: string;
}

/** Games still under way, unfolded until it is left folded. Left out of the page while it has none. */
function GameSection({ title, games, storageKey }: GameSectionProps) {
  const [open, setOpen] = useStoredState(storageKey, true, parseBoolean);
  if (games.length === 0) return null;

  return (
    <section>
      <FoldHeading title={title} count={games.length} open={open} onToggle={() => setOpen(!open)} />
      {open && (
        <ul className="mt-1 flex flex-col gap-2">
          {games.map((game) => (
            <GameListRow key={game.id} game={game} />
          ))}
        </ul>
      )}
    </section>
  );
}

interface HistoryFiltersProps {
  view: HistoryView;
  onChange: (part: Partial<HistoryView>) => void;
}

/** The option's switch is 28px of text, and the tap target reaching past it is 44px. */
const optionSwitch = "relative px-2 font-medium after:absolute after:-inset-y-3";

/**
 * What narrows history: the time and the currency as menus on one line, then the options a listed
 * game may have on, each in its own color until it is switched off.
 */
function HistoryFilters({ view, onChange }: HistoryFiltersProps) {
  const allOptions = view.options.length === GAME_OPTIONS.length;
  return (
    <div className="mb-2 rounded-xl border border-line px-2.5 text-sm">
      <div className="flex items-center gap-4">
        <TextMenu
          label={t.gamePages.list.played}
          caption={t.gamePages.list.played}
          options={PERIODS}
          value={view.period}
          onChange={(period) => onChange({ period })}
        />
        <TextMenu
          label={t.gamePages.list.currency}
          caption={t.gamePages.list.currency}
          options={CURRENCIES}
          value={view.currency}
          onChange={(currency) => onChange({ currency })}
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
    </div>
  );
}

/** Kept 36px wide so the three icons at the end of the heading sit close together. */
const iconButton = "grid h-11 w-9 shrink-0 place-items-center text-muted";

/**
 * Settled games, which come back the way they were left: unfolded at first. Folded, the heading
 * has only their number. Unfolded, it carries what narrows and orders the list: the stage after
 * the title, with the number of games listed, then the filter and the order at the right, next to
 * the fold.
 */
function HistorySection({ games }: { games: readonly Game[] }) {
  const [state, setState] = useStoredState(
    "games-list.history",
    DEFAULT_HISTORY_STATE,
    parseHistoryState,
  );
  const { open, filtering, view } = state;
  const setOpen = (next: boolean) => setState({ ...state, open: next });
  const change = (part: Partial<HistoryView>) => setState({ ...state, view: { ...view, ...part } });

  if (!open) {
    return (
      <section>
        <FoldHeading
          title={t.gamePages.list.pastGames}
          count={games.length}
          open={false}
          onToggle={() => setOpen(true)}
        />
      </section>
    );
  }

  const now = Date.now();
  const shown = historyGames(games, view, now);
  // Each stage is listed with the number of games it would show under the filters in force
  const stages = STAGES.map(({ value, label }) => ({
    value,
    label: `${label} (${
      value === view.stage
        ? shown.length
        : historyGames(games, { ...view, stage: value }, now).length
    })`,
  }));
  return (
    <section>
      {/* The title, the stage and the number share one baseline, whatever font each falls to */}
      <div className="flex min-h-11 items-baseline font-medium">
        <h2 className="shrink-0">
          <button
            type="button"
            aria-expanded
            onClick={() => setOpen(false)}
            className="min-h-11 pl-1"
          >
            {t.gamePages.list.pastGames}
          </button>
        </h2>
        <span aria-hidden className="px-1.5 text-muted">
          ·
        </span>
        <TextMenu
          label={t.gamePages.list.status}
          options={stages}
          value={view.stage}
          onChange={(stage) => change({ stage })}
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
      {filtering && <HistoryFilters view={view} onChange={change} />}
      {shown.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-2">
          {shown.map((game) => (
            <GameListRow key={game.id} game={game} />
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

function HostGames() {
  const { data: games, isPending } = useGames();
  if (isPending || !games) return null;
  const settled = games.filter((game) => game.status === "settled");

  return (
    <div className="flex flex-col gap-2 pt-4 pb-6">
      {games.length === 0 && (
        <div className="space-y-2 px-1 py-6 text-center">
          <p className="text-lg font-medium">{t.gamePages.list.noGamesYet2}</p>
          <p className="text-sm text-muted">{t.gamePages.list.tapNewGameBelowToRecord}</p>
        </div>
      )}
      <GameSection
        title={t.gamePages.list.inProgress}
        games={games.filter((game) => game.status === "open")}
        storageKey="games-list.open"
      />
      <GameSection
        title={t.gamePages.list.settling}
        games={games.filter((game) => game.status === "settling")}
        storageKey="games-list.settling"
      />
      <HistorySection games={settled} />
    </div>
  );
}

function PlayerGames() {
  return (
    <section className="flex flex-col items-center gap-3 py-16 text-center">
      <InDevelopment milestone="M7" />
      <p className="max-w-sm text-muted">{t.gamePages.list.gamesYouPlayInAsA}</p>
    </section>
  );
}

function SessionsPage() {
  const [role, setRole] = useState<Role>("host");

  return (
    <Page title={t.gamePages.list.game}>
      <div className="grid grid-cols-2 gap-2">
        {ROLES.map((item) => (
          <button
            key={item.role}
            type="button"
            aria-pressed={role === item.role}
            onClick={() => setRole(item.role)}
            className={cn(
              "min-h-11 rounded-xl border px-3 font-medium",
              role === item.role
                ? "border-accent bg-accent text-accent-text"
                : "border-line bg-surface",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {role === "host" ? <HostGames /> : <PlayerGames />}
    </Page>
  );
}
