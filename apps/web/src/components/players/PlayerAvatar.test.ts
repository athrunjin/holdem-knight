import { ORGANIZER_PLAYER_ID } from "@holdem-knight/core";
import { describe, expect, it, vi } from "vitest";

// The books in use are not what is under test here
vi.mock("@/data", () => ({ currentOrganizerId: () => "space-1" }));

const { groundOf } = await import("./PlayerAvatar");

describe("groundOf", () => {
  it("gives the host's own record its space's ground, so hosts differ", () => {
    const spaces = ["space-1", "space-2", "space-3", "space-4", "space-5", "space-6", "space-7"];
    const grounds = new Set(spaces.map((space) => groundOf(ORGANIZER_PLAYER_ID, space)));
    expect(grounds.size).toBeGreaterThan(1);
    expect(groundOf(ORGANIZER_PLAYER_ID, "space-2")).toBe(groundOf("space-2", "elsewhere"));
    expect(groundOf(ORGANIZER_PLAYER_ID)).toBe(groundOf("space-1", "elsewhere"));
  });

  it("gives any other record the ground of its own ID, whatever the space", () => {
    expect(groundOf("p1", "space-1")).toBe(groundOf("p1", "space-2"));
  });
});
