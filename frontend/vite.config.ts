import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";

const fsStub = path.resolve(__dirname, "src/stubs/fs.ts");
const fsPromisesStub = path.resolve(__dirname, "src/stubs/fs-promises.ts");

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    nodePolyfills({
      include: ["crypto", "buffer", "stream", "util", "events"],
      globals: { Buffer: true, process: true },
    }),
  ],
  resolve: {
    alias: {
      "node:fs/promises": fsPromisesStub,
      "node:fs": fsStub,
      "fs": fsStub,
    },
  },
});
