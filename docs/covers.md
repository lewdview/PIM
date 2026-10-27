# Song covers in PIM

Where cover art comes from, every place it is shown, which assets and helpers
nothing uses, and how the right cover reaches the lane-color picker and the
results screen.

Last audited: 2026-10-24.

## 1. Where covers come from

| Source | Field / key | Notes |
|---|---|---|
| `src/data/song_catalog.json` (bundled) and `public/data/song_catalog.json` (fetched fallback in `game/api.ts`) | `coverArt` | Catalog art per day, hosted at `files.th3scr1b3.art/covers/<month>/…`. Both copies are identical and written by `scripts/split_songs.mjs`. |
| `src/data/card_catalog.json` / `public/data/card_catalog.json` | `coverUrl` | Same URL as the song's `coverArt`. Cards then pass it through `getCoverUrlForRarity` (`services/vaultService.ts`). |
| `src/game/day_file_map.json` | `cover` | Used by `utils/resolveMediaUrls.ts` to map a day to its local or storage path. |
| Rarity art (`utils/rarityArtwork.ts`) | `RARITY_ARTWORK_CONFIG` | uncommon / rare / legendary swap to `alternate-covers/*.jpg`; common and mythic keep `covers/`. `getSmartCoverCandidates` / `useSmartCoverArt` fall back to the original if the alternate is missing. |
| Bombshell art (`utils/bombshellCards.ts`) | `src/game/bombshell_covers_map.json` | Per-day `lbFiles` / `normalFiles` under `rare_covers/day N/`, with a legacy `girl-covers/days/` fallback. |
| Player preference | `localStorage.preferred_bombshell_cover_<day>` | Written by `useVaultStore.setPreferredCardCover` (card modal, codex) and `setCustomBombshellCover` (song-select variant pill). |
| Player preference (song select only) | `localStorage.preferred_cover_<songId>` | Written alongside the above by the song-select variant pill. |
| Echo cards | `cover_url` / `coverUrl` | `utils/echoSystem.ts`. |
| Pack art | `public/data/packs/*`, `DEFAULT_BOMBSHELL_PACK_COVER`, `getRandomBombshellPackCover` | Pack and crate visuals, not song covers. |
| Placeholder | `public/data/covers/default.jpg` | Fallback in SongSelect, GameResults, UniverseHome, ListenPage, DayArtifactPage, Archive365Page, GlobalMenuBackground. |

## 2. Where covers are shown

**Gameplay and results**

- `pages/GamePlay/GameplayCore.tsx`: resolves the run cover (section 4), preloads it with `getSmartCoverCandidates`, draws it as the `cover_blur` background and the loading-card thumbnail, and samples it for lane colors when **Note theme = Song Artwork**. Saves it as `result_<songId>.coverUrl` and `active_cover_url_<songId>` when the run ends.
- `pages/GameResults.tsx`: shows `result.coverUrl` (falls back to `active_cover_url_<songId>`, then catalog art) and passes it to `results/OnDemandResults.tsx` and `campaign/CampaignResults.tsx` as `coverUrl`.
- `results/OnDemandResults.tsx`: background art and the hero art; the "Up next" card shows the next song's saved cover.
- `campaign/CampaignResults.tsx`: background art and the hero art; the "next stage" card shows the next song's saved cover.

**Song pickers**

- `pages/SongSelect.tsx`: hero art with the variant pill (ORIGINAL, bombshell LB/VAR files, ENHANCED). Grid tiles use catalog art.
- `pages/Chapter.tsx`, `pages/Campaign.tsx`, `campaign/ChapterStory.tsx`, `campaign/CampaignStory.tsx`: stage tiles use catalog art; the selected-stage preview in Chapter and ChapterStory uses the saved cover.
- `pages/Tutorial.tsx`, `pages/StageHome.tsx`, `pages/LaunchPage.tsx`, `pages/UniverseHome.tsx`, `pages/Archive365Page.tsx`, `pages/DayArtifactPage.tsx`, `pages/SongDetail.tsx`, `pages/WordChain.tsx`, `components/CommandPaletteModal.tsx`, `components/NavbarSpotlightWidgets.tsx`: catalog art.

**Cards and collection**

- `components/Card.tsx`, `HeroCard.tsx`, `CardDetailModal.tsx` (bombshell cover chooser), `TodayCardDetailModal.tsx`, `MobileCardActionSheet.tsx`, `EchoCardDecay.tsx`, `DecryptionAnimation.tsx`.
- `pages/CollectionPage.tsx`, `pages/CodexPage.tsx` (bombshell cover chooser, hi-res download), `pages/BombshellsPage.tsx`, `pages/ForgePage.tsx`, `pages/ClaimPage.tsx`, `pages/CardDesignShowcase.tsx`.
- Pack and reveal flow: `components/cinematic/PackContainer.tsx`, `SongUnlockReveal.tsx`, `BombshellBonusReveal.tsx`, `PackRipAnimation.tsx`, `pages/PackRevealPage.tsx`, `components/DailyClaimTransitionModal.tsx`, `components/ArcadeSplashScreen.tsx`, `components/PackShop.tsx`, `TokenShop.tsx`, `CyberPackBag.tsx`, `ShopConsole.tsx`.

**Audio and ambient**

- `components/GlobalPlayerBar.tsx` and `store/useGlobalPlayer.ts` (`currentTrack.coverUrl`), `components/AudioPreview.tsx`, `pages/ListenPage.tsx`, `pages/WarpZonePage.tsx`.
- `components/layout/GlobalMenuBackground.tsx` and `pages/RhythmHome.tsx`: menu backdrop from `sessionStorage.active_game_cover` (the last cover a run was launched with).
- `pages/HeroLandingPage.tsx` and `pages/ProfilePage.tsx`: `extractPalette()` themes the page from today's cover.
- `components/LiveActivity.tsx`, `services/liveActivity.ts`, `components/admin/AdminDropAnimationsSection.tsx`, `pages/PitchDeck.tsx`, `pages/SlideshowPage.tsx`.

## 3. Unused or broken

| Item | Status |
|---|---|
| `public/data/bombshell_covers_map.json` | Not read at runtime. The app imports `src/game/bombshell_covers_map.json` (the two are identical). |
| `/data/covers/day-190.jpg` (`OptionsModal.tsx` skin preview card) | File does not exist; `public/data/covers/` holds only `default.jpg`. The preview falls back to a broken image. |
| `setRarityArtworkConfig`, `getBombshellPackCovers` (export), `getBombshellHiResCandidates` (export), `generateHarmonicPaletteFromUrl` (export), `isUseLocalFiles` (export) | Exported but never imported outside their own file. Only `setRarityArtworkConfig` is used nowhere at all. |
| `girls-cover/` folder | Only mentioned in comments; `rare` now maps to `alternate-covers/`. |
| SongSelect "PRISM" variant | Never appears: `getCoverUrlForRarity(…, 'rare')` returns the same `alternate-covers` URL as ENHANCED, so it is de-duplicated away. |
| SongSelect ORIGINAL / ENHANCED picks | Not saved as a preference (only bombshell files are), so they apply to the launch from song select but not to later launches from other screens. |
| Card `coverUrl` vs song `coverArt` | Two names for the same URL across `card_catalog.json` and `song_catalog.json`. |

## 4. Which cover a run uses (the color picker)

All of this lives in `src/utils/gameCover.ts`.

1. A launcher that lets the player pick art calls `primeGameCover(day, url)` right before navigating to `/play/:songId`. That writes `sessionStorage.pim_launch_cover = {day, url}` and the menu-only `active_game_cover`.
2. `GameplayCore` calls `resolveGameCover(song)` once the song loads: the primed cover if its `day` matches this song, else `resolvePreferredCover(song)` (bombshell preference for the day, then `preferred_cover_<songId>`, then catalog `coverArt`).
3. That cover is preloaded; with Note theme = Song Artwork, a 3×3 downsample gives the three lane colors (falls back to a mood palette if the image is CORS-tainted).
4. When the run ends the cover is written to `result_<songId>.coverUrl` and `active_cover_url_<songId>`; `GameResults` shows exactly that.
5. Changing a day's saved cover (`setPreferredCardCover`, the song-select pill) clears a primed cover for that day so it cannot go stale.

`active_game_cover` is never read by gameplay or results any more. Before this change it was the fallback for every launch that primed nothing, so a run started from campaign, tutorial, a deep link, the archive or the global player picked up whichever song had been launched last, and its lane colors and results art came from the wrong song.

## 5. Entry points into PIM

| Entry point | Route | Cover |
|---|---|---|
| Song select play (`SongSelect.tsx`) | `/play/<id>` | Primed: variant on screen |
| Card modal play / export (`CardDetailModal.tsx`) | `/play/card-<day>` | Primed: cover shown in the modal |
| Card modal cover chooser | n/a | Primed on pick |
| Collection play buttons (`CollectionPage.tsx`, 4 places) | `/play/card-<day>` | Primed: card's cover |
| Codex play buttons (`CodexPage.tsx`, 2 places) | `/play/card-<day>` | Primed: card's cover |
| Results retry (`OnDemandResults.tsx`, `CampaignResults.tsx`) | `/play/<id>` | Primed: the cover just played |
| Results "up next" / next campaign stage | `/play/<id>` | Saved preference |
| Campaign (`Chapter.tsx`, `ChapterStory.tsx`) | `/play/<id>?mode=campaign` | Saved preference |
| Tutorial (`Tutorial.tsx`) | `/play/<id>?tutorial=true` | Saved preference |
| Daily drop route (`App.tsx`), `UniverseHome`, `HeroLandingPage`, `LandingPage`, `NextGenLandingPage`, `DayArtifactPage`, `SongDetail`, `StageHome`, `Archive365Page`, `WordChain`, `LaunchPage`, `CommandPaletteModal`, `NavbarSpotlightWidgets`, `GlobalPlayerBar` | `/play/<id>`, `/play/day-<n>`, `/play/card-<n>` | Saved preference |
| Pack reveal redirect (`useDailyRewards.ts`, `HomePage.tsx`), live activity links | `/play/<cardId>`, `/play/card-<n>` | Saved preference |
| Direct URL / shared link | any `/play/...` | Saved preference |
