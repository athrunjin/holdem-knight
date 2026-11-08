# 0021. Visual identity: the K◇K diamond knight helmet

- Status: Accepted
- Date: 2026-11-09

## Context

ADR 0020 named the product Hold’em Knight, but the app still used the old chip icon. The user picked a mark from three rounds of logo sketches: the brand should read as a pair of kings with a knight. A first handoff (v1) used the wrong sketches and was replaced by v1.1. The user also wants the home screen to show the full English name.

## Decision

- The single mark is D4 from round three: two facing K's whose diagonals form a gold diamond, with a knight helmet inside. The app icon is that mark on felt green.
- Under 32px (the favicon and the sidebar icon) the mark drops the helmet and becomes K◇K.
- Light backgrounds use the version with felt-green stems and dark backgrounds the version with bone stems.
- The home screen name is Holdem Knight, without the apostrophe, superseding Knight from ADR 0020. The manifest `name` stays Hold’em Knight · Tablebook.
- Colours are the existing design tokens, with none added. The wordmarks use Cinzel and Noto Serif SC, both under the SIL OFL. The app interface keeps its current fonts.
- The guide, vector files and build scripts live in `docs/brand/`. PNG exports aren't committed beyond what `apps/web/public/` ships; the scripts rebuild them.
- Dropped directions: a chess knight, the knight card icon (used by mistake in v1), a crowned shield, the names Chip Leader and KK 德州.

## Consequences

- Some phones cut the home screen name to "Holdem Kni…".
- Installed apps don't pick up a new icon or name by themselves. They have to be removed and added to the home screen again.
- Link previews use `og-image.png` from an absolute `holdem-knight.pages.dev` URL, so they show the production image even from preview deployments.
