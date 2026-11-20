/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { dropBrokenPageFiles, reloadAfterRelease } from "./reload-after-release";

/** A cache of URL to content type, behind the parts of the Cache Storage API the repair uses. */
function fakeCaches(entries: Record<string, string>) {
  const store = new Map(Object.entries(entries));
  const cache = {
    keys: async () => [...store.keys()].map((url) => new Request(url)),
    match: async (request: Request) => {
      const type = store.get(request.url);
      return type === undefined
        ? undefined
        : new Response("", { headers: { "content-type": type } });
    },
    delete: async (request: Request) => store.delete(request.url),
    put: async (request: Request, response: Response) => {
      store.set(request.url, response.headers.get("content-type") ?? "");
    },
  };
  const storage = {
    keys: async () => ["workbox-precache-v2"],
    open: async () => cache,
  } as unknown as CacheStorage;
  return { storage, store };
}

describe("dropBrokenPageFiles", () => {
  it("replaces scripts and styles held as the app's page where the host has them, and keeps the rest", async () => {
    const { storage, store } = fakeCaches({
      "https://x.test/assets/new-1.js": "text/html; charset=utf-8",
      "https://x.test/assets/tools-2.js": "application/javascript",
      "https://x.test/assets/index-3.css": "text/html",
      "https://x.test/index.html": "text/html",
    });
    // The host has the script again but still not the style
    const fetchFile = async (url: string) =>
      url.endsWith(".js")
        ? new Response("", { headers: { "content-type": "application/javascript" } })
        : new Response("<html>", { headers: { "content-type": "text/html" } });
    expect(await dropBrokenPageFiles(storage, fetchFile)).toBe(2);
    expect(Object.fromEntries(store)).toEqual({
      "https://x.test/assets/new-1.js": "application/javascript",
      "https://x.test/assets/tools-2.js": "application/javascript",
      "https://x.test/index.html": "text/html",
    });
  });
});

describe("reloadAfterRelease", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.useRealTimers();
  });

  it("repairs the offline cache and reloads once, and leaves a second failure to show", async () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    const { storage, store } = fakeCaches({ "https://x.test/assets/new-1.js": "text/html" });
    const target = new EventTarget() as unknown as Window;
    Object.defineProperty(target, "sessionStorage", { value: sessionStorage });
    Object.defineProperty(target, "caches", { value: storage });
    reloadAfterRelease(target, reload);
    const failToLoad = () => {
      const event = new Event("vite:preloadError", { cancelable: true });
      target.dispatchEvent(event);
      return event;
    };

    // The error is held back, as the page is going away
    expect(failToLoad().defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(store.size).toBe(0);

    expect(failToLoad().defaultPrevented).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);

    // Long after, as on the next release, it reloads again
    vi.advanceTimersByTime(60_000);
    failToLoad();
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(2));
  });
});
