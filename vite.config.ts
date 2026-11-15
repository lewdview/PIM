import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import type { Plugin } from "vite";

const port = Number(process.env.PORT || 5173);

// `npm run build:playgama` sets VITE_PLATFORM=playgama (see scripts/build-playgama.mjs).
const isPlaygama = process.env.VITE_PLATFORM === "playgama";
// Monthly Playgama builds (`npm run build:playgama -- --month=1`): one chapter of the
// campaign with its songs bundled. 0 means the full Playgama build.
const playgamaMonth = isPlaygama ? Math.min(12, Math.max(0, Number(process.env.PIM_PLAYGAMA_MONTH) || 0)) : 0;
const playgamaBombshell = playgamaMonth > 0 && process.env.PIM_PLAYGAMA_BOMBSHELL === "1";
// Chapter card album. scripts/build-playgama.mjs turns it on unless the build passes --no-album.
const playgamaAlbum = playgamaMonth > 0 && process.env.PIM_PLAYGAMA_ALBUM === "1";
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// Must match the productId in the Playgama dashboard's in-app purchase catalog.
const bonusProductId = `PIM_${MONTH_NAMES[Math.max(0, playgamaMonth - 1)]}_Bonus`;
// The month's leaderboard: the sum of the player's best score on every track.
const leaderboardId = `PIM_${MONTH_NAMES[Math.max(0, playgamaMonth - 1)]}_Score`;
// Set by scripts/build-playgama.mjs, e.g. m02-20261028.1745-cc926a6.
const buildVersion = process.env.PIM_BUILD_VERSION || "dev";

// Portal build (klyo): drop the third-party ecosystem bar and Google Fonts (only the
// klyo SDK may load from outside the package; the fonts are bundled instead), keep the
// Stella slideshow photos out of the bundle (portal content rules), and load the klyo
// SDK ahead of the game script. No other network's SDK or config is shipped.
const KLYO_SDK = '<script src="https://games.klyo.pl/sdk/klyo-gry-sdk.js"></script>';
const SLIDESHOW_GLOB = "'../../public/data/slideshow/**/*.{png,jpg,jpeg,gif,webp,svg}'";
const GOOGLE_FONTS_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&family=JetBrains+Mono:wght@400;700&family=Anton&family=Press+Start+2P&display=swap');";
const BUNDLED_FONTS = [
  ...[300, 400, 500, 600, 700].map((w) => `@fontsource/space-grotesk/latin-${w}.css`),
  "@fontsource/jetbrains-mono/latin-400.css",
  "@fontsource/jetbrains-mono/latin-700.css",
  "@fontsource/anton/latin-400.css",
  "@fontsource/press-start-2p/latin-400.css",
].map((f) => `@import '${f}';`).join("\n");
// Portal build (klyo): the game runs as a guest. klyo allows no backend or login of the
// game's own, so the Supabase library and the sign-in store are swapped for inert stand-ins
// (src/platform/klyo) and never reach the package.
function klyoGuest(): Plugin {
  const guestClient = path.resolve(import.meta.dirname, "src/platform/klyo/guestClient.ts");
  const guestAuth = path.resolve(import.meta.dirname, "src/platform/klyo/guestAuthStore.ts");
  const realAuth = path.resolve(import.meta.dirname, "src/store/useAuthStore.ts");
  return {
    name: "pim-klyo-guest",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (source === "@supabase/supabase-js") return guestClient;
      if (!source.endsWith("useAuthStore")) return null;
      const found = await this.resolve(source, importer, { ...options, skipSelf: true });
      return found && found.id === realAuth ? guestAuth : found;
    },
  };
}

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
      return html
        .replace(/\s*<!-- th3scr1b3 ecosystem bar[\s\S]*?<\/script>/, "")
        // Early in <head>, so the SDK has run before the game's module script does.
        .replace(/(<meta name="viewport"[^>]*>)/, `$1\n    ${KLYO_SDK}`)
        .replace("</head>", `  <meta name="pim-build" content="${buildVersion}">\n  </head>`);
    },
  };
}

export default defineConfig({
  // The portal hosts the archive under its own sub-path, so asset URLs must be relative.
  base: isPlaygama ? "./" : "/",
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  // Compile-time constants so a monthly build drops the rest of the app from its bundle.
  define: {
    __PIM_MONTH__: JSON.stringify(playgamaMonth),
    __PIM_BOMBSHELL__: JSON.stringify(playgamaBombshell),
    __PIM_ALBUM__: JSON.stringify(playgamaAlbum),
    __PIM_BONUS_PRODUCT_ID__: JSON.stringify(bonusProductId),
    __PIM_LEADERBOARD_ID__: JSON.stringify(leaderboardId),
    __PIM_BUILD_VERSION__: JSON.stringify(buildVersion),
  },
  esbuild: { drop: ['console', 'debugger'] },
  plugins: [
    // Before Tailwind, so the font import is swapped before Tailwind inlines index.css.
    ...(isPlaygama ? [klyoGuest(), playgamaPackaging()] : []),
    react(),
    tailwindcss(),
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
          // The portal build has no Supabase library to split out (see klyoGuest).
          ...(isPlaygama ? {} : { vendor_supabase: ['@supabase/supabase-js'] }),
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
