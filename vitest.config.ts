import preact from "@preact/preset-vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [preact()],
  define: {
    __BUILD_ID__: JSON.stringify("test"),
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}"],
    passWithNoTests: true,
  },
});
