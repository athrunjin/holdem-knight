import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { useStoredState } from "@/lib/stored-state";

/** Who the app is used as: the organizer of the games, or one who plays in them. */
export type Role = "host" | "player";

const parseRole = (stored: unknown): Role | undefined =>
  stored === "host" || stored === "player" ? stored : undefined;

/** The role in use, kept on the device and shared by every page that offers the switch. */
export function useRole() {
  return useStoredState<Role>("app.role", "host", parseRole);
}

const SEGMENTS: readonly { readonly role: Role; readonly label: string }[] = [
  { role: "host", label: t.ui.roleSwitch.host },
  { role: "player", label: t.ui.roleSwitch.player },
];

/**
 * Host or Player, as a small pill of two segments: a tap anywhere on it flips to the other. The
 * chosen one is filled with `line` and set in medium weight, and the fill slides across.
 */
export function RoleSwitch({
  role,
  onChange,
  className,
}: {
  role: Role;
  onChange: (role: Role) => void;
  className?: string;
}) {
  const player = role === "player";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={player}
      aria-label={t.ui.roleSwitch.label}
      onClick={() => onChange(player ? "host" : "player")}
      // 44px to tap around the pill, which is drawn smaller inside it
      className={cn("grid min-h-11 min-w-11 shrink-0 place-items-center rounded-lg", className)}
    >
      <span
        aria-hidden
        className="relative grid h-7.5 grid-cols-2 rounded-lg border border-line p-0.5 text-sm"
      >
        <span
          className={cn(
            "absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-md bg-line",
            "transition-transform duration-200 ease-out motion-reduce:transition-none",
            player && "translate-x-full",
          )}
        />
        {SEGMENTS.map((segment) => (
          <span
            key={segment.role}
            className={cn(
              "relative grid place-items-center px-2 transition-colors duration-200 ease-out motion-reduce:transition-none",
              segment.role === role ? "font-medium text-text" : "text-muted",
            )}
          >
            {segment.label}
          </span>
        ))}
      </span>
    </button>
  );
}
