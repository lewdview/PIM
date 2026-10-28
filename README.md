# PIM : th3v4ult — poetry in motion

A three-lane rhythm game built on **365 songs, one released every day for a year**, with a collectible card vault that decides which songs you can play. It runs in the browser, as a Farcaster / Base mini-app, and as a Tauri desktop app.

Live at [th3scr1b3.art](https://th3scr1b3.art).

[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat-square)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square)](https://www.typescriptlang.org)
[![Vite 7](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square)](https://vitejs.dev)
[![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-38B2AC?style=flat-square)](https://tailwindcss.com)
[![Tauri 2](https://img.shields.io/badge/Tauri-2-FFC131?style=flat-square)](https://tauri.app)
[![Supabase](https://img.shields.io/badge/Supabase-backend-3ECF8E?style=flat-square)](https://supabase.com)

---

## How the game works

1. **Collect.** Open packs in the vault to pull day cards. Owning any card for a day unlocks that day's song.
2. **Play.** Every song has a chart built from its own audio by Chart Master (v6). Clear it, chase combos, and climb the leaderboard.
3. **Go Deluxe.** Hit 97% on a song, or own its Deluxe card, and the harder Deluxe chart opens for it, with its own scores.

---

## Gameplay

### Notes

| Note | What you do | Standard v6 | Deluxe |
|---|---|---|---|
| Tap | Hit the lane | ✓ | ✓ |
| Hold | Hit and keep the lane down | ✓ | ✓ |
| Slide | Hold and follow the lane change | ✓ | ✓ |
| Swipe | Flick in the arrow's direction | left / up / right | all 8 directions, diagonals included |
| Hold-swipe | Hold, then flick on release | ✓ | ✓, any direction |
| Accent | Strong downbeat hit (+800) | ✓ | ✓ |
| Lift | Release a hold with an up flick | | ✓ |
| Zigzag | A hold that weaves between lanes | | ✓ |
| Mine | Don't touch it (−500, combo reset) | | ✓ |
| Break | Two-lane hit on the drop (+1200) | | ✓ |
| Remix ⚡ | Triggers a live stem effect (+1000) | | ✓ |
| Warp | Rare secret note that opens a hidden level | ✓ | ✓ |

**Warp notes** show up in roughly one run in eight, in the final stage. Hitting one either jumps straight into a beat-driven shooter (SIGNAL SIEGE) or unlocks a runner level after the song clears. The song resumes where it stopped, with power-ups, judged notes and telemetry carried across.

### Controls

| Input | How |
|---|---|
| Keyboard | **A / S / D** by default. In **Options → Controls** every lane has a primary and an alternate key; the **Use arrow keys ← ↓ →** preset maps the arrows alongside A/S/D, and arrow diagonals keep working for swipes. |
| Swipes on keyboard | Arrow keys (combine two for a diagonal). Arrow Up on a hold release makes a lift. |
| Gamepad | Face buttons for lanes, stick or D-pad for swipes. |
| Touch | Tap lanes, swipe in the arrow's direction. |
| Camera | **V** or **P** switches POV; the HUD lock keeps your chosen view through stage changes. |

### Stages, flow and failure

- Every chart has five stages placed on real phrase starts. Stages 3 and 5 switch the camera POV on the song's biggest energy lifts, with a clear runway before each switch.
- Combo flow states: **FEVER** (20, 2×), **SURGE** (40, 3× with autoplay assist), **SIGNAL LOCK** (60, 4×).
- Sonic punishment: lanes map to bass, mids and treble, and a miss mutes that band until you hit again.
- Three misses rewind the audio and the highway, with up to three continues.
- POV scenes include Classic, Cyber Tunnel, Canyon Run, Aurora Bridge, Corkscrew, Rollercoaster, DNA Helix, Möbius Loop and more (`src/pages/GamePlay/povScenes.ts`).

---

## Charts

### Chart Master (v6), the default

`src/game/chartMaster/` builds a chart from a song's audio:

| File | Job |
|---|---|
| `analysis.ts` | 3-band onset detection (low → lane 0, mid → 1, high → 2), spectral centroid for melody, harmonic layer for sustains |
| `beats.ts` | Tempo from the audio and a beat tracker that follows drift |
| `structure.ts` | Bars, repeats and energy; places the five stages and the POV switches |
| `compose.ts` | Places notes on a beat-locked grid by stage, difficulty and how busy the music is |
| `validate.ts` | Checks every chart and scores sync (share of notes on a strong onset) |

Across all 365 songs, 92% of v6 notes land on a strong onset. Baked charts live in `public/data/songs_variants/v6_master/`. Songs without a baked chart are generated in the browser at load time.

Older editions (`v1_gimmicks` "Classic", `v2`–`v5`) are still in `public/data/songs_variants/`. Classic is open to everyone; the rest sit behind the chart-editions unlock (`src/lib/chartVariant.ts`).

### Chart Master Deluxe

`composeChart({ deluxe: true })` runs the same composer, harder in every dimension:

- **Difficulty** +2 (capped at 10), **density** ×1.35, tighter minimum spacing per stage.
- **Every note type**, introduced stage by stage: lifts and hold-swipes from stage 2; zigzags and mines from stage 3; remixes and breaks from stage 4.
- **Placement tied to the music**: breaks on each stage's biggest drop, remixes where a repeated section starts, swipes in 8 directions following the melody, mines only on lanes the music isn't using.
- **Patterns**: doubles from stage 3, short jacks in stages 4 and 5, repeated sections embellished on every return.
- **Elite timing**: hit windows shrink to 0.85× (`src/pages/GamePlay/timing.ts`).

Deluxe plays under its own song id (`day-XXX_deluxe`), so its scores and leaderboards stay separate. The loader (`src/game/api.ts`) fetches `v6_master/day-XXX_deluxe.json`; when that file isn't baked yet, gameplay builds the Deluxe chart from the audio at runtime.

**Unlocking Deluxe** (`src/lib/deluxe.ts`): a song's Deluxe chart opens when the player

- clears the standard chart at **97% or higher** (the Prophecy tier), or
- owns that day's **Deluxe card** (card source `pack_deluxe`).

SongSelect shows a **DELUXE** button on every song, locked until one of these is true. A Deluxe card pack is planned as a second purchase per song: it will sell Deluxe copies of days the player already owns, minted by the vault-engine edge function.

---

## The vault

- **Packs** are data-driven (`src/data/packs.json`, mirrored in `discord-bot/data/packs.json`): Free, Taste, Light, Dark, Month, Bombshell, Prophecy, Alpha, token packs and more. Openings use one shared holo foil design with a tear-strip reveal and gyro-driven sheen.
- **Forge** (`ForgePage.tsx`): burn cards for V⚡ sparks, targeted pulls (500 V⚡), rarity upgrades (150 V⚡), and 3-of-a-kind fusion.
- **Codex and 365 archive**: browse, preview and inspect every day's release.
- **Campaign**: a constellation map of monthly chapters with a written story, star milestones at 70 / 85 / 95%, and arcade-style results screens.
- **Listen**: full tracks and isolated stems.
- **Live activity**: navbar pill, panel and toasts for drops, platinum runs and leaderboard changes.
- **Share links**: runs get a share URL with a generated preview card (`api/share-image.ts`).
- **Profile**: passport photo, settings sync and run history.

### Sign-in and chain

Players can sign in with a Base / Coinbase Smart Wallet (EIP-1271 verified by a Supabase edge function), with email, or play as a guest. Everything is offchain today; `PIM.sol` (ERC-721) is written but not deployed. Target network is Base (chain id `8453`).

---

## Repository layout

```
.
├── src/
│   ├── game/              # Chart Master, note types, audio, chart loader, secret levels
│   │   ├── chartMaster/   # v6 generator (standard + Deluxe)
│   │   └── secret/        # warp notes, shooter and runner levels
│   ├── pages/             # Routes: SongSelect, GamePlay/, Campaign, Forge, Codex, ...
│   │   └── GamePlay/      # GameplayCore, POV scenes, timing, stage timeline
│   ├── components/        # UI: packs, cards, Options modal, HUD, navbar
│   ├── lib/               # options, chart edition resolution, Deluxe access
│   ├── store/             # Zustand stores (vault, auth, settings)
│   ├── services/          # Supabase and vault clients
│   └── data/              # packs.json and other static data
├── public/data/           # Song metadata and baked charts per edition
├── scripts/               # Chart baking, stage tools, share pages, lyrics
├── api/                   # Vercel functions (share images, short links)
├── supabase/              # Migrations, queries, tests
├── discord-bot/           # 365 daily-drop Discord bot
├── src-tauri/             # Desktop app (package id art.th3scr1b3.pim)
├── artifacts/             # Side projects and standalone pages
├── docs/                  # Cover usage notes
├── CHANGELOG.md
└── project_dossier.md     # Long-form technical spec
```

---

## Development

Requires Node and pnpm (Node 22.6+ and ffmpeg for chart baking).

```bash
pnpm install
cp .env.example .env.local   # then fill in values

pnpm dev          # dev server with HMR
pnpm build        # production bundle in dist/
pnpm preview      # serve the production build
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint

pnpm tauri:dev    # desktop app
pnpm tauri:build  # desktop installers (macOS .dmg, Windows .msi, Linux .AppImage)

pnpm bot:dev      # Discord bot
```

### Baking charts

```bash
# Standard v6 charts (needs ffmpeg)
node scripts/bake_master_charts.ts [days…] [--force] [--jobs N] [--local <365-releases dir>] [--keep]

# Deluxe charts
node scripts/bake_master_charts.ts --deluxe --local <365-releases dir>
```

The script downloads (or reads) each song's audio, runs Chart Master, validates the result and writes a manifest with tempo, POV times, note mix and sync scores.

### Environment

`.env.local`:

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_BASE_BUILDER_CODE` | Base builder code for transaction attribution |
| `VITE_STORAGE_BASE_URL`, `VITE_MEDIA_BASE_URL` | Audio and media hosts (e.g. `https://files.th3scr1b3.art`) |
| `VITE_USE_LOCAL_FILES` | Load audio from local files during development |

Deployed on Vercel (`vercel.json`).

---

## License

Created by **TH3SCR1B3** ([th3scr1b3.art](https://th3scr1b3.art)). All rights reserved.
