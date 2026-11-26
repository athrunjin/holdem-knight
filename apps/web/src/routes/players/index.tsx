import { parsePlayerName, playerNumberText } from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Page } from "@/components/Page";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import {
  matchPlayers,
  PlayerGroups,
  PlayerListHeading,
  PlayerSearch,
} from "@/components/players/PlayerList";
import { newPlayer, usePlayers, useSavePlayer } from "@/data/players";
import { t } from "@/i18n";
import { namesakeHint } from "@/lib/player-name";

export const Route = createFileRoute("/players/")({
  component: PlayersPage,
});

/** The player library, laid out like the list a game's players are picked from. */
function PlayersPage() {
  const { data: players = [], isPending } = usePlayers();
  const savePlayer = useSavePlayer();
  const [query, setQuery] = useState("");

  const { groups, newName, namesakes, tooLong } = matchPlayers(players, query);
  // Names may repeat (ADR 0043): with namesakes found, the query can still be added as another
  const parsed = parsePlayerName(query);
  const createName = newName ?? (namesakes.length > 0 && parsed.ok ? parsed.name : undefined);

  function handleCreate() {
    if (createName === undefined) return;
    savePlayer.mutate(newPlayer(createName), { onSuccess: () => setQuery("") });
  }

  if (isPending) return null;

  return (
    <Page title={t.players.title}>
      <div className="pb-6">
        <PlayerSearch
          label={t.players.library.searchOrAddAPlayer}
          placeholder={t.players.library.searchOrAddNameOrInitials}
          query={query}
          onQueryChange={setQuery}
          newName={createName}
          tooLong={tooLong}
          hint={namesakeHint(namesakes)}
          createLabel={(name) => t.players.library.create(name)}
          saving={savePlayer.isPending}
          saveFailed={savePlayer.isError}
          onCreate={handleCreate}
        />

        {players.length === 0 && query === "" && (
          <p className="mt-4 rounded-2xl border border-dashed border-line px-6 py-8 text-center text-muted">
            {t.players.library.noPlayersYetTypeAName}
          </p>
        )}

        {players.length > 0 && <PlayerListHeading className="mt-3" />}
        <PlayerGroups groups={groups}>
          {({ id, name, number }) => (
            <Link
              to="/players/$playerId"
              params={{ playerId: id }}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-surface pl-3"
            >
              <PlayerAvatar id={id} name={name} size="sm" />
              <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
              {number !== undefined && (
                <span className="text-xs text-muted tabular-nums">{playerNumberText(number)}</span>
              )}
              <span className="grid size-11 shrink-0 place-items-center text-muted">
                <ChevronRight className="size-5" aria-hidden />
              </span>
            </Link>
          )}
        </PlayerGroups>
      </div>
    </Page>
  );
}
