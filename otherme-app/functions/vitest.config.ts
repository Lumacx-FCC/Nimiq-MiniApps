import { defineConfig } from "vitest/config";

// Explicit config so this package's tests don't inherit the parent
// otherme-app/vite.config.ts (client React/Vite plugin config) just because
// functions/ has no vite config of its own — functions/ is a plain Node
// package, nothing here needs Vite plugins.
export default defineConfig({
  test: {
    environment: "node",
  },
});
