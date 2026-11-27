# 0052. Sign-in with Google, and agreeing to the terms on first entry

- Status: Accepted
- Date: 2026-11-27

## Context

[ADR 0041](0041-sign-in-by-email-and-password-with-codes.md) chose an email address and a password, confirmed with codes sent from a domain of our own, and put Google aside. That domain is still not chosen. Without it, the hosted project can only send two emails an hour, and only to its own members, so no one else could confirm an address or reset a password.

On 2026-11-27 the organizer decided not to wait for it. Sign-in opens on the site as it is served now, to a small group of acquaintances, so that they start keeping their games in an account. Google confirms the address itself and sends no email. Two test accounts were made by hand in the hosted project's dashboard, with an email and a password, for the organizer to check the site with.

An account made through the app's sign-up has said it is 18 and agreed to the terms, and the database keeps when and which text ([ADR 0041](0041-sign-in-by-email-and-password-with-codes.md)). An account made through Google, or by hand, has said neither.

## Options considered

- Wait for the sending domain: the group waits for a decision that is not about them.
- Turn on Supabase's own mail for everyone: two emails an hour, to members only. It does not work for anyone else.
- **Google beside the email and the password**, and email sign-up closed online until there is a domain.
- For the agreement, a check in the row-level security of every table of the books: the database itself would hold it, but each policy would gain a condition, and the policies were proved in process and against a local Supabase only weeks ago ([ADR 0044](0044-books-in-postgres-as-documents.md)).
- **For the agreement, a step in the app**, before the account's books are opened, with the policies as they are.

## Decision

- **Continue with Google** on the sign-in and the sign-up pages, above the email form. It leaves for Google and comes back to the page it left, on whatever address the app is served from, so production and every branch preview come back to themselves. Coming back signed in, the page goes on to 我的; turned down at Google, it says so in a muted line; failed, in the form's issue. The button is Google's own dark button, with its fill, stroke, label color and G: the one place the app shows colors that are not its own, as Google's guidelines for the button ask.
- **A new account takes its name from Google** where it gave none of its own: `full_name`, then `name`, each only if it is a name an account may show, before the address and 玩家 (`handle_new_user`).
- **An account that has not agreed to the terms passes a first-entry step** before its books are used: it confirms its name, says it is 18 and agrees to the terms and the privacy policy, which it can read from the step. Until then the app opens none of its books, shows the step in place of every page but those two, and can sign out back to the guest's books. The step is shown again at every sign-in until it is done, and never after.
- **`agree_to_terms(display_name, version)`** records it, for the signed-in account only: the name goes on the profile and on the space the account owns, as a sign-up names both, and the time is the database's and the version the one given, both kept from the first call only. A name an account may not show, or a version that is not 1 to 20 characters, is refused. The account still cannot write `agreed_at` or `agreed_version` itself.
- **The gate is in the app, not in the policies.** An account that has not agreed could read and write its own space through the API with its key. For a small group the organizer knows, that is accepted; the step is what the app holds them to.
- **Email sign-up is closed online by `VITE_EMAIL_SIGN_UP=off`**, until there is a sending domain. The sign-up page then offers Google only, and the password reset is linked from nowhere, as it too needs an email; `/me/reset` stays reachable by its address. Unset, or `on`, both are as before. This is in the interface only: the hosted project still takes a sign-up sent to its API directly, but with addresses confirmed before use, as ADR 0041 has it, and no code sent, that account cannot sign in.
- **The two test accounts** sign in with their email and password, and pass the first-entry step once, as any account made by hand does. A forgotten password is reset in the dashboard.
- **Locally**, Google is in the local Supabase's configuration and off, so the stack starts with no secret. It is switched on by `SUPABASE_AUTH_EXTERNAL_GOOGLE_ENABLED=true` with a client ID and secret, in the shell or in the ignored `supabase/.env`.
- **This supersedes in part** [ADR 0041](0041-sign-in-by-email-and-password-with-codes.md): Google is a way to sign in, and email sign-up and the reset wait for the domain. Its codes, its sending domain and its Turnstile check stand for when sign-up opens to the public.

## Consequences

- Google cannot be reached from mainland China without a VPN, as ADR 0041 said of a China version. Someone there signs in with an email and a password once that is open, or waits for the China version's own sign-in.
- The hosted project needs Google turned on by hand, with a client ID and secret from Google Cloud, and its redirect list set to the production address and to the branch previews' addresses with a wildcard. A preview whose address is not on the list comes back to the site's own address instead.
- Before sign-up opens to the public: a sending domain for email sign-up and the reset, the Turnstile check, and the policies' view of an account that has not agreed, if the step is not enough by then.
- An account that has not agreed and signs in through a password reset lands on the step, which then stands in for `/me/new-password`: after Start it arrives on 我的 without having set its new password. Until reset mail can be sent this cannot happen online, and a test account's password is reset in the dashboard.
- Renaming the account (`useRenameAccount`) changes its profile only; the first-entry step names the space too. A space still does not follow a later rename ([ADR 0046](0046-the-books-in-use-follow-who-is-signed-in.md)).
- The texts of the terms and the privacy policy are still to come; `TERMS_VERSION` stays `0` until the first is published. Whether an account that agreed to `0` is asked again is decided with that text.
