import type { Messages } from "../zh";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const records = (count: number) => `${count} ${count === 1 ? "record" : "records"}`;

const counted = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/** What an import counts, in the confirmation's order, each kind only when there is one of it. */
const kinds = ({
  games,
  players,
  settings,
}: {
  games: number;
  players: number;
  settings: number;
}) =>
  [
    games > 0 && counted(games, "game", "games"),
    players > 0 && counted(players, "player", "players"),
    settings > 0 && counted(settings, "setting", "settings"),
  ]
    .filter(Boolean)
    .join(", ");

export const me: Messages["me"] = {
  title: "Me",
  version: (version) => `Hold’em Knight · dev ${version}`,
  header: {
    guest: "Guest",
    // Shorter than the Chinese, to keep the header on one row at 360px
    localOnly: "On this device",
    synced: "Synced to account",
  },
  playerFace: {
    noSettled: "No settled games yet.",
    sinceFirst: (from) => `${from} to now`,
  },
  guestOnly: {
    body: "Records are kept on this device only. Signing in will keep your players and past games, and sync them across devices.",
  },
  signedOut: {
    body: "Records are kept on this device only. Once you sign in, new records go to your account in the cloud and survive a change of phone. Records already on this device can be brought into the account from Me after signing in, and this device keeps its copy.",
  },
  account: {
    rename: "Rename",
    renameFailed: "Couldn’t save. Try again.",
    code: "Account ID",
    copyCode: "Copy account ID",
    copied: "Copied",
    copyFailed: "Couldn’t copy. Please write it down.",
    email: "Email",
    unread: "Couldn’t read your account. Check your network and try again.",
    note: "Signed in. Games and players are kept in your account in the cloud and need a connection to read and write. The guest records made on this device before signing in stay on it, and are still here after you sign out; what is brought into the account is a copy.",
  },
  guestImport: {
    title: "Guest records",
    // Short, so it stays on one line beside the button at 360px
    headline: (games) =>
      games > 0 ? `${games} ${games === 1 ? "game" : "games"} here` : "Records here",
    open: "Bring in",
    lead: "Copy this device’s guest records into your account:",
    games: "Games",
    gamesCount: (count) => String(count),
    players: "Players",
    playersCount: (count) => String(count),
    settings: "Settings",
    settingsCount: (count) => String(count),
    stays:
      "This device keeps its records as they are. Nothing already in the account is overwritten or doubled. Needs a connection.",
    confirm: "Bring in",
    working: "Bringing in…",
    done: "Brought into your account",
    doneAdded: (counts) => `Added: ${kinds(counts)}.`,
    doneThere: (counts) => `Already in the account, left as they were: ${kinds(counts)}.`,
    nothingNew: "Nothing new to bring in",
    doneStays: "The guest records are still on this device, and show again after you sign out.",
    failedUnknown:
      "No answer came from your account. The records were either all brought in or none were, and trying again never makes a second copy. Check your connection and try again.",
    failedRefused:
      "Your account didn’t accept these records, so none were brought in. This device keeps its records as they are.",
  },
  language: {
    title: "Language",
    device: "Same as device",
  },
  backup: {
    title: "Backup",
    bodyAccount:
      "Export every record in your account as a backup. Restoring only adds records; it never overwrites what the account already has.",
    bodyGuest:
      "Records on this device are lost if you change phones or clear the browser’s data. Export a backup now and then, and restore it when needed. Restoring only adds records; it never overwrites what this device already has.",
    export: "Export",
    restore: "Restore",
    chooseFile: "Choose a backup file",
    exportFailed: (reason) => `Export failed${reason && ` (${reason})`}. Try again.`,
    newerVersion: "This backup comes from a newer version. Refresh the app first.",
    unreadable: "This file isn’t recognized. Choose a backup exported by Hold’em Knight.",
    restored: (added) => `Restored: ${records(added)} added.`,
    restoredSkippingAccount: (added, skipped) =>
      `Restored: ${records(added)} added, ${skipped} already in the account skipped.`,
    restoredSkippingGuest: (added, skipped) =>
      `Restored: ${records(added)} added, ${skipped} already on this device skipped.`,
    foreignAccount: "This backup wasn’t exported from this account, so it can’t be restored here.",
    foreignGuest: "This backup belongs to another account and can’t be restored.",
    failedAccount: "Restore failed. Nothing in the account was changed.",
    failedGuest: "Restore failed. Nothing on this device was changed.",
  },
  income: {
    title: "Income",
    back: "Back to Me",
    period: "Period",
    periods: {
      thisWeek: "This week",
      lastWeek: "Last week",
      last3Months: "Last 3 months",
      last6Months: "Last 6 months",
      thisYear: "This year",
      all: "All time",
    },
    month: (year, month) => `${MONTHS[month - 1]} ${year}`,
    monthShort: (month) => MONTHS[month - 1] ?? "",
    day: (month, day) => `${MONTHS[month - 1]} ${day}`,
    currency: "Points",
    filter: "Filter",
    ratio: "Ratio",
    blinds: "Blinds",
    any: "Any",
    applyFilter: "Collapse and apply the filter",
    due: "Total due",
    gameCount: "games",
    ring: "Share of each item",
    itemGames: (games, average) => `${games} ${games === 1 ? "game" : "games"} · avg ${average}`,
    itemNone: "None",
    received: "Received",
    receivedAll: "All received",
    unreceived: "Outstanding",
    unreceivedGames: (games) => `${games} ${games === 1 ? "game" : "games"}`,
    unreceivedTitle: "Games outstanding",
    badDebtGames: (games) => (games === 1 ? "1 game" : `${games} games`),
    items: "Breakdown",
    counted: (item) => `Count ${item}`,
    absorbed: "Difference covered",
    kept: "Difference kept",
    absorbedNote: "not part of the four above",
    trend: "Trend",
    span: "Period",
    spans: { weeks4: "Past 4 weeks", months4: "Last 4 months" },
    // Insurance over its column of the chart, where the full word does not fit
    barInsurance: "Ins.",
    barShown: (name) => `Show ${name}`,
    weekFrom: (day) => `Week of ${day}`,
    barTotal: (period, amount) => `${period}: ${amount}`,
    noneYet:
      "No settled games yet. Once a settlement is confirmed, the rake, insurance, wages and time charges it brought in show here.",
    explain:
      "Counted as due at settlement, from games whose settlement is confirmed. Insurance counts only where its result is the host’s, and the host’s own play does not count. A game belongs to the day it started.",
    unread: "The income could not be read. Check the network and try again.",
  },
  transfers: {
    title: "Transfers",
    status: "Status",
    open: "Open",
    made: "Done",
    toCome: "Due",
    toPay: "To pay",
    received: "Received",
    paid: "Paid",
    even: "Even",
    people: (count) => (count === 1 ? "1 person" : `${count} people`),
    partyGames: (games) => (games === 1 ? "1 game" : `${games} games`),
    oldest: (day) => `since ${day}`,
    iPay: "I pay",
    markedOn: (day) => `marked ${day}`,
    confirmDone: (count) => `Confirm done (${count})`,
    confirmUndone: (count) => `Back to open (${count})`,
    markBad: (count) => `Bad debt (${count})`,
    markedBadOn: (day) => `bad debt since ${day}`,
    markLine: (who, amount) => `${who} ${amount} done`,
    showParty: (who) => `Transfers with ${who}`,
    between: "Between players",
    betweenCount: (count) => `${count}`,
    pays: (from, to) => `${from} → ${to}`,
    openSettlement: (day) => `Settlement of ${day}`,
    overdue: "Overdue",
    noneOpen: "No transfers are open.",
    noneMade: "No transfers were made in this period.",
    noneYet: "No game is settled yet. Once one is, its transfers are listed here by person.",
    explain:
      "The transfers of settled games, by person. The totals count only transfers between you and someone else; those between players are listed apart. Open transfers are listed whatever the period. One that will not come in for now can be set down as a bad debt: it leaves the amount due and is kept folded at the foot of the page, and can be taken back once it is paid or chased again.",
    unread: "The transfers could not be read. Check the network and try again.",
  },
};
