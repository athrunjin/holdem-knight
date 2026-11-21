import type { Messages } from "../zh";

export const players: Messages["players"] = {
  playerList: {
    allPlayers: "All players",
    groups: "Groups",
    all: "All",
    filter: "Filter",
    sort: "Sort",
    inProgress: (a) => `${a} · in progress`,
  },
  playerPage: {
    thisPlayerCantBeFound: "This player can’t be found.",
    backToPlayers: "Back to players",
    editPlayer: "Edit player",
    name: "Name",
  },
  library: {
    searchOrAddAPlayer: "Search or add a player",
    searchOrAddNameOrInitials: "Search or add: name or initials",
    create: (a) => `Create “${a}”`,
    noPlayersYetTypeAName:
      "No players yet. Type a name to add one, and pick them when you start a game.",
  },
};
