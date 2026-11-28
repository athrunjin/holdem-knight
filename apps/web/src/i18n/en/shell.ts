import type { Messages } from "../zh";

export const shell: Messages["shell"] = {
  nav: {
    label: "Main navigation",
    games: "Games",
    players: "Players",
    start: "New game",
    tools: "Tools",
    me: "Me",
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
    unreachableHeading: "Your account’s records can’t be read right now",
    unreachableBody:
      "This device hasn’t opened this account yet. The first time needs a connection to bring its records onto the device; after that it works offline too. Check your network and try again.",
    unreachableNote:
      "After signing out you can go on with the guest records on this device. They don’t go into the account.",
    readFailedAccount: "Some records couldn’t be read, so this page may be incomplete.",
    readFailedGuest: "Some records couldn’t be read, so this page may be incomplete.",
  },
  sync: {
    pending: (count) =>
      `${count} ${count === 1 ? "record" : "records"} to send. They go to your account once online`,
    refused: (count) => `${count} ${count === 1 ? "record wasn’t" : "records weren’t"} sent`,
    refusedNote:
      "Your account turned one of them down. They’re all still on this device, and you can export a backup.",
  },
};
