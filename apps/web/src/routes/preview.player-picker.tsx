/**
 * TEMPORARY preview: picking the starting players after 开局设置 (layout B).
 * Uses sample players held in memory only. Delete before merging.
 */
import { type Player, parsePlayerName, searchPlayers } from "@holdem-knight/core";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpDown, Check, ChevronDown, ListFilter, Search, UserPlus } from "lucide-react";
import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
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
  const [notice, setNotice] = useState<string | null>(null);

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

  const letters = groups.map(([letter]) => letter);
  const activeLetter = useActiveLetter(letters);

  // Placeholder for features still to come
  useEffect(() => {
    if (notice === null) return;
    const timer = setTimeout(() => setNotice(null), 1500);
    return () => clearTimeout(timer);
  }, [notice]);

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

        <div className="mt-3 flex items-center justify-between">
          <h2 className="font-semibold">全部玩家</h2>
          <div className="-mr-2 flex items-center">
            <button
              type="button"
              onClick={() => setNotice("分组")}
              className="flex min-h-11 items-center px-1"
            >
              <span className="flex items-center gap-0.5 rounded-full border border-line px-2.5 py-1 text-xs font-medium">
                全部
                <ChevronDown className="size-3.5 text-muted" aria-hidden />
              </span>
            </button>
            <button
              type="button"
              aria-label="筛选"
              onClick={() => setNotice("筛选")}
              className="grid size-11 place-items-center text-muted"
            >
              <ListFilter className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="排列方式"
              onClick={() => setNotice("排列方式")}
              className="grid size-11 place-items-center text-muted"
            >
              <ArrowUpDown className="size-5" aria-hidden />
            </button>
          </div>
        </div>
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
          {letters.length > 1 && <LetterIndex letters={letters} active={activeLetter} />}
        </div>
      </div>

      {notice && (
        <p
          role="status"
          className="fixed inset-x-0 top-1/2 z-20 mx-auto w-fit rounded-full bg-text px-4 py-2 text-sm text-bg shadow-lg"
        >
          {notice} · 开发中
        </p>
      )}

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[5] -mx-4 border-t border-line bg-bg/95 px-4 pt-1.5 pb-1.5 backdrop-blur md:bottom-0">
        {selected.length > 0 && (
          // Wraps onto up to three rows, then scrolls
          <ul className="mb-1 flex max-h-[4.25rem] flex-wrap gap-1 overflow-y-auto">
            {selected.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  aria-label={`取消选择${byId.get(id)?.name}`}
                  onClick={() => toggle(id)}
                  className="h-5 rounded-full bg-accent/15 px-2 text-xs leading-5 font-medium"
                >
                  {byId.get(id)?.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-3">
          <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-2">
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
            <span className="text-xs">开局后直接开始计时</span>
          </label>
          <button
            type="button"
            className="min-h-11 rounded-xl bg-accent px-8 font-semibold text-accent-text"
          >
            开局
          </button>
        </div>
      </div>
    </Page>
  );
}

/** Space between the top of the window and a section counted as current. */
const ACTIVE_OFFSET = 96;

/** The letter whose section sits at the top of the window. */
function useActiveLetter(letters: readonly string[]): string | undefined {
  const [active, setActive] = useState<string | undefined>(letters[0]);
  const key = letters.join("");

  useEffect(() => {
    const list = key.split("");
    function update() {
      let current = list[0];
      for (const letter of list) {
        const top = document.getElementById(`letter-${letter}`)?.getBoundingClientRect().top;
        if (top !== undefined && top <= ACTIVE_OFFSET) current = letter;
      }
      setActive(current);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [key]);

  return active;
}

/** How long a press lasts before the index grows. */
const HOLD_MS = 200;

/**
 * Letters down the right edge. A tap jumps to that letter. Holding enlarges the index,
 * and sliding up or down jumps as the finger passes each letter.
 */
function LetterIndex({
  letters,
  active,
}: {
  letters: readonly string[];
  active: string | undefined;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [pressing, setPressing] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const [picked, setPicked] = useState<string | undefined>(undefined);

  function letterAt(clientY: number): string | undefined {
    const rect = listRef.current?.getBoundingClientRect();
    if (!rect) return undefined;
    const index = Math.floor(((clientY - rect.top) / rect.height) * letters.length);
    return letters[Math.min(letters.length - 1, Math.max(0, index))];
  }

  function jumpTo(clientY: number) {
    const letter = letterAt(clientY);
    if (letter === undefined || letter === picked) return;
    setPicked(letter);
    document.getElementById(`letter-${letter}`)?.scrollIntoView({ block: "start" });
    navigator.vibrate?.(5);
  }

  function handleDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setPressing(true);
    jumpTo(event.clientY);
    holdTimer.current = setTimeout(() => setEnlarged(true), HOLD_MS);
  }

  function handleMove(event: PointerEvent<HTMLDivElement>) {
    if (pressing) jumpTo(event.clientY);
  }

  function handleUp() {
    clearTimeout(holdTimer.current);
    setPressing(false);
    setEnlarged(false);
    setPicked(undefined);
  }

  const shown = pressing ? (picked ?? active) : active;

  return (
    <nav aria-label="按字母跳转" className="absolute top-0 right-0 h-full">
      <div className="sticky top-16 flex items-start">
        {enlarged && shown && (
          <span
            aria-hidden
            className="absolute top-1/2 right-full mr-3 grid size-14 -translate-y-1/2 place-items-center rounded-full bg-accent text-2xl font-bold text-accent-text shadow-lg"
          >
            {shown}
          </span>
        )}
        <div
          ref={listRef}
          role="presentation"
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          className={cn(
            "flex touch-none flex-col items-center rounded-full py-1 transition-all select-none",
            enlarged ? "-mr-1 bg-surface px-1 shadow-lg ring-1 ring-line" : "",
          )}
        >
          {letters.map((letter) => (
            <span
              key={letter}
              className={cn(
                "grid place-items-center rounded-full font-semibold transition-all",
                enlarged ? "size-6.5 text-sm" : "size-5 text-[11px]",
                letter === shown ? "bg-highlight text-bg" : "text-muted",
              )}
            >
              {letter}
            </span>
          ))}
        </div>
      </div>
    </nav>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mt-5 mb-2 font-semibold">{children}</h2>;
}
