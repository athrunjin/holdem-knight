import { t } from "@/i18n";
/** After a saved config's name while its values have been changed by hand. */
export const MODIFIED_MARK = t.lib.configText.edited;

/** Asks before a saved config is deleted, saying so when game configs follow it. */
export function removalQuestion(what: string, name: string, followers: number) {
  const question = t.lib.configText.deleteThe(what, name);
  return followers > 0 ? t.lib.configText.gameSettingsUseItTheyKeep(question, followers) : question;
}

/** Asks before a saved config that game configs follow takes new values. */
export function updateQuestion(name: string, followers: number) {
  return t.lib.configText.updateGameSettingsUseItGames(name, followers);
}
