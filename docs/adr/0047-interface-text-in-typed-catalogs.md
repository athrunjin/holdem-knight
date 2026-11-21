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
- Components take the text from `useMessages()`, which renders them again when the language changes. Code outside components takes it from `messages()` as it is called, never into a constant at the top of a file. The pages are mounted again at a change, so whatever worked a text out is asked again.
- The language is the device's first that the interface comes in: Chinese for any kind of Chinese, else English. 我的 has a row to pick one instead, which takes effect at once and is kept in the browser. Each language is listed under its own name. The page's `lang` follows.
- Poker's own words that the Chinese interface already has in English, such as Buy-in and Call Time, stay as they are in both.
- Text is moved to the catalogs a part of the app at a time. Until a part is moved it reads in Chinese whatever the language.

## Consequences

- Both languages are in the one bundle. At this size that is a few kilobytes; a language loaded on demand would be a change to `LANGUAGES` alone.
- There is no file a translator's tool reads. A catalog is exported to one if that day comes.
- Names the books themselves hold, such as a saved setting called 默认工资设置 or the insurance seat, are data and are not translated by this; each is decided as its part is moved.
- What is not the app's own page stays in one language for now: the emails with codes, the page's title and description before the app starts, and the name on a home screen.
