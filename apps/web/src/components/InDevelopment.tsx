import { useMessages } from "@/i18n";

/** Marks a feature that is not built yet and the milestone it is planned for. */
export function InDevelopment({ milestone }: { milestone: string }) {
  const m = useMessages();
  return (
    <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-muted">
      {m.shell.inDevelopment(milestone)}
    </span>
  );
}
