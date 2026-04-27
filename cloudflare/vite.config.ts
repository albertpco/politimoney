import { existsSync, createReadStream } from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

const repoRoot = path.resolve(import.meta.dirname, "..");
const feedRoot = path.join(repoRoot, "dist", "public-feed", "latest");

function localFeedPlugin(): Plugin {
  return {
    name: "politimoney-local-feed",
    configureServer(server) {
      server.middlewares.use("/data/latest", (request, response, next) => {
        const requestPath = decodeURIComponent(request.url?.split("?")[0] ?? "/");
        const filePath = path.normalize(path.join(feedRoot, requestPath));
        if (!filePath.startsWith(feedRoot) || !existsSync(filePath)) {
          next();
          return;
        }

        response.setHeader("content-type", "application/json; charset=utf-8");
        createReadStream(filePath).pipe(response);
      });
    },
  };
}

export default defineConfig({
  root: path.join(repoRoot, "cloudflare"),
  plugins: [react(), tailwind(), localFeedPlugin()],
  resolve: {
    alias: {
      "@": path.join(repoRoot, "cloudflare", "src"),
    },
  },
  build: {
    outDir: path.join(repoRoot, "dist", "cloudflare"),
    emptyOutDir: true,
  },
  server: {
    port: 4174,
  },
});
