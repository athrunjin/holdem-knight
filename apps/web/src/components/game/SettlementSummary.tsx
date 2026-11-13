import {
  chipsToCents,
  chooseImbalanceHandling,
  type Game,
  INSURANCE_PLAYER_ID,
  ledgerTotals,
  type PlayerLedger,
  timerElapsedMs,
} from "@holdem-knight/core";
import { useSaveGame } from "@/data/games";
import { formatDifference } from "@/lib/chips";
import { formatGameMoney } from "@/lib/currency";
import { BalanceTile, BuyInTile, GameHostLine, GameTiles, Tile } from "./GameTiles";
import { formatElapsed } from "./GameTimer";
import { imbalanceChoices } from "./ImbalanceOptions";
import { PickerRow } from "./PickerRow";

interface SettlementSummaryProps {
  game: Game;
  ledger: readonly PlayerLedger[];
  /** Chips cashed out minus chips bought, 0 when the books balance */
  difference: number;
}

/**
 * The top of the settlement page: the game's blinds, date and host, its totals, and how a chip
 * difference is handled, as one row that opens the choices.
 */
export function SettlementSummary({ game, ledger, difference }: SettlementSummaryProps) {
  const saveGame = useSaveGame();
  const { currency, chipRatio, timer } = game;
  const people = ledger.filter((p) => p.playerId !== INSURANCE_PLAYER_ID);
  const { boughtChips } = ledgerTotals(people);
  const elapsed = timer && formatElapsed(timerElapsedMs(timer, game.settledAt ?? Date.now()));
  const cash = formatGameMoney(chipsToCents(Math.abs(difference), chipRatio), currency);
  const choices = imbalanceChoices(difference, cash);
  const chosen = choices.find(([handling]) => handling === game.imbalanceHandling)?.[1];

  return (
    <section aria-label="牌局信息">
      <GameHostLine game={game} />
      <GameTiles>
        <BuyInTile game={game} boughtChips={boughtChips} />
        <Tile label="时长">{elapsed ?? "—"}</Tile>
        <BalanceTile game={game} balanceChips={difference} />
      </GameTiles>
      {difference !== 0 && (
        <PickerRow
          title="差额处理方式"
          options={choices}
          value={game.imbalanceHandling}
          disabled={saveGame.isPending || game.status === "settled"}
          warn
          onChange={(handling) => saveGame.mutate(chooseImbalanceHandling(game, handling))}
        >
          <span className="font-medium">差额 {formatDifference(difference, cash)}</span>
          <span className="text-muted"> · {chosen ?? "未选择处理方式"}</span>
        </PickerRow>
      )}
      {saveGame.isError && (
        <p role="alert" className="mt-2 text-sm text-highlight">
          保存失败，请重试。
        </p>
      )}
    </section>
  );
}
