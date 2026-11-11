import { Info } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/insurance/Modal";

/** A small info icon that explains something when tapped. */
export function InfoButton({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={`${title}说明`}
        onClick={() => setOpen(true)}
        className="-my-2 grid size-9 shrink-0 place-items-center text-muted"
      >
        <Info className="size-4" aria-hidden />
      </button>
      {open && (
        <Modal title={title} onClose={() => setOpen(false)}>
          <p className="text-sm whitespace-pre-line text-muted">{text}</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 min-h-11 w-full rounded-xl border border-line font-medium"
          >
            知道了
          </button>
        </Modal>
      )}
    </>
  );
}
