import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const frontendDirectory = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [react()],
  define: {
    "import.meta.env.VITE_DESKTOP": JSON.stringify("true"),
    "import.meta.env.VITE_API_URL": JSON.stringify(
      "",
    ),
  },
  build: {
    outDir: resolve(frontendDirectory, "admin-dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(frontendDirectory, "admin.html"),
    },
  },
});
