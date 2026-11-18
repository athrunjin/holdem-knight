import type { QuoteBlock, QuoteOption } from "@holdem-knight/core";

const BLOCK_TEXT: Record<QuoteBlock, string> = {
  "tied-lead": "并列领先，不能投保",
  "no-outs": "没有反超牌，不需要保险",
  "too-many-outs": "outs 超出赔率表，不能投保",
  "pot-too-small": "底池太小，1 个筹码的保费赔付就超过底池，不能投保",
};

const chipText = (chips: number) => chips.toLocaleString("zh-CN");

export interface QuotePurchase {
  readonly option: QuoteOption;
  readonly oddsHundredths: number;
}

export type QuoteDecision =
  | {
      readonly kind: "bought";
      readonly purchaseId: string;
      readonly premiumChips: number;
      readonly payoutChips: number;
    }
  | { readonly kind: "declined" };

/** Why a pot has no insurance to sell, in place of its covers. */
export function QuoteBlocked({ block }: { block: QuoteBlock }) {
  return <p className="mt-2 text-sm text-muted">{BLOCK_TEXT[block]}</p>;
}

/** What was decided for an offer, with the way back to change it. */
export function DecisionBar({
  decision,
  saving,
  onRevise,
}: {
  decision: QuoteDecision;
  saving: boolean | undefined;
  onRevise: (() => void) | undefined;
}) {
  return (
    <div
      role="status"
      className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-line bg-bg p-2"
    >
      {decision.kind === "bought" ? (
        // The payout is on the row bought, just above
        <p className="min-w-0 font-semibold">已投保 · 保费 {chipText(decision.premiumChips)}</p>
      ) : (
        <p className="min-w-0 font-semibold">已选择不购买</p>
      )}
      <button
        type="button"
        disabled={saving}
        onClick={onRevise}
        className="min-h-11 shrink-0 rounded-xl bg-accent px-5 font-semibold text-accent-text disabled:opacity-60"
      >
        修改
      </button>
    </div>
  );
}
