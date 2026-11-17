# 0033. Tie cards are sold as a cover of their own

- Status: Accepted
- Date: 2026-11-17

## Context

A rule either counts tie cards or does not (`tieOuts`). While it counted them, they joined the cards that overtake: a leader with 6 outs and 2 tie cards was sold one cover on 8 cards, at the odds for 8. The two kinds of card do different things to the buyer. A card that overtakes takes the whole pot share; a tie card leaves the buyer their part of a split pot. One cover could not tell them apart, so it could not be bought for one kind only, and its odds were those of neither.

## Options considered

- Keep one cover on all the cards: nothing to change, and nothing to choose.
- **Sell the tie cards as a cover of their own**, priced by their own count, next to the cover on the cards that overtake.

For what the tie cover pays:

- Cap it at what a tie costs the buyer, the pot share less their part of the split.
- **The same covers as for the cards that overtake**: 保本, 半池 and 满池 with the same targets, and the same limit of the pot share. The organizer asked for the same table.

## Decision

- Under a rule that counts tie cards, `handOffers` gives a leader with tie cards two offers on a pot: the cards that overtake (`kind: "overtake"`, the key as before) and the tie cards (`kind: "tie"`, the key with `-tie`). Each is priced by `quoteInsurance` on its own count of cards. A leader with tie cards and nothing that overtakes has the tie offer only.
- Each offer is bought or turned down on its own, and the next card can be picked once both are decided.
- `QuoteInput.keptChips` is what the buyer still wins of the pot when a card sold comes: nothing for cards that overtake, and for tie cards the smallest share any of them leaves (`PotLeader.tieShareChips`). `ifHitChips` adds it to the payout less the premium. The premium and the payout do not depend on it.
- A purchase on tie cards is marked `tie` on the hand and on its `insurance_buy` event. Backups keep the field, with no change of version.
- A rule that does not count tie cards sells what it sold before, and a tied lead that cannot be insured is still refused once.
- `soldOuts`, which added the two counts, is gone.

## Consequences

- Prices change under a rule that counts tie cards, whenever a pot has any: the cover on the cards that overtake is priced on fewer cards, so at higher odds. With 6 outs and 2 tie cards at 1 赔 30, it is sold at 5.0 where the cover on all 8 was sold at 3.5.
- A buyer can hold both covers. Only one can pay, as a card is of one kind.
- A tie cover can leave the buyer more than the pot: 满池 on tie cards pays the pot share while half the pot is still theirs. This follows from giving it the same covers as the other, and is the first thing to look at if the tie cover needs a limit of its own.
- Insurance already bought keeps what it was sold on. A purchase from before has no `tie` mark and reads as cards that overtake, tie cards included.
