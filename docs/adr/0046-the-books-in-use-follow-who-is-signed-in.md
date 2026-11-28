# 0046. The books in use follow who is signed in

- Status: Narrowed by [0054](0054-account-books-written-to-the-device-first.md)
- Date: 2026-11-21

## Context

The app can sign an account in ([ADR 0041](0041-sign-in-by-email-and-password-with-codes.md)), and a repository on Supabase passes the same tests as the device's ([ADR 0045](0045-one-contract-for-both-repositories.md)). Every page still read and wrote the device's storage, under the organizer `guest`, through one repository made when the app starts. Signing in changed nothing but the card on 我的.

[ADR 0005](0005-guest-and-account-modes.md) says a guest's data is on the device and an account's in Supabase. What it leaves open is when the app goes from one to the other, what becomes of the guest's records at a sign-in, and what an account sees with no network. Bringing a guest's records into an account is put off until there is something released to bring over.

## Options considered

- Every hook takes its repository from React context: nothing is shared between two sets of books by construction, but each of some sixty reads and writes, and the functions outside components that make a record, has to be handed it.
- **One set of books in use at a time, behind the `repository` the pages already import**, switched when the session changes, with everything read so far let go and the pages started over.
- With no network, an account falls back to the device's books, as ADR 0005's table has it: what is recorded there the account never sees, and nothing on the page would say whose books these are.
- **With no network, an account's pages say its books cannot be reached**, and signing out is the way to the device's.

## Decision

- `data/books.ts` keeps one set of books in step with the session: the device's until an account signs in, that account's space while it is ([ADR 0040](0040-accounts-host-spaces-and-player-records.md)), and the device's again once it signs out. `repository` and `currentOrganizerId()` in `data/index.ts` answer for whichever is in use, so pages and hooks are written once for both.
- The guest's books are left as they are at a sign-in. An account starts with what it has in Supabase, which at first is nothing, and the guest's records are there again at a sign-out. Nothing is copied either way until the import is built.
- Pages are shown only once the books are open. A guest's open at once. An account's open when its space has been read; until then the page waits, and if the space cannot be read it says so, with 重试 and 退出登录. It is tried again when the browser reports the network back.
- When the books change hands, everything the app has read is dropped and the pages are mounted again, so nothing read from one set shows for the other. Who the account is stays.
- An account reads and writes Supabase directly, with no copy on the device. A read that fails is tried twice more, then the page says that it may be incomplete and offers 重试; a list that failed would otherwise look like an empty one. A write that fails says so where it was made, as it does for the device's storage, and nothing is queued. The Supabase client's own retries are off, since with both a page would wait most of half a minute to say there is no network, and a request with no answer is given up after 20 seconds.
- A game's organizer is shown by the name of the space whose books are open, where the ID stood in before. A guest has no name, so `guest` still shows.
- A backup is of the books in use, and is restored to them. One made as a guest is refused by an account, as one from another account is.

## Consequences

- An account cannot record a game without a network until the ledger is written to the device first and sent after (M6, step 2). Until then a real game is safer run as a guest, or with a connection that can be relied on.
- A device that has guest records and then signs in shows none of them until they are brought in. The import goes through `backupForOrganizer` and `restore_books` (ADR 0045), as a copy the person asks for on 我的 ([ADR 0053](0053-guest-records-brought-into-an-account.md)).
- Opening the app signed in costs one request for the account before anything shows.
- One set of books at a time means a write that is still under way as the session changes would reach the other set. Both repositories refuse a record that is not their organizer's, so it fails rather than lands in the wrong books.
- A space takes its name from the account's at sign-up and does not follow a later change of that name; there is no page to rename a space yet.
- This narrows ADR 0005: being offline no longer makes an account a guest.
