import { type FormEvent, useState } from "react";
import { FormDialog } from "@/components/game/FormDialog";
import { TextField } from "@/components/TextField";
import { t } from "@/i18n";

interface SaveNameDialogProps {
  title: string;
  label: string;
  /** A suggested name, such as 赔率表_11-11 */
  initialName: string;
  saving: boolean;
  saveFailed: boolean;
  /** Returns an issue to show, or nothing once saving has started */
  onSave: (name: string) => string | undefined;
  onClose: () => void;
}

/**
 * Names something before saving it. It opens on 取消 so a phone keyboard stays down, and a tap on
 * the name selects it, so typing replaces the suggestion.
 */
export function SaveNameDialog({
  title,
  label,
  initialName,
  saving,
  saveFailed,
  onSave,
  onClose,
}: SaveNameDialogProps) {
  const [name, setName] = useState(initialName);
  const [issue, setIssue] = useState<string>();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    setIssue(trimmed === "" ? t.common.enterAName : onSave(trimmed));
  }

  return (
    <FormDialog
      title={title}
      submitLabel={t.common.save}
      saving={saving}
      saveFailed={saveFailed}
      focusCancel
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <TextField
        id="save-name"
        label={label}
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
