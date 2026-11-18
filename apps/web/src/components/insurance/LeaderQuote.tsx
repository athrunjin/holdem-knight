import type { InsuranceStreet } from "@holdem-knight/core";
import type { QuoteDecision, QuotePurchase } from "./QuoteDecision";

export interface BoughtInsurance extends QuotePurchase {
  readonly playerId: string;
  readonly outs: number;
  /** The cards sold split the pot */
  readonly tie?: boolean;
  readonly street: InsuranceStreet;
}

/** What has been decided for each offer, by a key for that exact offer. */
export interface Decisions {
  get: (key: string) => QuoteDecision | undefined;
  buy: (key: string, purchase: BoughtInsurance) => void | Promise<void>;
  decline: (key: string) => void;
  revise: (key: string) => void;
  /**
   * Says whether the card came for what was bought on an offer, and lets the offer go: the next
   * pot starts with nothing decided. Missing where a hand settles its own cards as they are dealt.
   */
  settle?: (key: string, hit: boolean) => void;
}
