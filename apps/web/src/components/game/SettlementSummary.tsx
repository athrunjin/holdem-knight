import {
  chipsToCents,
  chooseImbalanceHandling,
  type Game,
  INSURANCE_PLAYER_ID,
  ledgerTotals,
  type PlayerLedger,
  timerElapsedMs,
} from "@holdem-knight/core";
import { useSaveGame } from "@/data/games";
import { formatDifference, formatSignedChips } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { CURRENCY_INFO, formatGameMoney } from "@/lib/currency";
import { formatElapsed } from "./GameTimer";
import { imbalanceChoices } from "./ImbalanceOptions";
import { PickerRow } from "./PickerRow";

/** Shown until organizers have names, which arrive with accounts (M6). */
const HOST_PLACEHOLDER = "{主持人}";

/** `2026-11-09 周一 19:00` in local time. */
function formatStart(time: number) {
  const date = new Date(time);
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const weekday = date.toLocaleDateString("zh-CN", { weekday: "short" });
  return `${day} ${weekday} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface px-2 py-1.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="truncate text-sm font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

interface SettlementSummaryProps {
  game: Game;
  ledger: readonly PlayerLedger[];
  /** Chips cashed out minus chips bought, 0 when the books balance */
  difference: number;
}

/**
 * The top of the settlement page: the game's blinds, date and host, its totals, and how a chip
 * difference is handled, as one row that opens the choices.
 */
export function SettlementSummary({ game, ledger, difference }: SettlementSummaryProps) {
  const saveGame = useSaveGame();
  const { currency, chipRatio, smallBlindChips, bigBlindChips, handChips, timer } = game;
  const people = ledger.filter((p) => p.playerId !== INSURANCE_PLAYER_ID);
  const { boughtChips } = ledgerTotals(people);
  const money = (chips: number) => formatGameMoney(chipsToCents(chips, chipRatio), currency);
  const hands = handChips === undefined ? "" : ` · ${boughtChips / handChips} 手`;
  const elapsed = timer && formatElapsed(timerElapsedMs(timer, game.settledAt ?? Date.now()));
  const cash = formatGameMoney(chipsToCents(Math.abs(difference), chipRatio), currency);
  const choices = imbalanceChoices(difference, cash);
  const chosen = choices.find(([handling]) => handling === game.imbalanceHandling)?.[1];

  return (
    <section aria-label="牌局信息">
      <h2 className="flex flex-wrap items-baseline gap-x-1.5 text-sm text-muted">
        <span className="text-lg font-semibold text-text">
          {smallBlindChips}/{bigBlindChips}
        </span>
        <span>
          {CURRENCY_INFO[currency].label} · {formatStart(game.createdAt)} · {HOST_PLACEHOLDER}
        </span>
      </h2>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        <Tile label="总买入">
          {money(boughtChips)}
          {hands}
        </Tile>
        <Tile label="时长">{elapsed ?? "—"}</Tile>
        <Tile label="平衡">
          <span className={cn(difference === 0 ? "text-win" : "text-highlight")}>
            {difference === 0 ? "✓ 平衡" : `不平衡 ${formatSignedChips(difference)}`}
          </span>
        </Tile>
      </dl>
      {difference !== 0 && (
        <PickerRow
          title="差额处理方式"
          options={choices}
          value={game.imbalanceHandling}
          disabled={saveGame.isPending || game.status === "settled"}
          warn
          onChange={(handling) => saveGame.mutate(chooseImbalanceHandling(game, handling))}
        >
          <span className="font-medium">差额 {formatDifference(difference, cash)}</span>
          <span className="text-muted"> · {chosen ?? "未选择处理方式"}</span>
        </PickerRow>
      )}
      {saveGame.isError && (
        <p role="alert" className="mt-2 text-sm text-highlight">
          保存失败，请重试。
        </p>
      )}
    </section>
  );
}
