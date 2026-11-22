import {
  chooseImbalanceHandling,
  type Game,
  type ImbalanceHandling,
  INSURANCE_PLAYER_ID,
  ledgerTotals,
  type PlayerLedger,
  RAKE_PLAYER_ID,
  timerElapsedMs,
} from "@holdem-knight/core";
import { TextMenu } from "@/components/TextMenu";
import { organizerNameOf } from "@/data";
import { useSaveGame } from "@/data/games";
import { t } from "@/i18n";
import { BalanceTile, BuyInTile, GameHostLine, GameTiles, Tile } from "./GameTiles";
import { formatElapsed } from "./GameTimer";

interface SettlementSummaryProps {
  game: Game;
  ledger: readonly PlayerLedger[];
  /** Chips cashed out minus chips bought, 0 when the books balance */
  difference: number;
  /** Takes a tap on the handling of a difference once the game is settled, when it cannot change */
  onLocked: () => void;
}

/**
 * The ways to handle a chip difference, each with a name short enough to sit over the balance
 * box; the box under it has the amount.
 */
export function imbalanceChoices(
  game: Pick<Game, "organizerId">,
  difference: number,
): readonly (readonly [ImbalanceHandling, string])[] {
  return [
    [
      "split",
      t.game.settlementSummary.splitByShareOf(
        difference > 0 ? t.game.settlementSummary.winnings : t.game.settlementSummary.losses,
      ),
    ],
    [
      "organizer",
      `${organizerNameOf(game)} ${difference > 0 ? t.game.settlementSummary.covers : t.common.keeps}`,
    ],
    ["ignore", t.game.settlementSummary.leaveAsIs],
  ];
}

/**
 * The top of the settlement page: the game's blinds, date and host, its totals, and how a chip
 * difference is handled, as small text over the balance box that opens the choices.
 */
export function SettlementSummary({ game, ledger, difference, onLocked }: SettlementSummaryProps) {
  const saveGame = useSaveGame();
  const { timer } = game;
  const settled = game.status === "settled";
  const people = ledger.filter(
    (p) => p.playerId !== INSURANCE_PLAYER_ID && p.playerId !== RAKE_PLAYER_ID,
  );
  const { boughtChips } = ledgerTotals(people);
  const elapsed = timer && formatElapsed(timerElapsedMs(timer, game.settledAt ?? Date.now()));
  const choices = imbalanceChoices(game, difference);
  const chosen = choices.find(([handling]) => handling === game.imbalanceHandling)?.[1];
  // Small highlighted text at the end of the line; its 44px target reaches up from it
  const lineClass = "-mt-8 min-h-11 items-end text-xs leading-none text-highlight";

  return (
    <section aria-label={t.game.settlementSummary.gameInfo}>
      <GameHostLine
        game={game}
        end={
          difference !== 0 &&
          (settled ? (
            // Locked once settled: a tap points at the button that opens the results again
            <button
              type="button"
              onClick={onLocked}
              className={`flex max-w-[45%] min-w-0 shrink-0 ${lineClass}`}
            >
              <span className="truncate pb-px">
                {chosen ?? t.game.settlementSummary.chooseHowToHandleIt}
              </span>
            </button>
          ) : (
            <div className="max-w-[45%] shrink-0">
              <TextMenu
                label={t.game.settlementSummary.howTheDifferenceIsHandled}
                options={choices.map(([value, label]) => ({ value, label }))}
                value={game.imbalanceHandling}
                placeholder={t.game.settlementSummary.chooseHowToHandleIt}
                align="right"
                disabled={saveGame.isPending}
                onChange={(handling) => saveGame.mutate(chooseImbalanceHandling(game, handling))}
                className={lineClass}
              />
            </div>
          ))
        }
      />
      <GameTiles>
        <BuyInTile game={game} boughtChips={boughtChips} />
        <Tile label={t.game.settlementSummary.length}>{elapsed ?? "—"}</Tile>
        <BalanceTile game={game} balanceChips={difference} />
      </GameTiles>
      {saveGame.isError && (
        <p role="alert" className="mt-2 text-sm text-highlight">
          {t.common.couldntSaveTryAgain}
        </p>
      )}
    </section>
  );
}
