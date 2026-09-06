import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// PORT/FRONTEND_PORT live in the repo-root .env (shared with docker-compose.yml),
// not frontend/.env, so load that one explicitly and fall back to the documented defaults.
export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(mode, path.resolve(__dirname, ".."), "");
  const backendPort = rootEnv.PORT || "8000";
  const frontendPort = Number(rootEnv.FRONTEND_PORT) || 5173;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: frontendPort,
      proxy: {
        "/api": {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
