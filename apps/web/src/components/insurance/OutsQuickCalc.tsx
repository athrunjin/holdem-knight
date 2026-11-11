import {
  handPotEntries,
  type InsuranceHandPlayer,
  type InsuranceRule,
  type InsuranceStreet,
  outsHitChance,
  parseChips,
  potTotals,
  stakeOf,
  unseenCards,
} from "@holdem-knight/core";
import { Minus, Plus } from "lucide-react";
import { type Ref, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { DeadMoneyDialog } from "./DeadMoneyDialog";
import type { InsuranceSeat } from "./InsuranceCalculator";
import type { Decisions } from "./LeaderQuote";
import { Modal } from "./Modal";
import { PlayerChipsDialog } from "./PlayerChipsDialog";
import { PotCover } from "./PotInsurance";
import { type PotShare, PotShares } from "./PotShares";
import { SeatPicker } from "./SeatPicker";

type Side = 0 | 1;

/** A side being filled in: first the seat, then the chips. */
type Adding =
  | { readonly side: Side; readonly stage: "seat" }
  | {
      readonly side: Side;
      readonly stage: "chips";
      readonly entry: InsuranceHandPlayer;
      /** Go on to the outs afterwards, as a quick edit of the trailing side does. */
      readonly thenOuts?: boolean;
    };

interface OutsQuickCalcProps {
  rule: InsuranceRule;
  seats: readonly InsuranceSeat[];
  /** Seats the two sides as the first two seats instead of asking who they are. */
  autoSeat: boolean;
  saving: boolean | undefined;
  decisions: Decisions | undefined;
}

const chipText = (chips: number) => chips.toLocaleString("zh-CN");
const percentText = (share: number) => `${(share * 100).toFixed(2)}%`;

const toggleClass = (active: boolean) =>
  cn(
    "min-h-11 rounded-xl border px-3 font-medium",
    active ? "border-accent bg-accent text-accent-text" : "border-line bg-surface",
  );

/** The trailing side's cards: those that win outright, and those that split the pot. */
interface OutsEntry {
  readonly outs: number;
  readonly ties: number;
}

/** The cards as sold: 6+2 when ties are sold with the outs, or just 6. */
const soldText = ({ outs, ties }: OutsEntry, tiesSold: boolean) =>
  tiesSold && ties > 0 ? `${outs}+${ties}` : String(outs);

const cardCount = (value: string) => value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

const blankPlayer = (playerId: string): InsuranceHandPlayer => ({
  playerId,
  chips: 0,
  cover: false,
  cards: [],
});

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
  // Tie cards take room in the odds table only when they are sold
  const outsMax = Math.min(unseen - ties, maxOuts - (tiesSold ? ties : 0));
  const tiesMax = (tiesSold ? Math.min(unseen, maxOuts) : unseen) - outs;
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

/** Dead money, lit until it has been confirmed, even as zero. */
function DeadMoneyRow({
  chips,
  entered,
  onEdit,
}: {
  chips: number;
  entered: boolean;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="编辑死钱"
      onClick={onEdit}
      className={cn(
        "flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border px-3",
        entered ? "border-line bg-surface" : "border-highlight bg-highlight/10 text-highlight",
      )}
    >
      <span className="text-sm">{entered ? "死钱" : "死钱 · 请确认"}</span>
      <span className="flex items-center gap-2">
        <span className="text-lg font-semibold tabular-nums">{chipText(chips)}</span>
        <Plus className="size-5 text-highlight" aria-hidden />
      </span>
    </button>
  );
}

/** One side of the pot: who, what they put in, and either the lead or the outs against it. */
function SideCard({
  player,
  name,
  leading,
  outs,
  hitChance,
  onSeat,
  onChips,
  onOuts,
  onLead,
}: {
  player: InsuranceHandPlayer | undefined;
  name: string;
  leading: boolean;
  /** The trailing side's cards as sold, once they are known. */
  outs: string | undefined;
  /** The trailing side's chance to come from behind, once its outs are known. */
  hitChance: number | undefined;
  /** Missing when the seat is given rather than picked. */
  onSeat: (() => void) | undefined;
  onChips: () => void;
  onOuts: () => void;
  onLead: () => void;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-xl border-2 p-2 transition-colors",
        leading ? "border-accent bg-accent/10" : "border-line bg-bg",
      )}
    >
      {!onSeat ? (
        <span className="flex min-h-11 items-center justify-center rounded-lg px-2 font-semibold">
          <span className="truncate">{name}</span>
        </span>
      ) : (
        <button
          type="button"
          aria-label={player ? `更换${name}` : "选择玩家"}
          onClick={onSeat}
          className={cn(
            "flex min-h-11 items-center justify-center gap-1 rounded-lg border px-2",
            player
              ? "border-line bg-surface font-semibold"
              : "border-dashed border-line text-highlight",
          )}
        >
          {player ? (
            <span className="truncate">{name}</span>
          ) : (
            <Plus className="size-5" aria-hidden />
          )}
        </button>
      )}
      <button
        type="button"
        aria-label={name ? `修改${name}的筹码` : "填写筹码"}
        onClick={onChips}
        className={cn(
          "flex min-h-11 items-center justify-between gap-1 rounded-lg border px-2",
          player ? "border-line bg-surface" : "border-dashed border-line",
        )}
      >
        <span className="text-xs text-muted">筹码</span>
        <span className="font-semibold tabular-nums">
          {player ? (player.cover ? "Cover" : chipText(player.chips)) : "—"}
        </span>
      </button>
      {leading ? (
        <span className="flex min-h-14 flex-col items-center justify-center rounded-lg bg-accent text-accent-text">
          <span className="text-lg leading-tight font-bold">领先</span>
          {hitChance !== undefined && (
            <span className="text-xs tabular-nums">被反超 {percentText(hitChance)}</span>
          )}
        </span>
      ) : (
        <div className="grid min-h-14 grid-cols-[1fr_auto] gap-1">
          <button
            type="button"
            aria-label="填写 Outs"
            onClick={onOuts}
            className={cn(
              "flex flex-col items-center justify-center rounded-lg border",
              outs === undefined
                ? "border-dashed border-line text-muted"
                : "border-line bg-surface",
            )}
          >
            <span className="text-xs text-muted">Outs</span>
            <span className="text-lg leading-tight font-semibold tabular-nums">{outs ?? "—"}</span>
          </button>
          <button
            type="button"
            onClick={onLead}
            className="w-11 rounded-lg border border-line bg-surface px-1 text-xs leading-tight font-medium"
          >
            切换领先
          </button>
        </div>
      )}
    </div>
  );
}

/** A quick price from two players' chips and the trailing player's outs, without picking cards. */
export function OutsQuickCalc({ rule, seats, autoSeat, saving, decisions }: OutsQuickCalcProps) {
  const [street, setStreet] = useState<InsuranceStreet>("turn");
  const [sides, setSides] = useState<
    readonly [InsuranceHandPlayer | undefined, InsuranceHandPlayer | undefined]
  >([undefined, undefined]);
  const [leader, setLeader] = useState<Side>(0);
  // Kept per side, so switching the lead back and forth keeps what was typed
  const [outs, setOuts] = useState<readonly [OutsEntry | undefined, OutsEntry | undefined]>([
    undefined,
    undefined,
  ]);
  // Undefined until the organizer confirms it, even as zero
  const [pools, setPools] = useState<readonly number[]>();
  const [adding, setAdding] = useState<Adding>();
  const [editingOuts, setEditingOuts] = useState(false);
  const [editingDead, setEditingDead] = useState(false);

  const nameOf = (id: string) => seats.find((s) => s.id === id)?.name ?? "未知玩家";
  const players = sides.filter((p): p is InsuranceHandPlayer => p !== undefined);
  const totals = potTotals(handPotEntries({ players, pools: pools ?? [] }));
  const deadRef = useRef<HTMLDivElement>(null);

  const trailer: Side = leader === 0 ? 1 : 0;
  const leaderPlayer = sides[leader];
  const trailerPlayer = sides[trailer];
  const trailerEntry = outs[trailer];
  // Tie cards are sold with the outs only when the rule says so
  const tiesSold = rule.tieOuts === "include";
  const trailerOuts = trailerEntry && trailerEntry.outs + (tiesSold ? trailerEntry.ties : 0);

  function setSide(side: Side, entry: InsuranceHandPlayer | undefined) {
    setSides(side === 0 ? [entry, sides[1]] : [sides[0], entry]);
  }

  /** Starts on an empty side: at the seat picker, or straight at the chips of the seat it is given. */
  function addSide(side: Side) {
    const seat = autoSeat ? seats[side] : undefined;
    setAdding(
      seat ? { side, stage: "chips", entry: blankPlayer(seat.id) } : { side, stage: "seat" },
    );
  }

  const ready = leaderPlayer && trailerPlayer && trailerEntry && trailerOuts !== undefined;
  const quoted = Boolean(ready);
  // What the next card does, once the trailing side's cards are known
  const chances = trailerEntry && {
    ...trailerEntry,
    hit: outsHitChance(street, trailerEntry.outs),
    tie: outsHitChance(street, trailerEntry.ties),
    win: 1 - outsHitChance(street, trailerEntry.outs + trailerEntry.ties),
  };

  // Once everything above is in and the quote opens, put dead money at the top
  useEffect(() => {
    if (quoted) deadRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [quoted]);

  const leaderStake =
    leaderPlayer && trailerPlayer
      ? Math.min(stakeOf(leaderPlayer, players), stakeOf(trailerPlayer, players))
      : 0;

  // Who put what into the pot, once both sides are in
  const parts: PotShare[] | undefined =
    leaderPlayer && trailerPlayer
      ? [
          {
            key: "leader",
            tone: "leader",
            label: nameOf(leaderPlayer.playerId),
            chips: leaderStake,
            note: chances && percentText(chances.win),
            onSelect: () => setAdding({ side: leader, stage: "chips", entry: leaderPlayer }),
          },
          {
            key: "trailer",
            tone: "trailer",
            label: nameOf(trailerPlayer.playerId),
            chips: leaderStake,
            note: chances && `Outs ${chances.outs} · ${percentText(chances.hit)}`,
            onSelect: () =>
              setAdding({
                side: trailer,
                stage: "chips",
                entry: trailerPlayer,
                thenOuts: true,
              }),
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
            onSelect: () => setEditingDead(true),
          },
        ]
      : undefined;

  const missing =
    !leaderPlayer || !trailerPlayer ? "先选好两位玩家和筹码。" : "填好落后一方的 Outs 后开始计算。";

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-pressed={street === "turn"}
          onClick={() => setStreet("turn")}
          className={toggleClass(street === "turn")}
        >
          保转牌
        </button>
        <button
          type="button"
          aria-pressed={street === "river"}
          onClick={() => setStreet("river")}
          className={toggleClass(street === "river")}
        >
          保河牌
        </button>
      </div>

      <section aria-labelledby="quick-pot-title">
        <h2 id="quick-pot-title" className="mb-2 font-semibold">
          底池信息
        </h2>
        <div ref={deadRef} className="scroll-mt-2">
          <DeadMoneyRow
            chips={totals.deadChips}
            entered={pools !== undefined}
            onEdit={() => setEditingDead(true)}
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {([0, 1] as const).map((side) => {
            const player = sides[side];
            const sideOuts = outs[side];
            const given = autoSeat ? seats[side] : undefined;
            return (
              <SideCard
                key={side}
                player={player}
                name={given?.name ?? (player ? nameOf(player.playerId) : "")}
                leading={leader === side}
                outs={sideOuts && soldText(sideOuts, tiesSold)}
                hitChance={chances?.hit}
                onSeat={given ? undefined : () => setAdding({ side, stage: "seat" })}
                onChips={() =>
                  player ? setAdding({ side, stage: "chips", entry: player }) : addSide(side)
                }
                onOuts={() => setEditingOuts(true)}
                onLead={() => setLeader(side)}
              />
            );
          })}
        </div>
        {parts && !ready && (
          <div className="mt-2">
            <PotShares parts={parts} />
          </div>
        )}
      </section>

      {ready && parts ? (
        <PotCover
          label="主池"
          parts={parts}
          input={{
            rule,
            street,
            potChips: totals.effectiveChips,
            shareChips: totals.effectiveChips,
            stakeChips: leaderStake,
            outs: trailerOuts,
          }}
          playerId={leaderPlayer.playerId}
          decisionKey={[
            "quick",
            leaderPlayer.playerId,
            trailerPlayer.playerId,
            street,
            totals.effectiveChips,
            leaderStake,
            trailerEntry.outs,
            trailerEntry.ties,
            rule.tieOuts,
          ].join("|")}
          outsText={`${soldText(trailerEntry, tiesSold)} outs`}
          saving={saving}
          decisions={decisions}
        />
      ) : (
        <p className="text-sm text-muted">{missing}</p>
      )}

      {editingDead && (
        <DeadMoneyDialog
          pools={(pools ?? []).map(String)}
          onConfirm={(next) => {
            setPools(next.map(Number));
            setEditingDead(false);
          }}
          onCancel={() => setEditingDead(false)}
        />
      )}

      {editingOuts && (
        <OutsDialog
          name={trailerPlayer ? nameOf(trailerPlayer.playerId) : "落后一方"}
          entry={trailerEntry}
          unseen={unseenCards(street)}
          maxOuts={rule.oddsHundredths.length}
          tiesSold={tiesSold}
          onConfirm={(entry) => {
            setOuts(trailer === 0 ? [entry, outs[1]] : [outs[0], entry]);
            setEditingOuts(false);
          }}
          onCancel={() => setEditingOuts(false)}
        />
      )}

      {adding?.stage === "seat" && (
        <SeatPicker
          seats={seats}
          takenSeats={players.map((p) => p.playerId)}
          onPick={({ id }) => {
            const current = sides[adding.side];
            if (current) {
              // A different player in the same place keeps the chips already entered
              setSide(adding.side, { ...current, playerId: id });
              setAdding(undefined);
            } else {
              setAdding({ side: adding.side, stage: "chips", entry: blankPlayer(id) });
            }
          }}
          onClose={() => setAdding(undefined)}
        />
      )}

      {adding?.stage === "chips" && (
        <PlayerChipsDialog
          name={nameOf(adding.entry.playerId)}
          chips={adding.entry.chips}
          cover={adding.entry.cover}
          coverTaken={sides[adding.side === 0 ? 1 : 0]?.cover ?? false}
          onConfirm={(chips) => {
            setSide(adding.side, { ...adding.entry, ...chips });
            setAdding(undefined);
            // The trailing side's outs come straight after its chips
            if (adding.thenOuts || (adding.side === trailer && outs[trailer] === undefined)) {
              setEditingOuts(true);
            }
          }}
          onCancel={() => setAdding(undefined)}
        />
      )}
    </div>
  );
}
