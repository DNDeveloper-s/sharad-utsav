import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The rules we test (prices, ages) are plain functions, so no browser is needed.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    // Same "@/..." shortcut that tsconfig.json gives the app.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
