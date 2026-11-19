import {
  type Game,
  INSURANCE_PLAYER_ID,
  INSURANCE_PLAYER_NAME,
  MAX_PLAYER_NAME_LENGTH,
  ORGANIZER_PLAYER_ID,
  type Player,
  type PlayerNameIssue,
  RAKE_PLAYER_ID,
  RAKE_PLAYER_NAME,
} from "@holdem-knight/core";

/**
 * Names for everyone with chips in a game: the players, the insurance and rake seats and the organizer,
 * whose ID stands in until organizers have names (M6).
 */
export function gameNameOf(players: readonly Player[], game: Pick<Game, "organizerId">) {
  const names = new Map(players.map(({ id, name }) => [id, name]));
  names.set(INSURANCE_PLAYER_ID, INSURANCE_PLAYER_NAME);
  names.set(RAKE_PLAYER_ID, RAKE_PLAYER_NAME);
  names.set(ORGANIZER_PLAYER_ID, game.organizerId);
  return (playerId: string) => names.get(playerId) ?? "未知玩家";
}

/** Initials for ordering everyone in a game by name: a player's own, or the name of a seat. */
export function gameInitialsOf(players: readonly Player[]) {
  const initials = new Map(players.map((player) => [player.id, player.initials]));
  return (playerId: string, name: string) => initials.get(playerId) ?? name;
}

export const PLAYER_NAME_ISSUE_TEXT: Record<PlayerNameIssue, string> = {
  empty: "请输入名字",
  "too-long": `名字不能超过 ${MAX_PLAYER_NAME_LENGTH} 个字`,
  duplicate: "已有同名玩家，可以写成「小王2」来区分",
  reserved: `「${INSURANCE_PLAYER_NAME}」和「${RAKE_PLAYER_NAME}」是保留名称，请换一个名字`,
};
