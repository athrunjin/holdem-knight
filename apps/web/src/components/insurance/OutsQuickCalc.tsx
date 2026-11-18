import {
  handPotEntries,
  type InsuranceHandPlayer,
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
import { type Ref, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { HandPlayerRow, type StandingNote } from "./HandPlayerRow";
import {
  DeadMoney,
  MIN_PLAYERS,
  nextPlayers,
  PRESET_DEAD_CHIPS,
  RoundAction,
  SectionReset,
  SectionTitle,
} from "./HandSections";
import type { InsuranceSeat } from "./InsuranceCalculator";
import type { Decisions } from "./LeaderQuote";
import { Modal } from "./Modal";
import { PotCover, type PotCoverOffer } from "./PotInsurance";
import type { PotShare } from "./PotShares";

type Side = 0 | 1;

interface OutsQuickCalcProps {
  rule: InsuranceRule;
  /** Everyone at the table, in its order. The first two start the pot. */
  seats: readonly InsuranceSeat[];
  /**
   * A player's counted chips, which update the table at once. Missing for the standalone
   * calculator, which has no table.
   */
  onStack: ((playerId: string, chips: number) => void) | undefined;
  saving: boolean | undefined;
  decisions: Decisions | undefined;
}

const STREETS: readonly { readonly id: InsuranceStreet; readonly label: string }[] = [
  { id: "turn", label: "转牌" },
  { id: "river", label: "河牌" },
];

/** The pen is there as in the other way of working, but what it opens is still to come. */
const comingSoon = () => window.alert("功能开发中");

const percentText = (share: number) => `${(share * 100).toFixed(1)}%`;

/** The trailing side's cards: those that win outright, and those that split the pot. */
interface OutsEntry {
  readonly outs: number;
  readonly ties: number;
}

/** The cards as sold: 6+2 when ties are sold with the outs, or just 6. */
const soldText = ({ outs, ties }: OutsEntry, tiesSold: boolean) =>
  tiesSold && ties > 0 ? `${outs}+${ties}` : String(outs);

const cardCount = (value: string) => value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

/** Dead money as a pot starts with it, not yet set by the organizer. */
const PRESET_DEAD = { pools: [PRESET_DEAD_CHIPS] as readonly number[], preset: true };

const stepClass =
  "grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-surface text-highlight disabled:opacity-30";

/** A card count typed in or nudged one at a time, between `min` and `max`. */
function CardStepper({
  id,
  label,
  text,
  min,
  max,
  inputRef,
  onChange,
}: {
  id: string;
  label: string;
  text: string;
  min: number;
  max: number;
  inputRef?: Ref<HTMLInputElement>;
  onChange: (text: string) => void;
}) {
  const value = parseChips(text) ?? 0;
  const step = (by: number) => onChange(String(Math.min(max, Math.max(min, value + by))));
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm text-muted">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`${label}减一`}
          disabled={value <= min}
          onClick={() => step(-1)}
          className={stepClass}
        >
          <Minus className="size-5" aria-hidden />
        </button>
        <div className="flex min-h-11 w-28 items-center gap-1 rounded-xl border border-line bg-surface px-3 focus-within:border-highlight">
          <input
            ref={inputRef}
            id={id}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={text}
            onChange={(event) => onChange(cardCount(event.target.value))}
            className="min-w-0 flex-1 bg-transparent text-center text-lg font-semibold tabular-nums outline-none"
          />
          <span className="text-muted">张</span>
        </div>
        <button
          type="button"
          aria-label={`${label}加一`}
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
  const [text, setText] = useState(String(entry?.outs ?? 4));
  const [tieText, setTieText] = useState(String(entry?.ties ?? 0));
  const inputRef = useRef<HTMLInputElement>(null);
  const outs = parseChips(text) ?? 0;
  const ties = parseChips(tieText) ?? 0;
  // Each kind of card is priced by its own count, so each has the odds table to itself. Tie cards
  // that are not sold need no odds.
  const outsMax = Math.min(unseen - ties, maxOuts);
  const tiesMax = Math.min(unseen - outs, tiesSold ? maxOuts : unseen);
  const valid = outs + ties >= 1 && outs <= outsMax && ties <= tiesMax;

  // Selected, so the first digit replaces the starting count
  useEffect(() => {
    inputRef.current?.select();
  }, []);

  return (
    <Modal title={`${name} 的 Outs`} onClose={onCancel}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) onConfirm({ outs, ties });
        }}
        className="flex flex-col items-center gap-3"
      >
        <CardStepper
          id="quick-outs"
          label="反超牌"
          text={text}
          min={0}
          max={outsMax}
          inputRef={inputRef}
          onChange={setText}
        />
        <CardStepper
          id="quick-ties"
          label={tiesSold ? "平分牌" : "平分牌（不算 outs）"}
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
            取消
          </button>
          <button
            type="submit"
            disabled={!valid}
            className="min-h-11 rounded-xl bg-accent font-semibold text-accent-text disabled:opacity-40"
          >
            确认
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * A quick price from two players' chips and the trailing player's outs, without picking cards. The
 * page is laid out as it is for a hand worked out from the cards: the pot, the players and the
 * insurance under them, which shows as soon as there is enough to price it.
 */
export function OutsQuickCalc({ rule, seats, onStack, saving, decisions }: OutsQuickCalcProps) {
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
  // Asking whether the card came, once every offer is decided
  const [recording, setRecording] = useState(false);
  // Dead money's field, where a tap on dead money in the pot's legend lands
  const deadRef = useRef<HTMLInputElement>(null);

  const nameOf = (id: string) => seats.find((s) => s.id === id)?.name ?? "未知玩家";
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

  /** Counted chips are the player's true stack, so they go to the table once typing is done. */
  function commitChips(side: Side) {
    const player = players[side];
    if (player && !player.cover && player.chips > 0) onStack?.(player.playerId, player.chips);
  }

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
    const keyOf = (kind: OfferKind) =>
      [
        "quick",
        kind,
        leaderId,
        trailerId,
        street,
        totals.effectiveChips,
        leaderStake,
        entry.outs,
        entry.ties,
        rule.tieOuts,
      ].join("|");
    const overtake: PotCoverOffer = {
      kind: "overtake",
      input: { ...input, outs: entry.outs },
      playerId: leaderId,
      decisionKey: keyOf("overtake"),
      onManage: comingSoon,
      name: "反超",
      count: entry.outs,
      // Tie cards a rule does not sell are still named, so nobody takes them for outs
      outsLines: !tiesSold && entry.ties > 0 ? [`平分 ${entry.ties} 张（不计入）`] : [],
    };
    if (!tiesSold || entry.ties === 0) return [overtake];
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
      onManage: comingSoon,
      name: "平分",
      count: entry.ties,
    };
    return entry.outs > 0 ? [overtake, tie] : [tie];
  }

  const offers =
    ready && leaderPlayer && trailerPlayer && trailerEntry
      ? quickOffers(leaderPlayer.playerId, trailerPlayer.playerId, trailerEntry)
      : [];
  // Once a cover is bought, the pot it was priced on stays as it is
  const locked = offers.some((o) => decisions?.get(o.decisionKey)?.kind === "bought");
  // Every offer that can be sold is bought or turned down. Away from a game nothing is recorded.
  const decided = offers.every(
    (o) => !decisions || decisions.get(o.decisionKey) !== undefined || !quoteInsurance(o.input).ok,
  );

  /** Whether the card came, for every offer: at most one kind of card can have. */
  function record(hit: OfferKind | undefined) {
    for (const offer of offers) decisions?.settle?.(offer.decisionKey, offer.kind === hit);
    // The pot is played out, so the next one starts without outs
    setOuts([undefined, undefined]);
    setRecording(false);
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
            label: "死钱",
            chips: totals.deadChips,
            note:
              chances && chances.ties > 0
                ? `平分 ${chances.ties} · ${percentText(chances.tie)}`
                : undefined,
            onSelect: locked ? undefined : () => deadRef.current?.focus(),
          },
        ]
      : undefined;

  // What the pot still needs before it can be priced, in the order it is entered
  const missing = [
    ...(players.length < MIN_PLAYERS ? ["两位玩家"] : []),
    ...players.flatMap((player, index) => {
      const needs = [
        ...(staked(player) ? [] : ["筹码"]),
        ...(index === trailer && trailerEntry === undefined ? ["Outs"] : []),
      ];
      return needs.length > 0 ? [`${nameOf(player.playerId)}（${needs.join("、")}）`] : [];
    }),
  ];

  return (
    <>
      <section aria-labelledby="quick-pot-title" className="mt-1">
        <SectionTitle id="quick-pot-title" title="底池信息" />
        <div className="relative flex flex-wrap items-stretch justify-center gap-1.5">
          {!locked && (
            <SectionReset
              label="清空底池信息"
              onReset={() => {
                setStreet("turn");
                setDead(PRESET_DEAD);
              }}
            />
          )}
          {/* Framed like a street of the board, with the card the insurance is on picked inside */}
          <fieldset className="flex shrink-0 flex-col items-center gap-1 rounded-xl border-2 border-line bg-surface px-2 pt-2 pb-1">
            <legend className="sr-only">保哪张牌</legend>
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
              保哪张牌
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
        <SectionTitle id="quick-players-title" title="池内玩家" />
        {seats.length < MIN_PLAYERS && (
          <p className="mb-2 text-sm text-muted">桌上至少要有两位玩家，才能算保险。</p>
        )}
        <ul className="flex flex-col gap-2">
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
                          takenIds: players.filter((p) => p !== player).map((p) => p.playerId),
                          // At a table another player is another pot: their own chips, no cover and no
                          // outs. Away from one the name is only a label, and what was entered stays.
                          onSeat: (id) => {
                            if (onStack) setSideOuts(side, undefined);
                            setEdited(
                              withSide(side, {
                                playerId: id,
                                ...(onStack && {
                                  chips: seats.find((s) => s.id === id)?.chips ?? 0,
                                  cover: false,
                                }),
                              }),
                            );
                          },
                          onChips: (chips) => setEdited(withSide(side, { chips })),
                          onChipsDone: () => commitChips(side),
                          onCover: (cover) => setCover(side, cover),
                          lead: {
                            kind: "reset",
                            label: `清空${name}的 Outs`,
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
                        领先
                      </span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-label={`填写${name}的 Outs`}
                      disabled={locked}
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
        </ul>
        {players.length === MIN_PLAYERS && !locked && (
          <RoundAction label="切换领先" onSelect={() => setLeader(trailer)}>
            <ArrowUpDown className="size-4" aria-hidden />
          </RoundAction>
        )}
      </section>

      <section aria-labelledby="quick-insurance-title" className="mt-3">
        <SectionTitle id="quick-insurance-title" title="保险信息" />
        {ready && parts ? (
          <>
            <PotCover
              label="主池"
              parts={parts}
              potChips={totals.effectiveChips}
              offers={offers}
              saving={saving}
              decisions={decisions}
            />
            <button
              type="button"
              disabled={!decided}
              onClick={() => setRecording(true)}
              className="mt-3 min-h-12 w-full rounded-xl bg-accent font-semibold text-accent-text disabled:opacity-40"
            >
              记录{streetText}
            </button>
          </>
        ) : (
          <p className="text-sm text-muted">
            {missing.length > 0
              ? `还差：${missing.join("、")}。填好后这里直接显示保险。`
              : "只能有一位玩家 Cover，至少两位玩家才能算保险。"}
          </p>
        )}
      </section>

      {recording && (
        <Modal title={`${streetText}击中保险？`} onClose={() => setRecording(false)}>
          <div className="flex flex-col gap-2">
            {/* With both kinds of card on sale, a hit says which kind came */}
            {offers.map(({ kind, name }) => (
              <button
                key={kind}
                type="button"
                onClick={() => record(kind)}
                className="min-h-12 rounded-xl bg-accent font-semibold text-accent-text"
              >
                {offers.length > 1 ? `击中${name}` : "击中"}
              </button>
            ))}
            <button
              type="button"
              onClick={() => record(undefined)}
              className="min-h-12 rounded-xl border border-line font-medium"
            >
              未击中
            </button>
          </div>
        </Modal>
      )}

      {editingOuts && (
        <OutsDialog
          name={trailerPlayer ? nameOf(trailerPlayer.playerId) : "落后一方"}
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
