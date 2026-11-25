import { type Player, type PlayerNameIssue, parsePlayerName } from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Page } from "@/components/Page";
import { usePlayers, useSavePlayer } from "@/data/players";
import { t } from "@/i18n";
import { toInitials } from "@/lib/pinyin";
import { PLAYER_NAME_ISSUE_TEXT } from "@/lib/player-name";

export const Route = createFileRoute("/players/$playerId_/edit")({
  component: EditPlayerPage,
});

function EditPlayerPage() {
  const { playerId } = Route.useParams();
  const { data: players, isPending } = usePlayers();

  if (isPending) return null;
  const player = players?.find(({ id }) => id === playerId);
  if (!players || !player) {
    return (
      <Page title={t.players.title}>
        <p className="text-muted">{t.players.playerPage.thisPlayerCantBeFound}</p>
        <Link to="/players" className="mt-2 inline-flex min-h-11 items-center text-highlight">
          {t.players.playerPage.backToPlayers}
        </Link>
      </Page>
    );
  }

  const otherNames = players.filter(({ id }) => id !== playerId).map(({ name }) => name);
  return <EditPlayerForm player={player} otherNames={otherNames} />;
}

function EditPlayerForm({ player, otherNames }: { player: Player; otherNames: string[] }) {
  const navigate = Route.useNavigate();
  const savePlayer = useSavePlayer();
  const [name, setName] = useState(player.name);
  const [issue, setIssue] = useState<PlayerNameIssue>();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = parsePlayerName(name, otherNames);
    if (!parsed.ok) {
      setIssue(parsed.issue);
      return;
    }
    setIssue(undefined);
    savePlayer.mutate(
      { ...player, name: parsed.name, initials: toInitials(parsed.name) },
      // Back to the player's page, which the form was opened from
      {
        onSuccess: () =>
          navigate({ to: "/players/$playerId", params: { playerId: player.id }, replace: true }),
      },
    );
  }

  return (
    <Page title={t.players.playerPage.editPlayer}>
      <form onSubmit={handleSubmit} noValidate className="flex max-w-md flex-col gap-6 pb-8">
        <div>
          <label htmlFor="name" className="mb-2 block font-medium">
            {t.players.playerPage.name}
          </label>
          <input
            id="name"
            type="text"
            autoComplete="off"
            value={name}
            aria-invalid={issue ? true : undefined}
            aria-describedby={issue ? "name-issue" : undefined}
            onChange={(event) => setName(event.target.value)}
            className="min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-lg outline-none focus:border-highlight aria-invalid:border-highlight"
          />
          {issue && (
            <p id="name-issue" className="mt-1 text-sm text-highlight">
              {PLAYER_NAME_ISSUE_TEXT[issue]}
            </p>
          )}
        </div>
        {savePlayer.isError && (
          <p role="alert" className="text-sm text-highlight">
            {t.common.couldntSaveTryAgain}
          </p>
        )}
        <button
          type="submit"
          disabled={savePlayer.isPending}
          className="min-h-12 rounded-xl bg-accent px-6 font-semibold text-accent-text disabled:opacity-60"
        >
          {t.common.save}
        </button>
      </form>
    </Page>
  );
}
