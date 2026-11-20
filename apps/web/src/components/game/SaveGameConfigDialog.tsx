import type { GameSettings } from "@holdem-knight/core";
import { type FormEvent, useState } from "react";
import { TextField } from "@/components/TextField";
import { newGameConfig, useGameConfigs, useSaveGameConfig } from "@/data/game-configs";
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
 * it and another name keeps a new one. It then opens on 取消, so a phone keyboard stays down.
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

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed === "") {
      setIssue("请输入名称");
      return;
    }
    const existing = saved.find((config) => config.name === trimmed);
    const config = existing ? { ...existing, settings } : newGameConfig(trimmed, settings);
    saveConfig.mutate(config, { onSuccess: () => onSaved(config.id) });
  }

  return (
    <FormDialog
      title="保存全局设置"
      submitLabel="保存"
      saving={saveConfig.isPending}
      saveFailed={saveConfig.isError}
      focusCancel={currentName !== undefined}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <TextField
        id="config-name"
        label={currentName === undefined ? "名称，同名会覆盖" : "名称：同名更新，改名另存"}
        value={name}
        issue={issue}
        inputMode="text"
        selectOnFocus
        onChange={(next) => {
          setName(next);
          setIssue(undefined);
        }}
      />
    </FormDialog>
  );
}
