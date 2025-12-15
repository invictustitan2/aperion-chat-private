import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "./components/Layout";
import { Chat } from "./pages/Chat";
import { Memory } from "./pages/Memory";
import { Receipts } from "./pages/Receipts";
import { Errors } from "./pages/Errors";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/chat" replace />} />
            <Route path="chat" element={<Chat />} />
            <Route path="memory" element={<Memory />} />
            <Route path="receipts" element={<Receipts />} />
            <Route path="errors" element={<Errors />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
