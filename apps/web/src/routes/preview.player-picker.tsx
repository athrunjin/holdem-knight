/**
 * TEMPORARY preview: picking the starting players after 开局设置 (layout B).
 * Uses sample players held in memory only. Delete before merging.
 */
import { type Player, parsePlayerName, searchPlayers } from "@holdem-knight/core";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Search, UserPlus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Page } from "@/components/Page";
import { cn } from "@/lib/cn";
import { toInitials } from "@/lib/pinyin";

export const Route = createFileRoute("/preview/player-picker")({
  component: PreviewPage,
});

const SAMPLE_NAMES = [
  "Ace",
  "Alex",
  "阿杰",
  "Ben",
  "包子",
  "陈哥",
  "Cindy",
  "大刘",
  "David",
  "二胖",
  "Frank",
  "高总",
  "胡子",
  "黄老板",
  "Jack",
  "金哥",
  "Kevin",
  "老王",
  "李四",
  "刘洋",
  "马哥",
  "Mike",
  "牛牛",
  "彭总",
  "钱多多",
  "Rick",
  "孙哥",
  "Tony",
  "王总",
  "小白",
  "小王2",
  "杨帆",
  "张三",
  "赵总",
];

/** Four tiles a row, at most three rows. */
const MAX_RECENT = 12;

/** Most recent first, as the real list would come from past games. */
const RECENT_NAMES = [
  "老王",
  "Ace",
  "张三",
  "胡子",
  "Kevin",
  "小白",
  "陈哥",
  "Tony",
  "马哥",
  "二胖",
  "Jack",
  "钱多多",
].slice(0, MAX_RECENT);

function makePlayer(name: string): Player {
  return {
    id: `p-${name}`,
    organizerId: "preview",
    name,
    initials: toInitials(name),
    createdAt: 0,
  };
}

function letterOf(player: Player): string {
  const first = player.initials[0]?.toUpperCase() ?? "";
  return /[A-Z]/.test(first) ? first : "#";
}

/** Only letters that have someone get a heading. */
function groupByLetter(players: readonly Player[]): [string, Player[]][] {
  const groups = new Map<string, Player[]>();
  const sorted = [...players].sort((a, b) => a.initials.localeCompare(b.initials));
  for (const player of sorted) {
    const letter = letterOf(player);
    groups.set(letter, [...(groups.get(letter) ?? []), player]);
  }
  return [...groups].sort(([a], [b]) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)));
}

function PreviewPage() {
  const [players, setPlayers] = useState(() => SAMPLE_NAMES.map(makePlayer));
  // In the order they were picked
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [query, setQuery] = useState("");
  const [startClock, setStartClock] = useState(false);

  const byName = new Map(players.map((player) => [player.name, player]));
  const byId = new Map(players.map((player) => [player.id, player]));
  const recentIds = new Set(RECENT_NAMES.map((name) => `p-${name}`));
  const recent = RECENT_NAMES.flatMap((name) => byName.get(name) ?? []);
  const others = players.filter(({ id }) => !recentIds.has(id));

  const recentMatches = searchPlayers(recent, query);
  const groups = groupByLetter(searchPlayers(others, query));
  const parsed = parsePlayerName(
    query,
    players.map(({ name }) => name),
  );
  const newName =
    parsed.ok && recentMatches.length === 0 && groups.length === 0 ? parsed.name : undefined;
  const isSelected = (id: string) => selected.includes(id);

  function toggle(id: string) {
    setSelected(isSelected(id) ? selected.filter((other) => other !== id) : [...selected, id]);
  }

  function create() {
    if (newName === undefined) return;
    const player = makePlayer(newName);
    setPlayers([...players, player]);
    setSelected([...selected, player.id]);
    setQuery("");
  }

  function jump(letter: string) {
    document.getElementById(`letter-${letter}`)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <Page title="选择玩家" centered>
      <div className="pb-4">
        <div className="flex min-h-12 items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-highlight">
          <Search className="size-5 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
          <input
            type="search"
            aria-label="搜索或新建玩家"
            placeholder="搜索或新建：名字或拼音首字母"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-h-11 w-full min-w-0 bg-transparent outline-none placeholder:text-muted"
          />
        </div>
        {newName !== undefined && (
          <button
            type="button"
            onClick={create}
            className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-accent font-semibold text-accent"
          >
            <UserPlus className="size-5" aria-hidden />
            新建「{newName}」并选中
          </button>
        )}

        {recentMatches.length > 0 && (
          <>
            <SectionTitle>最近玩家</SectionTitle>
            <ul className="grid grid-cols-4 gap-2">
              {recentMatches.map(({ id, name }) => {
                const active = isSelected(id);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggle(id)}
                      className={cn(
                        "relative flex min-h-18 w-full flex-col items-center justify-center gap-1 rounded-xl border px-1 transition-colors",
                        active ? "border-accent bg-accent/15" : "border-line bg-surface",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "grid size-9 place-items-center rounded-full font-semibold transition-colors",
                          active ? "bg-accent text-accent-text" : "bg-line/60",
                        )}
                      >
                        {[...name][0]?.toUpperCase()}
                      </span>
                      <span className="max-w-full truncate text-sm font-medium">{name}</span>
                      {active && (
                        <Check
                          className="absolute top-1 right-1 size-3.5 text-accent"
                          strokeWidth={3}
                          aria-hidden
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {groups.length > 0 && <SectionTitle>全部玩家</SectionTitle>}
        <div className="relative pr-6">
          {groups.map(([letter, members]) => (
            <section key={letter} id={`letter-${letter}`} className="scroll-mt-4">
              <h3 className="mt-3 mb-1 text-sm font-semibold text-highlight">{letter}</h3>
              <ul className="flex flex-col gap-1.5">
                {members.map(({ id, name, initials }) => (
                  <li
                    key={id}
                    className={cn(
                      "flex min-h-12 items-center gap-3 rounded-xl border pl-3",
                      isSelected(id) ? "border-accent bg-accent/10" : "border-line bg-surface",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                    <span className="text-xs text-muted">{initials}</span>
                    {/* biome-ignore lint/a11y/useSemanticElements: temporary preview */}
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isSelected(id)}
                      aria-label={`选择${name}`}
                      onClick={() => toggle(id)}
                      className="grid size-11 shrink-0 place-items-center"
                    >
                      <span
                        className={cn(
                          "grid size-6.5 place-items-center rounded-md border-2 transition-colors",
                          isSelected(id)
                            ? "border-accent bg-accent text-accent-text"
                            : "border-line",
                        )}
                      >
                        {isSelected(id) && <Check className="size-4" strokeWidth={3} aria-hidden />}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {groups.length > 1 && (
            <nav
              aria-label="按字母跳转"
              className="absolute top-0 right-0 flex h-full flex-col items-center"
            >
              <div className="sticky top-16 flex flex-col">
                {groups.map(([letter]) => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => jump(letter)}
                    className="h-5 w-5 text-[11px] font-semibold text-muted"
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </nav>
          )}
        </div>
      </div>

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[5] -mx-4 border-t border-line bg-bg/95 px-4 pt-2 pb-3 backdrop-blur md:bottom-0">
        {selected.length > 0 && (
          // Wraps onto up to three rows, then scrolls
          <ul className="mb-1 flex max-h-[5.25rem] flex-wrap gap-1.5 overflow-y-auto">
            {selected.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  aria-label={`取消选择${byId.get(id)?.name}`}
                  onClick={() => toggle(id)}
                  className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium"
                >
                  {byId.get(id)?.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={startClock}
            onChange={(event) => setStartClock(event.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="grid size-5.5 place-items-center rounded-md border-2 border-line peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-text peer-focus-visible:outline-2 peer-focus-visible:outline-highlight"
          >
            {startClock && <Check className="size-3.5" strokeWidth={3} />}
          </span>
          <span className="text-sm">开局后直接开始计时</span>
        </label>
        <button
          type="button"
          className="min-h-12 w-full rounded-xl bg-accent px-4 font-semibold text-accent-text"
        >
          开局
        </button>
      </div>
    </Page>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mt-5 mb-2 font-semibold">{children}</h2>;
}
