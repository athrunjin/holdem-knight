import { cn } from "@/lib/cn";

/** A poker chip: a ring with four edge marks around a smaller ring, in the color of the text. */
export function ChipIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      role="img"
      aria-label="筹码"
      className={cn("inline-block size-4 shrink-0", className)}
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    </svg>
  );
}
