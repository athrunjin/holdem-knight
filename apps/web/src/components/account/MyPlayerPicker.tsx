import {
  orderNamesakesByRecent,
  type Player,
  playerNumberText,
  searchPlayers,
} from "@holdem-knight/core";
import { Check } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/insurance/Modal";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { TextField } from "@/components/TextField";
import { usePlayers, useRecentPlayers } from "@/data/players";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";

/** Everyone in the recent games, so the whole library can be put in order of recency */
const ALL_RECENT = Number.MAX_SAFE_INTEGER;

/**
 * Picks which player of the library is the one using the app: one tap on a row chooses it and
 * closes. With nothing typed it lists everyone, the latest to play first; typed, those whose
 * name or initials match, namesakes in order of who played last. The one chosen now is ticked.
 * No player is made here: they are added on 玩家库.
 */
export function MyPlayerPicker({
  chosenId,
  onChoose,
  onClose,
}: {
  chosenId: string | undefined;
  onChoose: (player: Player) => void;
  onClose: () => void;
}) {
  const { data: players = [] } = usePlayers();
  const { data: recent = [] } = useRecentPlayers(ALL_RECENT);
  const [query, setQuery] = useState("");

  const recentIds = recent.map(({ id }) => id);
  const rank = new Map(recentIds.map((id, index) => [id, index]));
  const matches = searchPlayers(players, query);
  const listed =
    query.trim() === ""
      ? // The latest to play first, then everyone else as the library lists them
        matches.toSorted((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || 0)
      : orderNamesakesByRecent(matches, recentIds);

  return (
    <Modal title={t.me.playerFace.choose} onClose={onClose}>
      {players.length === 0 ? (
        <p className="py-2 text-sm text-muted">{t.me.playerFace.noPlayers}</p>
      ) : (
        <>
          <TextField
            id="my-player"
            label={t.game.addPlayerToGame.nameOrInitials}
            value={query}
            issue={undefined}
            inputMode="text"
            onChange={setQuery}
          />
          {listed.length > 0 && (
            // Scrolls inside the dialog, under the search
            <ul className="mt-2 flex max-h-[50dvh] flex-col gap-1.5 overflow-y-auto">
              {listed.map((player) => {
                const chosen = player.id === chosenId;
                return (
                  <li key={player.id}>
                    <button
                      type="button"
                      aria-current={chosen || undefined}
                      onClick={() => onChoose(player)}
                      className={cn(
                        "flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-left",
                        chosen ? "border-highlight" : "border-line",
                      )}
                    >
                      <PlayerAvatar id={player.id} name={player.name} size="sm" />
                      <span className="min-w-0 flex-1 truncate font-medium">{player.name}</span>
                      {player.number !== undefined && (
                        <span className="shrink-0 text-xs text-muted tabular-nums">
                          {playerNumberText(player.number)}
                        </span>
                      )}
                      {chosen && (
                        <Check
                          className="size-4 shrink-0 text-highlight"
                          strokeWidth={2.5}
                          aria-hidden
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      <button
        type="button"
        onClick={onClose}
        className="mt-3 min-h-11 w-full rounded-xl border border-line font-medium"
      >
        {t.common.close}
      </button>
    </Modal>
  );
}
