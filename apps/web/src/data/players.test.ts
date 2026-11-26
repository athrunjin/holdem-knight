import type { Player } from "@holdem-knight/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const kept: Player[] = [];
const repository = {
  players: {
    list: vi.fn(async () => kept),
    save: vi.fn(async () => undefined),
    ensure: vi.fn(),
  },
};

// The books in use stand in for themselves here
vi.mock(".", () => ({
  repository,
  currentOrganizerId: () => "me",
  currentOwnerName: () => undefined,
}));

const { numberedPlayers } = await import("./players");

describe("reading the player list", () => {
  beforeEach(() => {
    kept.length = 0;
    kept.push({
      id: "a",
      organizerId: "me",
      name: "小王",
      initials: "xw",
      createdAt: 1,
      number: 1,
    });
    vi.clearAllMocks();
  });

  it("makes the host's own record before it reads", async () => {
    repository.players.ensure.mockResolvedValue(undefined);
    await numberedPlayers();
    expect(repository.players.ensure).toHaveBeenCalledWith(
      expect.objectContaining({ id: "organizer", organizerId: "me" }),
    );
  });

  it("still reads when the own record cannot be made", async () => {
    repository.players.ensure.mockRejectedValue(new Error("offline"));
    expect(await numberedPlayers()).toEqual(kept);
  });
});
