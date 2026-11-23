import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const frontendDirectory = fileURLToPath(new URL(".", import.meta.url));
const projectDirectory = resolve(frontendDirectory, "../..");
const calculatorFiles = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/styles.css": ["styles.css", "text/css; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
};

function calculatorRoute() {
  return {
    name: "calculator-route",
    configureServer(server) {
      server.middlewares.use("/calculatrice", (request, response, next) => {
        const path = (request.url || "/").split("?")[0];
        const file = calculatorFiles[path];
        if (!file) return next();
        try {
          response.setHeader("Content-Type", file[1]);
          response.end(readFileSync(resolve(projectDirectory, file[0])));
        } catch (error) {
          next(error);
        }
      });
    },
    closeBundle() {
      const outputDirectory = resolve(frontendDirectory, "dist/calculatrice");
      mkdirSync(outputDirectory, { recursive: true });
      for (const filename of ["index.html", "styles.css", "app.js"]) {
        copyFileSync(
          resolve(projectDirectory, filename),
          resolve(outputDirectory, filename),
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), calculatorRoute()],
  server: {
    host: "0.0.0.0",
  },
});
