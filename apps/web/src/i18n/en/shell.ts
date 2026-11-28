import type { Messages } from "../zh";
import type { StoppedKind } from "../zh/shell";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const KINDS: Record<StoppedKind, string> = {
  game: "game",
  ledger: "ledger",
  insuranceHand: "insurance hand",
  summary: "settlement summary",
  player: "player",
  setting: "saved setting",
};

/** A kind with no game to name */
const ALONE: Record<StoppedKind, string> = {
  game: "a game",
  ledger: "a ledger",
  insuranceHand: "an insurance hand",
  summary: "a settlement summary",
  player: "a player",
  setting: "a saved setting",
};

export const shell: Messages["shell"] = {
  nav: {
    label: "Main navigation",
    games: "Games",
    players: "Players",
    start: "New game",
    tools: "Tools",
    me: "Me",
    unsent: ", records not sent",
  },
  update: {
    ready: "A new version is ready",
    later: "Later",
  },
  routeError: {
    title: "This page didn’t open",
    body: "A new version may have just been released; a refresh should open it. Your records are kept on this device and are not lost.",
  },
  inDevelopment: (milestone) => `${milestone} in progress`,
  books: {
    opening: "Opening your account…",
    unreachableTitle: "Can’t reach your account",
    firstOpenHeading: "This device hasn’t opened this account yet",
    firstOpenBody:
      "The first time needs a connection to bring the records onto this device. After that it works offline too. Check the connection and try again.",
    refusedHeading: "Can’t read the account right now",
    refusedBody:
      "The account didn’t accept this device’s read. The records on this device are all still here, and unsent ones go out the next time it opens. Try again later, or sign out and sign in again.",
    unreachableNote:
      "After signing out you can go on with the guest records on this device. They don’t go into the account.",
    readFailedAccount: "Some records couldn’t be read, so this page may be incomplete.",
    readFailedGuest: "Some records couldn’t be read, so this page may be incomplete.",
  },
  sync: {
    day: (month, day, time) => `${day} ${MONTHS[month - 1]} ${time}`,
    today: (time) => `Today ${time}`,
    refused: (count) => `${count} ${count === 1 ? "record" : "records"} not sent`,
    stoppedAt: (kind, removed, game) => {
      const what =
        game === undefined
          ? ALONE[kind]
          : kind === "game"
            ? `the game of ${game}`
            : `the ${KINDS[kind]} of the game of ${game}`;
      return removed ? `deleting ${what}` : what;
    },
    stopped: (what) => `Stopped at ${what}. They’re all on this device.`,
    about:
      "The account didn’t accept this record, and the ones after it are waiting on it. Try again, or export a backup first.",
  },
};
