import {
  formatOdds,
  type HandOffer,
  type InsuranceRule,
  parseChips,
  priceOption,
  type QuoteOption,
  soldOuts,
} from "@holdem-knight/core";
import { useId, useState } from "react";
import { formatCardText } from "@/lib/cards";
import { formatSignedChips, netColor } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { type Decisions, LeaderQuote } from "./LeaderQuote";
import { PotLegend, PotRing, type PotShare } from "./PotShares";
import { DecisionBar } from "./QuotePanel";

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

function Block({ offer, label, nameOf, rule, decisions }: PotInsuranceProps) {
  const { leader, input, quote, pot } = offer;
  const parts = potParts(offer, nameOf);
  const tied = pot.leaders.length > 1;
  const customId = useId();
  const [choice, setChoice] = useState<Choice>();
  const [customText, setCustomText] = useState("");

  const header = (
    <h3 className="flex items-baseline justify-between gap-2">
      <span className="text-sm text-muted">
        {label}
        {tied && ` · ${nameOf(leader.playerId)} 并列领先`}
      </span>
      <span className="text-2xl font-semibold tabular-nums">{chipText(pot.amountChips)}</span>
    </h3>
  );
  const sectionClass = "mt-3 rounded-xl border border-line bg-surface p-3";

  if (!quote.ok) {
    return (
      <section aria-label={`${label}保险`} className={sectionClass}>
        {header}
        <div className="mt-2 flex items-center gap-1.5">
          <PotRing parts={parts} total={pot.amountChips} />
          <PotLegend parts={parts} total={pot.amountChips} plain />
        </div>
        <LeaderQuote
          id={offer.key}
          decisionKey={offer.key}
          input={input}
          playerId={leader.playerId}
          saving={undefined}
          decisions={decisions}
        />
      </section>
    );
  }

  const { oddsHundredths, maxPremiumChips, stake, halfPot, fullPot } = quote;
  const standard: readonly { id: Choice; label: string; note?: string; option: QuoteOption }[] = [
    { id: "stake", label: "保本", ...(halfPot ? {} : { note: "即半池" }), option: stake },
    ...(halfPot ? [{ id: "half" as const, label: "半池", option: halfPot }] : []),
    { id: "full", label: "满池", option: fullPot },
  ];

  const decision = decisions?.get(offer.key);
  const locked = decision !== undefined;
  const bought = decision?.kind === "bought" ? decision : undefined;
  // What was bought stays picked out: on its own row, or as the custom premium it was
  const boughtRow = bought && standard.find((r) => r.option.premiumChips === bought.premiumChips);
  const picked: Choice | undefined = bought ? (boughtRow?.id ?? "custom") : choice;
  const shown = locked && !bought ? undefined : picked;

  const customPremium = bought && !boughtRow ? bought.premiumChips : (parseChips(customText) ?? 0);
  const tooHigh = customPremium > maxPremiumChips;
  const customOption =
    customPremium > 0 && !tooHigh ? priceOption(input, oddsHundredths, customPremium) : undefined;
  const chosen = shown === "custom" ? customOption : standard.find((r) => r.id === shown)?.option;

  const ties = leader.tieCards.length;
  const opponents = leader.byOpponent;

  return (
    <section aria-label={`${label}保险`} className={sectionClass}>
      {header}
      <div className="mt-2 flex items-center gap-1.5">
        <PotRing
          parts={parts}
          total={pot.amountChips}
          cover={chosen ? chosen.ifHitChips / input.shareChips : 0}
        >
          {chosen && (
            <>
              <span className="text-[10px] leading-none text-muted">保住</span>
              <span className="text-[13px] leading-tight font-semibold tabular-nums">
                {Math.round((chosen.ifHitChips / input.shareChips) * 100)}%
              </span>
            </>
          )}
        </PotRing>
        <PotLegend parts={parts} total={pot.amountChips} plain />
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2 border-t border-line pt-2">
        <span className="font-semibold whitespace-nowrap">赔 {formatOdds(oddsHundredths)} 倍</span>
        <span className="text-right text-sm text-muted">
          反超牌 {soldOuts(rule, leader)} 张
          {ties > 0 &&
            `，平分牌 ${ties} 张${rule.tieOuts === "include" ? "（已计入）" : "（不计入）"}`}
        </span>
      </div>
      <ul className="text-right text-xs text-muted">
        {opponents.map(({ playerId, cards }) => (
          <li key={playerId}>
            {opponents.length > 1 && `${nameOf(playerId)}：`}
            {cards.map(formatCardText).join(" ")}
          </li>
        ))}
        {ties > 0 && <li>平分：{leader.tieCards.map(formatCardText).join(" ")}</li>}
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
          <input
            id={customId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="保费"
            aria-label="自定义保费"
            value={bought && !boughtRow ? String(bought.premiumChips) : customText}
            onFocus={() => setChoice("custom")}
            onChange={(event) =>
              setCustomText(event.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""))
            }
            className="h-9 w-full min-w-0 rounded-md border border-line bg-bg px-1 text-right text-base font-semibold text-highlight tabular-nums outline-none placeholder:text-sm placeholder:font-normal placeholder:text-muted focus:border-highlight"
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
        {shown === "custom" && tooHigh && (
          <p role="alert" className="px-2 text-sm text-highlight">
            保费最多 {chipText(maxPremiumChips)}，也就是满池。
          </p>
        )}
      </fieldset>

      {decisions && decision && (
        <DecisionBar
          decision={decision}
          saving={undefined}
          onRevise={() => decisions.revise(offer.key)}
        />
      )}
      {decisions && !decision && (
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
          <button
            type="button"
            disabled={!chosen}
            onClick={() =>
              chosen &&
              decisions.buy(offer.key, {
                option: chosen,
                oddsHundredths,
                playerId: leader.playerId,
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
            onClick={() => decisions.decline(offer.key)}
            className="min-h-12 rounded-xl border border-line px-4 font-medium"
          >
            不购买
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * One pot with one leader, as a single block: the pot as a ring, and the leader's covers under it.
 * Picking a cover lights the ring's inner track for the share of the pot a hit would still leave.
 */
export function PotInsurance(props: PotInsuranceProps) {
  const { key, quote } = props.offer;
  // Starts over when the price changes, so a typed premium never carries over to different odds
  const price = quote.ok ? `${quote.oddsHundredths}-${quote.maxPremiumChips}` : "blocked";
  return <Block key={`${key}-${price}`} {...props} />;
}
