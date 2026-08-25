import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_DIR = fileURLToPath(new URL(".", import.meta.url));
const PAGES_DIR = path.join(PROJECT_DIR, "pages");

export default defineConfig({
  root: PAGES_DIR,
  base: "/map-commander/",
  build: {
    outDir: path.join(PROJECT_DIR, "pages-dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(PAGES_DIR, "index.html")
    }
  }
});
