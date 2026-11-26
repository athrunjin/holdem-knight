import { type Player, parsePlayerName, searchPlayers } from "@holdem-knight/core";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/insurance/Modal";
import { TextField } from "@/components/TextField";
import { newPlayer, usePlayers, useSavePlayer } from "@/data/players";
import { t } from "@/i18n";

const MAX_SUGGESTIONS = 8;

const pillClass =
  "inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 font-medium";

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
  const savePlayer = useSavePlayer();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const available = players.filter(({ id }) => !excludedIds.has(id));
  const matches = searchPlayers(available, query).slice(0, MAX_SUGGESTIONS);
  const parsed = parsePlayerName(query);
  const newName = parsed.ok && matches.length === 0 ? parsed.name : undefined;

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
            <ul className="mt-2 flex flex-wrap gap-2">
              {matches.map((player) => (
                <li key={player.id}>
                  <button type="button" onClick={() => pick(player)} className={pillClass}>
                    {player.name}
                  </button>
                </li>
              ))}
              {newName !== undefined && (
                <li>
                  <button
                    type="button"
                    disabled={savePlayer.isPending}
                    onClick={handleCreate}
                    className={`${pillClass} border-accent disabled:opacity-60`}
                  >
                    {t.game.addPlayerToGame.create(newName)}
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
