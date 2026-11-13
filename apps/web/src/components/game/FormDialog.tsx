import { type FormEvent, type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface FormDialogProps {
  title: ReactNode;
  submitLabel: string;
  /** False dims the confirm button until there is something to confirm */
  canSubmit?: boolean;
  /** A step back instead of 取消, which then does not close the dialog */
  back?: { readonly label: string; readonly onBack: () => void };
  saving: boolean;
  saveFailed: boolean;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
  /** Starts on 取消 instead of the first field, so a phone keyboard stays down */
  focusCancel?: boolean;
  children: ReactNode;
}

/** Dialog for entering one ledger record: title, form content, cancel and confirm. */
export function FormDialog({
  title,
  submitLabel,
  canSubmit = true,
  back,
  saving,
  saveFailed,
  onSubmit,
  onClose,
  focusCancel = false,
  children,
}: FormDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    ref.current?.showModal();
    if (focusCancel) cancelRef.current?.focus();
  }, [focusCancel]);

  // In the page's body, so a dialog opened from inside another form never nests in it
  return createPortal(
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl border border-line bg-surface p-5 text-text backdrop:bg-black/60"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <form
        onSubmit={(event) => {
          // React would otherwise carry the submit on to a form around the opener
          event.stopPropagation();
          onSubmit(event);
        }}
        noValidate
        className="mt-4 flex flex-col gap-4"
      >
        {children}
        {saveFailed && (
          <p role="alert" className="text-sm text-highlight">
            保存失败，请重试。
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => (back ? back.onBack() : ref.current?.close())}
            className="min-h-12 rounded-xl border border-line font-medium"
          >
            {back?.label ?? "取消"}
          </button>
          <button
            type="submit"
            disabled={saving || !canSubmit}
            className="min-h-12 rounded-xl bg-accent font-semibold text-accent-text disabled:opacity-40"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </dialog>,
    document.body,
  );
}
