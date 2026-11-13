import {
  chooseImbalanceHandling,
  type Game,
  type ImbalanceHandling,
  INSURANCE_PLAYER_ID,
  ledgerTotals,
  type PlayerLedger,
  timerElapsedMs,
} from "@holdem-knight/core";
import { useSaveGame } from "@/data/games";
import { BalanceTile, BuyInTile, GameHostLine, GameTiles, Tile } from "./GameTiles";
import { formatElapsed } from "./GameTimer";
import { PickerRow } from "./PickerRow";

interface SettlementSummaryProps {
  game: Game;
  ledger: readonly PlayerLedger[];
  /** Chips cashed out minus chips bought, 0 when the books balance */
  difference: number;
}

/**
 * The top of the settlement page: the game's blinds, date and host, its totals, and how a chip
 * difference is handled, as small text over the balance box that opens the choices.
 */
export function SettlementSummary({ game, ledger, difference }: SettlementSummaryProps) {
  const saveGame = useSaveGame();
  const { timer } = game;
  const people = ledger.filter((p) => p.playerId !== INSURANCE_PLAYER_ID);
  const { boughtChips } = ledgerTotals(people);
  const elapsed = timer && formatElapsed(timerElapsedMs(timer, game.settledAt ?? Date.now()));
  // Short enough to sit over the balance box; the box under it has the amount
  const choices: readonly (readonly [ImbalanceHandling, string])[] = [
    ["split", `水${difference > 0 ? "上" : "下"}比例分摊`],
    ["organizer", `${game.organizerId} ${difference > 0 ? "承担" : "收取"}`],
    ["ignore", "不做处理"],
  ];
  const chosen = choices.find(([handling]) => handling === game.imbalanceHandling)?.[1];

  return (
    <section aria-label="牌局信息">
      <GameHostLine
        game={game}
        end={
          difference !== 0 && (
            <PickerRow
              inline
              title="差额处理方案"
              options={choices}
              value={game.imbalanceHandling}
              disabled={saveGame.isPending || game.status === "settled"}
              onChange={(handling) => saveGame.mutate(chooseImbalanceHandling(game, handling))}
            >
              {chosen ?? "选择处理方案"}
            </PickerRow>
          )
        }
      />
      <GameTiles>
        <BuyInTile game={game} boughtChips={boughtChips} />
        <Tile label="时长">{elapsed ?? "—"}</Tile>
        <BalanceTile game={game} balanceChips={difference} />
      </GameTiles>
      {saveGame.isError && (
        <p role="alert" className="mt-2 text-sm text-highlight">
          保存失败，请重试。
        </p>
      )}
    </section>
  );
}
