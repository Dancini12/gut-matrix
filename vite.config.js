import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: ".",
  server: {
    proxy: {
      "/auth":     { target: "http://localhost:3001", changeOrigin: true },
      "/problems": { target: "http://localhost:3001", changeOrigin: true },
    },
  },
});
