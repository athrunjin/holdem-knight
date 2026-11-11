import type { InsuranceStreet } from "@holdem-knight/core";
import type { QuoteDecision, QuotePurchase } from "./QuotePanel";

export interface BoughtInsurance extends QuotePurchase {
  readonly playerId: string;
  readonly outs: number;
  readonly street: InsuranceStreet;
}

/** What has been decided for each offer, by a key for that exact offer. */
export interface Decisions {
  get: (key: string) => QuoteDecision | undefined;
  buy: (key: string, purchase: BoughtInsurance) => void | Promise<void>;
  decline: (key: string) => void;
  revise: (key: string) => void;
}
