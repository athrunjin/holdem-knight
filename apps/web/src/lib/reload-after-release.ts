/** When the page last reloaded itself for a file it could not load, kept for this tab only. */
const RELOADED_AT = "reloaded-after-release";

/** A second failure this soon after reloading is not a page left over from a release. */
const AGAIN_MS = 10_000;

/** A page's own files: scripts and styles. */
const PAGE_FILE = /\.(?:js|css)$/;

/**
 * Drops page files the offline cache holds as HTML. The host answers a file it does not have with
 * the app's page, as a single-page app needs, so a file missing while the offline cache filled in
 * a new version is kept as that page and fails on every visit, refresh or not. Without it in the
 * cache, the offline cache fetches the file again; it is fetched here too and kept, where the
 * host has it now, so the page still opens offline. Only the offline cache is touched; the games
 * and players live in IndexedDB.
 */
export async function dropBrokenPageFiles(
  cacheStorage: CacheStorage,
  fetchFile: (url: string) => Promise<Response> = (url) => fetch(url, { cache: "reload" }),
): Promise<number> {
  let dropped = 0;
  for (const key of await cacheStorage.keys()) {
    const cache = await cacheStorage.open(key);
    for (const request of await cache.keys()) {
      if (!PAGE_FILE.test(new URL(request.url).pathname)) continue;
      if (!isHtml(await cache.match(request))) continue;
      await cache.delete(request);
      dropped += 1;
      // The real file in its place, so the page still opens offline; left out if still missing
      const fresh = await fetchFile(request.url).catch(() => undefined);
      if (fresh?.ok && !isHtml(fresh)) await cache.put(request, fresh);
    }
  }
  return dropped;
}

const isHtml = (response: Response | undefined) =>
  response?.headers.get("content-type")?.includes("text/html") ?? false;

/**
 * Reloads the page once when a page's files cannot be loaded, as a page open across a release or
 * caught by the offline cache as it switches versions can be, after dropping files the offline
 * cache holds broken. The browser keeps a failed file until the page reloads, so reloading gets
 * the new version. If the files fail again right after, the error is left to show, so a page never
 * reloads without end.
 */
export function reloadAfterRelease(
  target: Window = window,
  reload: () => void = () => target.location.reload(),
) {
  target.addEventListener("vite:preloadError", (event) => {
    try {
      const last = Number(target.sessionStorage.getItem(RELOADED_AT)) || 0;
      if (Date.now() - last < AGAIN_MS) return;
      target.sessionStorage.setItem(RELOADED_AT, String(Date.now()));
    } catch {
      // Without storage there is no telling a second failure apart, so leave the error to show
      return;
    }
    event.preventDefault();
    const repaired = "caches" in target ? dropBrokenPageFiles(target.caches) : Promise.resolve(0);
    // Reload whether or not the repair worked: a page left over from a release needs only that
    repaired.catch(() => 0).finally(reload);
  });
}
