import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import playgamaBridge from "@playgama/bridge/vite";
import path from "path";
import type { Plugin } from "vite";

const port = Number(process.env.PORT || 5173);

// `npm run build:playgama` sets VITE_PLATFORM=playgama (see scripts/build-playgama.mjs).
const isPlaygama = process.env.VITE_PLATFORM === "playgama";
// Monthly Playgama builds (`npm run build:playgama -- --month=1`): one chapter of the
// campaign with its songs bundled. 0 means the full Playgama build.
const playgamaMonth = isPlaygama ? Math.min(12, Math.max(0, Number(process.env.PIM_PLAYGAMA_MONTH) || 0)) : 0;
const playgamaBombshell = playgamaMonth > 0 && process.env.PIM_PLAYGAMA_BOMBSHELL === "1";
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// Must match the productId in the Playgama dashboard's in-app purchase catalog.
const bonusProductId = `PIM_${MONTH_NAMES[Math.max(0, playgamaMonth - 1)]}_Bonus`;
// Bridge prices Playgama products in Gam: 10 Gam = 1 USD.
const bonusPriceUsd = Number(process.env.PIM_PLAYGAMA_BONUS_PRICE_USD) || 2;
// The month's leaderboard: the sum of the player's best score on every track.
const leaderboardId = `PIM_${MONTH_NAMES[Math.max(0, playgamaMonth - 1)]}_Score`;

// Playgama build: drop the third-party ecosystem bar and Google Fonts (only the
// Bridge may load from a CDN; the fonts are bundled instead), keep the Stella slideshow photos out of the bundle (portal content rules),
// and ship the Bridge config next to index.html.
const SLIDESHOW_GLOB = "'../../public/data/slideshow/**/*.{png,jpg,jpeg,gif,webp,svg}'";
const GOOGLE_FONTS_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&family=JetBrains+Mono:wght@400;700&family=Anton&display=swap');";
const BUNDLED_FONTS = [
  ...[300, 400, 500, 600, 700].map((w) => `@fontsource/space-grotesk/latin-${w}.css`),
  "@fontsource/jetbrains-mono/latin-400.css",
  "@fontsource/jetbrains-mono/latin-700.css",
  "@fontsource/anton/latin-400.css",
].map((f) => `@import '${f}';`).join("\n");
function playgamaPackaging(): Plugin {
  return {
    name: "pim-playgama-packaging",
    enforce: "pre",
    transform(code, id) {
      // Fonts ship in the archive instead of loading from Google Fonts.
      if (id.split("?")[0].endsWith("/src/index.css") && code.includes(GOOGLE_FONTS_IMPORT)) {
        return code.replace(GOOGLE_FONTS_IMPORT, BUNDLED_FONTS);
      }
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
        source: JSON.stringify({
          advertisement: { minimumDelayBetweenInterstitial: 60 },
          // The month's five bonus songs, sold as one non-consumable bundle.
          ...(playgamaMonth ? { payments: [{ id: bonusProductId, playgama: { amount: Math.round(bonusPriceUsd * 10) } }] } : {}),
          ...(playgamaMonth ? { leaderboards: [{ id: leaderboardId, isMain: true }] } : {}),
        }, null, 2) + "\n",
      });
    },
  };
}

export default defineConfig({
  // Playgama hosts the archive under its own sub-path, so asset URLs must be relative.
  base: isPlaygama ? "./" : "/",
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  // Compile-time constants so a monthly build drops the rest of the app from its bundle.
  define: {
    __PIM_MONTH__: JSON.stringify(playgamaMonth),
    __PIM_BOMBSHELL__: JSON.stringify(playgamaBombshell),
    __PIM_BONUS_PRODUCT_ID__: JSON.stringify(bonusProductId),
    __PIM_LEADERBOARD_ID__: JSON.stringify(leaderboardId),
  },
  esbuild: { drop: ['console', 'debugger'] },
  plugins: [
    // Before Tailwind, so the font import is swapped before Tailwind inlines index.css.
    ...(isPlaygama ? [playgamaPackaging()] : []),
    react(),
    tailwindcss(),
    ...(isPlaygama ? [playgamaBridge({ mode: "cdn" })] : []),
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
      // The app shell main.tsx renders; a monthly build swaps in its one-chapter shell.
      "@pim-root": path.resolve(import.meta.dirname, playgamaMonth ? "src/pages/MonthShell.tsx" : "src/App.tsx"),
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
