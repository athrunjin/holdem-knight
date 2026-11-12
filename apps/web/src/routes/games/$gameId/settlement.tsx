import {
  applyCharges,
  attributeInsurance,
  type Cents,
  type Charge,
  cents,
  chargeStatuses,
  chargesFrom,
  chipDifference,
  chooseCollector,
  chooseInsuranceOwner,
  collectorTransfers,
  type Game,
  INSURANCE_PLAYER_ID,
  isValidCollector,
  type LedgerEvent,
  ORGANIZER_COLLECTOR,
  type PlayerLedger,
  type PlayerNet,
  reopenGame,
  type SettlementOutcome,
  settleGame,
  settlementOutcome,
  settleTransfers,
  sum,
  summarizeByPlayer,
  waiveCharge,
  ZERO,
} from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ChevronDown, Share2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { GameOptionLine, GameTitle } from "@/components/game/GameOptions";
import { GameRules, hasGameRules } from "@/components/game/GameRules";
import { PickerRow } from "@/components/game/PickerRow";
import { type ResultCard, ResultCards, type ResultLine } from "@/components/game/ResultCards";
import { SettlementSummary } from "@/components/game/SettlementSummary";
import { InfoButton } from "@/components/InfoButton";
import { Page } from "@/components/Page";
import { useGame, useSaveGame } from "@/data/games";
import { useLedger } from "@/data/ledger";
import { usePlayers } from "@/data/players";
import {
  CHARGE_CLOCK_RULE,
  chargeClock,
  chargeRuleNotes,
  chargeRuleSections,
  formatSeatTime,
} from "@/lib/charges";
import { formatSignedChips } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { formatGameAmount, formatGameMoney } from "@/lib/currency";
import { gameNameOf } from "@/lib/player-name";
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
  const nameOf = gameNameOf(players, game);
  const seated = ledger
    .filter((p) => p.seated && p.playerId !== INSURANCE_PLAYER_ID)
    .map((p) => nameOf(p.playerId));
  const difference = chipDifference(ledger);

  return (
    <Page
      title={<GameTitle game={game} />}
      subtitle={<GameOptionLine game={game} />}
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
          <SettlementSummary game={game} ledger={ledger} difference={difference} />
          {difference === 0 || game.imbalanceHandling ? (
            <SettlementResult
              game={game}
              outcome={settlementOutcome(ledger, game.chipRatio, game.imbalanceHandling)}
              ledger={ledger}
              events={events}
              nameOf={nameOf}
            />
          ) : (
            <p className="mt-3 text-sm text-muted">选择差额处理方式后显示结果。</p>
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

interface SettlementResultProps {
  game: Game;
  outcome: SettlementOutcome;
  ledger: readonly PlayerLedger[];
  events: readonly LedgerEvent[];
  nameOf: (playerId: string) => string;
}

function SettlementResult({ game, outcome, ledger, events, nameOf }: SettlementResultProps) {
  const { difference, unresolved } = outcome;
  const seat = ledger.find((p) => p.playerId === INSURANCE_PLAYER_ID);
  const insured = attributeInsurance(outcome.nets, game.insuranceOwner);
  const { insuranceNet, ownerId } = insured;
  // Table fees and wages come last, in cash, so they never touch the chip results above
  const clock = chargeClock(game);
  const statuses = game.tableFee || game.wage ? chargeStatuses(game, events, clock) : [];
  const charges = chargesFrom(game, statuses);
  const ruleNotes = chargeRuleNotes(game, game.currency);
  const ruleSections = chargeRuleSections(game, game.currency);
  const charged = applyCharges(insured.nets, charges);
  const { nets } = charged;
  const {
    currency,
    status,
    smallBlindChips,
    bigBlindChips,
    handChips,
    collectorId: savedCollector,
    createdAt,
  } = game;
  // An organizer who plays has chips under the organizer's own ID, and stays on the organizer's card
  const host = ledger.find((p) => p.playerId === ORGANIZER_COLLECTOR);
  const people = ledger.filter(
    (p) => p.playerId !== INSURANCE_PLAYER_ID && p.playerId !== ORGANIZER_COLLECTOR,
  );
  const saveGame = useSaveGame();
  const [sharing, setSharing] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const [transfersOpen, setTransfersOpen] = useState(false);

  const insuranceText = formatGameMoney(insuranceNet, currency, "exceptZero");
  const chargesText = formatGameMoney(charged.total, currency);
  const separateInsurance = ownerId === INSURANCE_PLAYER_ID;

  const collectorId = isValidCollector(nets, savedCollector) ? savedCollector : undefined;
  const transfers = collectorId ? collectorTransfers(nets, collectorId) : settleTransfers(nets);
  const collectorName = (id: string) => (id === ORGANIZER_COLLECTOR ? "组织者" : nameOf(id));
  const planName = collectorId ? `代收人 ${collectorName(collectorId)}` : "最优方案";

  const organizerNet = nets.find((p) => p.playerId === ORGANIZER_COLLECTOR)?.net;
  const netOf = (list: readonly PlayerNet[], id: string) =>
    list.find((p) => p.playerId === id)?.net ?? ZERO;
  // Each person's result from the chips alone, before a difference is split
  const chipNets = settlementOutcome(ledger, game.chipRatio, undefined).nets;
  const chargesLocked = saveGame.isPending || status === "settled";
  const money = (value: number) => formatGameMoney(cents(value), currency);

  function insuranceLine(id: string): ResultLine[] {
    if (insuranceNet === 0 || id !== ownerId) return [];
    return [
      { key: "insurance", label: "保险", amount: insuranceNet, tone: "adjustment", group: "保险" },
    ];
  }

  /**
   * The time sat and the time charged, then wages at each rate and the table fee, each with a box
   * to let the player off it.
   */
  function chargeLines(playerId: string): ResultLine[] {
    const status = statuses.find((s) => s.playerId === playerId);
    const billedMinutes = status?.wageParts.reduce((all, p) => all + p.minutes, 0) ?? 0;
    const timeNote: ResultLine[] =
      game.wage && status
        ? [
            {
              key: "time",
              label: `在桌 ${formatSeatTime(status.seatedMs)} · 计费 ${formatSeatTime(billedMinutes * 60_000)}`,
              tone: "charge",
              note: true,
            },
          ]
        : [];
    const line = (charge: Charge, label: string): ResultLine => ({
      key: `${charge.kind}-${charge.part ?? ""}`,
      label,
      amount: cents(-charge.amount),
      tone: "charge",
      group: charge.kind === "wage" ? "工资" : "台费",
      waiver: {
        waived: charge.waived,
        disabled: chargesLocked,
        onChange: (waived) => {
          const { kind, part } = charge;
          const key = part ? { playerId, kind, part } : { playerId, kind };
          saveGame.mutate(waiveCharge(game, key, waived));
        },
      },
    });
    const own = charges.filter((c) => c.playerId === playerId);
    const rates = own.flatMap(({ hourly, minutes, ...charge }) =>
      hourly === undefined || minutes === undefined
        ? []
        : [
            line(
              { ...charge, hourly, minutes },
              `工资 ${money(hourly)}/时 × ${formatSeatTime(minutes * 60_000)}`,
            ),
          ],
    );
    const wages = [...timeNote, ...rates];
    const fee = own.find((c) => c.kind === "table_fee");
    const { tableFee } = game;
    if (fee) return [...wages, line(fee, `台费 ${money(fee.amount)}/人`)];
    if (!tableFee) return wages;
    const short = `台费 ${money(tableFee.amount)}/人 · 未满 ${tableFee.minMinutes} 分钟`;
    return [...wages, { key: "table_fee", label: short, tone: "charge", group: "台费" }];
  }

  const playerCards = ledger
    .filter((p) => p.playerId !== INSURANCE_PLAYER_ID || separateInsurance)
    .filter((p) => p.playerId !== ORGANIZER_COLLECTOR)
    .map((player): ResultCard => {
      const { playerId } = player;
      const base = netOf(chipNets, playerId);
      const share = netOf(outcome.nets, playerId) - base;
      const split: ResultLine[] =
        share === 0
          ? []
          : [
              {
                key: "split",
                label: "差额分摊",
                amount: cents(share),
                tone: "adjustment",
                group: "分摊",
              },
            ];
      return {
        id: playerId,
        name: nameOf(playerId),
        hands: handChips === undefined ? "—" : String(player.boughtChips / handChips),
        chips: player.cashedOutChips.toLocaleString("zh-CN"),
        netChips: player.cashedOutChips - player.boughtChips,
        base,
        lines: [...split, ...insuranceLine(playerId), ...chargeLines(playerId)],
        total: netOf(nets, playerId),
        collapsible: true,
      };
    })
    .toSorted((a, b) => b.total - a.total);

  // What handling the difference adds to the organizer, beyond their own chips if they play
  const covered =
    netOf(outcome.nets, ORGANIZER_COLLECTOR) - (host ? netOf(chipNets, ORGANIZER_COLLECTOR) : 0);
  const coveredLine: ResultLine =
    game.imbalanceHandling === "organizer"
      ? {
          key: "difference",
          label: covered < 0 ? "补齐差额" : "收取差额",
          amount: cents(covered),
          tone: "adjustment",
          group: "差额",
        }
      : {
          key: "split",
          label: "差额分摊",
          amount: cents(covered),
          tone: "adjustment",
          group: "分摊",
        };
  const income = (kind: Charge["kind"]) =>
    sum(charges.filter((c) => c.kind === kind && !c.waived).map((c) => c.amount));
  const receivesCharges = charged.recipientId === ORGANIZER_COLLECTOR;
  /** A dash when the organizer receives none of it, so the four lines always show. */
  const incomeLine = (group: "保险" | "工资" | "台费", amount: Cents): ResultLine => {
    const line = { key: group, label: group, group, tone: "charge" as const };
    return amount === 0 ? line : { ...line, amount };
  };
  const ownInsurance = ownerId === ORGANIZER_COLLECTOR ? insuranceNet : ZERO;
  // What an organizer can receive, always in this order. Rake has no amount until M4
  const organizerLines: ResultLine[] = [
    incomeLine("保险", ownInsurance),
    incomeLine("工资", receivesCharges ? income("wage") : ZERO),
    incomeLine("台费", receivesCharges ? income("table_fee") : ZERO),
    { key: "rake", label: "抽水", tone: "charge" },
    ...(covered === 0 ? [] : [coveredLine]),
  ];
  const organizerCard: ResultCard[] =
    organizerNet === undefined
      ? []
      : [
          {
            id: ORGANIZER_COLLECTOR,
            // The organizer's ID stands in until organizers have names (M6)
            name: game.organizerId,
            hands: !host || handChips === undefined ? "—" : String(host.boughtChips / handChips),
            chips: host ? host.cashedOutChips.toLocaleString("zh-CN") : "—",
            ...(host && {
              netChips: host.cashedOutChips - host.boughtChips,
              base: netOf(chipNets, ORGANIZER_COLLECTOR),
            }),
            lines: organizerLines,
            total: organizerNet,
            collapsible: true,
          },
        ];

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
    const count = [...playerCards, ...organizerCard].filter(
      (r) => (r.netChips ?? 0) * difference > 0,
    ).length;
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

  // The image closes with the organizer, named as in the transfers
  const imageOrganizer = organizerCard.map((card) => ({ ...card, name: "组织者" }));

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
        notes: [...notes, ...ruleNotes],
        results: [...playerCards, ...imageOrganizer].map(
          ({ name, hands, chips, netChips, total }) => ({
            name,
            hands,
            chips,
            net: netChips === undefined ? "—" : formatSignedChips(netChips),
            amount: formatGameAmount(total, currency, "exceptZero"),
            outcome: Math.sign(total),
          }),
        ),
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
      {seat && (
        <PickerRow
          title={`保险盈亏 ${insuranceText} 归属`}
          options={[
            [ORGANIZER_COLLECTOR, "组织者"],
            [INSURANCE_PLAYER_ID, "单独列出"],
            ...people.map(({ playerId }) => [playerId, nameOf(playerId)] as const),
          ]}
          value={ownerId}
          disabled={saveGame.isPending || status === "settled"}
          onChange={(owner) =>
            saveGame.mutate(
              chooseInsuranceOwner(game, owner === ORGANIZER_COLLECTOR ? undefined : owner),
            )
          }
        >
          <span className="font-medium">保险 {insuranceText}</span>
          <span className="text-muted">
            {" "}
            · 归属 {separateInsurance ? "单独列出" : collectorName(ownerId)}
          </span>
        </PickerRow>
      )}

      <ResultCards
        organizer={organizerCard[0]}
        cards={playerCards}
        currency={currency}
        settings={hasGameRules(game) && <GameRules game={game} charges={charges} />}
        settingsInfo={
          ruleSections.length > 0 && (
            <InfoButton title="计费规则" small>
              <div className="flex flex-col gap-2 text-sm">
                {ruleSections.map(({ title, lines }) => (
                  <section key={title}>
                    <h4 className="font-medium">{title}</h4>
                    {lines.map((line) => (
                      <p key={line} className="text-muted">
                        {line}
                      </p>
                    ))}
                  </section>
                ))}
                <p className="text-xs text-muted">{CHARGE_CLOCK_RULE}</p>
              </div>
            </InfoButton>
          )
        }
      />

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
                  <option value={ORGANIZER_COLLECTOR}>
                    {host ? "组织者" : "组织者（不在局中）"}
                  </option>
                  {playerCards
                    .filter(({ id }) => id !== INSURANCE_PLAYER_ID)
                    .map(({ id, name }) => (
                      <option key={id} value={id}>
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
