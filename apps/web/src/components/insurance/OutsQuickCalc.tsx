import {
  handPotEntries,
  type InsuranceHand,
  type InsuranceHandPlayer,
  type InsuranceHandPurchase,
  type InsuranceRule,
  type InsuranceStreet,
  type OfferKind,
  outsHitChance,
  parseChips,
  potTotals,
  quoteInsurance,
  stakeOf,
  unseenCards,
} from "@holdem-knight/core";
import { ArrowUpDown, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { selectOnFocus } from "@/lib/number-input";
import { HandPlayerRow, type StandingNote } from "./HandPlayerRow";
import {
  DeadMoney,
  MIN_PLAYERS,
  nextPlayers,
  PRESET_DEAD_CHIPS,
  SectionReset,
  SectionTitle,
} from "./HandSections";
import { HandSummary } from "./HandSummary";
import type { InsuranceSeat } from "./InsuranceCalculator";
import type { HandFinish, HandStore, SeatChips } from "./InsuranceHandFlow";
import type { BoughtInsurance, Decisions } from "./LeaderQuote";
import { Modal } from "./Modal";
import { PotCover, type PotCoverOffer } from "./PotInsurance";
import type { PotShare } from "./PotShares";

type Side = 0 | 1;

interface OutsQuickCalcProps {
  rule: InsuranceRule;
  /** Everyone at the table, in its order. The first two start the pot. */
  seats: readonly InsuranceSeat[];
  /** Writes the finished hand to the game. Missing for the standalone calculator. */
  store: HandStore | undefined;
  /** The insurance seat now, for the summary to show where it ends up. */
  seat: SeatChips | undefined;
  /** A blank hand, for what is worked out here to be kept as. */
  createHand: () => InsuranceHand;
  /** Told whether insurance is being worked out, while the settings must stay put. */
  onUnderWay?: ((underWay: boolean) => void) | undefined;
}

/** What was decided on a street and how the pot stood, to go back to if its result is taken back. */
interface StreetState {
  readonly leader: Side;
  readonly outs: readonly [OutsEntry | undefined, OutsEntry | undefined];
  readonly bought: ReadonlyMap<string, BoughtInsurance>;
  readonly declined: readonly string[];
}

/** A street whose card has come: who was ahead and behind, which cards came, and what was sold. */
interface StreetDone {
  readonly street: InsuranceStreet;
  readonly leaderId: string;
  readonly trailerId: string;
  /** The kind of card that came, or undefined when the leader stayed ahead */
  readonly hit: OfferKind | undefined;
  readonly purchases: readonly InsuranceHandPurchase[];
  readonly before: StreetState;
}

const STREETS: readonly { readonly id: InsuranceStreet; readonly label: string }[] = [
  { id: "turn", label: t.common.turn },
  { id: "river", label: t.common.river },
];

const percentText = (share: number) => `${(share * 100).toFixed(1)}%`;

/**
 * The trailing side's cards: those that win outright, and those that split the pot. Some of the
 * cards that win outright can be sold apart, as a second cover priced on its own count.
 */
interface OutsEntry {
  /** Every card that wins outright, those sold apart among them */
  readonly outs: number;
  /** How many of them are sold as the second cover. Never all of them. */
  readonly second: number;
  readonly ties: number;
}

/** The cards as sold: 6+2 when ties are sold with the outs, or just 6. */
const soldText = ({ outs, ties }: OutsEntry, tiesSold: boolean) =>
  tiesSold && ties > 0 ? `${outs}+${ties}` : String(outs);

const cardCount = (value: string) => value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

/** The two covers of one kind, as they are numbered for a hand worked from its cards. */
const PART_TEXT = { 1: "I", 2: "II" } as const;

/** Dead money as a pot starts with it, not yet set by the organizer. */
const PRESET_DEAD = { pools: [PRESET_DEAD_CHIPS] as readonly number[], preset: true };

const stepClass =
  "grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-surface text-highlight disabled:opacity-30";

/**
 * A card count typed in or nudged one at a time, between `min` and `max`, on one line with its
 * name before it.
 */
function CardStepper({
  id,
  label,
  text,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  text: string;
  min: number;
  max: number;
  onChange: (text: string) => void;
}) {
  const value = parseChips(text) ?? 0;
  const step = (by: number) => onChange(String(Math.min(max, Math.max(min, value + by))));
  return (
    <div className="flex w-full items-center justify-between gap-2">
      <label htmlFor={id} className="min-w-0 text-sm text-muted">
        {label}
      </label>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          aria-label={t.insurance.outsQuickCalc.oneLess(label)}
          disabled={value <= min}
          onClick={() => step(-1)}
          className={stepClass}
        >
          <Minus className="size-5" aria-hidden />
        </button>
        <div className="flex min-h-11 w-20 items-center gap-1 rounded-xl border border-line bg-surface px-2 focus-within:border-highlight">
          <input
            id={id}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={text}
            // Nothing is selected as the dialog opens. A tap on a count selects it, so the first
            // digit typed replaces it
            onFocus={(event) => selectOnFocus(event.currentTarget)}
            onChange={(event) => onChange(cardCount(event.target.value))}
            className="min-w-0 flex-1 bg-transparent text-center text-lg font-semibold tabular-nums outline-none"
          />
          <span className="text-sm text-muted">{t.insurance.outsQuickCalc.cardsUnit}</span>
        </div>
        <button
          type="button"
          aria-label={t.insurance.outsQuickCalc.oneMore(label)}
          disabled={value >= max}
          onClick={() => step(1)}
          className={stepClass}
        >
          <Plus className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function OutsDialog({
  name,
  entry,
  unseen,
  maxOuts,
  tiesSold,
  onConfirm,
  onCancel,
}: {
  name: string;
  entry: OutsEntry | undefined;
  /** Cards left to come, which the outs and the ties share. */
  unseen: number;
  /** The most cards the rule's odds table prices. */
  maxOuts: number;
  /** Whether the rule sells tie cards as outs. Unsold ties still show in the pot's chances. */
  tiesSold: boolean;
  onConfirm: (entry: OutsEntry) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(String(entry ? entry.outs - entry.second : 4));
  // The second cover's cards, once it is asked for
  const [secondText, setSecondText] = useState(
    entry && entry.second > 0 ? String(entry.second) : undefined,
  );
  const [tieText, setTieText] = useState(String(entry?.ties ?? 0));
  const first = parseChips(text) ?? 0;
  const second = secondText === undefined ? 0 : (parseChips(secondText) ?? 0);
  const ties = parseChips(tieText) ?? 0;
  // Each cover is priced by its own count, so each has the odds table to itself. Tie cards that
  // are not sold need no odds.
  const firstMax = Math.min(unseen - second - ties, maxOuts);
  const secondMax = Math.min(unseen - first - ties, maxOuts);
  const tiesMax = Math.min(unseen - first - second, tiesSold ? maxOuts : unseen);
  const valid =
    first + second + ties >= 1 && first <= firstMax && second <= secondMax && ties <= tiesMax;
  const { outsQuickCalc: text2 } = t.insurance;

  return (
    <Modal title={text2.sOuts(name)} onClose={onCancel}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) return;
          // Cards sold apart with none left beside them are simply the cards sold
          onConfirm({ outs: first + second, second: first > 0 ? second : 0, ties });
        }}
        className="flex flex-col items-center gap-2"
      >
        <CardStepper
          id="quick-outs"
          label={secondText === undefined ? text2.outs : text2.overtakePoolI}
          text={text}
          min={0}
          max={firstMax}
          onChange={setText}
        />
        {secondText === undefined ? (
          <button
            type="button"
            onClick={() => setSecondText("1")}
            className="-my-1 min-h-11 w-full text-left text-sm text-muted"
          >
            {text2.addOvertakePoolIi}
          </button>
        ) : (
          <CardStepper
            id="quick-outs-2"
            label={text2.overtakePoolIi}
            text={secondText}
            min={0}
            max={secondMax}
            onChange={setSecondText}
          />
        )}
        <span aria-hidden className="h-px w-full bg-line" />
        <CardStepper
          id="quick-ties"
          label={tiesSold ? text2.tieCards : text2.tieCardsNotCountedAsOuts}
          text={tieText}
          min={0}
          max={tiesMax}
          onChange={setTieText}
        />
        <div className="grid w-full grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-line font-medium"
          >
            {t.common.cancel}
          </button>
          <button
            type="submit"
            disabled={!valid}
            className="min-h-11 rounded-xl bg-accent font-semibold text-accent-text disabled:opacity-40"
          >
            {t.common.confirm}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * A hand worked from two players' chips and the trailing player's outs, without picking cards. The
 * page is laid out as it is for a hand worked out from the cards: the pot, the players and the
 * insurance under them, which shows as soon as there is enough to price it.
 *
 * It runs as that hand does. Covers are taken or turned down, then the street's card is recorded
 * as having come or not. After the turn the river follows by itself, with the pot as it was and
 * whoever is ahead now; the organizer enters its outs, or ends the hand there without the river.
 * Either way the hand ends on its summary, and nothing reaches the game before that is confirmed.
 */
export function OutsQuickCalc({
  rule,
  seats,
  store,
  seat,
  createHand,
  onUnderWay,
}: OutsQuickCalcProps) {
  // What the hand is kept as: its identity, with everything else worked out below
  const [base, setBase] = useState(createHand);
  const [street, setStreet] = useState<InsuranceStreet>("turn");
  // Nothing is kept until the organizer changes something, so a table that changes meanwhile
  // still shows as it is
  const [edited, setEdited] = useState<readonly InsuranceHandPlayer[]>();
  const [leader, setLeader] = useState<Side>(0);
  // Kept per side, so switching the lead back and forth keeps what was typed
  const [outs, setOuts] = useState<readonly [OutsEntry | undefined, OutsEntry | undefined]>([
    undefined,
    undefined,
  ]);
  const [dead, setDead] = useState(PRESET_DEAD);
  const [editingOuts, setEditingOuts] = useState(false);
  // What is decided on the street being worked on, by offer
  const [bought, setBought] = useState<ReadonlyMap<string, BoughtInsurance>>(new Map());
  const [declined, setDeclined] = useState<readonly string[]>([]);
  // The streets whose card has come, in order
  const [done, setDone] = useState<readonly StreetDone[]>([]);
  // On the summary, with the hand over
  const [ended, setEnded] = useState(false);
  const [finishing, setFinishing] = useState(false);
  // Asking whether the card came, once every offer is decided
  const [recording, setRecording] = useState(false);
  // Dead money's field, where a tap on dead money in the pot's legend lands
  const deadRef = useRef<HTMLInputElement>(null);

  const nameOf = (id: string) => seats.find((s) => s.id === id)?.name ?? t.common.unknownPlayer;
  const streetText = STREETS.find(({ id }) => id === street)?.label ?? "";
  // The first two of the table, with the chips they have there
  const players = edited ?? nextPlayers([], seats, MIN_PLAYERS);
  const totals = potTotals(handPotEntries({ players, pools: dead.pools }));

  const trailer: Side = leader === 0 ? 1 : 0;
  const leaderPlayer = players[leader];
  const trailerPlayer = players[trailer];
  const trailerEntry = outs[trailer];
  // Tie cards are sold, as a cover of their own, only when the rule says so
  const tiesSold = rule.tieOuts === "include";

  const withSide = (side: Side, change: Partial<InsuranceHandPlayer>) =>
    players.map((p, index) => (index === side ? { ...p, ...change } : p));

  const setSideOuts = (side: Side, entry: OutsEntry | undefined) =>
    setOuts(side === 0 ? [entry, outs[1]] : [outs[0], entry]);

  /** At most one player covers the other. The chips typed stay as they are under the cover. */
  function setCover(side: Side, cover: boolean) {
    setEdited(
      players.map((p, index) =>
        index === side ? { ...p, cover } : cover ? { ...p, cover: false } : p,
      ),
    );
  }

  const decisions: Decisions = {
    get(key) {
      const taken = bought.get(key);
      if (!taken) return declined.includes(key) ? { kind: "declined" } : undefined;
      const { premiumChips, payoutChips } = taken.option;
      return { kind: "bought", purchaseId: key, premiumChips, payoutChips };
    },
    buy: (key, purchase) => setBought(new Map(bought).set(key, purchase)),
    decline: (key) => setDeclined([...declined, key]),
    revise(key) {
      setBought(new Map([...bought].filter(([taken]) => taken !== key)));
      setDeclined(declined.filter((turnedDown) => turnedDown !== key));
    },
  };

  // Once a street's card has come, the pot it was played for stays as it is
  const potFixed = done.length > 0;
  const underWay = potFixed || bought.size > 0 || declined.length > 0;
  useEffect(() => onUnderWay?.(underWay), [onUnderWay, underWay]);

  const staked = (player: InsuranceHandPlayer) => player.cover || player.chips > 0;
  const ready =
    leaderPlayer &&
    trailerPlayer &&
    trailerEntry &&
    staked(leaderPlayer) &&
    staked(trailerPlayer) &&
    !(leaderPlayer.cover && trailerPlayer.cover);
  // What the next card does, once the trailing side's cards are known
  const chances = trailerEntry && {
    ...trailerEntry,
    hit: outsHitChance(street, trailerEntry.outs),
    tie: outsHitChance(street, trailerEntry.ties),
    win: 1 - outsHitChance(street, trailerEntry.outs + trailerEntry.ties),
  };

  const leaderStake =
    leaderPlayer && trailerPlayer
      ? Math.min(stakeOf(leaderPlayer, players), stakeOf(trailerPlayer, players))
      : 0;

  /** Where a side stands, under its name: the leader's chance to win, or the outs against it. */
  function noteOf(side: Side): StandingNote | undefined {
    if (side === leader) return { leading: true, text: chances ? percentText(chances.win) : "" };
    if (!chances || !trailerEntry) return undefined;
    return {
      leading: false,
      text: `Outs ${soldText(trailerEntry, tiesSold)} · ${percentText(chances.hit)}`,
    };
  }

  /**
   * What is on sale: the cards that overtake, and after them the tie cards where the rule sells
   * them. With tie cards only, there is just their cover.
   */
  function quickOffers(leaderId: string, trailerId: string, entry: OutsEntry): PotCoverOffer[] {
    const input = {
      rule,
      street,
      potChips: totals.effectiveChips,
      shareChips: totals.effectiveChips,
      stakeChips: leaderStake,
    };
    const keyOf = (kind: OfferKind, part?: 1 | 2) =>
      [
        "quick",
        kind,
        part ?? 0,
        leaderId,
        trailerId,
        street,
        totals.effectiveChips,
        leaderStake,
        entry.outs,
        entry.second,
        entry.ties,
        rule.tieOuts,
      ].join("|");
    // The cards that overtake as one cover, or as two where some are sold apart, each priced on
    // its own count and named as they are for a hand worked from its cards
    const cover = (count: number, part?: 1 | 2): PotCoverOffer => ({
      kind: "overtake",
      ...(part !== undefined && { part }),
      input: { ...input, outs: count },
      playerId: leaderId,
      decisionKey: keyOf("overtake", part),
      name: part === undefined ? t.common.outdraw : `${t.common.outdraw} ${PART_TEXT[part]}`,
      count,
      // Tie cards a rule does not sell are still named, so nobody takes them for outs
      outsLines:
        part !== 2 && !tiesSold && entry.ties > 0
          ? [t.insurance.outsQuickCalc.tieOnNotCounted(entry.ties)]
          : [],
    });
    const overtake =
      entry.second > 0
        ? [cover(entry.outs - entry.second, 1), cover(entry.second, 2)]
        : [cover(entry.outs)];
    if (!tiesSold || entry.ties === 0) return overtake;
    const tie: PotCoverOffer = {
      kind: "tie",
      // A tie leaves each of the two half the pot, so the other half is the most it can cost
      input: {
        ...input,
        outs: entry.ties,
        keptChips: Math.floor(totals.effectiveChips / 2),
        capChips: totals.effectiveChips - Math.floor(totals.effectiveChips / 2),
      },
      playerId: leaderId,
      decisionKey: keyOf("tie"),
      name: t.common.tie,
      count: entry.ties,
    };
    return entry.outs > 0 ? [...overtake, tie] : [tie];
  }

  const offers =
    ready && leaderPlayer && trailerPlayer && trailerEntry
      ? quickOffers(leaderPlayer.playerId, trailerPlayer.playerId, trailerEntry)
      : [];
  // Once a cover is bought, what it was priced on stays as it is
  const sold = offers.some((o) => bought.has(o.decisionKey));
  // The pot itself: who is in it, their chips and the dead money
  const locked = sold || potFixed;
  // Every offer that can be sold is bought or turned down
  const decided = offers.every(
    (o) => decisions.get(o.decisionKey) !== undefined || !quoteInsurance(o.input).ok,
  );

  /**
   * Whether the card came, for every cover on this street: at most one kind of card can have.
   * After the turn the river follows, with whoever the turn left ahead; the river ends the hand.
   */
  function record(came: PotCoverOffer | undefined) {
    const hit = came?.kind;
    if (!leaderPlayer || !trailerPlayer) return;
    const purchases = offers.flatMap((offer): InsuranceHandPurchase[] => {
      const taken = bought.get(offer.decisionKey);
      if (!taken) return [];
      return [
        {
          id: crypto.randomUUID(),
          offerKey: offer.decisionKey,
          playerId: taken.playerId,
          street,
          outs: [],
          outsCount: taken.outs,
          ...(taken.tie && { tie: true }),
          oddsHundredths: taken.oddsHundredths,
          premiumChips: taken.option.premiumChips,
          payoutChips: taken.option.payoutChips,
          hit: offer === came,
        },
      ];
    });
    setDone([
      ...done,
      {
        street,
        leaderId: leaderPlayer.playerId,
        trailerId: trailerPlayer.playerId,
        hit,
        purchases,
        before: { leader, outs, bought, declined },
      },
    ]);
    setBought(new Map());
    setDeclined([]);
    setOuts([undefined, undefined]);
    setRecording(false);
    if (street === "river") return setEnded(true);
    setStreet("river");
    if (hit === "overtake") setLeader(trailer);
  }

  /** Back from the summary to the river: as it stood before its card, or still to be entered. */
  function reopen() {
    setEnded(false);
    const last = done.at(-1);
    if (last?.street !== "river") return;
    setDone(done.slice(0, -1));
    setLeader(last.before.leader);
    setOuts(last.before.outs);
    setBought(last.before.bought);
    setDeclined(last.before.declined);
  }

  function reset() {
    setBase(createHand());
    setStreet("turn");
    setEdited(undefined);
    setLeader(0);
    setOuts([undefined, undefined]);
    setDead(PRESET_DEAD);
    setBought(new Map());
    setDeclined([]);
    setDone([]);
    setEnded(false);
  }

  const river = done.find((street) => street.street === "river");
  // The river says who took the pot: whoever was behind if their card came, both on a tie
  const winnerIds =
    river &&
    (river.hit === "overtake"
      ? [river.trailerId]
      : river.hit === "tie"
        ? [river.leaderId, river.trailerId]
        : [river.leaderId]);
  const hand: InsuranceHand = {
    ...base,
    step: "summary",
    players,
    pools: dead.pools,
    purchases: done.flatMap((street) => street.purchases),
    quick: {
      leaders: Object.fromEntries(done.map((street) => [street.street, street.leaderId])),
      ...(winnerIds && { winnerIds }),
    },
  };

  async function finish(choices: HandFinish) {
    if (!store) return reset();
    setFinishing(true);
    try {
      await store.finish(hand, choices);
      reset();
    } finally {
      setFinishing(false);
    }
  }

  if (ended) {
    return (
      <HandSummary
        hand={hand}
        nameOf={nameOf}
        seat={seat}
        recording={store !== undefined}
        seatedIds={seats.map(({ id }) => id)}
        saving={finishing}
        onBack={reopen}
        onConfirm={finish}
      />
    );
  }

  // Who put what into the pot: the leader first, dead money last
  const parts: PotShare[] | undefined =
    leaderPlayer && trailerPlayer
      ? [
          {
            key: "leader",
            tone: "leader",
            label: nameOf(leaderPlayer.playerId),
            chips: leaderStake,
            note: chances && percentText(chances.win),
          },
          {
            key: "trailer",
            tone: "trailer",
            label: nameOf(trailerPlayer.playerId),
            chips: leaderStake,
            note: chances && `Outs ${chances.outs} · ${percentText(chances.hit)}`,
          },
          {
            key: "dead",
            tone: "dead",
            label: t.common.deadMoney,
            chips: totals.deadChips,
            note:
              chances && chances.ties > 0
                ? t.insurance.outsQuickCalc.tie(chances.ties, percentText(chances.tie))
                : undefined,
            onSelect: locked ? undefined : () => deadRef.current?.focus(),
          },
        ]
      : undefined;

  // What the pot still needs before it can be priced, in the order it is entered
  const missing = [
    ...(players.length < MIN_PLAYERS ? [t.insurance.outsQuickCalc.twoPlayers] : []),
    ...players.flatMap((player, index) => {
      const needs = [
        ...(staked(player) ? [] : [t.common.chips]),
        ...(index === trailer && trailerEntry === undefined ? ["Outs"] : []),
      ];
      return needs.length > 0
        ? [
            `${nameOf(player.playerId)}${t.common.openParen}${needs.join(t.common.listSeparator)}${t.common.closeParen}`,
          ]
        : [];
    }),
  ];

  return (
    <>
      <section aria-labelledby="quick-pot-title" className="mt-1">
        <SectionTitle id="quick-pot-title" title={t.insurance.outsQuickCalc.pot} />
        <div className="relative flex flex-wrap items-stretch justify-center gap-1.5">
          {!sold && (
            <SectionReset
              label={t.insurance.outsQuickCalc.clearThePot}
              onReset={() => {
                // With a street already recorded, clearing gives up the hand
                if (
                  potFixed &&
                  !window.confirm(t.insurance.insuranceHandFlow.dropThisHandsInsuranceWhatWas)
                ) {
                  return;
                }
                reset();
              }}
            />
          )}
          {/* Framed like a street of the board, with the card the insurance is on picked inside */}
          <fieldset className="flex shrink-0 flex-col items-center gap-1 rounded-xl border-2 border-line bg-surface px-2 pt-2 pb-1">
            <legend className="sr-only">{t.insurance.outsQuickCalc.whichCardToInsure}</legend>
            <span className="flex gap-1">
              {STREETS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={street === id}
                  disabled={locked}
                  onClick={() => setStreet(id)}
                  className={cn(
                    "h-11 rounded-lg border px-3 font-medium transition-colors",
                    street === id
                      ? "border-accent bg-accent text-accent-text"
                      : "border-line text-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </span>
            <span aria-hidden className="text-xs whitespace-nowrap text-muted">
              {t.insurance.outsQuickCalc.whichCardToInsure}
            </span>
          </fieldset>
          <span aria-hidden className="mx-1 w-px self-stretch bg-line" />
          <DeadMoney
            chips={totals.deadChips}
            preset={dead.preset}
            inputRef={deadRef}
            edits={
              locked
                ? undefined
                : {
                    // Typed or confirmed, the amount is the organizer's own from then on
                    onChips: (chips) => setDead({ pools: chips > 0 ? [chips] : [], preset: false }),
                    onDone: () => {},
                  }
            }
          />
        </div>
      </section>

      <section aria-labelledby="quick-players-title" className="mt-3">
        <SectionTitle id="quick-players-title" title={t.insurance.outsQuickCalc.playersInThePot} />
        {seats.length < MIN_PLAYERS && (
          <p className="mb-2 text-sm text-muted">
            {t.insurance.outsQuickCalc.insuranceNeedsAtLeastTwoPlayers}
          </p>
        )}
        <ul className="relative flex flex-col gap-2">
          {players.map((player, index) => {
            const side = index as Side;
            const name = nameOf(player.playerId);
            const sideOuts = outs[side];
            return (
              <li key={player.playerId}>
                <HandPlayerRow
                  name={name}
                  player={player}
                  note={noteOf(side)}
                  edits={
                    locked
                      ? undefined
                      : {
                          seats,
                          // At a table the other player of the pot can be picked too, which
                          // has the two change places
                          takenIds: store
                            ? []
                            : players.filter((p) => p !== player).map((p) => p.playerId),
                          // At a table another player is another pot: their own chips, no cover and no
                          // outs. Away from one the name is only a label, and what was entered stays.
                          onSeat: (id) => {
                            if (store && players.some((p) => p.playerId === id)) {
                              // Each takes the other's place, with their chips and their outs
                              setEdited(players.toReversed());
                              setOuts([outs[1], outs[0]]);
                              return;
                            }
                            if (store) setSideOuts(side, undefined);
                            setEdited(
                              withSide(side, {
                                playerId: id,
                                ...(store && {
                                  chips: seats.find((s) => s.id === id)?.chips ?? 0,
                                  cover: false,
                                }),
                              }),
                            );
                          },
                          onChips: (chips) => setEdited(withSide(side, { chips })),
                          onChipsDone: () => {},
                          onCover: (cover) => setCover(side, cover),
                          lead: {
                            kind: "reset",
                            label: t.insurance.outsQuickCalc.clearSOuts(name),
                            onSelect: () => {
                              setSideOuts(side, undefined);
                              setEdited(withSide(side, { cover: false }));
                            },
                          },
                        }
                  }
                >
                  {/* As wide as the two cards of a hand, so the rows line up either way */}
                  {side === leader ? (
                    <span className="grid h-11 w-20 shrink-0 place-items-center">
                      <span className="rounded-lg bg-accent px-2.5 py-1 text-sm font-bold text-accent-text">
                        {t.common.ahead}
                      </span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-label={t.insurance.outsQuickCalc.enterSOuts(name)}
                      disabled={sold}
                      onClick={() => setEditingOuts(true)}
                      className={cn(
                        "flex h-11 w-20 shrink-0 flex-col items-center justify-center rounded-lg border",
                        sideOuts === undefined
                          ? "border-dashed border-highlight/60 text-highlight"
                          : "border-line bg-bg",
                      )}
                    >
                      <span className="text-[11px] leading-none text-muted">Outs</span>
                      <span className="leading-tight font-semibold tabular-nums">
                        {sideOuts ? soldText(sideOuts, tiesSold) : "—"}
                      </span>
                    </button>
                  )}
                </HandPlayerRow>
              </li>
            );
          })}
          {/* Where the two rows meet, under one's place in the lead and over the other's outs:
              a tap has them change who is ahead */}
          {players.length === MIN_PLAYERS && !sold && (
            <li className="absolute top-1/2 right-[calc(1.625rem+1px)] z-10 -translate-y-1/2">
              <button
                type="button"
                aria-label={t.insurance.outsQuickCalc.switchWhoIsAhead}
                onClick={() => setLeader(trailer)}
                className="grid size-11 place-items-center text-highlight"
              >
                <span className="grid size-6 place-items-center rounded-full border border-line bg-bg">
                  <ArrowUpDown className="size-3.5" aria-hidden />
                </span>
              </button>
            </li>
          )}
        </ul>
      </section>

      <section aria-labelledby="quick-insurance-title" className="mt-3">
        <SectionTitle id="quick-insurance-title" title={t.insurance.outsQuickCalc.insurance} />
        {ready && parts ? (
          <>
            <PotCover
              label={t.insurance.outsQuickCalc.mainPot}
              parts={parts}
              potChips={totals.effectiveChips}
              offers={offers}
              saving={false}
              decisions={decisions}
            />
            <button
              type="button"
              disabled={!decided}
              onClick={() => setRecording(true)}
              className="mt-3 min-h-12 w-full rounded-xl bg-accent font-semibold text-accent-text disabled:opacity-40"
            >
              {t.insurance.outsQuickCalc.record(streetText)}
            </button>
          </>
        ) : (
          <p className="text-sm text-muted">
            {missing.length > 0
              ? t.insurance.outsQuickCalc.stillNeededInsuranceShowsHereOnce(
                  missing.join(t.common.listSeparator),
                )
              : t.insurance.outsQuickCalc.onlyOnePlayerCanCoverAnd}
          </p>
        )}
        {/* The river came up by itself after the turn, and need not be worked on */}
        {potFixed && !sold && (
          <button
            type="button"
            onClick={() => setEnded(true)}
            className="mt-2 min-h-11 w-full rounded-xl border border-line text-sm font-medium"
          >
            {t.insurance.outsQuickCalc.endWithoutTheRiver}
          </button>
        )}
      </section>

      {recording && (
        <Modal
          title={t.insurance.outsQuickCalc.didHit(streetText)}
          onClose={() => setRecording(false)}
        >
          <div className="flex flex-col gap-2">
            {/* With both kinds of card on sale, a hit says which kind came */}
            {offers.map((offer) => (
              <button
                key={offer.decisionKey}
                type="button"
                onClick={() => record(offer)}
                className="min-h-12 rounded-xl bg-accent font-semibold text-accent-text"
              >
                {offers.length > 1
                  ? t.insurance.outsQuickCalc.hit(offer.name)
                  : t.insurance.outsQuickCalc.hit2}
              </button>
            ))}
            <button
              type="button"
              onClick={() => record(undefined)}
              className="min-h-12 rounded-xl border border-line font-medium"
            >
              {t.insurance.outsQuickCalc.missed}
            </button>
          </div>
        </Modal>
      )}

      {editingOuts && (
        <OutsDialog
          name={
            trailerPlayer ? nameOf(trailerPlayer.playerId) : t.insurance.outsQuickCalc.playerBehind
          }
          entry={trailerEntry}
          unseen={unseenCards(street)}
          maxOuts={rule.oddsHundredths.length}
          tiesSold={tiesSold}
          onConfirm={(entry) => {
            setSideOuts(trailer, entry);
            setEditingOuts(false);
          }}
          onCancel={() => setEditingOuts(false)}
        />
      )}
    </>
  );
}
