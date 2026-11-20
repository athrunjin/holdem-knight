# 0038. Game configs follow the saved configs they are made of

- Status: Accepted
- Date: 2026-11-20

## Context

A game's settings come in sections: the basic settings, insurance, wages, the table fee and rake. Each section can be saved on its own as a config, and the whole setup as a game config. Every one of them was a separate copy of the values, as was each game. A game keeping its own copy is right: a config changed later must never change a game that was played. A game config keeping its own copy was not: after a wage config went from 25 to 30 an hour, the game config that used it still held 25 and filled the next game with it, while the setup page named the section after the wage config whenever the values happened to match.

Nothing recorded which config a section was taken from. The page worked it out by comparing values, so of two configs with the same values the first always showed, and settings changed from a config simply read 自定义. Changing a config meant saving under its name again, typed by hand. Table fee and wage configs kept an amount with no currency.

The organizer chose, between a game config that stays as saved and one that follows its sections' configs, the one that follows.

## Options considered

- Keep game configs as copies, and offer to rewrite them when a section's config changes: still needs to know which game configs use the config, and the copies go stale whenever the offer is turned down or a restore brings a newer config in.
- A game config that only names saved configs: a section with values typed by hand could not be kept without first saving it as a config, and deleting a config would leave its game configs with nothing.
- **Each section of a game config names the saved config it was taken from and keeps the values too**: the saved config is the source while it exists, and the kept values hold once it is gone or where there never was one.

## Decision

- `GameSettings` gains an optional `sources`: for each section, the ID of the saved config its values belong to (`SettingsSources`). It is kept on a game config's `settings` and on a `Game`.
- A source is set when settings are saved, by `withSettingsSources`: the config the section was taken from while it still holds the section's values, or else the first saved config that does. A section switched off, or equal to no saved config, has none. Insurance is matched by its settings, whatever its odds, and the rule's `oddsTableId` is set the same way for the odds.
- Using a game config resolves it first (`resolveSettings`): each section with a source takes that config's values as they are now. Insurance takes its config's settings and keeps its own odds, which follow their saved odds table. A source whose config is gone is dropped and the section keeps the values kept with it. A section that is off stays off.
- A game is never resolved. Its `sources` only name the configs at the next game's setup, so of two configs with the same values the one that was used shows. They are checked against the values each time they are read, so a config changed since counts for nothing.
- Deleting a saved config or an odds table first gives the game configs that follow it the values it has now (`gameConfigWithout`), and says how many follow it before it goes. Saving new values into one that game configs follow asks first, as their next games will use them.
- At setup and in the tools, values changed by hand stay with the saved config they started from, which reads `name · 已修改`. 更新「name」 saves them into it, and 另存为 keeps them under a new name. The game config in use reads 已修改 under its name once the settings differ from what it would fill in now, and 保存全局设置 offers its name, so saving updates it. What the tools keep of a rake config is in [ADR 0039](0039-rake-configs-keep-amounts-in-blinds.md).
- Everything saved under a name gains `updatedAt`, set on each save. Table fee and wage configs gain the `currency` they were set in, shown by its mark in the list, with those of another currency last.
- Backups move to version 15 with `sources`, `updatedAt` and `currency`, all optional, so earlier backups read as before.

## Consequences

- A game config made before this names no sources and stays a copy until it is saved again from the setup page.
- Values typed by hand that equal a saved config are kept as that config's, as the setup page already named them by their values. A game config then follows it.
- Changing a saved config changes what every game config that follows it fills in next, which is the point, and is why an update asks first.
- The values kept in a game config can be older than the config they follow. They are only used once that config is gone, and deleting it on this device brings them up to date first. A config that disappears another way, such as by restoring onto a device that never had it, leaves the older values.
- Restore still only adds records ([ADR 0009](0009-backup-format.md)), so a config changed on one device does not replace the same config on another. `updatedAt` is kept so that a later restore or sync can take the newer one.
- The saved configs still live in four tables with their own lists and hooks. Bringing them into one, and a page to rename and delete them in one place, are left for later.
