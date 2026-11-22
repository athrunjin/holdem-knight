import type { GameSettings } from "@holdem-knight/core";
import { type FormEvent, useState } from "react";
import { TextField } from "@/components/TextField";
import { newGameConfig, useGameConfigs, useSaveGameConfig } from "@/data/game-configs";
import { t } from "@/i18n";
import { FormDialog } from "./FormDialog";

interface SaveGameConfigDialogProps {
  settings: GameSettings;
  /** The config that filled the form, whose name is offered so that saving updates it */
  currentName?: string | undefined;
  onSaved: (id: string) => void;
  onClose: () => void;
}

/**
 * Keeps the whole setup under a name. The name of the config in use is filled in, so 保存 updates
 * it and another name keeps a new one. It then opens on 取消, so a phone keyboard stays down. A
 * name already in use says under the field that saving replaces that one, with nothing to confirm.
 */
export function SaveGameConfigDialog({
  settings,
  currentName,
  onSaved,
  onClose,
}: SaveGameConfigDialogProps) {
  const { data: saved = [] } = useGameConfigs();
  const saveConfig = useSaveGameConfig();
  const [name, setName] = useState(currentName ?? "");
  const [issue, setIssue] = useState<string>();

  const trimmed = name.trim();
  // Saving under a name in use replaces that game config, which is said and not asked about
  const taken = saved.find((config) => config.name === trimmed);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (trimmed === "") {
      setIssue(t.common.enterAName);
      return;
    }
    const config = taken ? { ...taken, settings } : newGameConfig(trimmed, settings);
    saveConfig.mutate(config, { onSuccess: () => onSaved(config.id) });
  }

  return (
    <FormDialog
      title={t.game.saveGameConfigDialog.saveGameSettings}
      submitLabel={t.common.save}
      saving={saveConfig.isPending}
      saveFailed={saveConfig.isError}
      focusCancel={currentName !== undefined}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <TextField
        id="config-name"
        label={t.game.saveGameConfigDialog.nameOfTheGameSettings}
        value={name}
        issue={issue}
        inputMode="text"
        selectOnFocus
        onChange={(next) => {
          setName(next);
          setIssue(undefined);
        }}
      />
      {taken && !issue && (
        <p role="status" className="mt-1 text-sm text-highlight">
          {t.game.saveGameConfigDialog.gameSettingsWithThisNameExist}
        </p>
      )}
    </FormDialog>
  );
}
