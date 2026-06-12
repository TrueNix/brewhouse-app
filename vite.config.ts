import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri expects a fixed dev port and serves the built assets from dist/.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Don't watch the Rust side from Vite.
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "safari14",
    minify: "esbuild",
    sourcemap: false,
    outDir: "dist",
  },
});
