import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  // A directory with no .env files, so .env.local (real Turso and Clerk credentials) is never loaded.
  envDir: fileURLToPath(new URL("./tests/.no-env", import.meta.url)),
  resolve: { alias: { "@": root } },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    environment: "node",
    testTimeout: 20_000,
  },
});
