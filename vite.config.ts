import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: "./src/src/routes",
      generatedRouteTree: "./src/src/routeTree.gen.ts",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/src", import.meta.url)),
    },
  },
  optimizeDeps: {
    include: [
      "pdfjs-dist",
      "tesseract.js",
      "apexcharts",
      "react-apexcharts",
      "jspdf",
      "html2canvas",
      "dompurify",
      "recharts",
      "@tanstack/react-router",
      "@tanstack/react-query",
    ],
  },
  server: {
    port: 8082,
    strictPort: true,
    host: true,
  },
});
