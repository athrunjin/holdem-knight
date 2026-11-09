import { groupByInitial, type Player, parsePlayerName, searchPlayers } from "@holdem-knight/core";
import { ArrowUpDown, Check, ChevronDown, ListFilter, Search, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { LetterIndex, letterSectionId, useActiveLetter } from "@/components/game/LetterIndex";
import { newPlayer, usePlayers, useRecentPlayerIds, useSavePlayer } from "@/data/players";
import { cn } from "@/lib/cn";
import { PLAYER_NAME_ISSUE_TEXT } from "@/lib/player-name";

/** Four tiles a row, at most three rows. */
const MAX_RECENT = 12;

interface PlayerPickerProps {
  saving: boolean;
  saveFailed: boolean;
  /** Picked players in the order they were picked */
  onStart: (playerIds: readonly string[], startClock: boolean) => void;
}

/**
 * The step after 开局设置: pick who sits down at the start. Recent players come first as tiles,
 * then everyone else under their initial letter. Starting with nobody is fine.
 */
export function PlayerPicker({ saving, saveFailed, onStart }: PlayerPickerProps) {
  const players = usePlayers();
  const recentIds = useRecentPlayerIds(MAX_RECENT);
  const savePlayer = useSavePlayer();
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [query, setQuery] = useState("");
  const [startClock, setStartClock] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const all = players.data ?? [];
  const byId = new Map(all.map((player) => [player.id, player]));
  const recentSet = new Set(recentIds.data);
  const recent = (recentIds.data ?? []).flatMap((id) => byId.get(id) ?? []);
  const others = all.filter(({ id }) => !recentSet.has(id));

  const recentMatches = searchPlayers(recent, query);
  const groups = groupByInitial(searchPlayers(others, query));
  const parsed = parsePlayerName(
    query,
    all.map(({ name }) => name),
  );
  const newName =
    parsed.ok && recentMatches.length === 0 && groups.length === 0 ? parsed.name : undefined;
  const tooLong = !parsed.ok && parsed.issue === "too-long";
  const letters = groups.map(({ letter }) => letter);
  const activeLetter = useActiveLetter(letters);
  const isSelected = (id: string) => selected.includes(id);

  // Group, filter and sort are placeholders for now
  useEffect(() => {
    if (notice === null) return;
    const timer = setTimeout(() => setNotice(null), 1500);
    return () => clearTimeout(timer);
  }, [notice]);

  function toggle(id: string) {
    setSelected(isSelected(id) ? selected.filter((other) => other !== id) : [...selected, id]);
  }

  function handleCreate() {
    if (newName === undefined) return;
    const player = newPlayer(newName);
    savePlayer.mutate(player, {
      onSuccess: () => {
        setSelected([...selected, player.id]);
        setQuery("");
      },
    });
  }

  if (players.isPending || recentIds.isPending) return null;

  return (
    <>
      {/* Tall enough that the bar below stays at the bottom of the screen with few players */}
      <div className="min-h-[calc(100dvh-12rem)] pb-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleCreate();
          }}
        >
          <div className="flex min-h-12 items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-highlight">
            <Search className="size-5 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
            <input
              type="search"
              aria-label="搜索或新建玩家"
              placeholder="搜索或新建：名字或拼音首字母"
              autoComplete="off"
              enterKeyHint="done"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-h-11 w-full min-w-0 bg-transparent outline-none placeholder:text-muted"
            />
          </div>
          {tooLong && (
            <p className="mt-1 text-sm text-highlight">{PLAYER_NAME_ISSUE_TEXT["too-long"]}</p>
          )}
          {newName !== undefined && (
            <button
              type="submit"
              disabled={savePlayer.isPending}
              className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-accent font-semibold text-accent disabled:opacity-60"
            >
              <UserPlus className="size-5" aria-hidden />
              新建「{newName}」并选中
            </button>
          )}
          {savePlayer.isError && (
            <p role="alert" className="mt-1 text-sm text-highlight">
              保存失败，请重试。
            </p>
          )}
        </form>

        {all.length === 0 && query === "" && (
          <p className="mt-4 rounded-2xl border border-dashed border-line px-6 py-8 text-center text-muted">
            玩家库是空的。输入名字新建玩家，或直接开局，之后再加人。
          </p>
        )}

        {recentMatches.length > 0 && (
          <>
            <h2 className="mt-5 mb-2 font-semibold">最近玩家</h2>
            <ul className="grid grid-cols-4 gap-2">
              {recentMatches.map(({ id, name }) => (
                <li key={id}>
                  <RecentTile name={name} active={isSelected(id)} onToggle={() => toggle(id)} />
                </li>
              ))}
            </ul>
          </>
        )}

        {others.length > 0 && (
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
        )}
        <div className="relative pr-6">
          {groups.map(({ letter, players: members }) => (
            <section key={letter} id={letterSectionId(letter)} className="scroll-mt-4">
              <h3 className="mt-3 mb-1 text-sm font-semibold text-highlight">{letter}</h3>
              <ul className="flex flex-col gap-1.5">
                {members.map((player) => (
                  <li key={player.id}>
                    <PlayerRow
                      player={player}
                      checked={isSelected(player.id)}
                      onToggle={() => toggle(player.id)}
                    />
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

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[5] -mx-4 border-t border-line bg-bg/95 px-4 py-1.5 backdrop-blur md:bottom-0">
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
        {saveFailed && (
          <p role="alert" className="mb-1 text-sm text-highlight">
            开局失败，请重试。
          </p>
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
              className="grid size-5.5 shrink-0 place-items-center rounded-md border-2 border-line peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-text peer-focus-visible:outline-2 peer-focus-visible:outline-highlight"
            >
              {startClock && <Check className="size-3.5" strokeWidth={3} />}
            </span>
            <span className="text-xs">开局后直接开始计时</span>
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => onStart(selected, startClock)}
            className="min-h-11 shrink-0 rounded-xl bg-accent px-8 font-semibold text-accent-text disabled:opacity-60"
          >
            {selected.length > 0 ? `开局 · ${selected.length} 人` : "开局"}
          </button>
        </div>
      </div>
    </>
  );
}

function RecentTile({
  name,
  active,
  onToggle,
}: {
  name: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
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
  );
}

function PlayerRow({
  player,
  checked,
  onToggle,
}: {
  player: Player;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-xl border pl-3",
        checked ? "border-accent bg-accent/10" : "border-line bg-surface",
      )}
    >
      <span className="min-w-0 flex-1 truncate font-medium">{player.name}</span>
      <span className="text-xs text-muted">{player.initials}</span>
      <label className="grid size-11 shrink-0 cursor-pointer place-items-center">
        <input
          type="checkbox"
          aria-label={`选择${player.name}`}
          checked={checked}
          onChange={onToggle}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={cn(
            "grid size-6.5 place-items-center rounded-md border-2 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-highlight",
            checked ? "border-accent bg-accent text-accent-text" : "border-line",
          )}
        >
          {checked && <Check className="size-4" strokeWidth={3} />}
        </span>
      </label>
    </div>
  );
}
