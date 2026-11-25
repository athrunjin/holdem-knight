import type { Game } from "@holdem-knight/core";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GameListRow } from "@/components/game/GameListRow";
import { FoldHeading, HistorySection } from "@/components/game/HistorySection";
import { InDevelopment } from "@/components/InDevelopment";
import { Page } from "@/components/Page";
import { useGames } from "@/data/games";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { useListReturn } from "@/lib/list-return";
import { parseBoolean, useStoredState } from "@/lib/stored-state";

export const Route = createFileRoute("/")({
  component: SessionsPage,
});

type Role = "host" | "player";

const ROLES: readonly { readonly role: Role; readonly label: string }[] = [
  { role: "host", label: "Host" },
  { role: "player", label: "Player" },
];

interface GameSectionProps {
  title: string;
  games: readonly Game[];
  /** Where the fold is kept between visits */
  storageKey: string;
}

/** Games still under way, unfolded until it is left folded. Left out of the page while it has none. */
function GameSection({ title, games, storageKey }: GameSectionProps) {
  const [open, setOpen] = useStoredState(storageKey, true, parseBoolean);
  if (games.length === 0) return null;

  return (
    <section>
      <FoldHeading title={title} count={games.length} open={open} onToggle={() => setOpen(!open)} />
      {open && (
        <ul className="mt-1 flex flex-col gap-2">
          {games.map((game) => (
            <GameListRow key={game.id} game={game} />
          ))}
        </ul>
      )}
    </section>
  );
}

function HostGames() {
  const { data: games, isPending } = useGames();
  if (isPending || !games) return null;
  return <HostGameList games={games} />;
}

/** The games once they are read, so the page can go back to where it was left. */
function HostGameList({ games }: { games: readonly Game[] }) {
  useListReturn("/");
  const settled = games.filter((game) => game.status === "settled");

  return (
    <div className="flex flex-col gap-2 pt-4 pb-6">
      {games.length === 0 && (
        <div className="space-y-2 px-1 py-6 text-center">
          <p className="text-lg font-medium">{t.gamePages.list.noGamesYet2}</p>
          <p className="text-sm text-muted">{t.gamePages.list.tapNewGameBelowToRecord}</p>
        </div>
      )}
      <GameSection
        title={t.gamePages.list.inProgress}
        games={games.filter((game) => game.status === "open")}
        storageKey="games-list.open"
      />
      <GameSection
        title={t.gamePages.list.settling}
        games={games.filter((game) => game.status === "settling")}
        storageKey="games-list.settling"
      />
      <HistorySection games={settled} />
    </div>
  );
}

function PlayerGames() {
  return (
    <section className="flex flex-col items-center gap-3 py-16 text-center">
      <InDevelopment milestone="M7" />
      <p className="max-w-sm text-muted">{t.gamePages.list.gamesYouPlayInAsA}</p>
    </section>
  );
}

function SessionsPage() {
  const [role, setRole] = useState<Role>("host");

  return (
    <Page title={t.gamePages.list.game}>
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
