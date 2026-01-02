import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          // Keep the largest deps in their own cacheable chunks.
          if (id.includes("mermaid")) return "vendor-mermaid";
          if (id.includes("cytoscape")) return "vendor-cytoscape";

          // Markdown + math rendering stack tends to bloat the Chat route.
          if (
            id.includes("react-markdown") ||
            id.includes("remark-") ||
            id.includes("rehype-") ||
            id.includes("micromark") ||
            id.includes("mdast") ||
            id.includes("hast") ||
            id.includes("katex")
          ) {
            return "vendor-markdown";
          }

          if (id.includes("@tanstack/")) return "vendor-tanstack";
          if (id.includes("lucide-react")) return "vendor-icons";

          // Let Vite/Rollup decide chunking for everything else.
          return;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./test/setup.ts",
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
  },
});
