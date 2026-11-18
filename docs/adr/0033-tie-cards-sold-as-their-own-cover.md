# 0033. Tie cards are sold as a cover of their own

- Status: Accepted
- Date: 2026-11-17

## Context

A rule either counts tie cards or does not (`tieOuts`). While it counted them, they joined the cards that overtake: a leader with 6 outs and 2 tie cards was sold one cover on 8 cards, at the odds for 8. The two kinds of card do different things to the buyer. A card that overtakes takes the whole pot share; a tie card leaves the buyer their part of a split pot. One cover could not tell them apart, so it could not be bought for one kind only, and its odds were those of neither.

## Options considered

- Keep one cover on all the cards: nothing to change, and nothing to choose.
- **Sell the tie cards as a cover of their own**, priced by their own count, next to the cover on the cards that overtake.

For what the tie cover pays:

- The same covers as for the cards that overtake, up to the whole pot share: built first, and it let a tie leave the buyer more than the pot, since half the pot is still theirs.
- **No more than a tie can cost the buyer**: their share now less what the split leaves them.

The platforms whose rules could be read do not sell tie cards at all: cards that split the pot are not counted as outs. Selling them is this app's own rule, so there was no usual limit to copy.

## Decision

- Under a rule that counts tie cards, `handOffers` gives a leader with tie cards two offers on a pot: the cards that overtake (`kind: "overtake"`, the key as before) and the tie cards (`kind: "tie"`, the key with `-tie`). Each is priced by `quoteInsurance` on its own count of cards. A leader with tie cards and nothing that overtakes has the tie offer only.
- Each offer is bought or turned down on its own, and the next card can be picked once both are decided.
- `QuoteInput.keptChips` is what the buyer still wins of the pot when a card sold comes: nothing for cards that overtake, and for tie cards the smallest share any of them leaves (`PotLeader.tieShareChips`). `ifHitChips` adds it to the payout less the premium. The premium and the payout do not depend on it.
- `QuoteInput.capChips` is the most a cover may pay where that is less than the pot share. For tie cards it is the share less `tieShareChips`: half a pot that two would split, two thirds of one that three would. It is worked out from the cards, so a pot of three where a tie card only ever splits it two ways is covered to half. 保本 and 半池 keep their targets under it, and the largest cover is the cap itself, 封顶, shown only where it is more than 半池.
- A purchase on tie cards is marked `tie` on the hand and on its `insurance_buy` event. Backups keep the field, with no change of version.
- A rule that does not count tie cards sells what it sold before, and a tied lead that cannot be insured is still refused once.
- `soldOuts`, which added the two counts, is gone.

- The buyer may give up cards of a kind, and may have some sold as a second cover. The hand keeps both by the key the kind's covers share (`skippedOuts`, `splitOuts`, set by `arrangeOuts`). `handOffers` then gives the first cover, the second with a key ending in `-2`, each priced on its own cards with the same targets and the same limit, and each offer carries `baseKey`, `part`, `allOuts` and the cards given up. At least one card is always sold, and a second cover that would hold every card sold is the first.

## Consequences

- Prices change under a rule that counts tie cards, whenever a pot has any: the cover on the cards that overtake is priced on fewer cards, so at higher odds. With 6 outs and 2 tie cards at 1 赔 30, it is sold at 5.0 where the cover on all 8 was sold at 3.5.
- A buyer can hold both covers. Only one can pay, as a card is of one kind.
- Splitting a kind into two covers prices each on fewer cards, at higher odds: four tie cards at 8.0 become three at 10.0 and one at 30.0. This is the buyer's to choose, as it is at tables where outs are bought apart.
- A tie never leaves the buyer more than the pot: what the split leaves and the most the cover pays add up to the pot share.
- Between two players the cap is half the pot, so the tie cover has 保本 and 半池 and no row above them. With whole chips 半池 can be held a little under half, and says so.
- Insurance already bought keeps what it was sold on. A purchase from before has no `tie` mark and reads as cards that overtake, tie cards included.
