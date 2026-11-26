import {
  orderNamesakesByRecent,
  type Player,
  parsePlayerName,
  playerNumberText,
  searchPlayers,
} from "@holdem-knight/core";
import { Plus, UserPlus } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/insurance/Modal";
import { OwnTag } from "@/components/players/OwnTag";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { TextField } from "@/components/TextField";
import {
  isOwnRecord,
  newPlayer,
  usePlayers,
  useRecentPlayers,
  useSavePlayer,
} from "@/data/players";
import { t } from "@/i18n";
import { namesakesOf } from "@/lib/player-name";

const MAX_SUGGESTIONS = 8;

/** Everyone in the recent games, so that namesakes can all be put in order of recency */
const ALL_RECENT = Number.MAX_SAFE_INTEGER;

const rowClass = "flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-left";

interface AddPlayerToGameProps {
  /** Players already in this game, left out of the suggestions */
  excludedIds: ReadonlySet<string>;
  /**
   * `invite` is a quiet row in place of the first player, `plus` a small plus under the players
   * already seated.
   */
  variant: "invite" | "plus";
  onPick: (player: Player) => void;
}

/** Opens the search: pick a player to buy in, or create one if it finds nothing. */
export function AddPlayerToGame({ excludedIds, variant, onPick }: AddPlayerToGameProps) {
  const { data: players = [] } = usePlayers();
  const { data: recent = [] } = useRecentPlayers(ALL_RECENT);
  const savePlayer = useSavePlayer();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const available = players.filter(({ id }) => !excludedIds.has(id));
  // Namesakes come in order of who played last, so the one at the table now is likely first
  const found = orderNamesakesByRecent(
    searchPlayers(available, query),
    recent.map(({ id }) => id),
  );
  // The host's own record first, when it is not at the table yet (ADR 0051)
  const matches = [...found.filter(isOwnRecord), ...found.filter((p) => !isOwnRecord(p))].slice(
    0,
    MAX_SUGGESTIONS,
  );
  const parsed = parsePlayerName(query);
  // Names may repeat (ADR 0043): a name someone has, here or not, can be given to another player
  const namesake = parsed.ok && namesakesOf(players, parsed.name).length > 0;
  const newName = parsed.ok && (matches.length === 0 || namesake) ? parsed.name : undefined;

  function close() {
    setQuery("");
    setOpen(false);
    savePlayer.reset();
  }

  function pick(player: Player) {
    close();
    onPick(player);
  }

  function handleCreate() {
    if (newName === undefined) return;
    const player = newPlayer(newName);
    savePlayer.mutate(player, { onSuccess: () => pick(player) });
  }

  return (
    <>
      {variant === "invite" ? (
        // Where the first player's card will be, as tall as one
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid min-h-11 w-full place-items-center rounded-xl border border-line bg-surface/50 text-sm text-muted"
        >
          {t.game.addPlayerToGame.tapToInvite}
        </button>
      ) : (
        <button
          type="button"
          aria-label={t.game.addPlayerToGame.addAPlayer}
          onClick={() => setOpen(true)}
          className="mx-auto grid size-11 place-items-center text-highlight"
        >
          <span className="grid size-4.5 place-items-center rounded-full border border-line">
            <Plus className="size-2.5" aria-hidden />
          </span>
        </button>
      )}

      {open && (
        <Modal title={t.game.addPlayerToGame.addAPlayer} onClose={close}>
          <TextField
            id="add-player"
            label={t.game.addPlayerToGame.nameOrInitials}
            value={query}
            issue={savePlayer.isError ? t.game.addPlayerToGame.couldntSaveTryAgain : undefined}
            inputMode="text"
            onChange={setQuery}
          />
          {(matches.length > 0 || newName !== undefined) && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {matches.map((player) => (
                <li key={player.id}>
                  <button
                    type="button"
                    onClick={() => pick(player)}
                    className={`${rowClass} border-line`}
                  >
                    <PlayerAvatar id={player.id} name={player.name} size="sm" />
                    <span className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span className="truncate font-medium">{player.name}</span>
                      {isOwnRecord(player) && <OwnTag />}
                    </span>
                    {player.number !== undefined && (
                      <span className="shrink-0 text-xs text-muted tabular-nums">
                        {playerNumberText(player.number)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
              {newName !== undefined && (
                <li>
                  <button
                    type="button"
                    disabled={savePlayer.isPending}
                    onClick={handleCreate}
                    className={`${rowClass} border-accent text-accent disabled:opacity-60`}
                  >
                    <span className="grid size-8 shrink-0 place-items-center">
                      <UserPlus className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {namesake
                        ? t.game.addPlayerToGame.createNamesake(newName)
                        : t.game.addPlayerToGame.create(newName)}
                    </span>
                  </button>
                </li>
              )}
            </ul>
          )}
          <button
            type="button"
            onClick={close}
            className="mt-3 min-h-11 w-full rounded-xl border border-line font-medium"
          >
            {t.common.close}
          </button>
        </Modal>
      )}
    </>
  );
}
