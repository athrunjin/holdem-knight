import type { InsuranceHand, InsuranceRule, TieOuts } from "@holdem-knight/core";
import { useState } from "react";
import { MiniSwitch } from "@/components/MiniSwitch";
import { cn } from "@/lib/cn";
import { type HandStore, InsuranceHandFlow, type SeatChips } from "./InsuranceHandFlow";
import type { BoughtInsurance, Decisions } from "./LeaderQuote";
import { OutsQuickCalc } from "./OutsQuickCalc";
import type { QuoteDecision } from "./QuotePanel";

export type { BoughtInsurance } from "./LeaderQuote";

export interface InsuranceSeat {
  readonly id: string;
  readonly name: string;
}

export interface InsuranceRecorder {
  /** Resolves to the purchase's ID, or undefined if it was not saved. */
  onBuy: (purchase: BoughtInsurance) => Promise<string | undefined>;
  /** Takes a purchase back for changing. False if the organizer kept it. */
  onRevise: (purchaseId: string) => boolean;
  /** Purchases still in effect. */
  boughtIds: ReadonlySet<string>;
}

interface InsuranceCalculatorProps {
  rule: InsuranceRule;
  /** Switches whether tie cards are sold as outs. Whoever owns the rule decides what that changes. */
  onTieOutsChange: (tieOuts: TieOuts) => void;
  seats: readonly InsuranceSeat[];
  /** Hands out the seats in order instead of asking who is all-in: the standalone calculator has no table. */
  autoSeat?: boolean;
  saving?: boolean | undefined;
  /** Missing for the standalone calculator, which records nothing. */
  recorder?: InsuranceRecorder;
  handStore?: HandStore;
  seat?: SeatChips | undefined;
  /** The hand in progress, to carry on from. */
  openHand?: InsuranceHand | undefined;
  createHand: () => InsuranceHand;
}

const toggleClass = (active: boolean) =>
  cn(
    "min-h-11 rounded-xl border px-3 font-medium",
    active ? "border-accent bg-accent text-accent-text" : "border-line bg-surface",
  );

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
  onTieOutsChange,
  seats,
  autoSeat = false,
  saving,
}: InsuranceCalculatorProps) {
  const [mode, setMode] = useState<"cards" | "outs">("cards");
  const decisions = useDecisions(recorder);
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-pressed={mode === "cards"}
          onClick={() => setMode("cards")}
          className={toggleClass(mode === "cards")}
        >
          选牌计算
        </button>
        <button
          type="button"
          aria-pressed={mode === "outs"}
          onClick={() => setMode("outs")}
          className={toggleClass(mode === "outs")}
        >
          Outs数速算
        </button>
      </div>
      <MiniSwitch
        label="平分牌算 outs"
        checked={rule.tieOuts === "include"}
        onChange={(checked) => onTieOutsChange(checked ? "include" : "exclude")}
        className="ml-auto"
      />
      {/* Stays mounted, so looking at the other mode keeps the hand */}
      <div hidden={mode !== "cards"}>
        <InsuranceHandFlow
          rule={rule}
          seats={seats}
          autoSeat={autoSeat}
          open={openHand}
          createHand={createHand}
          store={handStore}
          seat={seat}
        />
      </div>
      {mode === "outs" && (
        <OutsQuickCalc
          rule={rule}
          seats={seats}
          autoSeat={autoSeat}
          saving={saving}
          decisions={decisions}
        />
      )}
    </>
  );
}
