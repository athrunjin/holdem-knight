import { type Currency, type Game, gameStage } from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronDown, Funnel } from "lucide-react";
import { type ReactNode, useState } from "react";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { GameOptions } from "@/components/game/GameOptions";
import { InDevelopment } from "@/components/InDevelopment";
import { Page } from "@/components/Page";
import { TextMenu } from "@/components/TextMenu";
import { useGames } from "@/data/games";
import { cn } from "@/lib/cn";
import {
  DEFAULT_HISTORY_VIEW,
  GAME_OPTIONS,
  type GameOption,
  type HistoryPeriod,
  type HistoryStage,
  type HistoryView,
  historyGames,
  isFiltered,
} from "@/lib/game-history";

export const Route = createFileRoute("/")({
  component: SessionsPage,
});

const STARTED_AT = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type Role = "host" | "player";

const ROLES: readonly { readonly role: Role; readonly label: string }[] = [
  { role: "host", label: "Host" },
  { role: "player", label: "Player" },
];

const STAGES: readonly { readonly value: HistoryStage; readonly label: string }[] = [
  { value: "all", label: "全部" },
  { value: "pending", label: "积分待处理" },
  { value: "complete", label: "已完成" },
];

const PERIODS: readonly { readonly value: HistoryPeriod; readonly label: string }[] = [
  { value: "all", label: "全部" },
  { value: "week", label: "过去一周" },
  { value: "month", label: "过去一个月" },
];

/** Each currency is shown by its mark alone, and named after the animal for a reader. */
const CURRENCIES: readonly { readonly value: Currency; readonly name: string }[] = [
  { value: "CNY", name: "熊猫" },
  { value: "AUD", name: "袋鼠" },
];

const OPTION_LABELS: Record<GameOption, string> = {
  insurance: "保险",
  wage: "工资",
  tableFee: "台费",
  rake: "抽水",
};

const chevronClass = (open: boolean) =>
  cn("size-5 text-muted transition-transform", open && "rotate-180");

function GameRow({ game, note }: { game: Game; note?: string | undefined }) {
  return (
    <li>
      <Link
        // Only a game at the table opens on its table. The rest open on their results
        to={game.status === "open" ? "/games/$gameId" : "/games/$gameId/settlement"}
        params={{ gameId: game.id }}
        className="flex min-h-16 items-center justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-2"
      >
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <CurrencyIcon currency={game.currency} className="size-4.5 self-center text-muted" />
          <span className="font-medium">
            {game.smallBlindChips} / {game.bigBlindChips}
          </span>
          <GameOptions game={game} />
        </span>
        <span className="flex shrink-0 flex-col items-end text-sm text-muted">
          {STARTED_AT.format(game.createdAt)}
          {note && <span className="text-xs text-highlight">{note}</span>}
        </span>
      </Link>
    </li>
  );
}

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
          {title}（{count}）
        </span>
        <ChevronDown className={chevronClass(open)} aria-hidden />
      </button>
    </h2>
  );
}

/** Games still under way, open from the start. Left out of the page while it has none. */
function GameSection({ title, games }: { title: string; games: readonly Game[] }) {
  const [open, setOpen] = useState(true);
  if (games.length === 0) return null;

  return (
    <section>
      <FoldHeading title={title} count={games.length} open={open} onToggle={() => setOpen(!open)} />
      {open && (
        <ul className="mt-1 flex flex-col gap-2">
          {games.map((game) => (
            <GameRow key={game.id} game={game} />
          ))}
        </ul>
      )}
    </section>
  );
}

interface PillProps {
  on: boolean;
  onClick: () => void;
  /** For a pill that shows no text */
  label?: string;
  className?: string;
  children: ReactNode;
}

/** A small choice in a filter's row, gold while it is on. */
function Pill({ on, onClick, label, className, children }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
      className={cn(
        // The pill is 32px tall and the tap target reaching past it is 44px
        "relative flex h-8 shrink-0 items-center rounded-full border px-2 text-sm after:absolute after:-inset-x-0.5 after:-inset-y-2",
        on ? "border-highlight text-highlight" : "border-line text-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** One filter: its name, then its choices as pills. */
function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="flex min-h-11 items-center gap-1">
      <legend className="float-left w-15 shrink-0 text-sm text-muted">{label}</legend>
      {children}
    </fieldset>
  );
}

interface HistoryFiltersProps {
  view: HistoryView;
  onChange: (part: Partial<HistoryView>) => void;
}

function HistoryFilters({ view, onChange }: HistoryFiltersProps) {
  const allOptions = view.options.length === GAME_OPTIONS.length;
  return (
    <div className="mb-2 rounded-xl border border-line px-2.5 py-1">
      <FilterRow label="对局时间">
        {PERIODS.map(({ value, label }) => (
          <Pill key={value} on={view.period === value} onClick={() => onChange({ period: value })}>
            {label}
          </Pill>
        ))}
      </FilterRow>
      <FilterRow label="积分类型">
        <Pill on={view.currency === "all"} onClick={() => onChange({ currency: "all" })}>
          全部
        </Pill>
        {CURRENCIES.map(({ value, name }) => (
          <Pill
            key={value}
            on={view.currency === value}
            label={name}
            onClick={() => onChange({ currency: value })}
          >
            <CurrencyIcon currency={value} className="size-4.5" />
          </Pill>
        ))}
      </FilterRow>
      {/* Every option starts on. Switching one off leaves out the games that have it */}
      <FilterRow label="开启配置">
        {GAME_OPTIONS.map((option) => {
          const on = view.options.includes(option);
          return (
            <Pill
              key={option}
              on={on}
              onClick={() =>
                onChange({
                  // Kept in the fixed order, whatever order they were tapped in
                  options: GAME_OPTIONS.filter((each) =>
                    each === option ? !on : view.options.includes(each),
                  ),
                })
              }
            >
              {OPTION_LABELS[option]}
            </Pill>
          );
        })}
        <Pill
          on={allOptions}
          label={allOptions ? "关闭全部配置" : "开启全部配置"}
          onClick={() => onChange({ options: allOptions ? [] : GAME_OPTIONS })}
          className="ml-auto"
        >
          All
        </Pill>
      </FilterRow>
    </div>
  );
}

const iconButton = "grid size-11 shrink-0 place-items-center text-muted";

/**
 * Settled games, folded at the start under their number. Unfolded, the heading carries what
 * narrows and orders the list: the stage after the title, with the number of games listed, then
 * the filter and the order at the right, next to the fold.
 */
function HistorySection({ games }: { games: readonly Game[] }) {
  const [open, setOpen] = useState(false);
  const [filtering, setFiltering] = useState(true);
  const [view, setView] = useState(DEFAULT_HISTORY_VIEW);
  const change = (part: Partial<HistoryView>) => setView({ ...view, ...part });

  if (!open) {
    return (
      <section>
        <FoldHeading
          title="历史对局"
          count={games.length}
          open={false}
          onToggle={() => setOpen(true)}
        />
      </section>
    );
  }

  const shown = historyGames(games, view, Date.now());
  return (
    <section>
      <div className="flex min-h-11 items-center font-medium">
        <h2 className="shrink-0">
          <button
            type="button"
            aria-expanded
            onClick={() => setOpen(false)}
            className="min-h-11 pl-1"
          >
            历史对局
          </button>
        </h2>
        <span aria-hidden className="px-1.5 text-muted">
          ·
        </span>
        <TextMenu
          label="对局状态"
          options={STAGES}
          value={view.stage}
          onChange={(stage) => change({ stage })}
          className="font-medium"
        />
        <span className="shrink-0">（{shown.length}）</span>
        <div className="ml-auto flex shrink-0">
          {/* Filled while the filters are on show, and gold while any of them is set */}
          <button
            type="button"
            aria-label="筛选"
            aria-expanded={filtering}
            onClick={() => setFiltering(!filtering)}
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
            aria-label={view.newestFirst ? "按时间排序：最新在前" : "按时间排序：最早在前"}
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
            aria-label="收起历史对局"
            onClick={() => setOpen(false)}
            className={cn(iconButton, "-mr-2")}
          >
            <ChevronDown className={chevronClass(true)} aria-hidden />
          </button>
        </div>
      </div>
      {filtering && <HistoryFilters view={view} onChange={change} />}
      {shown.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-2">
          {shown.map((game) => (
            <GameRow
              key={game.id}
              game={game}
              // With every stage listed together, the games still owed transfers say so
              note={
                view.stage === "all" && gameStage(game) === "pending" ? "积分待处理" : undefined
              }
            />
          ))}
        </ul>
      ) : (
        <p className="px-1 py-2 text-sm text-muted">
          {games.length > 0 ? "没有符合条件的牌局" : "暂无牌局"}
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
          <p className="text-lg font-medium">还没有牌局</p>
          <p className="text-sm text-muted">
            点下方的「开局」，记录每位玩家的 Buy-in、补码和离桌，散局时自动算出谁该转给谁多少。
          </p>
        </div>
      )}
      <GameSection title="进行中" games={games.filter((game) => game.status === "open")} />
      <GameSection title="结算中" games={games.filter((game) => game.status === "settling")} />
      <HistorySection games={settled} />
    </div>
  );
}

function PlayerGames() {
  return (
    <section className="flex flex-col items-center gap-3 py-16 text-center">
      <InDevelopment milestone="M7" />
      <p className="max-w-sm text-muted">以玩家身份参加的牌局会显示在这里。</p>
    </section>
  );
}

function SessionsPage() {
  const [role, setRole] = useState<Role>("host");

  return (
    <Page title="牌局">
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
