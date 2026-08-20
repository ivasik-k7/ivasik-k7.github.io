// Only the mono face is ever used — `body` sets `--font-mono` and every panel
// in the game inherits it. Geist Variable and Archivo Variable backed
// `--font-sans` and `--font-display`, and nothing in the source refers to
// either, so they were six woff2 files shipped to be never requested.
import "@fontsource-variable/geist-mono";
import "@/index.css";
import "@/i18n";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { routeTree } from "@/routeTree.gen";

const queryClient = new QueryClient();
const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}
