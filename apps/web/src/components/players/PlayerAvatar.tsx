import { ORGANIZER_PLAYER_ID } from "@holdem-knight/core";
import { currentOrganizerId } from "@/data";
import { cn } from "@/lib/cn";

const GROUNDS = [
  "bg-avatar-1",
  "bg-avatar-2",
  "bg-avatar-3",
  "bg-avatar-4",
  "bg-avatar-5",
  "bg-avatar-6",
] as const;

/**
 * The same ground for the same record every time, spread evenly over the six. The host's own
 * record has the one ID in every space (ADR 0051), so it takes its space's instead, and hosts
 * differ from each other as other records do.
 */
export function groundOf(recordId: string, organizerId = currentOrganizerId()) {
  const id = recordId === ORGANIZER_PLAYER_ID ? organizerId : recordId;
  let hash = 0;
  for (const char of id) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return GROUNDS[hash % GROUNDS.length];
}

const SIZES = {
  sm: "size-8 text-sm",
  md: "size-9 text-base",
  header: "size-10 text-lg",
  lg: "size-12 text-xl",
} as const;

/**
 * A player's avatar: the first character of their name on a ground taken from the record's ID,
 * so two people of one name do not look alike (ADR 0043).
 */
export function PlayerAvatar({
  id,
  name,
  size = "md",
  className,
}: {
  id: string;
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-medium text-bone",
        SIZES[size],
        groundOf(id),
        className,
      )}
    >
      {[...name.trim()][0]?.toUpperCase() ?? "?"}
    </span>
  );
}
