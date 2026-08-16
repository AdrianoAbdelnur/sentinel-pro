import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(rootDir),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    fileParallelism: true,
    pool: "threads",
    maxWorkers: 4,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.ts", "**/*.{test,spec}.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});