import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error Build tooling is JavaScript.
import { clientBoundaryPlugin } from "./scripts/client-boundary.mjs";
export default defineConfig({
  plugins: [clientBoundaryPlugin(), react()],
  server: { allowedHosts: ["localhost", "127.0.0.1"] },
});
