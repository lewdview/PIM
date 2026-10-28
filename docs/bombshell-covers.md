# Adding Bombshell covers

How to add new Bombshell cover variants, and every place in PIM that depends on the cover list or on hard-coded cover numbers.

## How the app finds a cover

A Bombshell cover exists for the app only when both of these are true:

1. It is listed in `src/game/bombshell_covers_map.json` under its day, in `lbFiles` (letterbox) or `normalFiles` (full frame), and `totalCovers` matches the two lists.
2. The file is live in storage at `rare_covers/day <N>/<file name>` on `files.th3scr1b3.art`. An optional hi-res PNG can sit at `rare_covers/day <N>/hi res/<same name>.png`. Without one, the Codex download falls back to the JPG.

Pulls pick a random file from the day's list on the client (`pickBombshellArtwork`), and owned cards store the **file name**. So new covers join the pull pool as soon as the map ships, and cards people already own keep their art.

Before this pipeline there was no script for any of this. The map was edited by hand.

## File naming

- Folder: `day <N>` with no zero padding (`day 7`, not `day 007`), days 1 to 365.
- Full frame: `day NNN - NN.jpg` (`day 007 - 10.jpg`).
- Letterbox: `lb day NNN - NN.jpg` (`lb day 007 - 03.jpg`).
- Hi res (optional): the same name as a `.png` inside `day <N>/hi res/`.
- JPG only. The day inside the file name must match the folder.
- Number new files after the day's current highest number. Lower numbers reorder the list. The scan warns if you do this.

## Pipeline

`scripts/bombshell_covers.mjs`, also available as `npm run covers:bombshell -- <command>`. Every command that changes something is a dry run unless you pass `--yes` or `--write`.

```bash
# 1. Check names and see what is new compared with the map (writes nothing)
node scripts/bombshell_covers.mjs scan --src "/Volumes/extremeUno/th3scr1b3-365-warp/365-releases/rare_covers"

# 2. Upload whatever is not live yet (JPGs plus any hi-res PNGs)
export R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… R2_BUCKET=…
node scripts/bombshell_covers.mjs upload --src "…/rare_covers"          # dry run
node scripts/bombshell_covers.mjs upload --src "…/rare_covers" --yes    # for real

# 3. Merge the new files into the map (both copies; never removes an entry)
node scripts/bombshell_covers.mjs map --src "…/rare_covers" --write

# 4. Confirm every mapped cover is live, then commit the map
node scripts/bombshell_covers.mjs verify            # or --days 120-150
```

Notes:

- Upload uses the S3 API through `@aws-sdk/client-s3` (now a devDependency). `R2_ENDPOINT` can replace `R2_ACCOUNT_ID` for any S3-compatible host. Keys are never stored in the repo.
- Upload skips files that already answer on the public URL. If storage can't be reached, it re-uploads them, which is safe because the files are identical.
- `--src` can point at a folder that holds only the new days or files. `map` only adds files, so partial folders are fine.
- Run `verify` before you merge the map change. A file that is in the map but not live shows up as a broken image.

## Places to check when covers are added

**Updates on its own from the map, no change needed**

- `utils/bombshellCards.ts`: `getBombshellDayCovers`, `pickBombshellArtwork` (pull pool), `getActiveBombshellCover`, `getBombshellCollectionStats` (total and % complete).
- Unlock counters such as "x / N unlocked" in `CardDetailModal.tsx` and `CodexPage.tsx`.
- `BombshellsPage.tsx` "N variants" and the per-month cover totals.
- `LaunchPage.tsx` `TOTAL_BOMBSHELL_VARIANTS` and the per-tile "of N" counts.
- The Song Select variant pill (lists every file for the day).

**Hard-coded, review by hand**

| Where | What is hard-coded | What to do |
|---|---|---|
| `src/pages/LaunchPage.tsx` `GALLERY_PICKS` | 14 picks, described as "the 14 best-covered days", each with a compressed copy in `public/data/launch/bombshells/` (`day-NNN-NN.jpg`) | If the best-covered days change, update the picks and add an 800×800 compressed copy for each new pick. Otherwise leave it as is. |
| `src/pages/BombshellsPage.tsx` `SHOWCASE_DAYS = [3, 12, 1]` | "days with strong coverage" | Swap in the days that gain the most covers if you want the showcase to show them. |
| `src/components/admin/AdminDropAnimationsSection.tsx` (2 places) | Sample card `day 033 - 01.jpg` / `/data/launch/bombshells/day-033-01.jpg` | Admin preview only. No change needed. |
| `src/utils/bombshellCards.ts` `pickBombshellArtwork`, `getActiveBombshellCover` | Fallback name `day NNN - 01.jpg` when a day has no entry | Only used for days missing from the map. Every day 1 to 365 has an entry today. |
| `src/utils/bombshellCards.ts` `getBombshellCollectionStats` | Loops days `1..365` | Fine unless covers are added for days beyond 365. |
| `src/utils/bombshellCards.ts` `LOCAL_BASE` | `/Volumes/extremeUno/th3scr1b3-365-warp/365-releases/rare_covers/` | Dev "use local files" mode only. Update it if the drive path changes. |
| `public/data/bombshell_covers_map.json` | Second copy of the map. Nothing in the app reads it. | The `map` command writes both copies so they stay identical. |

**Product effects to expect**

- **Pull odds per cover drop.** A day with 9 covers that grows to 13 gives each existing cover 1 in 13 instead of 1 in 9. Days with more covers spread pulls thinner.
- **"Mastered" can be lost.** The Codex marks a day Mastered when every cover is unlocked (`CodexPage.tsx`, plus the "Mastered 100%" filter). New covers on a mastered day turn it back to in-progress. Month rewards on the Bombshells page use fragments, not covers, so they don't change.
- **Collection % drops** for everyone, because `getBombshellCollectionStats` divides by the new total.

## Fixed alongside this pipeline

- `getBombshellUnlockedCoversForDay` matched cover URLs by substring, so owning `lb day 001 - 01.jpg` also counted `day 001 - 01.jpg` as unlocked. It now compares the exact file name, and some players' unlocked counts may go down by the phantom ones.
- The Song Select variant pill numbered full-frame covers after the letterbox ones (LB #1 to #4, then VAR #5 to #9). Each kind is now numbered on its own, so adding letterbox covers no longer renumbers the full-frame ones.
