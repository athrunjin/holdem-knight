import { QueryClient } from "@tanstack/react-query";

/**
 * What the app has read, kept for the pages that show it. Requests are never paused for being
 * offline: a guest's books are on the device and stay readable there, and an account's fail and
 * say so rather than wait.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2, networkMode: "always" },
    mutations: { networkMode: "always" },
  },
});
