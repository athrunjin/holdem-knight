import type { ErrorComponentProps } from "@tanstack/react-router";
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
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col gap-3 px-4 py-10">
      <h1 className="text-xl font-semibold">页面没能打开</h1>
      <p className="text-sm text-muted">
        可能是刚发布了新版本，刷新后就能打开。数据都保存在本机，不会丢失。
      </p>
      <button
        type="button"
        onClick={refresh}
        className="min-h-12 rounded-xl bg-accent font-semibold text-accent-text"
      >
        刷新
      </button>
      <p className="text-xs break-all text-muted">
        {error instanceof Error ? error.message : String(error)}
      </p>
    </div>
  );
}
