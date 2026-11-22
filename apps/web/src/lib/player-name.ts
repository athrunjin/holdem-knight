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
import { organizerNameOf } from "@/data";
import { t } from "@/i18n";

/**
 * Names for everyone with chips in a game: the players, the insurance and rake seats and the
 * organizer, by the name of their space.
 */
export function gameNameOf(players: readonly Player[], game: Pick<Game, "organizerId">) {
  const names = new Map(players.map(({ id, name }) => [id, name]));
  names.set(INSURANCE_PLAYER_ID, t.common.insurance);
  names.set(RAKE_PLAYER_ID, t.common.rake);
  names.set(ORGANIZER_PLAYER_ID, organizerNameOf(game));
  return (playerId: string) => names.get(playerId) ?? t.common.unknownPlayer;
}

/** Initials for ordering everyone in a game by name: a player's own, or the name of a seat. */
export function gameInitialsOf(players: readonly Player[]) {
  const initials = new Map(players.map((player) => [player.id, player.initials]));
  return (playerId: string, name: string) => initials.get(playerId) ?? name;
}

export const PLAYER_NAME_ISSUE_TEXT: Record<PlayerNameIssue, string> = {
  empty: t.lib.playerName.enterAName,
  "too-long": t.lib.playerName.aNameCantBeLongerThan(MAX_PLAYER_NAME_LENGTH),
  duplicate: t.lib.playerName.aPlayerWithThisNameExists,
  reserved: t.lib.playerName.andAreReservedNamesChooseAnother(
    INSURANCE_PLAYER_NAME,
    RAKE_PLAYER_NAME,
  ),
};
