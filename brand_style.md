# Brand Style Guide — th3vault & Beatstar (PIM)

This document serves as the official brand style registry for **th3vault & Beatstar (PIM)**. It outlines the visual philosophy, typography, color palette, geometric motifs, and layout behaviors that define the application's premium brutalist cyberpunk aesthetic.

---

## 1. Visual Philosophy & Tone
The system sits at the intersection of **technical brutalism** and **high-fidelity cyber neon**. It rejects the soft, round, friendly styles of mainstream apps in favor of high-contrast, sharp, structural layouts that feel like a state-of-the-art hacker console or military-grade audio archive interface.

> [!IMPORTANT]
> **Core Aesthetic Pillars:**
> * **Raw Utility**: Functional status lines, monospace readouts, visible grids, and technical parameters.
> * **Cyber Neon Accentuation**: Base layers of concrete-gray and deep blacks illuminated by hyper-vibrant, glowing neon energy lines.
> * **Premium Tactility**: Sheared angles (clip-paths), card borders with metallic reflections, glassmorphism panels, and micro-interactions.

---

## 2. Color Palette System

The system operates on a highly-curated set of HSL variables to maintain contrast and support the dynamic dark mode and neon glow aesthetics.

### Base Tones (Neutral darks and functional structures)
* **Pure Void Black**: `#000000` — The absolute foundation.
* **Corridor Dark Charcoal**: `#0c0c14` / `#08080c` — Used for page backdrops and layout sections.
* **Cyber Slate Concrete**: `#18181b` / `#27272a` — Grid lines, card slot placeholders, and inactive controls.

### Accent Neon Tones
The neon accents correspond directly to system statuses, gameplay difficulty zones, and progression rarity classes:

| Token Name | Hex Code | Purpose | Rarity / Mode |
| :--- | :--- | :--- | :--- |
| **Hot Pink** | `#FF1493` | Playback actions, primary UI triggers | light / default |
| **Neon Orange** | `#FF5500` | Vault doors, system override alerts, cognitive wings | Special Picks / Prophecy |
| **Neon Cyan** | `#00E5FF` | Mids audio lane, hold track guides | uncommon |
| **Neon Green** | `#39FF14` | Signal lock overlays, active states, success badges | rare |
| **Power Gold** | `#E5B800` | Fever multipliers, streak counters | legendary |
| **Prismatic Purple** | `#A855F7` | Bass realm lane triggers, Mythic card glow | mythic |

---

## 3. Typography
The type system utilizes distinct Google Fonts to divide readable hierarchy between aesthetic headings and data readouts.

### Header/Display Font: **Outfit**
* **Style**: Sans-serif, geometric, sharp.
* **Usage**: Page titles, logo branding, gacha card headers, and countdown stingers.
* **Treatment**: Uppercase, bold, letter-spacing ranging from `0.2em` to `0.5em` for a spacious, authoritative print.

### Functional/Metadata Font: **Roboto Mono** or **JetBrains Mono**
* **Style**: Monospace, clear vertical alignment, technical.
* **Usage**: Song timestamps, accuracy judgments (PERFECT+, GOOD), system statuses, leaderboard tables, and code consoles.
* **Treatment**: Lower-contrast coloring (e.g., `text-zinc-400`), tight letter spacing, and line heights.

---

## 4. Geometric Motifs & CSS Utilities

To establish the brutalist look, buttons and structural elements avoid generic borders and utilize specific custom shapes and glass-paneling effects.

### Sheared Action Buttons
Buttons feature stylized sheared-corners instead of standard border-radius, achieved via CSS `clip-path`:
```css
.sheared-btn {
  background: rgba(255, 20, 147, 0.12);
  border: 2px solid #FF1493;
  color: #FF1493;
  clip-path: polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%);
  font-family: monospace;
  letter-spacing: 0.3em;
  text-shadow: 0 0 20px rgba(255, 20, 147, 0.7);
}
```

### Glassmorphic Overlay
High-fidelity overlays utilize backdrops to blend and bleed layout layers:
```css
.glass-panel {
  background: rgba(12, 12, 20, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.6);
}
```

### CRT Scanlines & Vignette
To mimic analogue hardware streams:
```css
.vignette-overlay {
  background: radial-gradient(ellipse 90% 90% at 50% 42%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.9) 100%);
}
.scanline-overlay {
  background: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px);
  mix-blend-mode: multiply;
}
```

---

## 5. Dynamic Backgrounds spec
The dynamic gameplay backgrounds reflect the thematic energy of the active music track:

* **Neon Grid (Synthwave)**: Trailing horizon grid that rotates in 3D perspective.
* **Corrupted Signal (Glitch)**: Random screen translation shakes, CRT scanline highlights, and orange visual block static overlaying HUD lines.
* **Hyperspace Warp (Void)**: 24 vector star-streak lines emitting from a central glowing core.
* **The Living Vault (Interactive)**: An HSL-regulated corridor grid featuring floating card shards that consolidate based on `localStorage` decryption fragments. Accompanied by sliding hydraulic doors opening at `50%`, `75%`, and `90%` score thresholds.
