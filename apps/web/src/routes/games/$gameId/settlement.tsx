import {
  applyCharges,
  attributeInsurance,
  cents,
  chipDifference,
  chipsToCents,
  chooseCollector,
  chooseImbalanceHandling,
  chooseInsuranceOwner,
  collectorTransfers,
  type Game,
  gameCharges,
  INSURANCE_PLAYER_ID,
  INSURANCE_PLAYER_NAME,
  isValidCollector,
  type LedgerEvent,
  ORGANIZER_COLLECTOR,
  type PlayerLedger,
  reopenGame,
  type SettlementOutcome,
  seatTimes,
  settleGame,
  settlementOutcome,
  settleTransfers,
  summarizeByPlayer,
} from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ChevronDown, Share2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { ChargesSection } from "@/components/game/ChargesSection";
import { ImbalanceOptions } from "@/components/game/ImbalanceOptions";
import { Page } from "@/components/Page";
import { useGame, useSaveGame } from "@/data/games";
import { useLedger } from "@/data/ledger";
import { usePlayers } from "@/data/players";
import { chargeClock, chargesByPlayer } from "@/lib/charges";
import { formatDifference, formatSignedChips, netColor } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { formatGameMoney } from "@/lib/currency";
import { renderSettlementImage } from "@/lib/settlement-image";
import { shareFile } from "@/lib/share";

export const Route = createFileRoute("/games/$gameId/settlement")({
  component: SettlementPage,
});

function SettlementPage() {
  const { gameId } = Route.useParams();
  const { data: game } = useGame(gameId);
  const { data: events } = useLedger(gameId);
  const { data: players } = usePlayers();

  if (!game || !events || !players) return null;

  const ledger = summarizeByPlayer(events);
  const names = new Map(players.map(({ id, name }) => [id, name]));
  names.set(INSURANCE_PLAYER_ID, INSURANCE_PLAYER_NAME);
  const nameOf = (playerId: string) => names.get(playerId) ?? "未知玩家";
  const seated = ledger
    .filter((p) => p.seated && p.playerId !== INSURANCE_PLAYER_ID)
    .map((p) => nameOf(p.playerId));
  const difference = chipDifference(ledger);

  return (
    <Page
      title="结算"
      actions={
        <Link
          to="/games/$gameId"
          params={{ gameId }}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 text-highlight"
        >
          <ArrowLeft className="size-5" strokeWidth={1.75} aria-hidden />
          返回牌局
        </Link>
      }
    >
      {seated.length > 0 ? (
        <Notice gameId={gameId}>
          还有 {seated.length} 人在桌：{seated.join("、")}。全部离桌后才能结算。
        </Notice>
      ) : (
        <>
          {difference !== 0 && <ImbalanceSection game={game} difference={difference} />}
          {(difference === 0 || game.imbalanceHandling) && (
            <SettlementResult
              game={game}
              outcome={settlementOutcome(ledger, game.chipRatio, game.imbalanceHandling)}
              differenceChips={difference}
              ledger={ledger}
              events={events}
              nameOf={nameOf}
            />
          )}
        </>
      )}
    </Page>
  );
}

function Notice({ gameId, children }: { gameId: string; children: ReactNode }) {
  return (
    <div role="status" className="rounded-xl border border-highlight bg-surface p-4">
      <p>{children}</p>
      <Link
        to="/games/$gameId"
        params={{ gameId }}
        className="mt-2 inline-flex min-h-11 items-center text-highlight"
      >
        回到账本
      </Link>
    </div>
  );
}

/** Shows a chip difference and how it is handled. */
function ImbalanceSection({ game, difference }: { game: Game; difference: number }) {
  const saveGame = useSaveGame();
  const cash = formatGameMoney(chipsToCents(Math.abs(difference), game.chipRatio), game.currency);
  const settled = game.status === "settled";

  return (
    <section className="mb-4 rounded-xl border border-highlight bg-surface p-3">
      <h2 className="font-semibold">水上下不平衡</h2>
      <p className="mt-1 mb-3 text-sm text-muted">
        差额 {formatDifference(difference, cash)}。
        {settled ? "已确认结算，重新打开牌局后才能修改。" : "选择怎么处理，或回到牌局核对记录。"}
      </p>
      <ImbalanceOptions
        differenceChips={difference}
        cash={cash}
        value={game.imbalanceHandling}
        disabled={saveGame.isPending || settled}
        onChange={(handling) => saveGame.mutate(chooseImbalanceHandling(game, handling))}
      />
      {saveGame.isError && (
        <p role="alert" className="mt-2 text-sm text-highlight">
          保存失败，请重试。
        </p>
      )}
    </section>
  );
}

interface SettlementResultProps {
  game: Game;
  outcome: SettlementOutcome;
  differenceChips: number;
  ledger: readonly PlayerLedger[];
  events: readonly LedgerEvent[];
  nameOf: (playerId: string) => string;
}

function SettlementResult({
  game,
  outcome,
  differenceChips,
  ledger,
  events,
  nameOf,
}: SettlementResultProps) {
  const { difference, unresolved } = outcome;
  const seat = ledger.find((p) => p.playerId === INSURANCE_PLAYER_ID);
  const insured = attributeInsurance(outcome.nets, game.insuranceOwner);
  const { insuranceNet, ownerId } = insured;
  // Table fees and wages come last, in cash, so they never touch the chip results above
  const clock = chargeClock(game);
  const charges = gameCharges(game, events, clock);
  const charged = applyCharges(insured.nets, charges);
  const { nets } = charged;
  const owedBy = chargesByPlayer(charges);
  const hasCharges = game.tableFee !== undefined || game.wage !== undefined;
  const {
    currency,
    status,
    smallBlindChips,
    bigBlindChips,
    handChips,
    collectorId: savedCollector,
    createdAt,
  } = game;
  const people = ledger.filter((p) => p.playerId !== INSURANCE_PLAYER_ID);
  const saveGame = useSaveGame();
  const [sharing, setSharing] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const [transfersOpen, setTransfersOpen] = useState(false);

  const seatChips = seat ? seat.cashedOutChips - seat.boughtChips : 0;
  const insuranceText = formatGameMoney(insuranceNet, currency, "exceptZero");
  const chargesText = formatGameMoney(charged.total, currency);
  const separateInsurance = ownerId === INSURANCE_PLAYER_ID;

  const collectorId = isValidCollector(nets, savedCollector) ? savedCollector : undefined;
  const transfers = collectorId ? collectorTransfers(nets, collectorId) : settleTransfers(nets);
  const collectorName = (id: string) => (id === ORGANIZER_COLLECTOR ? "组织者" : nameOf(id));
  const planName = collectorId ? `代收人 ${collectorName(collectorId)}` : "最优方案";

  const organizerNet = nets.find((p) => p.playerId === ORGANIZER_COLLECTOR)?.net;
  const results = nets
    .toSorted((a, b) => b.net - a.net)
    .flatMap(({ playerId, net }) => {
      const player = ledger.find((p) => p.playerId === playerId);
      if (!player) return [];
      const netChips = player.cashedOutChips - player.boughtChips;
      const owed = owedBy.get(playerId);
      return [
        {
          playerId,
          name: nameOf(playerId),
          hands: handChips === undefined ? "—" : String(player.boughtChips / handChips),
          chips: player.cashedOutChips.toLocaleString("zh-CN"),
          netChips,
          netText: formatSignedChips(netChips),
          amount: formatGameMoney(net, currency, "exceptZero"),
          net,
          insured: insuranceNet !== 0 && playerId === ownerId && !separateInsurance,
          charges: owed && chargeLabel(owed.tableFee, owed.wage),
          receivesCharges: false,
        },
      ];
    });

  const organizerChips =
    (game.imbalanceHandling === "organizer" ? -differenceChips : 0) +
    (ownerId === ORGANIZER_COLLECTOR ? seatChips : 0);

  const rows =
    organizerNet === undefined
      ? results
      : [
          ...results,
          {
            playerId: ORGANIZER_COLLECTOR,
            name: "组织者",
            hands: "—",
            chips: "—",
            netChips: organizerChips,
            netText: formatSignedChips(organizerChips),
            amount: formatGameMoney(organizerNet, currency, "exceptZero"),
            net: organizerNet,
            insured: insuranceNet !== 0 && ownerId === ORGANIZER_COLLECTOR,
            charges: undefined,
            receivesCharges: charged.total !== 0 && charged.recipientId === ORGANIZER_COLLECTOR,
          },
        ];

  /** Short enough for the name column. The section below has the details. */
  function chargeLabel(tableFee: number, wage: number) {
    const label = [tableFee !== 0 && "台费", wage !== 0 && "工资"].filter(Boolean).join("");
    const amount = formatGameMoney(cents(-(tableFee + wage)), currency);
    return label === "" ? undefined : { label, amount };
  }

  function imbalanceNote() {
    if (difference === 0) return undefined;
    const size = formatGameMoney(cents(Math.abs(difference)), currency);
    if (unresolved !== 0) {
      const holder = collectorId ? "，差额留在代收人手上" : "";
      return `未处理差额 ${size}${holder}`;
    }
    if (game.imbalanceHandling === "organizer") {
      return `组织者${difference > 0 ? "补齐" : "收取"} ${size}`;
    }
    const count = results.filter((r) => r.netChips * difference > 0).length;
    return difference > 0
      ? `水上多 ${size}，由 ${count} 位赢家按水上比例扣减`
      : `水下多 ${size}，由 ${count} 位输家按水下比例少付`;
  }
  function insuranceNote() {
    if (!seat || insuranceNet === 0) return undefined;
    if (separateInsurance) return `保险 ${insuranceText}，单独列出`;
    return `保险 ${insuranceText}，计入${collectorName(ownerId)}`;
  }
  function chargesNote() {
    if (charged.total === 0) return undefined;
    const kinds = [game.tableFee && "台费", game.wage && "工资"].filter(Boolean).join("和");
    return `${kinds} ${chargesText}，计入${collectorName(charged.recipientId)}`;
  }
  const notes = [imbalanceNote(), insuranceNote(), chargesNote()].filter(
    (text) => text !== undefined,
  );

  async function handleShare() {
    setSharing(true);
    setShareFailed(false);
    try {
      const date = new Date(createdAt);
      const image = await renderSettlementImage({
        title: "Hold’em Knight · 结算",
        subtitle: `${date.toLocaleDateString("zh-CN")} · 盲注 ${smallBlindChips} / ${bigBlindChips}`,
        transferTitle: `转账方案 · ${planName}`,
        transfers: transfers.map(({ from, to, amount }) => ({
          from: collectorName(from),
          to: collectorName(to),
          amount: formatGameMoney(amount, currency),
        })),
        notes,
        results: rows.map(({ name, hands, chips, netChips, netText, amount }) => ({
          name,
          hands,
          chips,
          net: netText,
          amount,
          outcome: Math.sign(netChips),
        })),
      });
      const day = [date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-");
      await shareFile(image, `结算-${day}.png`);
    } catch {
      setShareFailed(true);
    } finally {
      setSharing(false);
    }
  }

  function handleReopen() {
    if (window.confirm("重新打开这局？可以继续记账，之后要再次结算。")) {
      saveGame.mutate(reopenGame(game));
    }
  }

  function choosePlan(next: string | undefined) {
    saveGame.mutate(chooseCollector(game, next));
  }

  function planButton(label: string, active: boolean, next: string | undefined) {
    return (
      <button
        type="button"
        aria-pressed={active}
        disabled={saveGame.isPending || status === "settled"}
        onClick={() => choosePlan(next)}
        className={cn(
          "min-h-11 rounded-xl border font-medium disabled:opacity-60",
          active ? "border-accent bg-accent text-accent-text" : "border-line bg-surface",
        )}
      >
        {label}
      </button>
    );
  }

  return (
    <>
      <h2 className="text-lg font-semibold">结果</h2>
      <div className="mt-2 rounded-xl border border-line bg-surface px-2">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th scope="col" className="py-2 text-left font-medium">
                玩家
              </th>
              <th scope="col" className="w-8 text-right font-medium">
                手
              </th>
              <th scope="col" className="w-14 text-right font-medium">
                筹码
              </th>
              <th scope="col" className="w-16 text-right font-medium">
                水上/下
              </th>
              <th scope="col" className="w-20 text-right font-medium">
                金额
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(
              ({
                playerId,
                name,
                hands,
                chips,
                netChips,
                netText,
                amount,
                net,
                insured,
                charges: chargeText,
                receivesCharges,
              }) => (
                <tr key={playerId} className="h-12 border-t border-line tabular-nums">
                  <th scope="row" className="truncate text-left font-medium">
                    {name}
                    {insured && (
                      <span className="block truncate text-xs font-normal text-highlight">
                        含保险 {insuranceText}
                      </span>
                    )}
                    {chargeText && (
                      <span className="block text-xs leading-tight font-normal whitespace-normal text-win">
                        {chargeText.label}{" "}
                        <span className="whitespace-nowrap">{chargeText.amount}</span>
                      </span>
                    )}
                    {receivesCharges && (
                      <span className="block text-xs leading-tight font-normal whitespace-normal text-win">
                        含台费工资 <span className="whitespace-nowrap">{chargesText}</span>
                      </span>
                    )}
                  </th>
                  <td className="text-right">{hands}</td>
                  <td className="text-right">{chips}</td>
                  <td className={cn("text-right", netColor(netChips))}>{netText}</td>
                  <td className={cn("text-right font-semibold", netColor(net))}>{amount}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      {notes.length > 0 && (
        <div role="status" className="mt-2 text-sm text-highlight">
          {notes.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
      )}

      {hasCharges && (
        <ChargesSection
          game={game}
          charges={charges}
          seatTimes={seatTimes(events, clock.now)}
          total={charged.total}
          recipientName={collectorName(charged.recipientId)}
          nameOf={nameOf}
        />
      )}

      {seat && (
        <label className="mt-3 block">
          <span className="mb-1 block text-sm text-muted">保险盈亏 {insuranceText} 归属</span>
          <select
            value={ownerId}
            disabled={saveGame.isPending || status === "settled"}
            onChange={(event) => {
              const owner = event.target.value;
              const next = owner === ORGANIZER_COLLECTOR ? undefined : owner;
              saveGame.mutate(chooseInsuranceOwner(game, next));
            }}
            className="min-h-12 w-full rounded-xl border border-line bg-surface px-3"
          >
            <option value={ORGANIZER_COLLECTOR}>组织者</option>
            <option value={INSURANCE_PLAYER_ID}>单独列出</option>
            {people.map(({ playerId }) => (
              <option key={playerId} value={playerId}>
                {nameOf(playerId)}
              </option>
            ))}
          </select>
        </label>
      )}

      <section className="mt-4">
        <h2>
          <button
            type="button"
            aria-expanded={transfersOpen}
            onClick={() => setTransfersOpen(!transfersOpen)}
            className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 text-left font-medium"
          >
            <span className="min-w-0 truncate">
              转账方案（{transfers.length} 笔）· {planName}
            </span>
            <ChevronDown
              className={cn(
                "size-5 shrink-0 text-muted transition-transform",
                transfersOpen && "rotate-180",
              )}
              aria-hidden
            />
          </button>
        </h2>
        {transfersOpen && (
          <div className="mt-2">
            <div className="grid grid-cols-2 gap-2">
              {planButton("最优方案", collectorId === undefined, undefined)}
              {planButton("代收人", collectorId !== undefined, collectorId ?? ORGANIZER_COLLECTOR)}
            </div>

            {collectorId !== undefined && (
              <label className="mt-2 block">
                <span className="mb-1 block text-sm text-muted">由谁代收</span>
                <select
                  value={collectorId}
                  disabled={saveGame.isPending || status === "settled"}
                  onChange={(event) => choosePlan(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-line bg-surface px-3"
                >
                  <option value={ORGANIZER_COLLECTOR}>组织者（不在局中）</option>
                  {results
                    .filter(({ playerId }) => playerId !== INSURANCE_PLAYER_ID)
                    .map(({ playerId, name }) => (
                      <option key={playerId} value={playerId}>
                        {name}
                      </option>
                    ))}
                </select>
              </label>
            )}

            {transfers.length === 0 ? (
              <p className="mt-2 text-muted">没有输赢，不需要转账。</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {transfers.map(({ from, to, amount }) => (
                  <li
                    key={`${from}-${to}`}
                    className="flex min-h-14 items-center gap-2 rounded-xl border border-line bg-surface px-4"
                  >
                    <span className="min-w-0 truncate font-medium">{collectorName(from)}</span>
                    <ArrowRight className="size-4 shrink-0 text-muted" aria-label="转给" />
                    <span className="min-w-0 truncate font-medium">{collectorName(to)}</span>
                    <span className="ml-auto shrink-0 text-lg font-semibold text-highlight">
                      {formatGameMoney(amount, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {saveGame.isError && (
        <p role="alert" className="mt-2 text-sm text-highlight">
          保存失败，请重试。
        </p>
      )}

      {shareFailed && (
        <p role="alert" className="mt-2 text-sm text-highlight">
          图片生成失败，请重试。
        </p>
      )}

      <div className="flex flex-col gap-2 pt-6 pb-8">
        <button
          type="button"
          disabled={sharing}
          onClick={handleShare}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line px-6 font-medium disabled:opacity-60"
        >
          <Share2 className="size-5" strokeWidth={1.75} aria-hidden />
          生成图片
        </button>
        {status === "open" ? (
          <button
            type="button"
            disabled={saveGame.isPending}
            onClick={() => saveGame.mutate(settleGame(game, Date.now()))}
            className="min-h-12 w-full rounded-xl bg-accent px-6 font-semibold text-accent-text disabled:opacity-60"
          >
            确认结算
          </button>
        ) : (
          <button
            type="button"
            disabled={saveGame.isPending}
            onClick={handleReopen}
            className="min-h-12 w-full rounded-xl border border-line px-6 font-medium disabled:opacity-60"
          >
            重新打开牌局
          </button>
        )}
      </div>
    </>
  );
}
