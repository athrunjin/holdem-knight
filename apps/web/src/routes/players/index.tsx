import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Page } from "@/components/Page";
import {
  matchPlayers,
  PlayerGroups,
  PlayerListHeading,
  PlayerSearch,
} from "@/components/players/PlayerList";
import { newPlayer, usePlayers, useSavePlayer } from "@/data/players";

export const Route = createFileRoute("/players/")({
  component: PlayersPage,
});

/** The player library, laid out like the list a game's players are picked from. */
function PlayersPage() {
  const { data: players = [], isPending } = usePlayers();
  const savePlayer = useSavePlayer();
  const [query, setQuery] = useState("");

  const { groups, newName, tooLong } = matchPlayers(players, query);

  function handleCreate() {
    if (newName === undefined) return;
    savePlayer.mutate(newPlayer(newName), { onSuccess: () => setQuery("") });
  }

  if (isPending) return null;

  return (
    <Page title="玩家">
      <div className="pb-6">
        <PlayerSearch
          label="搜索或新建玩家"
          placeholder="搜索或新建：名字或拼音首字母"
          query={query}
          onQueryChange={setQuery}
          newName={newName}
          tooLong={tooLong}
          createLabel={(name) => `新建「${name}」`}
          saving={savePlayer.isPending}
          saveFailed={savePlayer.isError}
          onCreate={handleCreate}
        />

        {players.length === 0 && query === "" && (
          <p className="mt-4 rounded-2xl border border-dashed border-line px-6 py-8 text-center text-muted">
            玩家库是空的。输入名字新建玩家，开局时就能直接选人。
          </p>
        )}

        {players.length > 0 && <PlayerListHeading className="mt-3" />}
        <PlayerGroups groups={groups}>
          {({ id, name, initials }) => (
            <Link
              to="/players/$playerId"
              params={{ playerId: id }}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-surface pl-3"
            >
              <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
              <span className="text-xs text-muted">{initials}</span>
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
