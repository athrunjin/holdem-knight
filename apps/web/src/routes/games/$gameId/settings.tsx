import {
  type GameSettings,
  insuranceActive,
  toGameSettingsForm,
  updateGameSettings,
} from "@holdem-knight/core";
import { createFileRoute } from "@tanstack/react-router";
import { GameSettingsForm } from "@/components/game/GameSettingsForm";
import { Page } from "@/components/Page";
import { useGame, useHasLedgerEvents, useSaveGameSettings } from "@/data/games";
import { useLedger } from "@/data/ledger";

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
    <Page title="修改设置">
      <GameSettingsForm
        initial={toGameSettingsForm(game)}
        submitLabel="保存"
        ratioLocked={hasLedgerEvents}
        showBuyIn={!hasLedgerEvents || game.handChips !== undefined}
        showInsurance={game.handChips !== undefined}
        initialInsurance={game.insurance}
        lastInsurance={game.insurance}
        insuranceLocked={insuranceActive(events)}
        initialTableFee={game.tableFee}
        lastTableFee={game.tableFee}
        initialWage={game.wage}
        lastWage={game.wage}
        saving={saveGame.isPending}
        saveFailed={saveGame.isError}
        onSubmit={handleSubmit}
      />
    </Page>
  );
}
