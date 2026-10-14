import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import playgamaBridge from "@playgama/bridge/vite";
import path from "path";
import type { Plugin } from "vite";

const port = Number(process.env.PORT || 5173);

// `npm run build:playgama` sets VITE_PLATFORM=playgama (see scripts/build-playgama.mjs).
const isPlaygama = process.env.VITE_PLATFORM === "playgama";

// Playgama build: drop the third-party ecosystem bar (only the Bridge may load from
// a CDN), keep the Stella slideshow photos out of the bundle (portal content rules),
// and ship the Bridge config next to index.html.
const SLIDESHOW_GLOB = "'../../public/data/slideshow/**/*.{png,jpg,jpeg,gif,webp,svg}'";
function playgamaPackaging(): Plugin {
  return {
    name: "pim-playgama-packaging",
    enforce: "pre",
    transform(code) {
      if (!code.includes(SLIDESHOW_GLOB)) return null;
      return code.replace(SLIDESHOW_GLOB, `[${SLIDESHOW_GLOB}, '!../../public/data/slideshow/stella/**']`);
    },
    transformIndexHtml(html) {
      return html.replace(/\s*<!-- th3scr1b3 ecosystem bar[\s\S]*?<\/script>/, "");
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "playgama-bridge-config.json",
        source: JSON.stringify({ advertisement: { minimumDelayBetweenInterstitial: 60 } }, null, 2) + "\n",
      });
    },
  };
}

export default defineConfig({
  // Playgama hosts the archive under its own sub-path, so asset URLs must be relative.
  base: isPlaygama ? "./" : "/",
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  esbuild: { drop: ['console', 'debugger'] },
  plugins: [
    react(),
    tailwindcss(),
    ...(isPlaygama ? [playgamaBridge({ mode: "cdn" }), playgamaPackaging()] : []),
    {
      name: "farcaster-well-known",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith("/.well-known/farcaster.json") || req.url?.startsWith("/farcaster.json")) {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Content-Type", "application/json");
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, isPlaygama ? "dist-playgama" : "dist"),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor_react: ['react', 'react-dom', 'wouter', 'zustand'],
          vendor_web3: ['ethers', '@coinbase/wallet-sdk'],
          vendor_supabase: ['@supabase/supabase-js'],
          vendor_ui: ['framer-motion', 'lucide-react', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
  server: {
    port,
    strictPort: false,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      allow: [".."],
    },
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
});
