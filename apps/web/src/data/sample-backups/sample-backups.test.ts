import "fake-indexeddb/auto";

import {
  applyCharges,
  attributeInsurance,
  type BackupData,
  cents,
  chipDifference,
  collectorTransfers,
  type Game,
  gameCharges,
  INSURANCE_PLAYER_ID,
  INSURANCE_PLAYER_NAME,
  isValidCollector,
  type LedgerEvent,
  ORGANIZER_COLLECTOR,
  seatTimes,
  settlementOutcome,
  settleTransfers,
  summarizeByPlayer,
} from "@holdem-knight/core";
import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { GUEST_ORGANIZER_ID } from "@/data";
import { parseBackup, serializeBackup } from "@/data/backup";
import { createDexieRepository, createGuestDatabase } from "@/data/dexie-repository";
import { chargeClock, chargesByPlayer, formatSeatTime } from "@/lib/charges";
import { formatSignedChips } from "@/lib/chips";
import { CURRENCY_INFO, formatGameMoney } from "@/lib/currency";
import { allSamples, type Expected, SAMPLE_SCENARIOS, type SampleScenario } from "./scenarios";

const OUTPUT = "../../../sample-backups";
const EXPORTED_AT = Date.UTC(2026, 0, 8);

/** Pretty-printed, so a change to a sample reads well in a diff. */
function backupFile(data: BackupData) {
  return `${JSON.stringify(JSON.parse(serializeBackup(data, EXPORTED_AT)), null, 2)}\n`;
}

function namer(data: BackupData) {
  const names = new Map(data.players.map(({ id, name }) => [id, name]));
  names.set(INSURANCE_PLAYER_ID, INSURANCE_PLAYER_NAME);
  names.set(ORGANIZER_COLLECTOR, "组织者");
  return (id: string) => names.get(id) ?? id;
}

/** Seats everyone out at their current stack, as 一键离桌 does. */
function leaveAll(events: readonly LedgerEvent[]): LedgerEvent[] {
  const leftAt = (events.at(-1)?.occurredAt ?? 0) + 60_000;
  const cashOuts = summarizeByPlayer(events)
    .filter((player) => player.seated)
    .map(({ playerId, stackChips }, index): LedgerEvent => {
      const { organizerId, gameId } = events[0] as LedgerEvent;
      const id = `leave-${index}`;
      return {
        id,
        organizerId,
        gameId,
        occurredAt: leftAt,
        type: "cash_out",
        playerId,
        chips: stackChips,
      };
    });
  return [...events, ...cashOuts];
}

/** What the settlement page shows, put together the way the page puts it together. */
function settle(game: Game, recorded: readonly LedgerEvent[], nameOf: (id: string) => string) {
  const events = game.status === "open" ? leaveAll(recorded) : recorded;
  const ledger = summarizeByPlayer(events);
  const differenceChips = chipDifference(ledger);
  const outcome = settlementOutcome(ledger, game.chipRatio, game.imbalanceHandling);
  const insured = attributeInsurance(outcome.nets, game.insuranceOwner);
  const clock = chargeClock(game);
  const charges = gameCharges(game, events, clock);
  const charged = applyCharges(insured.nets, charges);
  const { nets } = charged;

  const players = nets
    .toSorted((a, b) => b.net - a.net)
    .flatMap(({ playerId, net }) => {
      const player = ledger.find((p) => p.playerId === playerId);
      if (!player || !game.handChips) return [];
      return [
        {
          name: nameOf(playerId),
          hands: player.boughtChips / game.handChips,
          cashedOutChips: player.cashedOutChips,
          netChips: player.cashedOutChips - player.boughtChips,
          net,
        },
      ];
    });
  const organizerNet = nets.find((p) => p.playerId === ORGANIZER_COLLECTOR)?.net;
  const seat = ledger.find((p) => p.playerId === INSURANCE_PLAYER_ID);
  const seatChips = seat ? seat.cashedOutChips - seat.boughtChips : 0;
  const organizerChips =
    (game.imbalanceHandling === "organizer" ? -differenceChips : 0) +
    (insured.ownerId === ORGANIZER_COLLECTOR ? seatChips : 0);
  const results =
    organizerNet === undefined
      ? players
      : [...players, { name: "组织者", netChips: organizerChips, net: organizerNet }];

  const { collectorId } = game;
  const transfers = (
    isValidCollector(nets, collectorId) && collectorId
      ? collectorTransfers(nets, collectorId)
      : settleTransfers(nets)
  ).map(({ from, to, amount }) => ({ from: nameOf(from), to: nameOf(to), amount }));

  const owed = chargesByPlayer(charges);
  const hasCharges = game.tableFee !== undefined || game.wage !== undefined;
  const expected: Expected = {
    differenceChips,
    difference: outcome.difference,
    results,
    transfers,
    ...(seat ? { insuranceNet: insured.insuranceNet } : {}),
    ...(hasCharges
      ? {
          chargesTotal: charged.total,
          charges: seatTimes(events, clock.now).map(({ playerId, seatedMs }) => ({
            name: nameOf(playerId),
            seatedMinutes: Math.floor(seatedMs / 60_000),
            tableFee: cents(owed.get(playerId)?.tableFee ?? 0),
            wage: cents(owed.get(playerId)?.wage ?? 0),
          })),
        }
      : {}),
  };
  return expected;
}

function gameOf({ data }: SampleScenario) {
  const [game] = data.games;
  if (!game) throw new Error("expected a game");
  return game;
}

function table(header: readonly string[], align: string, rows: readonly (readonly string[])[]) {
  return [
    `| ${header.join(" | ")} |`,
    `|${align}`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

/** The results in the app's own formatting, to read next to the phone. */
function expectedMarkdown() {
  const sections = SAMPLE_SCENARIOS.map((scenario) => {
    const game = gameOf(scenario);
    const { expected } = scenario;
    const money = (value: number) => formatGameMoney(cents(value), game.currency);
    const signed = (value: number) => formatGameMoney(cents(value), game.currency, "exceptZero");
    const nameOf = namer(scenario.data);
    const date = new Date(game.createdAt).toISOString().slice(0, 10);
    const { chips, amount } = game.chipRatio;
    const ratio = `${chips.toLocaleString("zh-CN")} chip${chips === 1 ? "" : "s"} = ${money(amount)}`;
    const status = game.status === "settled" ? "settled" : "open";
    const plan = game.collectorId ? `代收人 ${nameOf(game.collectorId)}` : "最优方案";

    const lines = [
      `## ${scenario.slug}: ${scenario.title}`,
      "",
      `Game dated **${date}** · blinds ${game.smallBlindChips} / ${game.bigBlindChips} · ` +
        `${CURRENCY_INFO[game.currency].label} · ${ratio} · ${status} · file \`${scenario.slug}.json\``,
      "",
      ...scenario.checks.map((text) => `- ${text}`),
    ];
    if (scenario.steps) {
      lines.push(
        "",
        "Before comparing:",
        "",
        ...scenario.steps.map((text, i) => `${i + 1}. ${text}`),
      );
    }
    if (expected.differenceChips !== 0) {
      const chips = formatSignedChips(expected.differenceChips);
      lines.push("", `Imbalance: ${chips} 筹码（${money(Math.abs(expected.difference))}）.`);
    }
    if (expected.insuranceNet !== undefined) {
      lines.push("", `Insurance result: ${signed(expected.insuranceNet)}.`);
    }
    lines.push(
      "",
      "Results:",
      "",
      table(
        ["玩家", "手", "筹码", "水上/下", "金额"],
        " --- | --: | --: | --: | --: |",
        expected.results.map(({ name, hands, cashedOutChips, netChips, net }) => [
          name,
          hands === undefined ? "—" : String(hands),
          cashedOutChips === undefined ? "—" : cashedOutChips.toLocaleString("zh-CN"),
          formatSignedChips(netChips),
          signed(net),
        ]),
      ),
    );
    if (expected.charges && expected.chargesTotal !== undefined) {
      lines.push(
        "",
        `Table fee and wages: ${money(expected.chargesTotal)} in all, to the organizer.`,
        "",
        table(
          ["玩家", "在桌", "台费", "工资"],
          " --- | --: | --: | --: |",
          expected.charges.map(({ name, seatedMinutes, tableFee, wage }) => [
            name,
            formatSeatTime(seatedMinutes * 60_000),
            tableFee === 0 ? "未满时长" : money(tableFee),
            money(wage),
          ]),
        ),
      );
    }
    lines.push(
      "",
      `Transfers (${expected.transfers.length} 笔 · ${plan}):`,
      "",
      table(
        ["From", "To", "Amount"],
        " --- | --- | --: |",
        expected.transfers.map(({ from, to, amount }) => [from, to, money(amount)]),
      ),
    );
    return lines.join("\n");
  });

  return [
    "# Expected results of the sample backups",
    "",
    "Generated by `apps/web/src/data/sample-backups/sample-backups.test.ts` from the results worked out by hand in",
    "`scenarios.ts`. Do not edit this file; see the README for how to change a sample.",
    "",
    "Amounts are in the app's own formatting. Every game starts at 19:00 Beijing time on its date.",
    "",
    ...sections.flatMap((section) => [section, ""]),
  ].join("\n");
}

describe("sample backups", () => {
  it.each(SAMPLE_SCENARIOS.map((s) => [s.slug, s] as const))(
    "%s settles to the results worked out by hand",
    (_, scenario) => {
      const game = gameOf(scenario);
      const actual = settle(game, scenario.data.ledgerEvents, namer(scenario.data));
      expect(actual).toEqual(scenario.expected);
    },
  );

  it("restores every sample into an empty guest database and settles the same from there", async () => {
    const parsed = parseBackup(backupFile(allSamples()));
    if (!parsed.ok) throw new Error(`sample backup rejected: ${parsed.issue}`);

    const db = createGuestDatabase(`test-${crypto.randomUUID()}`);
    const repository = createDexieRepository(db, GUEST_ORGANIZER_ID);
    try {
      const { games, players, ledgerEvents } = parsed.data;
      const result = await repository.backup.restore(parsed.data);
      expect(result).toEqual({
        added: games.length + players.length + ledgerEvents.length,
        skipped: 0,
      });
      for (const scenario of SAMPLE_SCENARIOS) {
        const game = await repository.games.get(gameOf(scenario).id);
        if (!game) throw new Error(`${scenario.slug} was not restored`);
        const events = await repository.ledger.listByGame(game.id);
        const nameOf = namer({ ...parsed.data, players: await repository.players.list() });
        expect(settle(game, events, nameOf), scenario.slug).toEqual(scenario.expected);
      }
    } finally {
      await Dexie.delete(db.name);
    }
  });

  it("each file restores on its own", () => {
    for (const { slug, data } of SAMPLE_SCENARIOS) {
      expect(parseBackup(backupFile(data)), slug).toEqual({ ok: true, data });
    }
  });

  it("matches the committed files", async () => {
    for (const { slug, data } of SAMPLE_SCENARIOS) {
      await expect(backupFile(data)).toMatchFileSnapshot(`${OUTPUT}/${slug}.json`);
    }
    await expect(backupFile(allSamples())).toMatchFileSnapshot(`${OUTPUT}/all.json`);
    await expect(expectedMarkdown()).toMatchFileSnapshot(`${OUTPUT}/EXPECTED.md`);
  });
});
