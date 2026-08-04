# CHANGELOG & VERSION NOTES — PIM : th3v4ult

All notable advancements, architectural updates, features, and resolved trials & errors are documented in this log.

---

## [v2.4.0] - 2026-08-04

### 🚀 Major Advancements & Features

#### 1. 3D Cyber Tunnel POV Perspective Engine
- **Full-Screen 360° Cylindrical Tunnel**: Rendered complete 360-degree cylindrical tunnel depth rings and 12 longitudinal perspective wall ribs converging at the horizon vanishing point (`vanishingY = hitY * 0.28`).
- **Rotational Vortex Swirl**: Added continuous angular swirl rotation (`swirlAngle = t * 0.9 * speedMult`) to tunnel rings and perspective wall ribs.
- **Stage 4 & Stage 5 Dynamic Stage Warp**:
  - **Stage 4 (Hyperspace Void Plunge)**: Tunnel cylinder & background completely vanish (`opacity: 0`), creating a dark void where only glowing neon rails and notes stream through space.
  - **Stage 5 (Overdrive Return)**: Tunnel environment returns **TWICE AS FAST** (`swirlSpeedMult: 2.4`) with double-speed swirl rotation and high-frequency neon light pulses.
- **3D Circular Target Strike Zones**: Rendered 3D circular target rings sitting flat at the perspective baseline for lanes 0, 1, and 2 with outer glowing neon borders, inner target circles, metallic rim drop shadows, and center pulse dots.

#### 2. Volumetric 3D Laser Hold Ribbons
- **Perspective Z-Depth Trajectory Alignment**: Updated hold note trails, slides, and terminus blocks to match 3D Tunnel Perspective ratios (`topRatio: 0.18`, `botRatio: 0.86`).
- **Volumetric Laser Core & Neon Energy Edges**: Rendered dual glowing 3D neon edges (`shadowBlur = 16`, `lineWidth = 3`), translucent plasma fills, and scrolling z-axis plasma gridlines.
- **Active 3D Circular Target Ring Exposition**: Animated electrical plasma arcs encircling the baseline circular strike targets during active holds with real-time percentage completion text and sizzling spark particles.

#### 3. POV Shift Controls & HUD Toast Notification System
- **Hotkeys & UI Controls**: Wired **`V`** and **`P`** hotkeys and a glassmorphic HUD switch pill in the bottom right corner.
- **Cyber POV Toast Overlay**: Added an animated glassmorphic HUD toast banner (`[ CAMERA PERSPECTIVE: 3D CYBER TUNNEL VORTEX ]`) with neon ping indicators and audio confirmation (`menu_confirm`).
- **Track Cache Auto-Reset**: Resetting `offscreenCanvasRef.current = null` on POV mode changes so offscreen static track geometry regenerates with matching perspective parameters.

#### 4. Mobile Layout & Bottom Navigation Optimization
- **Removed 130px Top Padding Block**: Removed `<div className="h-[130px] md:hidden" />` in `Navbar.tsx` that was creating a massive blank gap at the top of pages on mobile devices.
- **Bottom Navigation Clearance**: Added `pb-36 md:pb-8` and `pb-[env(safe-area-inset-bottom)]` across `SongSelect`, `HomePage`, `CollectionPage`, `ForgePage`, `LeaderboardPage`, `EarnPage`, and `ClaimPage`. Key navigation items, stage selection pills, and CTAs now scroll completely clear of the mobile bottom tab bar (`62px`) + `GlobalPlayerBar` (`56px`).

---

### 🛠️ Log of Trials, Errors & Bug Fixes

1. **Duplicate Babel Identifier Declaration** (`VideoExportModal.tsx`):
   - *Error*: `[plugin:vite:react-babel] VideoExportModal.tsx: Identifier 'cleanTitle' has already been declared.`
   - *Fix*: Removed duplicate `cleanTitle` declaration in `VideoExportModal.tsx`.

2. **Runtime `ReferenceError`** (`GamePlay.tsx`):
   - *Error*: `ReferenceError: Can't find variable: activeKeysRef`.
   - *Fix*: Updated line 3454 in `GamePlay.tsx` to reference `laneRef.current[lane]?.pressed`.

3. **Blob URL CORS Audio Security Error** (`GamePlay.tsx`):
   - *Error*: Setting `crossOrigin = "anonymous"` on `blob:` URLs caused HTMLMediaElement to fail with CORS security error.
   - *Fix*: Added `const isBlobUrl = audio.src.startsWith("blob:");` check before assigning `crossOrigin`. Added fallback to standard audio streaming if Blob URL fails.

4. **Vite Unmounted Drive `EPERM` Execution Issue**:
   - *Error*: Node `fs` stream error accessing `/Volumes/extremeUno/...` when external drive is unmounted.
   - *Fix*: Handled local file resolution fallbacks safely and ran unsandboxed dev server.

5. **Audio Forge Daemon Probe Spam** (`HomePage.tsx`):
   - *Fix*: Defaulted `setAudioForgeOnline(false)` in dev environment to prevent unnecessary console error logs when Audio Forge daemon is offline.

---

### 📦 File Modification Summary
- `artifacts/beatstar-vault/src/pages/GamePlay.tsx` — 3D Cyber Tunnel POV engine, rotational swirl, 3D target strike rings, 3D laser hold ribbons, POV Toast, CORS/Blob audio fallback.
- `artifacts/beatstar-vault/src/components/Navbar.tsx` — Removed 130px top padding spacer; added safe-area bottom nav padding.
- `artifacts/beatstar-vault/src/components/OptionsModal.tsx` — Camera POV Engine cards & Stage POV transitions toggle.
- `artifacts/beatstar-vault/src/components/ui/VideoExportModal.tsx` — Fixed duplicate `cleanTitle` variable.
- `artifacts/beatstar-vault/src/lib/options.ts` — Added `povMode` and `stagePovSwitch` options.
- `artifacts/beatstar-vault/src/store/useVaultStore.ts` — Added `povMode` and `stagePovSwitch` profile settings & sync.
- `artifacts/beatstar-vault/src/pages/HomePage.tsx` — Mobile bottom clearance & Audio Forge probe optimization.
- `artifacts/beatstar-vault/src/pages/SongSelect.tsx` — Mobile bottom clearance for stage cards.
- `artifacts/beatstar-vault/src/pages/CollectionPage.tsx` — Mobile top & bottom padding adjustments.
- `artifacts/beatstar-vault/src/pages/ForgePage.tsx` — Mobile top & bottom padding adjustments.
- `artifacts/beatstar-vault/src/pages/LeaderboardPage.tsx` — Mobile top & bottom padding adjustments.
- `artifacts/beatstar-vault/src/pages/EarnPage.tsx` — Mobile bottom clearance.
- `artifacts/beatstar-vault/src/pages/ClaimPage.tsx` — Mobile top & bottom padding adjustments.
