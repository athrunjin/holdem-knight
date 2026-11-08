import {
  createGame,
  DEFAULT_GAME_SETTINGS,
  type GameSettings,
  toGameSettingsForm,
} from "@holdem-knight/core";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  type GameConfigChoice,
  GameConfigPicker,
  LAST_CONFIG,
} from "@/components/game/GameConfigPicker";
import { GameSettingsForm } from "@/components/game/GameSettingsForm";
import { SaveGameConfigDialog } from "@/components/game/SaveGameConfigDialog";
import { Page } from "@/components/Page";
import { GUEST_ORGANIZER_ID } from "@/data";
import { useGames, useSaveGameSettings } from "@/data/games";

export const Route = createFileRoute("/games/new")({
  component: NewGamePage,
});

function NewGamePage() {
  const navigate = Route.useNavigate();
  const games = useGames();
  const saveGame = useSaveGameSettings();
  const [selected, setSelected] = useState<string | null>(LAST_CONFIG);
  // A new choice remounts the form, which starts again from its initial values
  const [applied, setApplied] = useState<{ key: number; choice?: GameConfigChoice }>({ key: 0 });
  const [saving, setSaving] = useState<GameSettings | null>(null);

  function handleApply(choice: GameConfigChoice) {
    setSelected(choice.id);
    setApplied({ key: applied.key + 1, choice });
  }

  function handleSubmit(settings: GameSettings) {
    const game = createGame(
      { id: crypto.randomUUID(), organizerId: GUEST_ORGANIZER_ID, createdAt: Date.now() },
      settings,
    );
    saveGame.mutate(game, {
      onSuccess: () =>
        navigate({ to: "/games/$gameId", params: { gameId: game.id }, replace: true }),
    });
  }

  const latest = games.data?.[0];
  const settings = applied.choice?.settings;
  // Carry over the latest game's settings by default
  const start = settings ?? latest ?? DEFAULT_GAME_SETTINGS;
  const configRule = settings?.insurance;
  const configTableFee = settings?.tableFee;
  const configWage = settings?.wage;

  return (
    <Page
      title="开局设置"
      centered
      actions={
        <GameConfigPicker selected={selected} onSelect={setSelected} onApply={handleApply} />
      }
    >
      {!games.isPending && (
        <GameSettingsForm
          key={applied.key}
          initial={toGameSettingsForm(start)}
          initialInsurance={start.insurance}
          lastInsurance={configRule ?? games.data?.find((game) => game.insurance)?.insurance}
          lastInsuranceLabel={configRule && applied.choice?.name}
          initialTableFee={start.tableFee}
          lastTableFee={configTableFee ?? games.data?.find((game) => game.tableFee)?.tableFee}
          lastTableFeeLabel={configTableFee && applied.choice?.name}
          initialWage={start.wage}
          lastWage={configWage ?? games.data?.find((game) => game.wage)?.wage}
          lastWageLabel={configWage && applied.choice?.name}
          submitLabel="开局"
          saving={saveGame.isPending}
          saveFailed={saveGame.isError}
          onSubmit={handleSubmit}
          onSaveConfig={setSaving}
        />
      )}
      {saving && (
        <SaveGameConfigDialog
          settings={saving}
          onSaved={(id) => {
            setSelected(id);
            setSaving(null);
          }}
          onClose={() => setSaving(null)}
        />
      )}
    </Page>
  );
}
