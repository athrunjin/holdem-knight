import type { InsuranceHand, InsuranceRule } from "@holdem-knight/core";
import { useEffect, useState } from "react";
import { type HandStore, InsuranceHandFlow, type SeatChips } from "./InsuranceHandFlow";
import { OutsQuickCalc } from "./OutsQuickCalc";

export interface InsuranceSeat {
  readonly id: string;
  readonly name: string;
  /** The chips the player has at the table, which a hand starts their stake from. Zero away from a game. */
  readonly chips?: number;
}

/** Working from the cards of a hand, or from a count of outs for a quick price. */
export type InsuranceMode = "cards" | "outs";

interface InsuranceCalculatorProps {
  /** Which of the two is on show. The page picks it, in its title. */
  mode: InsuranceMode;
  rule: InsuranceRule;
  seats: readonly InsuranceSeat[];
  /** Missing for the standalone calculator, which records nothing. */
  handStore?: HandStore;
  seat?: SeatChips | undefined;
  /** The hand in progress, to carry on from. */
  openHand?: InsuranceHand | undefined;
  createHand: () => InsuranceHand;
  /** Told whether a hand's insurance is being worked out, while the settings must stay put. */
  onHandUnderWay?: ((underWay: boolean) => void) | undefined;
}

/** Works out a hand's insurance from its cards, or from counts of outs. */
export function InsuranceCalculator({
  handStore,
  seat,
  openHand,
  createHand,
  rule,
  seats,
  mode,
  onHandUnderWay,
}: InsuranceCalculatorProps) {
  // Either way of working can have a hand under way, and the settings wait for both
  const [cardsUnderWay, setCardsUnderWay] = useState(false);
  const [outsUnderWay, setOutsUnderWay] = useState(false);
  const underWay = cardsUnderWay || outsUnderWay;
  useEffect(() => onHandUnderWay?.(underWay), [onHandUnderWay, underWay]);
  return (
    <>
      {/* Both stay mounted, so looking at the other mode keeps the hand */}
      <div hidden={mode !== "cards"}>
        <InsuranceHandFlow
          rule={rule}
          seats={seats}
          open={openHand}
          createHand={createHand}
          store={handStore}
          seat={seat}
          onUnderWay={setCardsUnderWay}
        />
      </div>
      {/* The quick price too, so its pot is still there after a look at the cards */}
      <div hidden={mode !== "outs"}>
        <OutsQuickCalc
          rule={rule}
          seats={seats}
          store={handStore}
          seat={seat}
          createHand={createHand}
          onUnderWay={setOutsUnderWay}
        />
      </div>
    </>
  );
}
