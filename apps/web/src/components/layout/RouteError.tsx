import type { ErrorComponentProps } from "@tanstack/react-router";
import { useMessages } from "@/i18n";
import { dropBrokenPageFiles } from "@/lib/reload-after-release";

/** Drops page files the offline cache holds broken, then reloads, whether the repair worked or not. */
function refresh() {
  const repaired = "caches" in window ? dropBrokenPageFiles(window.caches) : Promise.resolve(0);
  repaired.catch(() => 0).finally(() => window.location.reload());
}

/**
 * What a page shows when it fails, in place of the router's own English message. Most often its
 * files could not be loaded, as a page open across a release can, which a refresh puts right.
 */
export function RouteError({ error }: ErrorComponentProps) {
  const m = useMessages();
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col gap-3 px-4 py-10">
      <h1 className="text-xl font-semibold">{m.shell.routeError.title}</h1>
      <p className="text-sm text-muted">{m.shell.routeError.body}</p>
      <button
        type="button"
        onClick={refresh}
        className="min-h-12 rounded-xl bg-accent font-semibold text-accent-text"
      >
        {m.common.refresh}
      </button>
      <p className="text-xs break-all text-muted">
        {error instanceof Error ? error.message : String(error)}
      </p>
    </div>
  );
}
