import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { CommandPalette } from "./components/CommandPalette";
import { Layout } from "./components/Layout";
import { ThemeProvider } from "./contexts/ThemeContext";

// Lazy load page components for code splitting
const Chat = lazy(() =>
  import("./pages/Chat").then((m) => ({ default: m.Chat })),
);
const Memory = lazy(() =>
  import("./pages/Memory").then((m) => ({ default: m.Memory })),
);
const Identity = lazy(() =>
  import("./pages/Identity").then((m) => ({ default: m.Identity })),
);
const Receipts = lazy(() =>
  import("./pages/Receipts").then((m) => ({ default: m.Receipts })),
);
const Settings = lazy(() =>
  import("./pages/Settings").then((m) => ({ default: m.Settings })),
);
const SystemStatus = lazy(() =>
  import("./pages/SystemStatus").then((m) => ({ default: m.SystemStatus })),
);
const Logs = lazy(() =>
  import("./pages/Logs").then((m) => ({ default: m.Logs })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Loading spinner for lazy-loaded components
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );
}

function App() {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Global Cmd+K listener for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {/* Command Palette */}
          <CommandPalette
            isOpen={isCommandPaletteOpen}
            onClose={() => setIsCommandPaletteOpen(false)}
          />

          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/chat" replace />} />
              <Route
                path="chat"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Chat />
                  </Suspense>
                }
              />
              <Route
                path="memory"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Memory />
                  </Suspense>
                }
              />
              <Route
                path="identity"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Identity />
                  </Suspense>
                }
              />
              <Route
                path="receipts"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Receipts />
                  </Suspense>
                }
              />
              <Route
                path="errors"
                element={<Navigate to="/status" replace />}
              />
              <Route
                path="status"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <SystemStatus />
                  </Suspense>
                }
              />
              <Route
                path="settings"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Settings />
                  </Suspense>
                }
              />
              <Route
                path="logs"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Logs />
                  </Suspense>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
