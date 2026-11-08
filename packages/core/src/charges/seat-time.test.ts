import { describe, expect, it } from "vitest";

import { seatedMs, seatSessions } from "./seat-time";
import { buy, leave, MIN, rebuy, undo } from "./test-events";

describe("seatSessions", () => {
  it("runs from the buy-in to the cash-out", () => {
    const sessions = seatSessions([buy("a", 0), rebuy("a", 20), leave("a", 90)]);
    expect(sessions.get("a")).toEqual([{ from: 0, to: 90 * MIN }]);
  });

  it("leaves a session open while the player is seated", () => {
    expect(seatSessions([buy("a", 5)]).get("a")).toEqual([{ from: 5 * MIN }]);
  });

  it("starts a new session when a cash-out is reversed", () => {
    const out = leave("a", 60);
    const sessions = seatSessions([buy("a", 0), out, undo(out, 100), leave("a", 130)]);
    expect(sessions.get("a")).toEqual([
      { from: 0, to: 60 * MIN },
      { from: 100 * MIN, to: 130 * MIN },
    ]);
  });

  it("ignores hand changes written together", () => {
    const first = buy("a", 0, 300);
    const sessions = seatSessions([first, undo(first, 10), buy("a", 10, 200), leave("a", 40)]);
    expect(sessions.get("a")).toEqual([{ from: 0, to: 40 * MIN }]);
  });

  it("drops a player removed as a mistake", () => {
    const first = buy("a", 0);
    expect(seatSessions([first, undo(first, 15)]).has("a")).toBe(false);
  });

  it("keeps each player apart", () => {
    const sessions = seatSessions([buy("a", 0), buy("b", 10), leave("a", 30), leave("b", 70)]);
    expect(sessions.get("a")).toEqual([{ from: 0, to: 30 * MIN }]);
    expect(sessions.get("b")).toEqual([{ from: 10 * MIN, to: 70 * MIN }]);
  });
});

describe("seatedMs", () => {
  it("adds up sessions and runs an open one to now", () => {
    expect(seatedMs([{ from: 0, to: 10 * MIN }, { from: 20 * MIN }], 50 * MIN)).toBe(40 * MIN);
  });
});
