/** The common chip ratios a new game offers: so many chips for one point. */
export const RATIO_PICKS = [1, 5, 10, 20].map((chips) => ({ chips, label: `${chips}:1` }));

/** The common blinds a new game offers. */
export const BLIND_PICKS = (
  [
    [1, 1],
    [1, 2],
    [5, 5],
    [5, 10],
    [10, 10],
    [10, 20],
  ] as const
).map(([small, big]) => ({ small, big, label: `${small}/${big}` }));
