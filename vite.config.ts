import { defineConfig } from "vite";

// Production is served under asharksfishbowl.com/arena/
// (fresh path so phones can't keep an immutable-cached /fighter/ JS bundle)
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/arena/" : "/",
  server: {
    port: 3851,
    host: "127.0.0.1",
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
}));
