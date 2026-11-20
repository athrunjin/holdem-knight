# 0043. Players may share a name, told apart in a game and by number

- Status: Accepted
- Date: 2026-11-20

## Context

`parsePlayerName` refuses a name already in the player list, because every list picks a player by name, and suggests writing a namesake as 小王2. Real tables have several people called the same, and a host's name for a player is only a note ([ADR 0040](0040-accounts-host-spaces-and-player-records.md)). The organizer asked that several players may carry the same note and sort as usual in the player list; that no two rows of one game read the same, with a suffix such as `_1` added during the game; and that a tap on a player's avatar opens their page, where an ID and the like tell them apart.

## Options considered

- Keep names unique in a space: the host has to invent a name for the second 小王 and remember which is which.
- Make the host rename one of them when both sit down: interrupts the start of a game.
- **Let names repeat, and give each row of a game a name of its own from the order they sat down**: nothing to type, and the list keeps the names the host chose.

## Decision

- A name need not be unique in a space. 保险 and 抽水 stay reserved.
- In a game, every row reads differently. Among players with the same name, the first to sit down keeps it, and each later one reads `name_1`, `name_2`, in the order of their first buy-in, skipping any label a row of that game already has. A pure function in `core` works this out from the ledger, so nothing is stored and a name in the list is never changed. The game page, the settlement, the records, the shared image and what a linked player reads of their own row ([ADR 0042](0042-linked-players-and-claiming-records.md)) all use these names.
- Each player record has a number within its space, given when it is made and never used again, shown as `#0042`. IDs stay the identity; the number is for people.
- A player has an avatar: the first character of the name on a color taken from the record's ID, so namesakes differ at a glance. A tap on it opens the player's page, which shows the number, whether the record is linked and to whose account (its display name and code), the last game and the number of games.
- Lists of players keep their order by initials, with namesakes next to each other, each with its avatar and number.

## Consequences

- The same person can read 小王 in one game and 小王_1 in another, depending on who sat down first.
- None of this needs an account, so it can be built in guest mode, ahead of M6.
- Numbers are given by the space. Guest records brought into a space that already has players are numbered again, which changes nothing but what is shown.
- Search by name returns every namesake; the number and the avatar are what tell them apart there.
