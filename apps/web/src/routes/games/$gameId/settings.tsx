import {
  type GameSettings,
  insuranceActive,
  rakeChips,
  toGameSettingsForm,
  updateGameSettings,
} from "@holdem-knight/core";
import { createFileRoute } from "@tanstack/react-router";
import { GameSettingsForm } from "@/components/game/GameSettingsForm";
import { Page } from "@/components/Page";
import { useGame, useHasLedgerEvents, useSaveGameSettings } from "@/data/games";
import { useLedger } from "@/data/ledger";
import { t } from "@/i18n";

export const Route = createFileRoute("/games/$gameId/settings")({
  component: GameSettingsPage,
});

function GameSettingsPage() {
  const { gameId } = Route.useParams();
  const navigate = Route.useNavigate();
  const { data: game } = useGame(gameId);
  const { data: hasLedgerEvents } = useHasLedgerEvents(gameId);
  const { data: events } = useLedger(gameId);
  const saveGame = useSaveGameSettings();

  if (!game || hasLedgerEvents === undefined || !events) return null;

  function handleSubmit(settings: GameSettings) {
    if (!game || hasLedgerEvents === undefined) return;
    saveGame.mutate(updateGameSettings(game, settings, { hasLedgerEvents }), {
      onSuccess: () => navigate({ to: "/games/$gameId", params: { gameId }, replace: true }),
    });
  }

  return (
    <Page title={t.gamePages.settings.editSettings}>
      <GameSettingsForm
        initial={toGameSettingsForm(game)}
        submitLabel={t.common.save}
        ratioLocked={hasLedgerEvents}
        showBuyIn={!hasLedgerEvents || game.handChips !== undefined}
        showInsurance={game.handChips !== undefined}
        initialInsurance={game.insurance}
        lastInsurance={game.insurance}
        lastInsuranceLabel={t.gamePages.settings.thisGamesInsuranceSettings}
        insuranceLocked={insuranceActive(events)}
        initialTableFee={game.tableFee}
        lastTableFee={game.tableFee}
        lastTableFeeLabel={t.gamePages.settings.thisGamesTimeChargeSettings}
        initialWage={game.wage}
        lastWage={game.wage}
        lastWageLabel={t.gamePages.settings.thisGamesDealerWageSettings}
        initialRake={game.rake}
        lastRake={game.rake}
        lastRakeLabel={t.gamePages.settings.thisGamesRakeSettings}
        lastBasics={game}
        lastBasicsLabel={t.gamePages.settings.thisGamesBasics}
        lastSources={game.sources}
        rakeLocked={rakeChips(events) > 0}
        saving={saveGame.isPending}
        saveFailed={saveGame.isError}
        onSubmit={handleSubmit}
      />
    </Page>
  );
}
