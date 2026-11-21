# 0047. Interface text in typed catalogs, one a language

- Status: Accepted
- Date: 2026-11-21

## Context

Every word of the interface was written in Chinese where it is shown: about a thousand lines in some ninety files, in components, in the helpers that word a charge or a record, and in what is drawn on a shared image. The organizer wants an English version, a setting that switches between the two, and a way of keeping languages that stays easy as the app grows.

## Options considered

- A library with keys looked up by name (i18next) or messages extracted from the source (Lingui): tools for translators and for loading a language on demand, at the price of a dependency, a build step or keys the compiler does not see, for a catalog one person and an assistant maintain.
- **Catalogs as TypeScript objects**, the Chinese one giving the shape and every other typed against it.

## Decision

- `apps/web/src/i18n/zh` is the interface in Chinese, an object of text grouped by the part of the app it belongs to, a file a group. Text with something to fill in is a function of it. `Messages` is that object's type.
- A language is a folder beside it whose catalog is typed `Messages`, and a line in `LANGUAGES`. The compiler then refuses a text that is missing, one that is not asked for, and one that takes something else to fill in. A test checks the same of what the catalogs are at run time, and that no Chinese is left in another language's.
- Everything reads the text from `t`, exported by `i18n`: a component, a helper that words a charge, a constant at the top of a file. The language is settled once, as the page loads, and picking another loads the page again. A change of language is rare, and starting over leaves no text anywhere in the old one, with nothing for each piece of code to subscribe to.
- The catalogs are grouped as the source is: `game`, `insurance`, `gamePages`, `players`, `tools`, `callTime`, `lib` for what helpers word, `ui` for shared pieces, and under each a part for the file the text is used in. What three or more files say is in `common`.
- Dates are formatted for the language in use (`localeTag`). Amounts and chip counts read the same in both.
- The language is the device's first that the interface comes in: Chinese for any kind of Chinese, else English. 我的 has a row to pick one instead, which takes effect at once and is kept in the browser. Each language is listed under its own name. The page's `lang` follows.
- Poker's own words that the Chinese interface already has in English, such as Buy-in and Call Time, stay as they are in both.
- English for the game's own words follows common usage in cash games: buy-in, rebuy, cash-out, rake and its cap, time charge for 台费, dealer wage for 工资, premium, payout, outs and odds for insurance.
- Tests read the interface in Chinese whatever the machine is set to (`src/test-setup.ts`).

## Consequences

- Both languages are in the one bundle. At this size that is a few kilobytes; a language loaded on demand would be a change to `LANGUAGES` alone.
- There is no file a translator's tool reads. A catalog is exported to one if that day comes.
- Names the books themselves hold are data and are not translated: what a setting was saved as, a player's name, and the two built-in odds tables, 1 赔 30 and 1 赔 32, whose names come from `core` and are checked against when a table is named. The names `core` reserves for players are the Chinese ones only.
- A sentence built around something that is not text, such as a figure drawn between two halves, is kept as its halves, so its order is the Chinese one in every language.
- What is not the app's own page stays in one language for now: the emails with codes, the page's title and description before the app starts, and the name on a home screen.
