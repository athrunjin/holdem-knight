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
      "Once you sign in, games and players are kept in the cloud and need a connection to read and write. Check your network and try again.",
    unreachableNote:
      "After signing out you can go on with the guest records on this device. They don’t go into the account.",
    readFailedAccount:
      "Some records couldn’t be read from the cloud, so this page may be incomplete. Check your network.",
    readFailedGuest: "Some records couldn’t be read, so this page may be incomplete.",
  },
};
