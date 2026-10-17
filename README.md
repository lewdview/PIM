# @workspace/beatstar-vault (PIM : th3v4ult)

> **Primary Live-Service Application & Source of Truth for PIM : th3v4ult - poetry in motion**

[![Base Mini-App](https://img.shields.io/badge/Base-Farcaster%20Mini--App-0052FF?style=flat-square)](https://base.org)
[![React 19](https://img.shields.io/badge/React-19.1.0-61DAFB?style=flat-square)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?style=flat-square)](https://vitejs.dev)
[![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-38B2AC?style=flat-square)](https://tailwindcss.com)
[![Tauri 2.0](https://img.shields.io/badge/Tauri-2.0-FFC131?style=flat-square)](https://tauri.app)

---

## 🏛️ Application Role & Architectural Directives

`beatstar-vault` is the core live-service client for the PIM ecosystem.

> [!CAUTION]
> ### Primary Development Rule
> - **ALL** new features, gameplay mechanics, visual updates, audio filters, card forge upgrades, database logic, gacha tuning, and pitch deck presentations **MUST** be implemented, tested, and validated directly in this package (`artifacts/beatstar-vault`).
> - The secondary package (`artifacts/rhythm-game`) is kept in sync only after features are finalized here.

---

## ✨ Features & Subsystems

### 1. Collectible Vault & Gacha Pack Shop
* **365-Day Catalog Codex**: Browse, preview, and inspect the entire 365 daily release tracks.
* **Cinematic Pack Reveals**: Framer Motion 3D pack tear animations and holographic foil card reveals.
* **The Card Forge (`ForgePage.tsx`)**:
  * **Card Burning**: Recycle duplicate or unwanted cards into V⚡ sparks (in-game currency).
  * **Targeted Pulls**: Spend 500 V⚡ sparks to acquire any specific card from the 365 archive.
  * **Rarity Upgrades**: Spend 150 V⚡ sparks to upgrade an owned card to the next tier.
  * **Duplicate Fusion**: Combine 3 identical cards (same day & rarity) to create 1 higher-tier card.
  * **Echo Cards & Generational Decay**: Generational prestige multipliers with entropy decay.

### 2. Canvas 3D Rhythm Engine & Audio Highway (`GamePlay.tsx`)
* **Perspective Canvas Highway**: 60fps `requestAnimationFrame` projection mapping 3D coordinates onto a responsive 2D canvas.
* **Full Note Taxonomy**: Tap, Hold, 8-directional Swipe (`↑`, `↓`, `←`, `→`, diagonals), Hold+Swipe End, Double Tap, Slide/Drag lerp, Zigzag, Lift, Scratch, and Mine/Ghost hazards.
* **Signature Remix Note ⚡**: Real-time Web Audio stem mutations (`vocals_isolate`, `drums_mute`, `bass_boost`), canvas color inversion, and bonus points.
* **Overdrive Flow States**: **FEVER** (Combo $\ge 20$, $2\times$), **SURGE** (Combo $\ge 40$, $3\times$ with **Autoplay Assist**), **SIGNAL LOCK** (Combo $\ge 60$, $4\times$).
* **Failure & Rewind**: 3-miss limit $\to$ 2.5s audio rewind + 1.2s highway reverse scroll + up to 3 continues.

### 3. Sonic Punishment (3-Band Web Audio Crossover)
* **3 Frequency Lanes**: Lane 0 Bass ($<300\text{Hz}$), Lane 1 Mids ($\approx 1200\text{Hz}$), Lane 2 Treble ($>3200\text{Hz}$).
* **Dynamic Muting**: Channel volume drops to `0.04` on miss, instantly restores to `1.0` on hit, with a `3.5s` passive safety recovery.

### 4. Campaign & Creation Tools
* **Constellation Sector Map & Winding Roads (`Campaign.tsx`, `Chapter.tsx`)**: Milestone star rewards ($70\%, 85\%, 95\%$) and unlocks.
* **Visual Beatmap Editor (`BeatmapEditor.tsx`)**: Full waveform visualizer, BPM detection, snap subdivisions (1/4 to 1/32), 8-direction swipe editing, and JSON import/export.
* **Listen Jukebox (`ListenPage.tsx`)**: Full track and isolated stem player.
* **Voyeur Telemetry (`VoyeurPage.tsx`)**: Real-time global feed of card drops, platinum runs, and leaderboard shifts.
* **Admin Economy Dashboard (`AdminPage.tsx`)**: Real-time live drop tuning and pity controls.
* **Interactive Pitch Deck (`PitchDeck.tsx`)**: 12-slide interactive executive deck with live simulations for Auth, Canvas Rhythm, Web Audio Equalizer, Tokenomics, and Ephemeral Key generation.

### 5. Wallet Sign-In & Onchain Roadmap
Today: Base wallet sign-in, guest play, everything offchain. Roadmap: `PIM.sol` (ERC-721, hardened, not yet deployed).
* **Target Network**: **Base (Chain ID `8453`)** — wallet sign-in today; contracts not yet deployed.
* **EVM / Coinbase Smart Wallet**: EIP-1271 signature verification via `auth-smart-wallet` Edge Function.
* **Web2 Fallback**: Email/password authentication creates an ephemeral EVM keypair locally in encrypted LocalStorage for instant gasless onboarding.

### 6. Desktop Native Engine (Tauri 2.0)
* Configured under `src-tauri/` with package ID `art.th3scr1b3.pim`.
* Supports macOS Universal (`.dmg`), Windows (`.msi`), and Linux (`.AppImage` / Steam Deck).

---

## 📁 Source Directory Structure

```
artifacts/beatstar-vault/
├── src/
│   ├── components/            # Reusable UI components (Navbar, Modals, AudioHUD, Cards, etc.)
│   ├── game/                  # Rhythm engine core (Canvas renderer, Web Audio DSP, Note math, API)
│   ├── pages/                 # Routing views (HomePage, GamePlay, Codex, Forge, PitchDeck, etc.)
│   ├── services/              # Supabase & vault client services (vaultService.ts)
│   ├── store/                 # Zustand reactive state stores (useVaultStore, useAuthStore, etc.)
│   ├── utils/                 # Helpers (desktop.ts, haptics.ts, sound.ts)
│   ├── App.tsx                # App shell, routing tree, audio provider
│   └── main.tsx               # Application entrypoint
├── src-tauri/                 # Tauri 2.0 Rust desktop core & configuration
├── public/                    # Static assets, icons, audio SFX, card covers
├── project_dossier.md         # Synced comprehensive technical specification
├── package.json               # Package dependencies & scripts
└── vite.config.ts             # Vite 7 build configuration
```

---

## 🛠️ Development & Commands

```bash
# Run local dev server with Hot Module Replacement
pnpm dev

# Type check and build production web bundle to dist/
pnpm build

# Preview production build locally
pnpm preview

# Run desktop app via Tauri 2.0
pnpm tauri dev

# Build cross-platform native desktop installer
pnpm tauri build

# Build the Playgama upload (needs ffmpeg + zip) -> pim-playgama.zip
pnpm build:playgama
```

### Playgama build

`build:playgama` sets `VITE_PLATFORM=playgama`, which turns on `src/platform/`:
the Playgama Bridge SDK (loaded from the Playgama CDN, with a bundled fallback),
`game_ready`, an interstitial on the results screen, pause/mute on platform and ad
events, and a mirror of local progress into `bridge.storage`. Asset URLs are
rewritten for Playgama's sub-path hosting. Every other build ignores all of this.

To try it locally: `npx serve dist-playgama` (or any static server). Off-platform
the SDK runs as its `mock` platform, so ads are reported as unsupported.

#### Monthly builds ("PIM: January")

`pnpm build:playgama -- --month=1` builds one campaign chapter as its own game:
that month's tracks, charts and lyrics bundled into the zip, no vault, packs,
shop or sign-in, and no calls to Supabase or the CDN. The five bonus songs open
with the chapter's platinum target, one rewarded ad per song, or the month's
bundle through Bridge payments (product `PIM_January_Bonus`, non-consumable;
add it to the Playgama dashboard's in-app purchase catalog with the same id and
price; the button only shows when the portal supports payments). A platinum run on a track shows that
track's Bombshell artwork behind it during play.

The game opens on an animated intro and a press-start screen, then the chapter
on one screen with no scrolling. Where the portal offers Bridge leaderboards,
the month has one, `PIM_January_Score`: the total of the player's best score on
every track. Bridge 2.3.1 reports leaderboards as unavailable on playgama.com
itself, so the button only appears on portals that support them.

- `--media-dir=/Volumes/extremeUno/th3scr1b3-365-warp/365-releases` copies the
  songs and art from a local mirror; without it they are downloaded from
  `files.th3scr1b3.art`. Audio is re-encoded to 160 kbps MP3, art to 1280 px.
- `--no-bombshell` leaves the Bombshell artwork out.
- `--bonus-price=2` sets the bundle price in USD (default 2). Keep it equal
  to the price in the dashboard catalog.
- `--placeholder-media` uses silent audio and blank art, to test the build
  without the real files. Don't upload that zip.

- `--month=all` builds all twelve in turn (or a list, `--month=2,3`).

Output: `pim-playgama-<month>.zip`.

The same scaffold serves every month: the month number picks the chapter, its
songs, colour and platinum target from `src/game/campaign.ts`, and names the
bundle `PIM_<Month>_Bonus` and the leaderboard `PIM_<Month>_Score`.

This branch is the Playgama game's own line and does not take merges from
`main`. A change from the web game comes over only by cherry-pick, and only
when it fits this format: campaign play with no sign-in, no gacha, packs or
shop, and no network calls besides the Bridge.

---

## 🔐 Environment Variables

Create `.env.local` in `artifacts/beatstar-vault/`:

```env
VITE_SUPABASE_URL=https://toemkhrfsbkfkutwcjkd.supabase.co
VITE_SUPABASE_ANON_KEY=<YOUR_SUPABASE_ANON_KEY>
VITE_STORAGE_BASE_URL=https://files.th3scr1b3.art
VITE_CDN_BASE_URL=https://th3scr1b3.art
```

---

## 📄 License

Created by **TH3SCR1B3** ([th3scr1b3.art](https://th3scr1b3.art)). All rights reserved.
