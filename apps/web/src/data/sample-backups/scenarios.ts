/**
 * Sample games for trying the app on a phone: each one is a backup file to restore, with the
 * results worked out by hand. `sample-backups.test.ts` checks the results against `core` and
 * writes the files to `apps/web/sample-backups/`. Never imported by the app.
 */
import {
  type BackupData,
  type Cents,
  type Currency,
  cents,
  type Game,
  INSURANCE_PLAYER_ID,
  type LedgerEvent,
  type Player,
  RULE_30,
} from "@holdem-knight/core";
import { toInitials } from "@/lib/pinyin";

const ORGANIZER = "guest";
const MINUTE = 60_000;

const PLAYER_NAMES = {
  zw: "张伟",
  wf: "王芳",
  ln: "李娜",
  ly: "刘洋",
  cj: "陈静",
  zl: "赵磊",
} as const;

type PlayerKey = keyof typeof PLAYER_NAMES;

const playerId = (key: PlayerKey) => `sample-player-${key}`;

/** The same six players sit in every sample game, as regulars would. */
export const SAMPLE_PLAYERS: readonly Player[] = Object.entries(PLAYER_NAMES).map(
  ([key, name]) => ({
    id: playerId(key as PlayerKey),
    organizerId: ORGANIZER,
    name,
    initials: toInitials(name),
    createdAt: Date.UTC(2026, 0, 1, 10, 0),
  }),
);

export interface ExpectedResult {
  /** As the settlement page names the row: a player, 组织者 or 保险. */
  readonly name: string;
  /** Missing for the organizer's row, which shows —. */
  readonly hands?: number;
  readonly cashedOutChips?: number;
  readonly netChips: number;
  /** After imbalance handling, insurance and charges. */
  readonly net: Cents;
}

export interface ExpectedTransfer {
  readonly from: string;
  readonly to: string;
  readonly amount: Cents;
}

export interface ExpectedCharge {
  readonly name: string;
  readonly seatedMinutes: number;
  readonly tableFee: Cents;
  readonly wage: Cents;
}

/** Worked out by hand from the rules, so a change in `core` that moves any of them fails the test. */
export interface Expected {
  /** Chips cashed out minus chips bought; 0 when the table balances. */
  readonly differenceChips: number;
  readonly difference: Cents;
  /** As listed on the settlement page: players by result, highest first, then the organizer. */
  readonly results: readonly ExpectedResult[];
  readonly transfers: readonly ExpectedTransfer[];
  readonly insuranceNet?: Cents;
  readonly charges?: readonly ExpectedCharge[];
  readonly chargesTotal?: Cents;
}

export interface SampleScenario {
  /** File name without `.json`. */
  readonly slug: string;
  readonly title: string;
  /** What the game is for and what to look at. */
  readonly checks: readonly string[];
  /** For a game left open: what to tap before the expected results show. */
  readonly steps?: readonly string[];
  readonly data: BackupData;
  readonly expected: Expected;
}

interface GameSetup
  extends Pick<
    Game,
    | "currency"
    | "smallBlindChips"
    | "bigBlindChips"
    | "collectorId"
    | "imbalanceHandling"
    | "insurance"
    | "insuranceOwner"
    | "tableFee"
    | "wage"
  > {
  /** Day of January 2026 the game is on, which also tells the samples apart in the games list. */
  readonly day: number;
  readonly buyInBigBlinds: number;
  readonly ratio: { readonly chips: number; readonly amount: number };
  /** Minutes after the start; missing leaves the game open. */
  readonly settledAfter?: number;
}

/** Builds one game and its ledger. Times are minutes after 19:00 Beijing time on the game's day. */
function sampleGame(slug: string, setup: GameSetup) {
  const { day, buyInBigBlinds, ratio, settledAfter, ...settings } = setup;
  const gameId = `sample-game-${slug}`;
  const start = Date.UTC(2026, 0, day, 11, 0);
  const at = (minute: number) => start + Math.round(minute * MINUTE);
  const events: LedgerEvent[] = [];
  const meta = (minute: number) => ({
    id: `sample-${slug}-e${events.length + 1}`,
    organizerId: ORGANIZER,
    gameId,
    occurredAt: at(minute),
  });
  const seat = (key: PlayerKey | "insurance") =>
    key === "insurance" ? INSURANCE_PLAYER_ID : playerId(key);
  const add = <T extends LedgerEvent>(event: T) => {
    events.push(event);
    return event;
  };

  const game: Game = {
    id: gameId,
    organizerId: ORGANIZER,
    ...settings,
    chipRatio: { chips: ratio.chips, amount: cents(ratio.amount) },
    buyInBigBlinds,
    handChips: settings.bigBlindChips * buyInBigBlinds,
    status: settledAfter === undefined ? "open" : "settled",
    createdAt: start,
    ...(settledAfter === undefined ? {} : { settledAt: at(settledAfter) }),
  };

  const chipEvent =
    (type: "buy_in" | "rebuy" | "cash_out") =>
    (key: PlayerKey | "insurance", minute: number, chips: number) =>
      add({ ...meta(minute), type, playerId: seat(key), chips });

  return {
    game,
    events,
    buyIn: chipEvent("buy_in"),
    rebuy: chipEvent("rebuy"),
    cashOut: chipEvent("cash_out"),
    stack: (key: PlayerKey, minute: number, chips: number) =>
      add({ ...meta(minute), type: "stack_set", playerId: seat(key), chips }),
    undo: (target: LedgerEvent, minute: number) =>
      add({ ...meta(minute), type: "reversal", reversedEventId: target.id }),
    insurance: (
      key: PlayerKey,
      minute: number,
      purchase: { chips: number; outs: number; oddsHundredths: number; hit: boolean },
    ) => {
      const { chips, outs, oddsHundredths, hit } = purchase;
      const payoutChips = (chips * oddsHundredths) / 100;
      const buy = add({
        ...meta(minute),
        type: "insurance_buy",
        playerId: seat(key),
        chips,
        payoutChips,
        outs,
        oddsHundredths,
        street: "river",
      });
      add({
        ...meta(minute + 1),
        type: "insurance_settle",
        purchaseId: buy.id,
        playerId: seat(key),
        hit,
        chips: hit ? payoutChips : 0,
      });
    },
    /** Only the players this game used, so each file restores on its own. */
    data(): BackupData {
      const used = new Set(events.flatMap((e) => (e.type === "reversal" ? [] : [e.playerId])));
      return {
        games: [game],
        players: SAMPLE_PLAYERS.filter(({ id }) => used.has(id)),
        ledgerEvents: events,
        insuranceRules: [],
        insuranceHands: [],
        gameConfigs: [],
      };
    },
  };
}

const CNY: Currency = "CNY";

function balanced(): SampleScenario {
  const g = sampleGame("01-balanced", {
    day: 1,
    currency: CNY,
    smallBlindChips: 1,
    bigBlindChips: 2,
    buyInBigBlinds: 100,
    ratio: { chips: 1, amount: 100 },
    settledAfter: 245,
  });
  g.buyIn("zw", 0, 200);
  g.buyIn("wf", 1, 200);
  g.buyIn("ln", 2, 200);
  g.buyIn("ly", 3, 200);
  g.rebuy("ln", 90, 200);
  g.cashOut("wf", 180, 130);
  g.cashOut("zw", 240, 520);
  g.cashOut("ln", 240.5, 0);
  g.cashOut("ly", 241, 350);

  return {
    slug: "01-balanced",
    title: "Balanced game",
    checks: [
      "Four players, one rebuy, 1 chip = ¥1, so every chip result equals its cash result.",
      "The table balances, so there is no imbalance section.",
      "The best plan settles four people in three transfers.",
    ],
    data: g.data(),
    expected: {
      differenceChips: 0,
      difference: cents(0),
      results: [
        { name: "张伟", hands: 1, cashedOutChips: 520, netChips: 320, net: cents(32000) },
        { name: "刘洋", hands: 1, cashedOutChips: 350, netChips: 150, net: cents(15000) },
        { name: "王芳", hands: 1, cashedOutChips: 130, netChips: -70, net: cents(-7000) },
        { name: "李娜", hands: 2, cashedOutChips: 0, netChips: -400, net: cents(-40000) },
      ],
      transfers: [
        { from: "李娜", to: "张伟", amount: cents(32000) },
        { from: "李娜", to: "刘洋", amount: cents(8000) },
        { from: "王芳", to: "刘洋", amount: cents(7000) },
      ],
    },
  };
}

function collectorAndUndo(): SampleScenario {
  const g = sampleGame("02-collector-and-undo", {
    day: 2,
    currency: CNY,
    smallBlindChips: 5,
    bigBlindChips: 10,
    buyInBigBlinds: 100,
    ratio: { chips: 1000, amount: 10000 },
    collectorId: playerId("zl"),
    settledAfter: 245,
  });
  g.buyIn("cj", 0, 1000);
  g.buyIn("zl", 1, 1000);
  g.buyIn("zw", 2, 1000);
  const mistake = g.rebuy("zw", 30, 1000);
  g.undo(mistake, 31);
  const early = g.cashOut("zl", 60, 1500);
  g.undo(early, 75);
  g.rebuy("cj", 90, 1000);
  g.cashOut("zl", 200, 2600);
  g.cashOut("zw", 240, 900);
  g.cashOut("cj", 241, 500);

  return {
    slug: "02-collector-and-undo",
    title: "Collector, a return to the table and an undone rebuy",
    checks: [
      "张伟's rebuy at 19:30 was a mistake and is undone, so he shows 1 hand.",
      "赵磊 left at 20:00 with 1,500, came back at 20:15 (返回) and left for good with 2,600. Only the last cash-out counts.",
      "1,000 chips = ¥100. 赵磊 collects: everyone who lost pays him, so there are two transfers.",
    ],
    data: g.data(),
    expected: {
      differenceChips: 0,
      difference: cents(0),
      results: [
        { name: "赵磊", hands: 1, cashedOutChips: 2600, netChips: 1600, net: cents(16000) },
        { name: "张伟", hands: 1, cashedOutChips: 900, netChips: -100, net: cents(-1000) },
        { name: "陈静", hands: 2, cashedOutChips: 500, netChips: -1500, net: cents(-15000) },
      ],
      transfers: [
        { from: "陈静", to: "赵磊", amount: cents(15000) },
        { from: "张伟", to: "赵磊", amount: cents(1000) },
      ],
    },
  };
}

function imbalanceSplit(): SampleScenario {
  const g = sampleGame("03-imbalance-split", {
    day: 3,
    currency: CNY,
    smallBlindChips: 1,
    bigBlindChips: 2,
    buyInBigBlinds: 100,
    ratio: { chips: 3, amount: 100 },
    imbalanceHandling: "split",
    settledAfter: 185,
  });
  g.buyIn("zw", 0, 200);
  g.buyIn("wf", 1, 200);
  g.buyIn("ln", 2, 200);
  g.buyIn("ly", 3, 200);
  g.cashOut("ln", 120, 0);
  g.cashOut("ly", 150, 0);
  g.cashOut("zw", 180, 500);
  g.cashOut("wf", 181, 350);

  return {
    slug: "03-imbalance-split",
    title: "Too many chips, split among the winners",
    checks: [
      "800 chips bought, 850 cashed out: the table is 50 chips over (¥16.67), and the game is set to split it.",
      "3 chips = ¥1, which does not divide evenly. Each side's total is converted once and then shared out, so the results still add up to 0.",
      "The winners give up the ¥16.67 in proportion to what they won: 张伟 ¥11.11, 王芳 ¥5.56.",
      "李娜 and 刘洋 lost the same chips, but split ¥133.33 as ¥66.67 and ¥66.66: the odd cent goes to the first.",
    ],
    data: g.data(),
    expected: {
      differenceChips: 50,
      difference: cents(1667),
      results: [
        { name: "张伟", hands: 1, cashedOutChips: 500, netChips: 300, net: cents(8889) },
        { name: "王芳", hands: 1, cashedOutChips: 350, netChips: 150, net: cents(4444) },
        { name: "刘洋", hands: 1, cashedOutChips: 0, netChips: -200, net: cents(-6666) },
        { name: "李娜", hands: 1, cashedOutChips: 0, netChips: -200, net: cents(-6667) },
      ],
      transfers: [
        { from: "李娜", to: "张伟", amount: cents(6667) },
        { from: "刘洋", to: "王芳", amount: cents(4444) },
        { from: "刘洋", to: "张伟", amount: cents(2222) },
      ],
    },
  };
}

function imbalanceOrganizer(): SampleScenario {
  const g = sampleGame("04-imbalance-organizer-aud", {
    day: 4,
    currency: "AUD",
    smallBlindChips: 1,
    bigBlindChips: 2,
    buyInBigBlinds: 50,
    ratio: { chips: 100, amount: 5000 },
    imbalanceHandling: "organizer",
    settledAfter: 125,
  });
  g.buyIn("zw", 0, 100);
  g.buyIn("wf", 1, 100);
  g.buyIn("cj", 2, 100);
  g.rebuy("zw", 45, 100);
  g.cashOut("zw", 100, 0);
  g.cashOut("wf", 120, 180);
  g.cashOut("cj", 121, 190);

  return {
    slug: "04-imbalance-organizer-aud",
    title: "Chips missing, the organizer keeps the difference (AUD)",
    checks: [
      "A game in Australian dollars: 100 chips = $50.",
      "400 chips bought, 370 cashed out: the table is 30 chips short ($15), and the game has the organizer take it.",
      "张伟 pays the full $100 he lost, the winners get theirs, and the organizer row keeps $15.",
    ],
    data: g.data(),
    expected: {
      differenceChips: -30,
      difference: cents(-1500),
      results: [
        { name: "陈静", hands: 1, cashedOutChips: 190, netChips: 90, net: cents(4500) },
        { name: "王芳", hands: 1, cashedOutChips: 180, netChips: 80, net: cents(4000) },
        { name: "张伟", hands: 2, cashedOutChips: 0, netChips: -200, net: cents(-10000) },
        { name: "组织者", netChips: 30, net: cents(1500) },
      ],
      transfers: [
        { from: "张伟", to: "陈静", amount: cents(4500) },
        { from: "张伟", to: "王芳", amount: cents(4000) },
        { from: "张伟", to: "组织者", amount: cents(1500) },
      ],
    },
  };
}

function insurance(): SampleScenario {
  const g = sampleGame("05-insurance", {
    day: 5,
    currency: CNY,
    smallBlindChips: 5,
    bigBlindChips: 10,
    buyInBigBlinds: 100,
    ratio: { chips: 10, amount: 100 },
    insurance: RULE_30,
    insuranceOwner: playerId("ly"),
    settledAfter: 245,
  });
  g.buyIn("insurance", 0, 1000);
  g.buyIn("zw", 1, 1000);
  g.buyIn("wf", 2, 1000);
  g.buyIn("ln", 3, 1000);
  g.buyIn("ly", 4, 1000);
  g.insurance("zw", 60, { chips: 50, outs: 4, oddsHundredths: 800, hit: true });
  g.insurance("ln", 150, { chips: 150, outs: 10, oddsHundredths: 250, hit: false });
  g.cashOut("ln", 200, 0);
  g.cashOut("zw", 240, 2300);
  g.cashOut("wf", 240.5, 1100);
  g.cashOut("ly", 241, 800);
  g.cashOut("insurance", 241.5, 800);

  return {
    slug: "05-insurance",
    title: "Insurance, one hit and one miss, taken by a player",
    checks: [
      "Insurance on the 1 赔 30 table. 10 chips = ¥1.",
      "张伟 bought 50 on 4 outs (pays 8): hit, the seat pays 400. 李娜 bought 150 on 10 outs (pays 2.5): miss, the seat keeps 150.",
      "The insurance seat bought 1,000 and leaves with 800: −200 chips, −¥20.",
      "The insurance result goes to 刘洋: his chips show −200, his amount −¥40 with 含保险 −¥20.",
    ],
    data: g.data(),
    expected: {
      differenceChips: 0,
      difference: cents(0),
      insuranceNet: cents(-2000),
      results: [
        { name: "张伟", hands: 1, cashedOutChips: 2300, netChips: 1300, net: cents(13000) },
        { name: "王芳", hands: 1, cashedOutChips: 1100, netChips: 100, net: cents(1000) },
        { name: "刘洋", hands: 1, cashedOutChips: 800, netChips: -200, net: cents(-4000) },
        { name: "李娜", hands: 1, cashedOutChips: 0, netChips: -1000, net: cents(-10000) },
      ],
      transfers: [
        { from: "李娜", to: "张伟", amount: cents(10000) },
        { from: "刘洋", to: "张伟", amount: cents(3000) },
        { from: "刘洋", to: "王芳", amount: cents(1000) },
      ],
    },
  };
}

function charges(): SampleScenario {
  const g = sampleGame("06-table-fee-and-wages", {
    day: 6,
    currency: CNY,
    smallBlindChips: 1,
    bigBlindChips: 2,
    buyInBigBlinds: 100,
    ratio: { chips: 1, amount: 100 },
    tableFee: { amount: cents(2000), minMinutes: 60 },
    wage: {
      hourly: cents(3000),
      adjustment: { kind: "after_start", afterHours: 3, hourly: cents(5000) },
    },
    settledAfter: 310,
  });
  g.buyIn("zw", 0, 200);
  g.buyIn("wf", 0.25, 200);
  g.buyIn("ln", 30, 200);
  g.cashOut("wf", 45.25, 150);
  g.buyIn("ly", 60.5, 200);
  const away = g.cashOut("ln", 150, 120);
  g.cashOut("ly", 170, 200);
  g.undo(away, 200);
  g.rebuy("ln", 210, 200);
  g.cashOut("ln", 270, 40);
  g.cashOut("zw", 300, 610);

  return {
    slug: "06-table-fee-and-wages",
    title: "Table fee and wages",
    checks: [
      "Table fee ¥20 a head after 60 minutes at the table. Wages ¥30 an hour, ¥50 an hour from 3 hours after the first player sat down (22:00).",
      "王芳 sat 45 minutes: no table fee, 45 minutes of wages.",
      "李娜 left at 21:30 and came back at 22:20 (返回): 120 minutes at ¥30 and 70 at ¥50, ¥118.33 after rounding.",
      "刘洋 sat 109 minutes 30 seconds: the part minute is not charged, so 109 minutes, ¥54.50.",
      "The charges come off each player's cash result and go to the organizer, so the chips still balance while the amounts do not match the chips.",
    ],
    data: g.data(),
    expected: {
      differenceChips: 0,
      difference: cents(0),
      chargesTotal: cents(44533),
      charges: [
        { name: "张伟", seatedMinutes: 300, tableFee: cents(2000), wage: cents(19000) },
        { name: "王芳", seatedMinutes: 45, tableFee: cents(0), wage: cents(2250) },
        { name: "李娜", seatedMinutes: 190, tableFee: cents(2000), wage: cents(11833) },
        { name: "刘洋", seatedMinutes: 109, tableFee: cents(2000), wage: cents(5450) },
      ],
      results: [
        { name: "张伟", hands: 1, cashedOutChips: 610, netChips: 410, net: cents(20000) },
        { name: "王芳", hands: 1, cashedOutChips: 150, netChips: -50, net: cents(-7250) },
        { name: "刘洋", hands: 1, cashedOutChips: 200, netChips: 0, net: cents(-7450) },
        { name: "李娜", hands: 2, cashedOutChips: 40, netChips: -360, net: cents(-49833) },
        { name: "组织者", netChips: 0, net: cents(44533) },
      ],
      transfers: [
        { from: "李娜", to: "组织者", amount: cents(44533) },
        { from: "刘洋", to: "张伟", amount: cents(7450) },
        { from: "王芳", to: "张伟", amount: cents(7250) },
        { from: "李娜", to: "张伟", amount: cents(5300) },
      ],
    },
  };
}

function open(): SampleScenario {
  const g = sampleGame("07-open-game", {
    day: 7,
    currency: CNY,
    smallBlindChips: 2,
    bigBlindChips: 5,
    buyInBigBlinds: 100,
    ratio: { chips: 1, amount: 100 },
  });
  g.buyIn("wf", 0, 500);
  g.buyIn("cj", 1, 500);
  g.buyIn("zl", 2, 500);
  g.rebuy("zl", 60, 500);
  g.cashOut("zl", 120, 300);
  g.stack("wf", 150, 1200);

  return {
    slug: "07-open-game",
    title: "Game still open",
    checks: [
      "王芳 and 陈静 are still seated. 王芳's stack was typed in as 1,200; 陈静 still has her 500.",
      "赵磊 bought two hands and left with 300.",
      "Use it to try the settle flow: the expected results are after seating everyone out.",
    ],
    steps: [
      "Open the game dated 2026-01-07 and tap 结算.",
      "The dialog says 水上下平衡 and 还有 2 人在桌. Tap 一键离桌并结算.",
    ],
    data: g.data(),
    expected: {
      differenceChips: 0,
      difference: cents(0),
      results: [
        { name: "王芳", hands: 1, cashedOutChips: 1200, netChips: 700, net: cents(70000) },
        { name: "陈静", hands: 1, cashedOutChips: 500, netChips: 0, net: cents(0) },
        { name: "赵磊", hands: 2, cashedOutChips: 300, netChips: -700, net: cents(-70000) },
      ],
      transfers: [{ from: "赵磊", to: "王芳", amount: cents(70000) }],
    },
  };
}

export const SAMPLE_SCENARIOS: readonly SampleScenario[] = [
  balanced(),
  collectorAndUndo(),
  imbalanceSplit(),
  imbalanceOrganizer(),
  insurance(),
  charges(),
  open(),
];

/** Every sample in one file, for restoring them all at once. */
export function allSamples(): BackupData {
  const datas = SAMPLE_SCENARIOS.map(({ data }) => data);
  return {
    games: datas.flatMap((d) => d.games),
    players: SAMPLE_PLAYERS,
    ledgerEvents: datas.flatMap((d) => d.ledgerEvents),
    insuranceRules: datas.flatMap((d) => d.insuranceRules),
    insuranceHands: datas.flatMap((d) => d.insuranceHands),
    gameConfigs: datas.flatMap((d) => d.gameConfigs),
  };
}
