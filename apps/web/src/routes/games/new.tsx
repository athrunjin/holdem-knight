import {
  createGame,
  DEFAULT_GAME_SETTINGS,
  type GameSettings,
  toGameSettingsForm,
  toggleTimer,
} from "@holdem-knight/core";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import {
  type GameConfigChoice,
  GameConfigPicker,
  LAST_CONFIG,
} from "@/components/game/GameConfigPicker";
import { GameSettingsForm } from "@/components/game/GameSettingsForm";
import { PlayerPicker } from "@/components/game/PlayerPicker";
import { SaveGameConfigDialog } from "@/components/game/SaveGameConfigDialog";
import { Page } from "@/components/Page";
import { GUEST_ORGANIZER_ID } from "@/data";
import { useGames, useStartGame } from "@/data/games";
import { deviceTimeZone } from "@/lib/charges";

export const Route = createFileRoute("/games/new")({
  component: NewGamePage,
});

function NewGamePage() {
  const navigate = Route.useNavigate();
  const games = useGames();
  const startGame = useStartGame();
  const [selected, setSelected] = useState<string | null>(LAST_CONFIG);
  // A new choice remounts the form, which starts again from its initial values
  const [applied, setApplied] = useState<{ key: number; choice?: GameConfigChoice }>({ key: 0 });
  const [saving, setSaving] = useState<GameSettings | null>(null);
  // Settings confirmed on the first step, waiting for the players
  const [picking, setPicking] = useState<GameSettings | null>(null);

  function handleApply(choice: GameConfigChoice) {
    setSelected(choice.id);
    setApplied({ key: applied.key + 1, choice });
  }

  function showStep(settings: GameSettings | null) {
    setPicking(settings);
    startGame.reset();
    window.scrollTo(0, 0);
  }

  function handleStart(playerIds: readonly string[], startClock: boolean) {
    if (!picking) return;
    const now = Date.now();
    const game = createGame(
      {
        id: crypto.randomUUID(),
        organizerId: GUEST_ORGANIZER_ID,
        createdAt: now,
        timeZone: deviceTimeZone(),
      },
      picking,
    );
    startGame.mutate(
      { game: startClock ? { ...game, timer: toggleTimer(undefined, now) } : game, playerIds },
      {
        onSuccess: () =>
          navigate({ to: "/games/$gameId", params: { gameId: game.id }, replace: true }),
      },
    );
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
      title={picking ? "选择玩家" : "开局设置"}
      centered
      actions={
        picking ? (
          <button
            type="button"
            onClick={() => showStep(null)}
            className="flex min-h-11 items-center gap-0.5 text-sm text-muted"
          >
            <ChevronLeft className="size-4" aria-hidden />
            设置
          </button>
        ) : (
          <GameConfigPicker selected={selected} onSelect={setSelected} onApply={handleApply} />
        )
      }
    >
      {picking && (
        <PlayerPicker
          saving={startGame.isPending}
          saveFailed={startGame.isError}
          onStart={handleStart}
        />
      )}
      {/* Stays mounted while picking players, so going back keeps what was typed */}
      {!games.isPending && (
        <div hidden={picking !== null}>
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
            submitLabel="下一步：选择玩家"
            saving={false}
            saveFailed={false}
            onSubmit={showStep}
            onSaveConfig={setSaving}
          />
        </div>
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
