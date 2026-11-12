import { Info } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Modal } from "@/components/insurance/Modal";
import { cn } from "@/lib/cn";

interface InfoButtonProps {
  title: string;
  /** Plain text, with line breaks kept. */
  text?: string;
  /** Laid-out content, in place of `text`. */
  children?: ReactNode;
  /** Sized to sit beside small text. */
  small?: boolean;
}

/** A small info icon that explains something when tapped. */
export function InfoButton({ title, text, children, small = false }: InfoButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={`${title}说明`}
        onClick={() => setOpen(true)}
        className={cn(
          "grid shrink-0 place-items-center text-muted",
          small ? "-mx-1 size-6" : "-my-2 size-9",
        )}
      >
        <Info className={small ? "size-3.5" : "size-4"} aria-hidden />
      </button>
      {open && (
        <Modal title={title} onClose={() => setOpen(false)}>
          {children ?? <p className="text-sm whitespace-pre-line text-muted">{text}</p>}
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
