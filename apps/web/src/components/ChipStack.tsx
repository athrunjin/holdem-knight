import { cn } from "@/lib/cn";

/**
 * Three chips in a stack, the app's mark for chips: outlines, or filled when `lit`. Each chip is
 * filled with the color behind it so it hides the one under it; `ground` names that color.
 */
export function ChipStack({
  lit = false,
  ground = "var(--bg)",
  className,
}: {
  lit?: boolean;
  ground?: string;
  className?: string;
}) {
  const side = lit ? `color-mix(in srgb, currentColor 35%, ${ground})` : ground;
  const face = lit ? `color-mix(in srgb, currentColor 60%, ${ground})` : ground;
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-6 shrink-0", className)}
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      {[15, 10.5, 6].map((top) => (
        <g key={top}>
          <path d={`M4 ${top}v3.5a8 3 0 0 0 16 0v-3.5`} fill={side} />
          <ellipse cx="12" cy={top} rx="8" ry="3" fill={face} />
        </g>
      ))}
    </svg>
  );
}
