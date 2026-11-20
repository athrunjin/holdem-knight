import { ConfigMenu } from "@/components/ConfigMenu";
import { useGameConfigs, useRemoveGameConfig } from "@/data/game-configs";

/** Last time's setup, which the page starts from. */
export const LAST_CONFIG = "last";
/** A new game's settings with nothing to carry over. */
export const DEFAULT_CONFIG = "default";
export const DEFAULT_CONFIG_NAME = "默认全局设置";

interface GameConfigPickerProps {
  /** The chosen game config's ID, or null once it has been deleted */
  selected: string | null;
  /** The settings were changed by hand since the game config filled them */
  modified: boolean;
  /** Whether last time's setup is listed: only when it is neither a saved game config nor the default */
  lastShown: boolean;
  onSelect: (id: string | null) => void;
  /** Fills the form with a game config, by its ID */
  onApply: (id: string) => void;
}

/**
 * The game config in use, at the right of the page's title: only its name, as where it sits says
 * what it is, and a way to switch. A tap lists the others and one more fills the form, with
 * nothing to confirm. It is called 全局设置 for a reader and wherever it is named, to tell it from
 * each section's own.
 */
export function GameConfigPicker({
  selected,
  modified,
  lastShown,
  onSelect,
  onApply,
}: GameConfigPickerProps) {
  const { data: saved = [] } = useGameConfigs();
  const removeConfig = useRemoveGameConfig();
  const choices = [
    ...(lastShown ? [{ id: LAST_CONFIG, name: "上次全局设置" }] : []),
    { id: DEFAULT_CONFIG, name: DEFAULT_CONFIG_NAME },
    ...saved.map(({ id, name }) => ({ id, name, removable: true })),
  ];
  function handleRemove(id: string) {
    const config = saved.find((other) => other.id === id);
    if (!config || !window.confirm(`删除全局设置「${config.name}」？`)) return;
    removeConfig.mutate(id, {
      onSuccess: () => {
        if (selected === id) onSelect(null);
      },
    });
  }

  return (
    <ConfigMenu
      label="全局设置"
      choices={choices}
      selectedId={selected ?? undefined}
      modified={modified}
      onPick={onApply}
      onRemove={handleRemove}
      align="right"
      className="text-sm"
    />
  );
}
