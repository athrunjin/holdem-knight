import {
  formatOdds,
  type HandOffer,
  type InsuranceRule,
  parseChips,
  priceOption,
  type QuoteInput,
  type QuoteOption,
  quoteInsurance,
  soldOuts,
} from "@holdem-knight/core";
import { useId, useState } from "react";
import { formatCardText } from "@/lib/cards";
import { formatSignedChips, netColor } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { formatOddsText, selectOnFocus } from "@/lib/number-input";
import type { Decisions } from "./LeaderQuote";
import { PotLegend, PotRing, type PotShare } from "./PotShares";
import { DecisionBar, QuotePanel } from "./QuotePanel";

interface PotInsuranceProps {
  /** One leader's offer on one pot. */
  offer: HandOffer;
  /** The pot's name: 主池, 边池 and so on. */
  label: string;
  nameOf: (id: string) => string;
  rule: InsuranceRule;
  /** Missing for the standalone calculator, which prices covers but records nothing. */
  decisions: Decisions | undefined;
}

interface PotCoverProps {
  /** What heads the block: the pot's name, and whose lead it is when that needs saying. */
  label: string;
  /** Who put what into the pot, leaders first. */
  parts: readonly PotShare[];
  input: QuoteInput;
  /** The buyer. */
  playerId: string;
  /** Tells this offer's decision from any other's. */
  decisionKey: string;
  /** What is sold, in words, before the odds: 反超 2 张. */
  outsText: string;
  /** The cards sold, a line for each opponent, where the cards are known. */
  outsLines?: readonly string[];
  saving?: boolean | undefined;
  /** Missing for the standalone calculator, which prices covers but records nothing. */
  decisions: Decisions | undefined;
}

type Choice = "stake" | "half" | "full" | "custom";

const chipText = (chips: number) => chips.toLocaleString("zh-CN");

const rowClass =
  "grid min-h-11 w-full grid-cols-[1fr_repeat(4,3.6rem)] items-center gap-1 rounded-lg border px-2 py-1 text-right tabular-nums";

/** A result either way. On the cover picked it also says what that leaves the buyer up or down. */
function Result({ chips, net }: { chips: number | undefined; net: number | undefined }) {
  return (
    <span>
      <span className="block">{chips === undefined ? "—" : chipText(chips)}</span>
      {net !== undefined && (
        <span className={cn("block text-[11px] leading-tight", netColor(net))}>
          {formatSignedChips(net)}
        </span>
      )}
    </span>
  );
}

function CoverRow({
  label,
  note,
  option,
  selected,
  faded,
  stakeChips,
  onSelect,
}: {
  label: string;
  /** A second name for the same cover. */
  note?: string | undefined;
  option: QuoteOption;
  selected: boolean;
  faded: boolean;
  stakeChips: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        rowClass,
        selected ? "border-accent" : "border-transparent",
        faded && "opacity-50 grayscale",
      )}
    >
      <span className="text-left font-medium">
        {label}
        {note && <span className="block text-xs whitespace-nowrap text-muted">{note}</span>}
        {option.capped && <span className="block text-xs text-highlight">已到上限</span>}
      </span>
      <span className="font-semibold text-highlight">{chipText(option.premiumChips)}</span>
      <span>{chipText(option.payoutChips)}</span>
      <Result
        chips={option.ifHitChips}
        net={selected ? option.ifHitChips - stakeChips : undefined}
      />
      <Result
        chips={option.ifMissChips}
        net={selected ? option.ifMissChips - stakeChips : undefined}
      />
    </button>
  );
}

const percentText = (share: number) => `${(share * 100).toFixed(1)}%`;

/**
 * The pot by who put it in: its leaders first with their chance to win it, then the players behind
 * with their outs against this offer's leader, then any dead money.
 */
function potParts(
  { pot, potIndex, leader }: HandOffer,
  nameOf: (id: string) => string,
): PotShare[] {
  const leaders = pot.leaders.map((l) => l.playerId);
  const live = pot.playerIds.map((playerId): PotShare => {
    const leading = leaders.includes(playerId);
    const chance = percentText(pot.equity[playerId] ?? 0);
    const outs = leader.byOpponent.find((o) => o.playerId === playerId)?.cards.length ?? 0;
    return {
      key: playerId,
      tone: leading ? "leader" : "trailer",
      label: nameOf(playerId),
      chips: pot.stakes[playerId] ?? 0,
      note: leading ? chance : `Outs ${outs} · ${chance}`,
    };
  });
  const deadChips = pot.amountChips - live.reduce((sum, { chips }) => sum + chips, 0);
  return [
    ...live.filter(({ tone }) => tone === "leader"),
    ...live.filter(({ tone }) => tone !== "leader"),
    // The main pot always lists dead money, even at zero; a side pot only when it holds some
    ...(potIndex === 0 || deadChips > 0
      ? [{ key: "dead-money", tone: "dead" as const, label: "死钱", chips: deadChips }]
      : []),
  ];
}

function Block({
  label,
  parts,
  input,
  playerId,
  decisionKey,
  outsText,
  outsLines = [],
  saving,
  decisions,
}: PotCoverProps) {
  const quote = quoteInsurance(input);
  const customId = useId();
  // The stake cover is picked on arrival, so the block opens on a price and not on a blank
  const [choice, setChoice] = useState<Choice>("stake");
  const [customText, setCustomText] = useState("");
  const [customFocused, setCustomFocused] = useState(false);
  // Selling a cover to each leader on its own. Only the switch for now: it changes nothing yet.
  const [split, setSplit] = useState(false);

  const header = (
    <h3 className="flex items-baseline justify-between gap-2">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{chipText(input.potChips)}</span>
    </h3>
  );
  const sectionClass = "mt-3 rounded-xl border border-line bg-surface p-3";

  if (!quote.ok) {
    return (
      <section aria-label={`${label}保险`} className={sectionClass}>
        {header}
        <div className="mt-2 flex items-center gap-1.5">
          <PotRing parts={parts} total={input.potChips} />
          <PotLegend parts={parts} total={input.potChips} plain />
        </div>
        <QuotePanel id={decisionKey} input={input} />
      </section>
    );
  }

  const { oddsHundredths, maxPremiumChips, stake, halfPot, fullPot } = quote;
  const standard: readonly { id: Choice; label: string; note?: string; option: QuoteOption }[] = [
    { id: "stake", label: "保本", ...(halfPot ? {} : { note: "即半池" }), option: stake },
    ...(halfPot ? [{ id: "half" as const, label: "半池", option: halfPot }] : []),
    { id: "full", label: "满池", option: fullPot },
  ];

  const decision = decisions?.get(decisionKey);
  const locked = decision !== undefined;
  const bought = decision?.kind === "bought" ? decision : undefined;
  // What was bought stays picked out: on its own row, or as the custom premium it was
  const boughtRow = bought && standard.find((r) => r.option.premiumChips === bought.premiumChips);
  const picked: Choice | undefined = bought ? (boughtRow?.id ?? "custom") : choice;
  const shown = locked && !bought ? undefined : picked;

  // Typed premiums are held within what is on sale, so a custom one is priced as soon as it is typed
  const customPremium = bought && !boughtRow ? bought.premiumChips : (parseChips(customText) ?? 0);
  const customOption =
    customPremium > 0 && customPremium <= maxPremiumChips
      ? priceOption(input, oddsHundredths, customPremium)
      : undefined;
  const chosen = shown === "custom" ? customOption : standard.find((r) => r.id === shown)?.option;
  const chosenLabel = shown === "custom" ? "自定义" : standard.find((r) => r.id === shown)?.label;

  return (
    <section aria-label={`${label}保险`} className={sectionClass}>
      {header}
      <div className="mt-2 flex items-center gap-1.5">
        <PotRing
          parts={parts}
          total={input.potChips}
          cover={{
            premium: chosen ? chosen.premiumChips / input.shareChips : 0,
            kept: chosen ? chosen.ifHitChips / input.shareChips : 0,
          }}
        >
          {chosen && (
            <>
              <span className="text-[10px] leading-none text-muted">{chosenLabel}</span>
              <span className="text-[13px] leading-tight font-semibold tabular-nums">
                {Math.round((chosen.ifHitChips / input.shareChips) * 100)}%
              </span>
            </>
          )}
        </PotRing>
        <PotLegend parts={parts} total={input.potChips} plain />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
        <span className="font-semibold whitespace-nowrap">
          {outsText} · 赔 {formatOddsText(formatOdds(oddsHundredths))}
        </span>
        {/* Ends under the chips of the legend above, which sit a little in from the edge */}
        <button
          type="button"
          role="switch"
          aria-checked={split}
          onClick={() => setSplit(!split)}
          className={cn(
            "-my-2.5 mr-1 flex min-h-11 shrink-0 items-center gap-1.5 text-sm transition-colors",
            split ? "text-text" : "text-muted",
          )}
        >
          分开购买
          <span
            aria-hidden
            className={cn(
              "relative h-4.5 w-8 rounded-full transition-colors after:absolute after:top-0.5 after:size-3.5 after:rounded-full after:transition-[left]",
              split ? "bg-text after:left-4 after:bg-bg" : "bg-line after:left-0.5 after:bg-muted",
            )}
          />
        </button>
      </div>
      <ul className="text-xs text-muted">
        {outsLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      {/* Once decided, the covers not taken fade and the one bought stays as it was picked */}
      <fieldset disabled={locked} className="mt-2">
        <div className="grid grid-cols-[1fr_repeat(4,3.6rem)] gap-1 px-2 text-right text-xs text-muted">
          <span />
          <span>保费</span>
          <span>赔付</span>
          <span>中了到手</span>
          <span>没中到手</span>
        </div>
        {standard.map(({ id, label, note, option }) => (
          <CoverRow
            key={id}
            label={label}
            note={note}
            option={option}
            selected={shown === id}
            faded={locked && shown !== id}
            stakeChips={input.stakeChips}
            onSelect={() => setChoice(id)}
          />
        ))}
        {/* A label, so a tap anywhere on the line lands in the premium */}
        <label
          htmlFor={customId}
          className={cn(
            rowClass,
            shown === "custom" ? "border-accent" : "border-transparent",
            locked && shown !== "custom" && "opacity-50 grayscale",
          )}
        >
          <span className="text-left font-medium">自定义</span>
          {/* No box of its own: a dash like the cells after it until a premium is typed */}
          <input
            id={customId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="done"
            // A dash while the row is not being typed in, like the cells after it
            placeholder={customFocused ? "" : "—"}
            aria-label={`自定义保费，1 到 ${maxPremiumChips} 的整数`}
            value={bought && !boughtRow ? String(bought.premiumChips) : customText}
            onFocus={(event) => {
              setChoice("custom");
              setCustomFocused(true);
              // Opens on a selected 0 in place of the dash, so the first digit typed replaces it
              if (customText === "") setCustomText("0");
              selectOnFocus(event.currentTarget);
            }}
            onBlur={() => {
              setCustomFocused(false);
              // Left with no premium, the cell goes back to its dash
              if ((parseChips(customText) ?? 0) === 0) setCustomText("");
            }}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "").replace(/^0+/, "");
              // Whole chips from 1 up to the most on sale: a larger number stops at that
              setCustomText(digits === "" ? "" : String(Math.min(Number(digits), maxPremiumChips)));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            className="h-9 w-full min-w-0 bg-transparent text-right font-semibold text-highlight tabular-nums outline-none placeholder:font-normal placeholder:text-text"
          />
          <span>{customOption ? chipText(customOption.payoutChips) : "—"}</span>
          <Result
            chips={customOption?.ifHitChips}
            net={
              shown === "custom" && customOption
                ? customOption.ifHitChips - input.stakeChips
                : undefined
            }
          />
          <Result
            chips={customOption?.ifMissChips}
            net={
              shown === "custom" && customOption
                ? customOption.ifMissChips - input.stakeChips
                : undefined
            }
          />
        </label>
      </fieldset>

      {decisions && decision && (
        <DecisionBar
          decision={decision}
          saving={saving}
          onRevise={() => decisions.revise(decisionKey)}
        />
      )}
      {decisions && !decision && (
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
          <button
            type="button"
            disabled={saving || !chosen}
            onClick={() =>
              chosen &&
              decisions.buy(decisionKey, {
                option: chosen,
                oddsHundredths,
                playerId,
                outs: input.outs,
                street: input.street,
              })
            }
            className="min-h-12 rounded-xl bg-accent font-semibold text-accent-text disabled:opacity-60"
          >
            {chosen ? `确认投保 · 保费 ${chipText(chosen.premiumChips)}` : "确认投保"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => decisions.decline(decisionKey)}
            className="min-h-12 rounded-xl border border-line px-4 font-medium disabled:opacity-60"
          >
            不购买
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * A pot and the insurance on it as a single block: the pot as a ring, and the leader's covers under
 * it. Picking a cover lights the ring's inner track for the share of the pot a hit would still leave.
 */
export function PotCover(props: PotCoverProps) {
  const quote = quoteInsurance(props.input);
  // Starts over when the price changes, so a typed premium never carries over to different odds
  const price = quote.ok ? `${quote.oddsHundredths}-${quote.maxPremiumChips}` : "blocked";
  return <Block key={`${props.decisionKey}-${price}`} {...props} />;
}

/** The block for one leader's offer on one pot of a hand worked out from the cards. */
export function PotInsurance({ offer, label, nameOf, rule, decisions }: PotInsuranceProps) {
  const { leader, pot } = offer;
  const ties = leader.tieCards.length;
  const counted = rule.tieOuts === "include" ? "（已计入）" : "（不计入）";
  return (
    <PotCover
      label={pot.leaders.length > 1 ? `${label} · ${nameOf(leader.playerId)} 并列领先` : label}
      parts={potParts(offer, nameOf)}
      input={offer.input}
      playerId={leader.playerId}
      decisionKey={offer.key}
      outsText={`反超 ${soldOuts(rule, leader)} 张`}
      outsLines={[
        ...leader.byOpponent.map(
          ({ playerId, cards }) =>
            `${leader.byOpponent.length > 1 ? `${nameOf(playerId)}：` : ""}${cards.map(formatCardText).join(" ")}`,
        ),
        ...(ties > 0
          ? [`平分 ${ties} 张${counted}：${leader.tieCards.map(formatCardText).join(" ")}`]
          : []),
      ]}
      decisions={decisions}
    />
  );
}
