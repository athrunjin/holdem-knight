import { QueryClient } from "@tanstack/react-query";

/**
 * What the app has read, kept for the pages that show it. Requests are never paused for being
 * offline: both a guest's books and an account's are read from the device (ADR 0054), and what
 * still goes to the account fails and says so rather than wait.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2, networkMode: "always" },
    mutations: { networkMode: "always" },
  },
});
