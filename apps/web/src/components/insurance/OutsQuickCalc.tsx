import {
  handPotEntries,
  type InsuranceHandPlayer,
  type InsuranceRule,
  type InsuranceStreet,
  outsHitChance,
  parseChips,
  potTotals,
  stakeOf,
} from "@holdem-knight/core";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TextField } from "@/components/TextField";
import { cn } from "@/lib/cn";
import { DeadMoneyDialog } from "./DeadMoneyDialog";
import type { InsuranceSeat } from "./InsuranceCalculator";
import { type Decisions, LeaderQuote } from "./LeaderQuote";
import { Modal } from "./Modal";
import { PlayerChipsDialog } from "./PlayerChipsDialog";
import { PotShares } from "./PotShares";
import { SeatPicker } from "./SeatPicker";

type Side = 0 | 1;

/** A side being filled in: first the seat, then the chips. */
type Adding =
  | { readonly side: Side; readonly stage: "seat" }
  | { readonly side: Side; readonly stage: "chips"; readonly entry: InsuranceHandPlayer };

interface OutsQuickCalcProps {
  rule: InsuranceRule;
  seats: readonly InsuranceSeat[];
  saving: boolean | undefined;
  decisions: Decisions | undefined;
}

const chipText = (chips: number) => chips.toLocaleString("zh-CN");
const percentText = (share: number) => `${(share * 100).toFixed(1)}%`;

const toggleClass = (active: boolean) =>
  cn(
    "min-h-11 rounded-xl border px-3 font-medium",
    active ? "border-accent bg-accent text-accent-text" : "border-line bg-surface",
  );

function OutsDialog({
  name,
  outs,
  onConfirm,
  onCancel,
}: {
  name: string;
  outs: number | undefined;
  onConfirm: (outs: number) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(outs?.toString() ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const typed = parseChips(text);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  return (
    <Modal title={`${name} 的 Outs`} onClose={onCancel}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (typed !== null) onConfirm(typed);
        }}
      >
        <TextField
          id="quick-outs"
          label="反超牌张数"
          value={text}
          issue={undefined}
          suffix="张"
          inputMode="numeric"
          inputRef={inputRef}
          onChange={(value) => setText(value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""))}
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-line font-medium"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={typed === null}
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
  outs: number | undefined;
  /** The trailing side's chance to come from behind, once its outs are known. */
  hitChance: number | undefined;
  onSeat: () => void;
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
      <button
        type="button"
        aria-label={player ? `修改${name}的筹码` : "填写筹码"}
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
export function OutsQuickCalc({ rule, seats, saving, decisions }: OutsQuickCalcProps) {
  const [street, setStreet] = useState<InsuranceStreet>("turn");
  const [sides, setSides] = useState<
    readonly [InsuranceHandPlayer | undefined, InsuranceHandPlayer | undefined]
  >([undefined, undefined]);
  const [leader, setLeader] = useState<Side>(0);
  // Kept per side, so switching the lead back and forth keeps what was typed
  const [outs, setOuts] = useState<readonly [number | undefined, number | undefined]>([
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
  const bothIn = players.length === 2;

  const trailer: Side = leader === 0 ? 1 : 0;
  const leaderPlayer = sides[leader];
  const trailerPlayer = sides[trailer];
  const trailerOuts = outs[trailer];

  function setSide(side: Side, entry: InsuranceHandPlayer | undefined) {
    setSides(side === 0 ? [entry, sides[1]] : [sides[0], entry]);
  }

  const ready = leaderPlayer && trailerPlayer && trailerOuts !== undefined;
  const quoted = Boolean(ready);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the quote opening below scrolls again
  useEffect(() => {
    // Once both players are in, put dead money at the top
    if (bothIn) deadRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [bothIn, quoted]);
  const leaderStake =
    leaderPlayer && trailerPlayer
      ? Math.min(stakeOf(leaderPlayer, players), stakeOf(trailerPlayer, players))
      : 0;

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
            return (
              <SideCard
                key={side}
                player={player}
                name={player ? nameOf(player.playerId) : ""}
                leading={leader === side}
                outs={outs[side]}
                hitChance={
                  trailerOuts === undefined ? undefined : outsHitChance(street, trailerOuts)
                }
                onSeat={() => setAdding({ side, stage: "seat" })}
                onChips={() =>
                  setAdding(
                    player ? { side, stage: "chips", entry: player } : { side, stage: "seat" },
                  )
                }
                onOuts={() => setEditingOuts(true)}
                onLead={() => setLeader(side)}
              />
            );
          })}
        </div>
        {leaderPlayer && trailerPlayer && (
          <div className="mt-2">
            <PotShares
              parts={[
                { key: "leader", label: nameOf(leaderPlayer.playerId), chips: leaderStake },
                { key: "trailer", label: nameOf(trailerPlayer.playerId), chips: leaderStake },
                { key: "dead", label: "死钱", chips: totals.deadChips },
              ]}
              uncalledChips={totals.uncalledChips}
            />
          </div>
        )}
      </section>

      {ready ? (
        <section aria-label="保险报价" className="rounded-xl border border-line bg-surface p-3">
          <h3 className="font-semibold">
            {nameOf(leaderPlayer.playerId)} 领先 · {trailerOuts} outs
            <span className="ml-1 text-sm font-normal text-muted">
              投入 {chipText(leaderStake)} · 可得 {chipText(totals.effectiveChips)}
            </span>
          </h3>
          <LeaderQuote
            id="quick"
            decisionKey={[
              "quick",
              leaderPlayer.playerId,
              trailerPlayer.playerId,
              street,
              totals.effectiveChips,
              leaderStake,
              trailerOuts,
            ].join("|")}
            input={{
              rule,
              street,
              potChips: totals.effectiveChips,
              shareChips: totals.effectiveChips,
              stakeChips: leaderStake,
              outs: trailerOuts,
            }}
            playerId={leaderPlayer.playerId}
            saving={saving}
            decisions={decisions}
          />
        </section>
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
          outs={trailerOuts}
          onConfirm={(count) => {
            setOuts(trailer === 0 ? [count, outs[1]] : [outs[0], count]);
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
              setAdding({
                side: adding.side,
                stage: "chips",
                entry: { playerId: id, chips: 0, cover: false, cards: [] },
              });
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
            if (adding.side === trailer && outs[trailer] === undefined) setEditingOuts(true);
          }}
          onCancel={() => setAdding(undefined)}
        />
      )}
    </div>
  );
}
