import type { InsuranceHand, InsuranceRule } from "@holdem-knight/core";
import { useState } from "react";
import { type HandStore, InsuranceHandFlow, type SeatChips } from "./InsuranceHandFlow";
import type { BoughtInsurance, Decisions } from "./LeaderQuote";
import { OutsQuickCalc } from "./OutsQuickCalc";
import type { QuoteDecision } from "./QuoteDecision";

export type { BoughtInsurance } from "./LeaderQuote";

export interface InsuranceSeat {
  readonly id: string;
  readonly name: string;
  /** The chips the player has at the table, which a hand starts their stake from. Zero away from a game. */
  readonly chips?: number;
}

export interface InsuranceRecorder {
  /** Resolves to the purchase's ID, or undefined if it was not saved. */
  onBuy: (purchase: BoughtInsurance) => Promise<string | undefined>;
  /** Takes a purchase back for changing. False if the organizer kept it. */
  onRevise: (purchaseId: string) => boolean;
  /** Purchases still in effect. */
  boughtIds: ReadonlySet<string>;
}

/** Working from the cards of a hand, or from a count of outs for a quick price. */
export type InsuranceMode = "cards" | "outs";

interface InsuranceCalculatorProps {
  /** Which of the two is on show. The page picks it, in its title. */
  mode: InsuranceMode;
  rule: InsuranceRule;
  seats: readonly InsuranceSeat[];
  saving?: boolean | undefined;
  /** Missing for the standalone calculator, which records nothing. */
  recorder?: InsuranceRecorder;
  handStore?: HandStore;
  seat?: SeatChips | undefined;
  /** The hand in progress, to carry on from. */
  openHand?: InsuranceHand | undefined;
  createHand: () => InsuranceHand;
}

function useDecisions(recorder: InsuranceRecorder | undefined): Decisions | undefined {
  const [decided, setDecided] = useState<ReadonlyMap<string, QuoteDecision>>(new Map());
  if (!recorder) return undefined;

  const write = (key: string, decision: QuoteDecision | undefined) =>
    setDecided((current) => {
      const next = new Map(current);
      if (decision) next.set(key, decision);
      else next.delete(key);
      return next;
    });

  return {
    get(key) {
      const decision = decided.get(key);
      // A purchase undone from the records below is open again
      return decision?.kind === "bought" && !recorder.boughtIds.has(decision.purchaseId)
        ? undefined
        : decision;
    },
    async buy(key, purchase) {
      const { premiumChips, payoutChips } = purchase.option;
      const purchaseId = await recorder.onBuy(purchase);
      if (purchaseId) write(key, { kind: "bought", purchaseId, premiumChips, payoutChips });
    },
    decline: (key) => write(key, { kind: "declined" }),
    revise(key) {
      const decision = decided.get(key);
      if (decision?.kind === "bought" && !recorder.onRevise(decision.purchaseId)) return;
      write(key, undefined);
    },
  };
}

/** Works out insurance from the cards, or from an outs count for a quick price. */
export function InsuranceCalculator({
  recorder,
  handStore,
  seat,
  openHand,
  createHand,
  rule,
  seats,
  saving,
  mode,
}: InsuranceCalculatorProps) {
  const decisions = useDecisions(recorder);
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
        />
      </div>
      {/* The quick price too, so its pot is still there after a look at the cards */}
      <div hidden={mode !== "outs"}>
        <OutsQuickCalc
          rule={rule}
          seats={seats}
          onStack={handStore?.enterStack}
          saving={saving}
          decisions={decisions}
        />
      </div>
    </>
  );
}
