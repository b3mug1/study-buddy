import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 1000,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:1001",
        changeOrigin: false,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 1000,
    strictPort: true,
  },
});
