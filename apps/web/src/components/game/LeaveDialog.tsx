import {
  type Cents,
  cents,
  chargeStatuses,
  chargesFrom,
  chipsToCents,
  type Game,
  gameRecord,
  type LedgerEvent,
  parseChips,
  type RecordEntry,
  summarizeByPlayer,
} from "@holdem-knight/core";
import { type FormEvent, useState } from "react";
import { InfoButton } from "@/components/InfoButton";
import { TextField } from "@/components/TextField";
import { formatSeatTime, gameMinuteOfDay } from "@/lib/charges";
import { formatSignedChips, netColor } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { formatGameAmount, formatGameMoney } from "@/lib/currency";
import { FormDialog } from "./FormDialog";
import { HandsStepper } from "./HandsStepper";
import { TotalChip } from "./ResultCards";

/** More records than this open from an info icon instead of showing in the dialog. */
const MAX_INLINE_RECORDS = 8;

const TIME = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

interface LeaveDialogProps {
  game: Game;
  events: readonly LedgerEvent[];
  playerId: string;
  name: string;
  saving: boolean;
  saveFailed: boolean;
  /** `leftAt` is when the dialog opened, so the charges shown are the charges made. */
  onSubmit: (chips: number, hands: number | undefined, leftAt: number) => void;
  onClose: () => void;
}

function Line({ label, amount, off }: { label: string; amount?: string; off?: boolean }) {
  const tone = off ? "text-muted line-through" : "text-muted";
  return (
    <div className="flex min-h-7 items-center justify-between gap-2">
      <span className={cn("min-w-0 truncate", tone)}>{label}</span>
      {amount !== undefined && <span className={cn("shrink-0 tabular-nums", tone)}>{amount}</span>}
    </div>
  );
}

/**
 * A player's result before they leave the table, laid out like their settlement card: final
 * Buy-ins and chips to confirm, the time sat with the wages and table fee it comes to, and their
 * Buy-in record. The charges are worked out once, for the moment the dialog opened, and stay still
 * while it is open. Closing it without leaving changes nothing, so the time goes on counting.
 */
export function LeaveDialog({
  game,
  events,
  playerId,
  name,
  saving,
  saveFailed,
  onSubmit,
  onClose,
}: LeaveDialogProps) {
  const { handChips, chipRatio: ratio, currency } = game;
  const [openedAt] = useState(Date.now);
  const player = summarizeByPlayer(events).find((p) => p.playerId === playerId);
  const boughtChips = player?.boughtChips ?? 0;
  const cashedOutChips = player?.cashedOutChips ?? 0;
  const initialHands = handChips === undefined ? undefined : boughtChips / handChips;
  const [handsValue, setHandsValue] = useState(String(initialHands ?? ""));
  const [countedHands, setCountedHands] = useState(initialHands ?? 0);
  const [chipsValue, setChipsValue] = useState(String(player?.stackChips ?? 0));
  const [issue, setIssue] = useState<string>();
  const chips = parseChips(chipsValue);
  const money = (value: number) => formatGameMoney(chipsToCents(value, ratio), currency);
  const amount = (value: Cents) =>
    formatGameAmount(value, currency, value === 0 ? "auto" : "exceptZero");
  /** Buy-ins where the game counts them, chips where it does not. */
  const buyIns = (value: number) =>
    handChips === undefined
      ? `${value.toLocaleString("zh-CN")} 筹码`
      : `${value / handChips} 个 Buy-in`;

  /** Chips follow the Buy-in count, as they do on the player row. */
  function changeHands(next: string) {
    setHandsValue(next);
    setIssue(undefined);
    const hands = parseChips(next);
    if (handChips === undefined || !hands) return;
    if (chips !== null) {
      setChipsValue(String(Math.max(0, chips + (hands - countedHands) * handChips)));
    }
    setCountedHands(hands);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (chips === null) {
      setIssue("请输入整数筹码数");
    } else if (handChips !== undefined && !parseChips(handsValue)) {
      setIssue("请输入大于 0 的整数 Buy-in");
    } else {
      onSubmit(chips, handChips === undefined ? undefined : countedHands, openedAt);
    }
  }

  const finalBought =
    handChips === undefined
      ? boughtChips
      : boughtChips + (countedHands - (initialHands ?? 0)) * handChips;
  const net = chips === null ? null : chips + cashedOutChips - finalBought;

  // Charged as of the moment the dialog opened, which is also when the player is recorded leaving
  const statuses =
    game.tableFee || game.wage
      ? chargeStatuses(game, events, { now: openedAt, minuteOfDay: gameMinuteOfDay(game) })
      : [];
  const status = statuses.find((s) => s.playerId === playerId);
  const charges = chargesFrom(game, statuses).filter((c) => c.playerId === playerId);
  const wages = charges.filter((c) => c.kind === "wage");
  const fee = charges.find((c) => c.kind === "table_fee");
  const due = charges.filter((c) => !c.waived).reduce((total, c) => total + c.amount, 0);
  const billedMinutes = status?.wageParts.reduce((all, part) => all + part.minutes, 0) ?? 0;
  const cash = net === null ? null : chipsToCents(net, ratio);

  const records = gameRecord(events).filter((entry) => entry.playerId === playerId);
  const timesBought = records.filter((r) => r.kind === "buy_in" || r.kind === "rebuy").length;
  let running = 0;
  const recordLines = records.flatMap((entry) => {
    const text = recordText(entry);
    return text ? [{ id: entry.id, time: TIME.format(entry.occurredAt), text }] : [];
  });

  /** One line of the player's record, with the Buy-ins so far after each change. */
  function recordText({ kind, chips: moved }: RecordEntry) {
    const total = () => `${running.toLocaleString("zh-CN")} 筹码（${money(running)}）`;
    switch (kind) {
      case "buy_in":
        running += moved;
        return `上桌 · 带入 ${buyIns(moved)}`;
      case "rebuy":
        running += moved;
        return `补码 ${buyIns(moved)} / ${total()}`;
      case "reduce":
        running -= moved;
        return `退回 ${buyIns(moved)} / ${total()}`;
      case "remove":
        running -= moved;
        return "移出";
      case "cash_out": {
        const result = moved - running;
        const resultCash = formatGameMoney(chipsToCents(result, ratio), currency, "exceptZero");
        return `下桌 · 带出 ${moved.toLocaleString("zh-CN")} 筹码 / ${formatSignedChips(result)} / ${resultCash}`;
      }
      case "return":
        return "回桌";
      default:
        // Stack changes and insurance are in the game record, not the Buy-in record
        return undefined;
    }
  }

  const recordList = (
    <ul className="divide-y divide-line text-xs">
      {recordLines.map(({ id, time, text }) => (
        <li key={id} className="flex min-h-7 items-center gap-2 py-0.5">
          <span className="shrink-0 text-muted tabular-nums">{time}</span>
          <span className="min-w-0">{text}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <FormDialog
      title={`结算并下桌 · ${name}`}
      submitLabel="确认下桌"
      saving={saving}
      saveFailed={saveFailed}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      {handChips !== undefined && <HandsStepper value={handsValue} onChange={changeHands} />}
      <TextField
        id="leave-chips"
        label="筹码数"
        value={chipsValue}
        issue={issue}
        suffix="筹码"
        inputMode="numeric"
        onChange={(next) => {
          setIssue(undefined);
          setChipsValue(next);
        }}
      />

      <section aria-label="结算" className="overflow-hidden rounded-xl border border-line text-xs">
        <div className="flex min-h-9 items-center justify-between gap-2 bg-accent/15 px-2 text-sm tabular-nums">
          <span>
            水上/下{" "}
            <span className={net === null ? "text-muted" : netColor(net)}>
              {net === null ? "—" : formatSignedChips(net)}
            </span>
          </span>
          <span className={cash === null ? "text-muted" : netColor(cash)}>
            {cash === null ? "—" : amount(cash)}
          </span>
        </div>
        <div className="px-2">
          {status && (
            <Line
              label={`在桌 ${formatSeatTime(status.seatedMs)}${game.wage ? ` · 计费 ${formatSeatTime(billedMinutes * 60_000)}` : ""}`}
            />
          )}
          {wages.map(({ part, hourly, minutes, amount: owed, waived }) => (
            <Line
              key={part ?? "wage"}
              label={
                hourly === undefined || minutes === undefined
                  ? "工资"
                  : `工资 ${formatGameMoney(hourly, currency)}/时 × ${formatSeatTime(minutes * 60_000)}`
              }
              amount={amount(cents(-owed))}
              off={waived}
            />
          ))}
          {fee ? (
            <Line
              label={`台费 ${formatGameMoney(fee.amount, currency)}/人`}
              amount={amount(cents(-fee.amount))}
              off={fee.waived}
            />
          ) : (
            game.tableFee &&
            status && (
              <Line
                label={`台费 ${formatGameMoney(game.tableFee.amount, currency)}/人 · 未满 ${game.tableFee.minMinutes} 分钟`}
                amount="—"
              />
            )
          )}
          <div className="flex min-h-10 items-center justify-between border-t border-accent text-sm">
            <span className="font-semibold">合计</span>
            {cash === null ? (
              <span className="text-muted">—</span>
            ) : (
              <TotalChip total={cents(cash - due)} currency={currency} />
            )}
          </div>
        </div>
      </section>

      <section aria-label="Buy-in 记录">
        <div className="flex items-center justify-between gap-2 text-xs text-muted">
          <p>
            共计 {timesBought} 次带入 {buyIns(finalBought)}
            {handChips !== undefined &&
              ` / ${finalBought.toLocaleString("zh-CN")} 筹码（${money(finalBought)}）`}
          </p>
          {recordLines.length > MAX_INLINE_RECORDS && (
            <InfoButton title="Buy-in 记录" small>
              <div className="max-h-[50dvh] overflow-y-auto">{recordList}</div>
            </InfoButton>
          )}
        </div>
        {recordLines.length <= MAX_INLINE_RECORDS && <div className="mt-1">{recordList}</div>}
      </section>
    </FormDialog>
  );
}
