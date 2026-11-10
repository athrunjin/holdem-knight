import {
  formatOdds,
  type InsuranceQuote,
  priceOption,
  type QuoteBlock,
  type QuoteInput,
  type QuoteOption,
  quoteInsurance,
} from "@holdem-knight/core";
import { Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { PremiumDialog } from "./PremiumDialog";

const BLOCK_TEXT: Record<QuoteBlock, string> = {
  "tied-lead": "并列领先，不能投保",
  "street-closed": "当前规则不卖转牌保险",
  "no-outs": "没有反超牌，不需要保险",
  "too-many-outs": "outs 超出赔率表，不能投保",
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

interface QuotePanelProps {
  id: string;
  input: QuoteInput;
  saving?: boolean | undefined;
  /** Locks the offer until the organizer asks to change it. */
  decision?: QuoteDecision | undefined;
  /** These are missing for the standalone calculator, which records nothing. */
  onBuy?: ((purchase: QuotePurchase) => void) | undefined;
  onDecline?: (() => void) | undefined;
  onRevise?: (() => void) | undefined;
}

function OptionRow({
  label,
  note,
  option,
  selected,
  onSelect,
}: {
  label: string;
  /** A second name for the same cover. */
  note?: string | undefined;
  option: QuoteOption;
  selected: boolean;
  onSelect?: (() => void) | undefined;
}) {
  const cells = (
    <>
      <span className="text-left font-medium">
        {label}
        {note && <span className="block text-xs whitespace-nowrap text-muted">{note}</span>}
        {option.capped && <span className="block text-xs text-highlight">已到上限</span>}
      </span>
      <span className="font-semibold text-highlight">{chipText(option.premiumChips)}</span>
      <span>{chipText(option.payoutChips)}</span>
      <span>{chipText(option.ifHitChips)}</span>
      <span>{chipText(option.ifMissChips)}</span>
    </>
  );
  const rowClass = "grid min-h-11 w-full grid-cols-[1fr_repeat(4,3.6rem)] items-center gap-1 px-2";
  if (!onSelect) return <div className={cn(rowClass, "text-right tabular-nums")}>{cells}</div>;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        rowClass,
        "rounded-lg border text-right tabular-nums",
        selected ? "border-accent" : "border-transparent",
      )}
    >
      {cells}
    </button>
  );
}

function DecisionBar({
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
        <p className="min-w-0">
          <span className="block font-semibold">
            已投保 · 保费 {chipText(decision.premiumChips)}
          </span>
          <span className="block text-sm text-muted">赔付 {chipText(decision.payoutChips)}</span>
        </p>
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

function Quote({
  input,
  quote,
  saving,
  decision,
  onBuy,
  onDecline,
  onRevise,
}: QuotePanelProps & { quote: Extract<InsuranceQuote, { ok: true }> }) {
  const { oddsHundredths, maxPremiumChips, stake, halfPot, fullPot } = quote;
  const [choice, setChoice] = useState<"stake" | "half" | "full" | "custom">("full");
  const [customPremium, setCustomPremium] = useState<number>();
  const [editing, setEditing] = useState(false);

  const customOption =
    customPremium === undefined ? undefined : priceOption(input, oddsHundredths, customPremium);
  const chosen = { stake, half: halfPot ?? undefined, full: fullPot, custom: customOption }[choice];
  const locked = decision !== undefined;

  return (
    <div className="mt-2">
      <fieldset disabled={locked} className={cn(locked && "opacity-50 grayscale")}>
        <div className="grid grid-cols-[1fr_repeat(4,3.6rem)] gap-1 px-2 text-right text-xs text-muted">
          <span className="text-left">赔 {formatOdds(oddsHundredths)} 倍</span>
          <span>保费</span>
          <span>赔付</span>
          <span>中了到手</span>
          <span>没中到手</span>
        </div>
        <OptionRow
          label="保本"
          note={halfPot ? undefined : "即半池"}
          option={stake}
          selected={choice === "stake"}
          onSelect={onBuy && (() => setChoice("stake"))}
        />
        {halfPot && (
          <OptionRow
            label="半池"
            option={halfPot}
            selected={choice === "half"}
            onSelect={onBuy && (() => setChoice("half"))}
          />
        )}
        <OptionRow
          label="满池"
          option={fullPot}
          selected={choice === "full"}
          onSelect={onBuy && (() => setChoice("full"))}
        />
        {customOption && (
          <OptionRow
            label="自定义"
            option={customOption}
            selected={choice === "custom"}
            onSelect={onBuy && (() => setChoice("custom"))}
          />
        )}
        <button
          type="button"
          aria-label="自定义保费"
          onClick={() => setEditing(true)}
          className="mt-1 grid min-h-11 w-full place-items-center rounded-lg border border-dashed border-line text-highlight"
        >
          <Plus className="size-5" aria-hidden />
        </button>
      </fieldset>
      {onBuy && locked && <DecisionBar decision={decision} saving={saving} onRevise={onRevise} />}
      {onBuy && !locked && (
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
          <button
            type="button"
            disabled={saving || !chosen}
            onClick={() => chosen && onBuy({ option: chosen, oddsHundredths })}
            className="min-h-12 rounded-xl bg-accent font-semibold text-accent-text disabled:opacity-60"
          >
            {chosen ? `确认投保 · 保费 ${chipText(chosen.premiumChips)}` : "确认投保"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onDecline}
            className="min-h-12 rounded-xl border border-line px-4 font-medium disabled:opacity-60"
          >
            不购买
          </button>
        </div>
      )}
      {editing && (
        <PremiumDialog
          input={input}
          oddsHundredths={oddsHundredths}
          maxPremiumChips={maxPremiumChips}
          initialChips={customPremium ?? 0}
          onConfirm={(premium) => {
            setCustomPremium(premium);
            setChoice("custom");
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}

/** Prices a pot for one buyer: both standard covers, any custom premium, and the result either way. */
export function QuotePanel(props: QuotePanelProps) {
  const quote = quoteInsurance(props.input);
  if (!quote.ok) return <p className="mt-2 text-sm text-muted">{BLOCK_TEXT[quote.block]}</p>;
  // Remount when the price changes, so a typed premium never carries over to different odds
  const key = `${quote.oddsHundredths}-${quote.maxPremiumChips}`;
  return <Quote key={key} {...props} quote={quote} />;
}
