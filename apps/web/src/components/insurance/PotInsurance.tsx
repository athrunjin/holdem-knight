import {
  formatOdds,
  type HandOffer,
  type InsuranceQuote,
  type InsuranceRule,
  type OfferKind,
  parseChips,
  priceOption,
  type QuoteInput,
  type QuoteOption,
  quoteInsurance,
} from "@holdem-knight/core";
import { useId, useRef, useState } from "react";
import { formatCardText } from "@/lib/cards";
import { formatSignedChips, netColor } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { formatOddsText, selectOnFocus } from "@/lib/number-input";
import type { Decisions } from "./LeaderQuote";
import { PotLegend, PotRing, type PotShare } from "./PotShares";
import { DecisionBar, QuoteBlocked, type QuoteDecision } from "./QuoteDecision";

interface PotInsuranceProps {
  /** One leader's offers on one pot: the cards that overtake, then the tie cards, as far as there are any. */
  offers: readonly HandOffer[];
  /** The pot's name: 主池, 边池 and so on. */
  label: string;
  nameOf: (id: string) => string;
  rule: InsuranceRule;
  /** Missing for the standalone calculator, which prices covers but records nothing. */
  decisions: Decisions | undefined;
}

/** One kind of card sold on a pot, with its own covers and its own decision. */
export interface PotCoverOffer {
  readonly kind: OfferKind;
  readonly input: QuoteInput;
  /** The buyer. */
  readonly playerId: string;
  /** Tells this offer's decision from any other's. */
  readonly decisionKey: string;
  /** What is sold, in words, before the odds: 反超 2 张, 平分 4 张. */
  readonly outsText: string;
  /** The cards sold, a line for each opponent, where the cards are known. */
  readonly outsLines?: readonly string[];
}

interface PotCoverProps {
  /** What heads the block: the pot's name, and whose lead it is when that needs saying. */
  label: string;
  /** Who put what into the pot, leaders first. */
  parts: readonly PotShare[];
  potChips: number;
  /** What is on sale on the pot, in the order shown. Never empty. */
  offers: readonly PotCoverOffer[];
  saving?: boolean | undefined;
  /** Missing for the standalone calculator, which prices covers but records nothing. */
  decisions: Decisions | undefined;
}

type Choice = "stake" | "half" | "full" | "custom";

const chipText = (chips: number) => chips.toLocaleString("zh-CN");

/**
 * A row of the cover table. Its figures are a size under the text, so five digits sit easily in a
 * column and six still fit on a phone 393px wide.
 */
const rowClass =
  "grid min-h-11 w-full grid-cols-[1fr_repeat(4,3.6rem)] items-center gap-1 rounded-lg border px-2 py-1 text-right text-sm whitespace-nowrap tabular-nums";

/** The name of a row, at the size of the text. */
const rowNameClass = "text-left text-base font-medium";

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
      <span className={rowNameClass}>
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

/** The cover picked for one offer, and a custom premium as typed. */
interface Pick {
  readonly choice: Choice;
  readonly customText: string;
}

// The stake cover is picked on arrival, so an offer opens on a price and not on a blank
const FIRST_PICK: Pick = { choice: "stake", customText: "" };

const KIND_TEXT: Record<OfferKind, string> = { overtake: "反超", tie: "平分" };

type PricedQuote = Extract<InsuranceQuote, { ok: true }>;

/**
 * An offer's covers and which of them shows as picked, from what was picked and what was decided.
 * Cards that overtake are covered up to the whole pot, 满池. Tie cards are covered up to what a
 * tie can cost, 封顶, which is a row of its own only where it is more than the rows before it:
 * between two players it is half the pot, and 半池 already says that.
 */
function coverView(
  kind: OfferKind,
  input: QuoteInput,
  quote: PricedQuote,
  { choice, customText }: Pick,
  decision: QuoteDecision | undefined,
) {
  const { oddsHundredths, maxPremiumChips, stake, halfPot, fullPot } = quote;
  const smaller: readonly { id: Choice; label: string; note?: string; option: QuoteOption }[] = [
    { id: "stake", label: "保本", ...(halfPot ? {} : { note: "即半池" }), option: stake },
    ...(halfPot ? [{ id: "half" as const, label: "半池", option: halfPot }] : []),
  ];
  const most = Math.max(...smaller.map(({ option }) => option.premiumChips));
  const standard = [
    ...smaller,
    ...(kind === "overtake"
      ? [{ id: "full" as const, label: "满池", option: fullPot }]
      : fullPot.premiumChips > most
        ? [{ id: "full" as const, label: "封顶", option: fullPot }]
        : []),
  ];
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
  return {
    standard,
    locked,
    shown,
    customOption,
    chosen,
    chosenLabel,
    /** The premium to show in the custom cell */
    customValue: bought && !boughtRow ? String(bought.premiumChips) : customText,
  };
}

/** One offer's covers under the pot: what is sold and at what odds, the table, and its own decision. */
function CoverTable({
  offer,
  quote,
  pick,
  onPick,
  saving,
  decisions,
}: {
  offer: PotCoverOffer;
  quote: PricedQuote;
  pick: Pick;
  /** Called with every row picked and every premium typed, which also puts this offer in the ring */
  onPick: (pick: Pick) => void;
  saving: boolean | undefined;
  decisions: Decisions | undefined;
}) {
  const { input, decisionKey, outsText, outsLines = [], kind } = offer;
  const customId = useId();
  const customRef = useRef<HTMLInputElement>(null);
  const [customFocused, setCustomFocused] = useState(false);
  // Selling a cover to each leader on its own. Only the switch for now: it changes nothing yet.
  const [split, setSplit] = useState(false);

  const decision = decisions?.get(decisionKey);
  const { oddsHundredths, maxPremiumChips } = quote;
  const { standard, locked, shown, customOption, chosen, customValue } = coverView(
    kind,
    input,
    quote,
    pick,
    decision,
  );
  const { customText } = pick;

  return (
    <div className="mt-2 border-t border-line pt-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold whitespace-nowrap">
          {outsText} · 赔 {formatOddsText(formatOdds(oddsHundredths))}
        </span>
        {/* Tie cards are sold as they are, so only the cards that overtake have the switch.
            It ends under the chips of the legend above, which sit a little in from the edge. */}
        {kind === "overtake" && (
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
                split
                  ? "bg-text after:left-4 after:bg-bg"
                  : "bg-line after:left-0.5 after:bg-muted",
              )}
            />
          </button>
        )}
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
            onSelect={() => onPick({ ...pick, choice: id })}
          />
        ))}
        {/*
          A label, so a tap anywhere on the line lands in the premium while there is none to keep.
          Once a premium is typed, only a tap on the premium itself goes into it: anywhere else on
          the line just picks the line.
        */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: the premium inside takes the keyboard; the line is only a larger place to tap */}
        <label
          htmlFor={customId}
          onClick={(event) => {
            if (locked || !customOption || event.target === customRef.current) return;
            event.preventDefault();
            onPick({ ...pick, choice: "custom" });
          }}
          className={cn(
            rowClass,
            shown === "custom" ? "border-accent" : "border-transparent",
            locked && shown !== "custom" && "opacity-50 grayscale",
          )}
        >
          <span className={rowNameClass}>自定义</span>
          {/* No box of its own: a dash like the cells after it until a premium is typed */}
          <input
            ref={customRef}
            id={customId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="done"
            // A dash while the row is not being typed in, like the cells after it
            placeholder={customFocused ? "" : "—"}
            aria-label={`自定义保费，1 到 ${maxPremiumChips} 的整数`}
            value={customValue}
            onFocus={(event) => {
              setCustomFocused(true);
              // Opens on a selected 0 in place of the dash, so the first digit typed replaces it
              onPick({ choice: "custom", customText: customText === "" ? "0" : customText });
              selectOnFocus(event.currentTarget);
            }}
            onBlur={() => {
              setCustomFocused(false);
              // Left with no premium, the cell goes back to its dash
              if ((parseChips(customText) ?? 0) === 0) onPick({ ...pick, customText: "" });
            }}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "").replace(/^0+/, "");
              // Whole chips from 1 up to the most on sale: a larger number stops at that
              onPick({
                choice: "custom",
                customText: digits === "" ? "" : String(Math.min(Number(digits), maxPremiumChips)),
              });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            // Kept at 16px, under which a phone zooms the page on focus, and drawn at the size of
            // the figures around it: wider than its column by as much as it is then scaled down
            className="-ml-[calc(100%/0.875-100%)] h-9 w-[calc(100%/0.875)] min-w-0 origin-right scale-[0.875] bg-transparent text-right text-base font-semibold text-highlight tabular-nums outline-none placeholder:font-normal placeholder:text-text"
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
                playerId: offer.playerId,
                outs: input.outs,
                street: input.street,
                ...(kind === "tie" && { tie: true }),
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
    </div>
  );
}

function Block({ label, parts, potChips, offers, saving, decisions }: PotCoverProps) {
  const [picks, setPicks] = useState<Readonly<Record<string, Pick>>>({});
  // The offer a row was last picked in, which is the one the ring draws. The first until then.
  const [touched, setTouched] = useState<string>();
  const pickOf = (key: string) => picks[key] ?? FIRST_PICK;

  const quoted = offers.map((offer) => ({ offer, quote: quoteInsurance(offer.input) }));
  const active = quoted.find(({ offer }) => offer.decisionKey === touched) ?? quoted[0];
  const ring =
    active?.quote.ok === true
      ? {
          ...coverView(
            active.offer.kind,
            active.offer.input,
            active.quote,
            pickOf(active.offer.decisionKey),
            decisions?.get(active.offer.decisionKey),
          ),
          shareChips: active.offer.input.shareChips,
          // With two kinds of card on sale, the ring says which one its cover is for
          kindText: offers.length > 1 ? KIND_TEXT[active.offer.kind] : "",
        }
      : undefined;
  const cover = ring?.chosen;
  const [only] = quoted;

  return (
    <section
      aria-label={`${label}保险`}
      className="mt-3 rounded-xl border border-line bg-surface p-3"
    >
      <h3 className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-muted">{label}</span>
        <span className="text-2xl font-semibold tabular-nums">{chipText(potChips)}</span>
      </h3>
      <div className="mt-2 flex items-center gap-1.5">
        <PotRing
          parts={parts}
          total={potChips}
          {...(ring && {
            cover: {
              premium: cover ? cover.premiumChips / ring.shareChips : 0,
              payout: cover ? cover.payoutChips / ring.shareChips : 0,
            },
          })}
        >
          {ring && cover && (
            <>
              <span className="text-[11px] leading-none whitespace-nowrap text-muted">
                {ring.kindText}
                {ring.chosenLabel}
              </span>
              <span className="text-[15px] leading-tight font-semibold tabular-nums">
                {/* What the cover pays against the pot share: a full pot reads 100% */}
                {Math.round((cover.payoutChips / ring.shareChips) * 100)}%
              </span>
            </>
          )}
        </PotRing>
        <PotLegend parts={parts} total={potChips} plain />
      </div>

      {quoted.map(({ offer, quote }) =>
        quote.ok ? (
          <CoverTable
            key={offer.decisionKey}
            offer={offer}
            quote={quote}
            pick={pickOf(offer.decisionKey)}
            onPick={(pick) => {
              setPicks((current) => ({ ...current, [offer.decisionKey]: pick }));
              setTouched(offer.decisionKey);
            }}
            saving={saving}
            decisions={decisions}
          />
        ) : quoted.length === 1 && only ? (
          // A pot with nothing to sell says why under the ring, with no heading of its own
          <QuoteBlocked key={offer.decisionKey} block={quote.block} />
        ) : (
          <div key={offer.decisionKey} className="mt-2 border-t border-line pt-2">
            <span className="font-semibold">{offer.outsText}</span>
            <QuoteBlocked block={quote.block} />
          </div>
        ),
      )}
    </section>
  );
}

/**
 * A pot and the insurance on it as a single block: the pot as a ring, and under it the covers for
 * each kind of card on sale, the cards that overtake first and the tie cards after them. Each has
 * its own table and its own decision. The ring's inner arc is as long as what a cover pays against
 * the pot share, for the cover picked last in either table.
 */
export function PotCover(props: PotCoverProps) {
  // Starts over when a price changes, so a typed premium never carries over to different odds
  const key = props.offers
    .map(({ decisionKey, input }) => {
      const quote = quoteInsurance(input);
      const price = quote.ok ? `${quote.oddsHundredths}-${quote.maxPremiumChips}` : "blocked";
      return `${decisionKey}-${price}`;
    })
    .join("/");
  return <Block key={key} {...props} />;
}

/** The block for one leader's offers on one pot of a hand worked out from the cards. */
export function PotInsurance({ offers, label, nameOf, rule, decisions }: PotInsuranceProps) {
  const [first] = offers;
  if (!first) return null;
  const { leader, pot } = first;
  const cardsText = (cards: readonly number[]) => cards.map(formatCardText).join(" ");
  return (
    <PotCover
      label={pot.leaders.length > 1 ? `${label} · ${nameOf(leader.playerId)} 并列领先` : label}
      parts={potParts(first, nameOf)}
      potChips={pot.amountChips}
      offers={offers.map(({ key, kind, input, outs }): PotCoverOffer => {
        const base = { kind, input, playerId: leader.playerId, decisionKey: key };
        if (kind === "tie") {
          return { ...base, outsText: `平分 ${outs.length} 张`, outsLines: [cardsText(outs)] };
        }
        // Tie cards a rule does not sell are still named, so nobody looks for them among the outs
        const unsold = rule.tieOuts === "include" ? [] : leader.tieCards;
        return {
          ...base,
          outsText: `反超 ${outs.length} 张`,
          outsLines: [
            ...leader.byOpponent.map(
              ({ playerId, cards }) =>
                `${leader.byOpponent.length > 1 ? `${nameOf(playerId)}：` : ""}${cardsText(cards)}`,
            ),
            ...(unsold.length > 0
              ? [`平分 ${unsold.length} 张（不计入）：${cardsText(unsold)}`]
              : []),
          ],
        };
      })}
      decisions={decisions}
    />
  );
}
