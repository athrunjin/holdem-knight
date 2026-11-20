import "@fontsource-variable/archivo/wdth.css";
import "./styles.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouteError } from "./components/layout/RouteError";
import { trackKeyboardInset } from "./lib/keyboard-inset";
import { reloadAfterRelease } from "./lib/reload-after-release";
import { routeTree } from "./routeTree.gen";

trackKeyboardInset();
reloadAfterRelease();

const queryClient = new QueryClient({
  defaultOptions: {
    // Guest data is local and must stay readable and writable offline, so skip the default pausing
    queries: { staleTime: 30_000, retry: 2, networkMode: "always" },
    mutations: { networkMode: "always" },
  },
});

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  defaultErrorComponent: RouteError,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Could not find the #root element");

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
