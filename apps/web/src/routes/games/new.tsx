import {
  createGame,
  DEFAULT_GAME_SETTINGS,
  type GameSettings,
  resolveSettings,
  sameGameSettings,
  toGameSettingsForm,
  toggleTimer,
} from "@holdem-knight/core";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import {
  DEFAULT_CONFIG,
  DEFAULT_CONFIG_NAME,
  GameConfigPicker,
  LAST_CONFIG,
} from "@/components/game/GameConfigPicker";
import { GameSettingsForm } from "@/components/game/GameSettingsForm";
import { PlayerPicker } from "@/components/game/PlayerPicker";
import { SaveGameConfigDialog } from "@/components/game/SaveGameConfigDialog";
import { Page } from "@/components/Page";
import { GUEST_ORGANIZER_ID } from "@/data";
import { useConfigLibrary } from "@/data/config-library";
import { useGameConfigs } from "@/data/game-configs";
import { useGames, useStartGame } from "@/data/games";
import { deviceTimeZone } from "@/lib/charges";

export const Route = createFileRoute("/games/new")({
  component: NewGamePage,
});

type Option = "insurance" | "tableFee" | "wage" | "rake";

function NewGamePage() {
  const navigate = Route.useNavigate();
  const games = useGames();
  const { data: configs = [] } = useGameConfigs();
  const library = useConfigLibrary();
  const startGame = useStartGame();
  // The config that filled the form, or null once it has been deleted. A new choice remounts the
  // form, which starts again from its initial values
  const [applied, setApplied] = useState<{ key: number; id: string | null }>({
    key: 0,
    id: LAST_CONFIG,
  });
  const [modified, setModified] = useState(false);
  const [saving, setSaving] = useState<GameSettings | null>(null);
  // Settings confirmed on the first step, waiting for the players
  const [picking, setPicking] = useState<GameSettings | null>(null);

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
  // A game config's settings as the saved configs it follows have them now (ADR 0038)
  const resolved = (saved: GameSettings) => (library ? resolveSettings(saved, library) : saved);
  // Last time's setup goes by the saved game config it equals, or by the default, and is listed
  // as last time's only when it is neither
  const lastConfig =
    latest && configs.find((saved) => sameGameSettings(resolved(saved.settings), latest));
  const lastIsDefault = !latest || sameGameSettings(DEFAULT_GAME_SETTINGS, latest);
  const lastShown = !lastConfig && !lastIsDefault;
  const selected =
    applied.id === LAST_CONFIG
      ? (lastConfig?.id ?? (lastShown ? LAST_CONFIG : DEFAULT_CONFIG))
      : applied.id;
  const config = configs.find((saved) => saved.id === selected);
  const settings =
    selected === DEFAULT_CONFIG ? DEFAULT_GAME_SETTINGS : config && resolved(config.settings);
  const configName = selected === DEFAULT_CONFIG ? DEFAULT_CONFIG_NAME : config?.name;
  // Carry over the latest game's settings by default
  const start = settings ?? latest ?? DEFAULT_GAME_SETTINGS;
  /** Offered as "last time": a picked game config's option, or else the latest game's that had one. */
  const lastOf = <K extends Option>(option: K) => {
    const from = settings?.[option] ? settings : games.data?.find((game) => game[option]);
    return {
      rule: from?.[option],
      source: from?.sources?.[option],
      label: settings?.[option] && configName,
    };
  };
  const insurance = lastOf("insurance");
  const tableFee = lastOf("tableFee");
  const wage = lastOf("wage");
  const rake = lastOf("rake");

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
          <GameConfigPicker
            selected={selected}
            modified={modified}
            lastShown={lastShown}
            onSelect={(id) => setApplied({ ...applied, id })}
            onApply={(id) => setApplied({ key: applied.key + 1, id })}
          />
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
            lastInsurance={insurance.rule}
            lastInsuranceLabel={insurance.label}
            initialTableFee={start.tableFee}
            lastTableFee={tableFee.rule}
            lastTableFeeLabel={tableFee.label}
            initialWage={start.wage}
            lastWage={wage.rule}
            lastWageLabel={wage.label}
            initialRake={start.rake}
            lastRake={rake.rule}
            lastRakeLabel={rake.label}
            // A picked game config's basics, or else the latest game's
            lastBasics={settings ?? latest}
            lastBasicsLabel={settings && configName}
            lastSources={{
              basics: (settings ?? latest)?.sources?.basics,
              insurance: insurance.source,
              tableFee: tableFee.source,
              wage: wage.source,
              rake: rake.source,
            }}
            submitLabel="下一步：选择玩家"
            saving={false}
            saveFailed={false}
            onSubmit={showStep}
            onSaveConfig={setSaving}
            onModifiedChange={setModified}
          />
        </div>
      )}
      {saving && (
        <SaveGameConfigDialog
          settings={saving}
          currentName={config?.name}
          onSaved={(id) => {
            // The form keeps what was typed, and now reads as this config unchanged
            setApplied({ ...applied, id });
            setSaving(null);
          }}
          onClose={() => setSaving(null)}
        />
      )}
    </Page>
  );
}
