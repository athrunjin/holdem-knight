# 0041. Sign-in by email and password, confirmed with codes

- Status: Accepted
- Date: 2026-11-20

## Context

Accounts need a way to sign in ([ADR 0040](0040-accounts-host-spaces-and-player-records.md)). The organizer asked for an email address that is verified, a password that can be reset, and multi-factor sign-in left for later. The app is a PWA, mostly used from a phone's home screen.

## Options considered

- Links by email only, no password: nothing to remember, but every sign-in waits for an email, and a link tapped in a mail app opens in the browser, not in the installed app.
- Sign-in through Google or Apple: quick, but it adds a provider to depend on and to explain, and a China version cannot use them ([ADR 0003](0003-backend-supabase.md)).
- A phone number: SMS costs money and needs a sender in each country; planned for the China version only.
- **An email address and a password, with codes for confirming**: what was asked for, and it works the same in a browser and in the installed app.

## Decision

- Supabase Auth with an email address and a password. An address is confirmed before the account can be used.
- Confirming an address and resetting a password use a six-digit code typed into the app, not a link. On iOS a link from an email opens in Safari, which shares nothing with the app on the home screen, so the sign-in would not reach it.
- Mail is sent through a sender of our own, from our own domain with SPF and DKIM. Supabase's built-in mail is for trying things out only: two an hour, and only to the project's members.
- Signing up and asking for a reset pass a Cloudflare Turnstile check. Replies do not say whether an address has an account.
- A password changes only with a recent sign-in. Changing the address confirms the new one before it takes over. An account can sign out everywhere.
- Guest mode stays as it is ([ADR 0005](0005-guest-and-account-modes.md)): no account is made for a visitor, so Supabase's anonymous sign-in is not used. After signing in, guest data is brought in with one tap ([ADR 0040](0040-accounts-host-spaces-and-player-records.md)).
- Later: a second factor by authenticator app (TOTP), which Supabase has built in, offered to hosts first and asked for by row-level security where it matters. Passkeys once Supabase's support, in beta since May 2026, is stable.

## Consequences

- A sending domain is needed first, and so the permanent domain that [CONTEXT](../CONTEXT.md) still lists as open.
- Production needs Supabase's Pro plan in any case, as the free one pauses; it also checks new passwords against leaked ones.
- Mail to Chinese mailboxes from a sender abroad has to be tried before it is relied on.
- Each code is an email, so the sender's hourly limit has to be raised from Supabase's starting value as use grows.
