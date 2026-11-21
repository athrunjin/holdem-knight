import { DEFAULT_RAKE_RULE, type Game, parseRake, type RakeForm } from "@holdem-knight/core";
import { useState } from "react";
import { useSaveGame } from "@/data/games";
import { t } from "@/i18n";
import { type ChargeChoice, initialRakeChoice, RakeSettingsPanel } from "./ChargeSettings";

/** What 本局 stands for in the list of presets: the rule this game was set up with. */
const THIS_GAME = t.game.gameRakeSettings.thisGamesRakeSettings;

/**
 * 抽水计算's settings in a game: closed at first, they are this game's own rule, so a change is
 * asked about before it applies to the game, and is then saved with it. A new name for the same
 * values changes nothing and goes through.
 */
export function GameRakeSettings({ game }: { game: Game }) {
  const saveGame = useSaveGame();
  const rule = game.rake ?? DEFAULT_RAKE_RULE;
  // The settings as changed here, shown at once while the game is being saved
  const [choice, setChoice] = useState<ChargeChoice<RakeForm>>(() => initialRakeChoice(rule, rule));

  function handleChange(next: ChargeChoice<RakeForm>) {
    const parsed = parseRake(next.form);
    const current = parseRake(choice.form);
    const repriced =
      parsed.ok && JSON.stringify(parsed.rule) !== JSON.stringify(current.ok && current.rule);
    if (repriced) {
      if (!window.confirm(t.game.gameRakeSettings.thisChangeAppliesToThisGame)) return false;
      saveGame.mutate({ ...game, rake: parsed.rule });
    }
    setChoice(next);
    return true;
  }

  return (
    <RakeSettingsPanel
      value={choice}
      currency={game.currency}
      stakes={{
        smallBlindChips: game.smallBlindChips,
        bigBlindChips: game.bigBlindChips,
        ratio: game.chipRatio,
      }}
      lastRule={rule}
      lastRuleLabel={THIS_GAME}
      lastSource={game.sources?.rake}
      defaultOpen={false}
      onChange={handleChange}
    />
  );
}
