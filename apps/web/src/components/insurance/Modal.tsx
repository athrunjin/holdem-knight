import { type ReactNode, useEffect, useRef } from "react";

interface ModalProps {
  /** Text, or a line of its own making such as a name with buttons beside it */
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      // Only its own close: React passes on that of a dialog opened from it, such as an info mark's
      onClose={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-sm rounded-2xl border border-line bg-surface p-3 text-text backdrop:bg-black/60"
    >
      <h2 className="mb-2 font-semibold">{title}</h2>
      {children}
    </dialog>
  );
}
