import type { Currency, GameSummary } from "@holdem-knight/core";
import { BLIND_PICKS, RATIO_PICKS } from "./game-picks";

/** The games the income page counts: of one currency, and of one ratio or blinds where chosen. */
export interface IncomeFilter {
  readonly currency: Currency;
  /** As `ratioKey` gives it. Missing for any ratio. */
  readonly ratio?: string | undefined;
  /** As `blindsKey` gives them. Missing for any blinds. */
  readonly blinds?: string | undefined;
}

export const ratioKey = ({ chipRatio }: GameSummary) => `${chipRatio.chips}:${chipRatio.amount}`;
export const blindsKey = (summary: GameSummary) =>
  `${summary.smallBlindChips}/${summary.bigBlindChips}`;

/**
 * The ratios and blinds there are to choose from: those a new game offers that some of these
 * games in the currency have. Ratios and blinds typed in by hand are not offered.
 */
export function filterChoices(games: readonly GameSummary[], currency: Currency) {
  const own = games.filter((game) => game.currency === currency);
  return {
    ratios: RATIO_PICKS.map(({ chips }) => ({ value: `${chips}:100`, chips })).filter(({ value }) =>
      own.some((game) => ratioKey(game) === value),
    ),
    blinds: BLIND_PICKS.map(({ small, big, label }) => ({
      value: label,
      name: `${small} / ${big}`,
    })).filter(({ value }) => own.some((game) => blindsKey(game) === value)),
  };
}
