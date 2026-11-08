# 0020. The product is named Hold’em Knight

- Status: Accepted. The home screen name is superseded by [0021](0021-brand-identity.md)
- Date: 2026-11-07

## Context

The project had collected several names: 德州之王 / King in Texas in the app, `chip-ledger` for the repository, `holdem-assistant` for the root package and `@holdem/*` for the workspace packages. The user wants one name, with the English name leading for now, including on phone and tablet home screens.

## Decision

- The brand is **Hold’em Knight**, the full name is **Hold’em Knight · Tablebook**, and the home screen icon reads **Knight**. The table in `docs/CONTEXT.md` lists every form.
- The Chinese names (有局, 有局·德州账本) are on record only and aren't shown in the app yet. Interface text stays in Chinese.
- Code, domain and package names use `holdem-knight`, without an apostrophe: the repository, the root package and the `@holdem-knight/*` scope. This replaces the rule in `docs/CONTEXT.md` that the repository and scope stay neutral.
- The IndexedDB name `holdem-guest` and the backup format `holdem-backup` stay as they are. Changing the first would strand existing guest data, and changing the second would reject existing backups.

## Consequences

- Records written before this one keep the old names, as ADRs aren't edited.
- A `*.pages.dev` subdomain can't be renamed, so `holdem-knight.pages.dev` needs a new Cloudflare Pages project. Browser storage belongs to the origin, so organizers must move their data with a backup and add the app to the home screen again.
- Home screens that already have the app may keep showing the old name until it is added again.
