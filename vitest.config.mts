import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    // Component tests are .tsx and opt into jsdom per file, the same way the
    // DOM-dependent parser tests already do.
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
