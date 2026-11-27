# 0053. A guest's records are brought into an account as a copy, when the person asks

- Status: Accepted
- Date: 2026-11-27

## Context

After a sign-in the app shows the account's books and leaves the guest's records on the device as they are ([ADR 0046](0046-the-books-in-use-follow-who-is-signed-in.md)). ADR 0046 put bringing them in off until there was something released to bring over, and said it would go through `backupForOrganizer` and `restore_books` ([ADR 0045](0045-one-contract-for-both-repositories.md)). Both exist and are tested. The app is now opened to a small group of acquaintances ([ADR 0052](0052-sign-in-with-google-and-a-first-entry-agreement.md)), some of whom played as guests first.

## Options considered

- Bring them in at every sign-in, on their own: no step to take, but records appear in an account no one asked for, and a second account on the same device would take them as well.
- Move them: the guest's books emptied once copied. Nothing to bring twice, but a failure halfway, or the wrong account, could lose the only copy.
- **A copy, offered on 我的 and made with one confirming tap**, the guest's books left untouched.
- To keep the offer from coming back: a mark in the guest's books (they would be written to), the account's books compared with the guest's on each visit (every record of the account read), or **a fingerprint of the guest's books kept beside them on the device, per space**.

## Decision

- **Offered** on 我的, signed in, when this device's guest books hold a game, a player other than the guest's own record, or a saved setting, and are not the ones already brought into this account's space. The card says how many games they hold. Tapped, it opens in place with the number of games, players and settings, that this device keeps its records, that nothing in the account is overwritten or doubled, and that it needs a connection; one confirming tap brings them in.
- **One restore.** `bringGuestBooks` in `data/guest-import.ts` reads the guest's books, gives them to the space with `backupForOrganizer`, and restores them through the account's repository in one call, which adds only what the space lacks, all or none. Then what the app has read is let go, as at a switch of books, so pages already open read them again. It says how many records were added and how many were already in the account.
- **A copy, never a move.** The guest's books are only read: nothing in them is deleted, changed or marked.
- **The host's own record.** The guest's own record stands, under the same ID, for the account's (ADR 0051). Its name in what is restored is the account's, so a space that has its own record keeps it, name included, and one that has none yet gets it under the account's name in the same call. The host's games under the organizer seat are its history at once, with no merge.
- **Settled games bring their summaries** as kept on the device, re-addressed, where the space has none for the game; a game the space already had keeps its own. A settled game with no summary (from before summaries) is brought as it is, and its summary is worked out from its ledger the first time a report is read, as for any game restored from a backup (ADR 0049). Nothing about money is worked out again.
- **The mark**: after a restore that succeeded, the fingerprint of the guest's books at that moment is kept in this browser's storage under `guest-import.<space ID>`. It is the count and a 53-bit hash of every record's list and ID, the guest's own record left out. The card is offered again only when the guest's books hold a different set of records, as after playing as a guest again; a change to a record already brought, which a restore would not carry, does not count. Another account's space has a mark of its own. Without storage the card is offered again, and bringing the same records in again adds nothing.
- **Not done**: no import at sign-in, none for a guest who is not signed in, no merge of ordinary records that share a name ([ADR 0043](0043-namesakes-in-a-space.md)), no change to the backup format.

## Consequences

- A record changed on the device after it was brought in keeps the account's earlier copy, as any restore does. A game in progress brought in and then finished as a guest arrives a second time with its new events but its earlier status; it is settled again in the account. Bringing in newer versions of records waits for the merge of M6 step 2.
- Clearing the browser's storage, or another browser on the same device, offers the card again; what it brings is then nothing new.
- The guest's books are read on every visit to 我的 while signed in, from the device, to count them.
- This narrows ADR 0046: the guest's books are still left as they are at a sign-in, and nothing is copied on its own, but the person can copy them into the account.
