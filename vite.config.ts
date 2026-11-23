import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/** Changes on every build; appended to data URLs so a new deploy is picked up past the cache. */
const buildId = process.env.GITHUB_SHA?.slice(0, 12) ?? Date.now().toString(36);

export default defineConfig({
  root: here("src/web"),
  publicDir: here("public"),
  plugins: [preact()],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  build: {
    outDir: here("dist"),
    emptyOutDir: true,
    target: "es2022",
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: here("src/web/index.html"),
        // Methodology page (data-transparency spec), served at /metodika/.
        metodika: here("src/web/metodika/index.html"),
      },
    },
  },
});
