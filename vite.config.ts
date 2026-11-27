import { defineConfig } from "vite";

// Production is served under asharksfishbowl.com/fighter/
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/fighter/" : "/",
  server: {
    port: 3851,
    host: "127.0.0.1",
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
}));
