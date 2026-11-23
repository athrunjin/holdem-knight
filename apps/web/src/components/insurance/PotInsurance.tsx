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
import { SquarePen } from "lucide-react";
import { useId, useRef, useState } from "react";
import { t } from "@/i18n";
import { formatCardText } from "@/lib/cards";
import { formatSignedChips, netColor } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { formatOddsText, selectOnFocus } from "@/lib/number-input";
import type { Decisions } from "./LeaderQuote";
import { PotHeading, PotLegend, PotRing, type PotShare } from "./PotShares";
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
  /** Opens the cards of an offer's kind, to give some up or sell some as a second cover */
  onManage: (offer: HandOffer) => void;
}

/** One kind of card sold on a pot, with its own covers and its own decision. */
export interface PotCoverOffer {
  readonly kind: OfferKind;
  /** Which of the two covers this is, where the cards of its kind are sold as two. */
  readonly part?: 1 | 2;
  readonly input: QuoteInput;
  /** The buyer. */
  readonly playerId: string;
  /** Tells this offer's decision from any other's. */
  readonly decisionKey: string;
  /** What the cards do, with the cover's number where there are two: 反超, 平分 II. */
  readonly name: string;
  /** How many cards the cover is on. */
  readonly count: number;
  /** Every card of the kind, where the cards are known: it follows the count in gray, 3 / 5 张. */
  readonly outsTotal?: number;
  /**
   * Opens the cards, to give some up or sell some apart. Null where there is nothing to choose, or
   * a cover of the kind is already decided, which dims the icon; missing where the cards are not
   * known, which leaves the icon out.
   */
  readonly onManage?: (() => void) | null;
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
        {option.capped && (
          <span className="block text-xs text-highlight">
            {t.insurance.potInsurance.atTheLimit}
          </span>
        )}
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
      ? [{ key: "dead-money", tone: "dead" as const, label: t.common.deadMoney, chips: deadChips }]
      : []),
  ];
}

/**
 * What an offer sells, as the line over its covers, all at one size: 反超 · 3 / 5 张 | 赔 15.0,
 * with the total in gray, and at the right the pen that opens the cards.
 */
function OfferHeading({
  offer: { name, count, outsTotal, onManage },
  oddsHundredths,
  locked = false,
}: {
  offer: PotCoverOffer;
  /** Missing where the offer has no price */
  oddsHundredths?: number;
  /** The offer is decided, so its cards stay as they are */
  locked?: boolean;
}) {
  return (
    <div className="flex min-h-6 items-center justify-between gap-2">
      <span className="min-w-0 truncate text-base leading-6 font-semibold tabular-nums">
        {name} · {count}
        {outsTotal !== undefined && <span className="text-muted"> / {outsTotal}</span>}{" "}
        {t.insurance.potInsurance.cardsUnit}
        {oddsHundredths !== undefined && (
          <>
            <span className="text-muted"> | </span>
            {t.insurance.potInsurance.pays} {formatOddsText(formatOdds(oddsHundredths))}
          </>
        )}
      </span>
      {onManage !== undefined && (
        <button
          type="button"
          aria-label={t.insurance.potInsurance.manageOuts}
          disabled={!onManage || locked}
          onClick={onManage ?? undefined}
          className="-my-2.5 -mr-2 grid size-11 shrink-0 place-items-center text-highlight disabled:text-muted disabled:opacity-40"
        >
          <SquarePen className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** The cover picked for one offer, and a custom premium as typed. */
interface Pick {
  readonly choice: Choice;
  readonly customText: string;
}

// The stake cover is picked on arrival, so an offer opens on a price and not on a blank
const FIRST_PICK: Pick = { choice: "stake", customText: "" };

const KIND_TEXT: Record<OfferKind, string> = { overtake: t.common.outdraw, tie: t.common.tie };
const PART_TEXT = { 1: "I", 2: "II" } as const;

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
    {
      id: "stake",
      label: t.insurance.potInsurance.stakeBack,
      ...(halfPot ? {} : { note: t.insurance.potInsurance.halfPot }),
      option: stake,
    },
    ...(halfPot
      ? [{ id: "half" as const, label: t.insurance.potInsurance.halfPot2, option: halfPot }]
      : []),
  ];
  const most = Math.max(...smaller.map(({ option }) => option.premiumChips));
  const standard = [
    ...smaller,
    ...(kind === "overtake"
      ? [{ id: "full" as const, label: t.insurance.potInsurance.fullPot, option: fullPot }]
      : fullPot.premiumChips > most
        ? [{ id: "full" as const, label: t.insurance.potInsurance.cap, option: fullPot }]
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
  const chosenLabel =
    shown === "custom" ? t.common.custom : standard.find((r) => r.id === shown)?.label;
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
  show = "all",
}: {
  /**
   * The heading with its cards, the covers under it, or both. The two are drawn apart for the last
   * offer of a pot, whose heading ends the stretch the pot's ring stays pinned over.
   */
  show?: "all" | "head" | "body";
  offer: PotCoverOffer;
  quote: PricedQuote;
  pick: Pick;
  /** Called with every row picked and every premium typed, which also puts this offer in the ring */
  onPick: (pick: Pick) => void;
  saving: boolean | undefined;
  decisions: Decisions | undefined;
}) {
  const { input, decisionKey, outsLines = [], kind } = offer;
  const customId = useId();
  const customRef = useRef<HTMLInputElement>(null);
  const [customFocused, setCustomFocused] = useState(false);

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

  const head = (
    <div className="mt-2 border-t border-line pt-2">
      <OfferHeading offer={offer} oddsHundredths={oddsHundredths} locked={locked} />
      <ul className="text-xs text-muted">
        {outsLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
  if (show === "head") return head;

  return (
    <div>
      {show === "all" && head}

      {/* Once decided, the covers not taken fade and the one bought stays as it was picked */}
      <fieldset disabled={locked} className="mt-2">
        <div className="grid grid-cols-[1fr_repeat(4,3.6rem)] gap-1 px-2 text-right text-xs text-muted">
          <span />
          <span>{t.insurance.potInsurance.premium}</span>
          <span>{t.insurance.potInsurance.payout}</span>
          <span>{t.insurance.potInsurance.ifItHits}</span>
          <span>{t.insurance.potInsurance.ifItMisses}</span>
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
          <span className={rowNameClass}>{t.common.custom}</span>
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
            aria-label={t.insurance.potInsurance.customPremiumAWholeNumberFrom(maxPremiumChips)}
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
            {chosen
              ? t.insurance.potInsurance.insurePremium(chipText(chosen.premiumChips))
              : t.insurance.potInsurance.insure}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => decisions.decline(decisionKey)}
            className="min-h-12 rounded-xl border border-line px-4 font-medium disabled:opacity-60"
          >
            {t.insurance.potInsurance.dontBuy}
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
          kindText:
            offers.length > 1
              ? `${KIND_TEXT[active.offer.kind]}${active.offer.part ? ` ${PART_TEXT[active.offer.part]}` : ""}`
              : "",
        }
      : undefined;
  const cover = ring?.chosen;
  const [only] = quoted;
  const last = quoted.at(-1);
  const tableProps = (offer: PotCoverOffer, quote: PricedQuote) => ({
    offer,
    quote,
    pick: pickOf(offer.decisionKey),
    onPick: (pick: Pick) => {
      setPicks((current) => ({ ...current, [offer.decisionKey]: pick }));
      setTouched(offer.decisionKey);
    },
    saving,
    decisions,
  });

  return (
    <section
      aria-label={t.insurance.potInsurance.insurance(label)}
      className="mt-3 rounded-xl border border-line bg-surface p-3"
    >
      {/*
        The pot's name and ring stay at the top of the page while its tables scroll under them,
        and let go once the heading of the last table reaches them: they are pinned within this
        stretch, which ends with that heading.
      */}
      <div>
        <div className="sticky top-0 z-10 -mx-3 -mt-3 rounded-t-xl bg-surface px-3 pt-3 pb-1">
          <PotHeading title={label} chips={potChips} />
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
                  {/* The kind of card on a line of its own, as the two together run past the ring */}
                  {ring.kindText && (
                    <span className="text-[11px] leading-tight whitespace-nowrap text-muted">
                      {ring.kindText}
                    </span>
                  )}
                  <span className="text-[11px] leading-tight whitespace-nowrap text-muted">
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
        </div>

        {quoted.map(({ offer, quote }, index) =>
          quote.ok ? (
            <CoverTable
              key={offer.decisionKey}
              show={index === quoted.length - 1 ? "head" : "all"}
              {...tableProps(offer, quote)}
            />
          ) : quoted.length === 1 && only && !offer.onManage ? (
            // A pot with nothing to sell says why under the ring, with no heading of its own
            <QuoteBlocked key={offer.decisionKey} block={quote.block} />
          ) : (
            // With cards to give up, the heading stays: too many outs for the odds table can be
            // brought within it that way
            <div key={offer.decisionKey} className="mt-2 border-t border-line pt-2">
              <OfferHeading offer={offer} />
              <QuoteBlocked block={quote.block} />
            </div>
          ),
        )}
      </div>
      {last?.quote.ok && <CoverTable show="body" {...tableProps(last.offer, last.quote)} />}
    </section>
  );
}

/**
 * A pot and the insurance on it as a single block: the pot as a ring, and under it the covers for
 * each kind of card on sale, the cards that overtake first and the tie cards after them. Each has
 * its own table and its own decision. Inside the pot's ring, a middle ring shows what a cover pays
 * and an inner one its premium, for the cover picked last in either table.
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
export function PotInsurance({
  offers,
  label,
  nameOf,
  rule,
  decisions,
  onManage,
}: PotInsuranceProps) {
  const [first] = offers;
  if (!first) return null;
  const { leader, pot } = first;
  const cardsText = (cards: readonly number[]) => cards.map(formatCardText).join(" ");
  return (
    <PotCover
      label={
        pot.leaders.length > 1
          ? t.insurance.potInsurance.tiedForTheLead(label, nameOf(leader.playerId))
          : label
      }
      parts={potParts(first, nameOf)}
      potChips={pot.amountChips}
      offers={offers.map((offer): PotCoverOffer => {
        const { key, baseKey, kind, part, input, outs, allOuts, skippedOuts } = offer;
        const name = `${KIND_TEXT[kind]}${part ? ` ${PART_TEXT[part]}` : ""}`;
        // Named once for the kind, under its first cover
        const lead = part !== 2;
        // Tie cards a rule does not sell are still named, so nobody looks for them among the outs
        const unsold = kind === "tie" || rule.tieOuts === "include" ? [] : leader.tieCards;
        // A cover of the kind already bought or turned down fixes how its cards are sold
        const decided = offers.some((o) => o.baseKey === baseKey && decisions?.get(o.key));
        return {
          kind,
          ...(part !== undefined && { part }),
          input,
          playerId: leader.playerId,
          decisionKey: key,
          name,
          count: outs.length,
          outsTotal: allOuts.length,
          // One card leaves nothing to choose between
          onManage: allOuts.length > 1 && !decided ? () => onManage(offer) : null,
          // The cards bought on one line, whoever they are good for, and those given up on the
          // next, under each cover of the kind
          outsLines: [
            ...(outs.length > 0 ? [cardsText(outs)] : []),
            ...(skippedOuts.length > 0
              ? [t.insurance.potInsurance.declined(cardsText(skippedOuts))]
              : []),
            ...(lead && unsold.length > 0
              ? [t.insurance.potInsurance.tieOnNotCounted(unsold.length, cardsText(unsold))]
              : []),
          ],
        };
      })}
      decisions={decisions}
    />
  );
}
