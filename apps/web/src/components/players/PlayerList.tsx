import {
  groupByInitial,
  type InitialGroup,
  type Player,
  parsePlayerName,
  searchPlayers,
} from "@holdem-knight/core";
import { ArrowUpDown, ChevronDown, ListFilter, Search, UserPlus } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { LetterIndex, letterSectionId, useActiveLetter } from "@/components/game/LetterIndex";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { namesakesOf, PLAYER_NAME_ISSUE_TEXT } from "@/lib/player-name";

interface PlayerMatches {
  /** The players the query finds, under their initial letter */
  groups: InitialGroup<Player>[];
  /** Set when the query finds nobody and can be saved as a new player */
  newName: string | undefined;
  /** The players whose name is the query's, spaces and case aside */
  namesakes: Player[];
  tooLong: boolean;
}

/** What a search of the player library shows: the matches by letter, or a name to add. */
export function matchPlayers(players: readonly Player[], query: string): PlayerMatches {
  const groups = groupByInitial(searchPlayers(players, query));
  const parsed = parsePlayerName(query);
  return {
    groups,
    newName: parsed.ok && groups.length === 0 ? parsed.name : undefined,
    namesakes: namesakesOf(players, query),
    tooLong: !parsed.ok && parsed.issue === "too-long",
  };
}

interface PlayerSearchProps {
  /** Accessible name of the field */
  label: string;
  placeholder: string;
  query: string;
  onQueryChange: (query: string) => void;
  newName: string | undefined;
  tooLong: boolean;
  /** A quiet line under the field, such as that another player has this name */
  hint?: string | undefined;
  /** Text of the button that adds the query as a player */
  createLabel: (name: string) => string;
  saving: boolean;
  saveFailed: boolean;
  onCreate: () => void;
}

/** The search field over a player list. A query that finds nobody can be added as a new player. */
export function PlayerSearch({
  label,
  placeholder,
  query,
  onQueryChange,
  newName,
  tooLong,
  hint,
  createLabel,
  saving,
  saveFailed,
  onCreate,
}: PlayerSearchProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (newName !== undefined) onCreate();
      }}
    >
      <div className="flex min-h-12 items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-highlight">
        <Search className="size-5 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
        <input
          type="search"
          aria-label={label}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="done"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="min-h-11 w-full min-w-0 bg-transparent outline-none placeholder:text-muted"
        />
      </div>
      {tooLong && (
        <p className="mt-1 text-sm text-highlight">{PLAYER_NAME_ISSUE_TEXT["too-long"]}</p>
      )}
      {hint !== undefined && <p className="mt-1 text-sm text-muted tabular-nums">{hint}</p>}
      {newName !== undefined && (
        <button
          type="submit"
          disabled={saving}
          className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-accent font-semibold text-accent disabled:opacity-60"
        >
          <UserPlus className="size-5" aria-hidden />
          {createLabel(newName)}
        </button>
      )}
      {saveFailed && (
        <p role="alert" className="mt-1 text-sm text-highlight">
          {t.common.couldntSaveTryAgain}
        </p>
      )}
    </form>
  );
}

/** The 全部玩家 heading. Group, filter and order are placeholders for now. */
export function PlayerListHeading({ className }: { className?: string }) {
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (notice === null) return;
    const timer = setTimeout(() => setNotice(null), 1500);
    return () => clearTimeout(timer);
  }, [notice]);

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <h2 className="font-semibold">{t.players.playerList.allPlayers}</h2>
      <div className="-mr-2 flex items-center">
        <button
          type="button"
          onClick={() => setNotice(t.players.playerList.groups)}
          className="flex min-h-11 items-center px-1"
        >
          <span className="flex items-center gap-0.5 rounded-full border border-line px-2.5 py-1 text-xs font-medium">
            {t.players.playerList.all}
            <ChevronDown className="size-3.5 text-muted" aria-hidden />
          </span>
        </button>
        <button
          type="button"
          aria-label={t.players.playerList.filter}
          onClick={() => setNotice(t.players.playerList.filter)}
          className="grid size-11 place-items-center text-muted"
        >
          <ListFilter className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={t.players.playerList.sort}
          onClick={() => setNotice(t.players.playerList.sort)}
          className="grid size-11 place-items-center text-muted"
        >
          <ArrowUpDown className="size-5" aria-hidden />
        </button>
      </div>
      {notice && (
        <p
          role="status"
          className="fixed inset-x-0 top-1/2 z-20 mx-auto w-fit rounded-full bg-text px-4 py-2 text-sm text-bg shadow-lg"
        >
          {t.players.playerList.inProgress(notice)}
        </p>
      )}
    </div>
  );
}

interface PlayerGroupsProps {
  groups: readonly InitialGroup<Player>[];
  /** One player's row */
  children: (player: Player) => ReactNode;
}

/** Players under their initial letter, with the letters down the right edge to jump by. */
export function PlayerGroups({ groups, children }: PlayerGroupsProps) {
  const letters = groups.map(({ letter }) => letter);
  const activeLetter = useActiveLetter(letters);

  return (
    <div className="relative pr-6">
      {groups.map(({ letter, players }) => (
        <section key={letter} id={letterSectionId(letter)} className="scroll-mt-4">
          <h3 className="mt-3 mb-1 text-sm font-semibold text-highlight">{letter}</h3>
          <ul className="flex flex-col gap-1.5">
            {players.map((player) => (
              <li key={player.id}>{children(player)}</li>
            ))}
          </ul>
        </section>
      ))}
      {letters.length > 1 && <LetterIndex letters={letters} active={activeLetter} />}
    </div>
  );
}
