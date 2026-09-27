#!/usr/bin/env python3
"""
Master 8K Bombshell Pack Artwork Extractor & Generator
Extracts all 12 collector pack covers (6 Light, 6 Dark) from the 8K master source,
applies soft circle pink gradient backdrop, smooth bottom fade, and glossy pink specular shine.
Exports all canonical files and legacy aliases across beatstar-vault and rhythm-game.
"""

import os
import shutil
import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import label

MASTER_8K_PATH = "/Users/studio/Downloads/bombshell_light_dark_8k.png"
OUTPUT_DIRS = [
    "/Users/studio/BEATSTAR.th3scr1b3.art/beatstar/artifacts/beatstar-vault/public/data/packs",
    "/Users/studio/BEATSTAR.th3scr1b3.art/beatstar/artifacts/beatstar-vault/dist/data/packs",
    "/Users/studio/BEATSTAR.th3scr1b3.art/beatstar/artifacts/rhythm-game/public/data/packs",
    "/Users/studio/BEATSTAR.th3scr1b3.art/beatstar/artifacts/rhythm-game/dist/data/packs",
]
SCRATCH_DIR = "/Users/studio/.gemini/antigravity/brain/42188ded-cd43-4cfb-bf9b-5f902a0b4436/scratch"

def main():
    print(f"Loading master 8K source from: {MASTER_8K_PATH}")
    im = Image.open(MASTER_8K_PATH)
    print(f"Master image size: {im.size}, mode: {im.mode}")

    r0_splits = [0, 1261, 2684, 3900, 5203, 6490, 7680]
    r1_splits = [0, 1294, 2684, 3994, 5251, 6502, 7680]
    tiers = [1, 2, 5, 10, 25, 50]
    pw, ph = 480, 720

    # Precompute optimal seam between col 4 (Dark 25) and col 5 (Dark 50)
    print("Computing seam for Dark 25 / Dark 50 boundary...")
    d_crop = np.array(im.crop((6300, 2800, 6700, 4800)))
    alpha_strip = d_crop[:, :, 3].astype(float)
    H_s, W_s = alpha_strip.shape

    cost = np.zeros_like(alpha_strip)
    cost[0] = alpha_strip[0]
    backtrack = np.zeros((H_s, W_s), dtype=int)
    for y in range(1, H_s):
        prev = cost[y - 1]
        left = np.pad(prev[:-1], (1, 0), constant_values=1e9)
        center = prev
        right = np.pad(prev[1:], (0, 1), constant_values=1e9)
        stacked = np.stack([left, center, right], axis=0)
        best_idx = np.argmin(stacked, axis=0)
        cost[y] = alpha_strip[y] + np.min(stacked, axis=0)
        backtrack[y] = np.arange(W_s) + (best_idx - 1)
        np.clip(backtrack[y], 0, W_s - 1, out=backtrack[y])

    best_x = np.argmin(cost[-1])
    seam_xs = np.zeros(H_s, dtype=int)
    curr_x = best_x
    for y in range(H_s - 1, -1, -1):
        seam_xs[y] = curr_x
        curr_x = backtrack[y, curr_x]
    print("Seam computed successfully.")

    # 1. Generate Soft Circle Pink Gradient
    print("Synthesizing soft circle pink gradient backdrop...")
    cx, cy = pw // 2, int(ph * 0.44)
    r_max = int(pw * 0.58)
    gy, gx = np.ogrid[:ph, :pw]
    dist = np.sqrt((gx - cx) ** 2 + (gy - cy) ** 2)
    factor = np.clip(1.0 - (dist / r_max), 0.0, 1.0)
    factor = factor * factor * (3.0 - 2.0 * factor)  # smoothstep

    alpha_bg = (factor * 230).astype(np.uint8)
    red_bg = np.full((ph, pw), 255, dtype=np.uint8)
    green_bg = (20 + 40 * factor).astype(np.uint8)
    blue_bg = (147 + 25 * (1.0 - factor)).astype(np.uint8)
    grad_arr = np.stack([red_bg, green_bg, blue_bg, alpha_bg], axis=-1)
    grad_img = Image.fromarray(grad_arr).filter(ImageFilter.GaussianBlur(16))

    # 2. Generate Glossy Pink Shine Overlay
    print("Synthesizing glossy pink specular shine...")
    angle_rad = np.radians(35)
    proj = gx * np.cos(angle_rad) + gy * np.sin(angle_rad)
    center_proj = pw * 0.5 * np.cos(angle_rad) + ph * 0.44 * np.sin(angle_rad)
    dist_proj = np.abs(proj - center_proj)

    gloss_w1 = 52.0
    gloss_factor1 = np.clip(1.0 - (dist_proj / gloss_w1), 0.0, 1.0) ** 2

    dist_proj2 = np.abs(proj - (center_proj - 65))
    gloss_w2 = 22.0
    gloss_factor2 = np.clip(1.0 - (dist_proj2 / gloss_w2), 0.0, 1.0) ** 2

    total_gloss = np.clip(gloss_factor1 * 0.7 + gloss_factor2 * 0.4, 0.0, 1.0)
    lens_dist = np.sqrt(((gx - pw * 0.5) / (pw * 0.65)) ** 2 + ((gy - ph * 0.22) / (ph * 0.35)) ** 2)
    lens_gloss = np.clip(1.0 - lens_dist, 0.0, 1.0) * 0.22
    combined_gloss = np.clip(total_gloss + lens_gloss, 0.0, 1.0)

    gloss_a = (combined_gloss * 135).astype(np.uint8)
    gloss_r = np.full((ph, pw), 255, dtype=np.uint8)
    gloss_g = (130 + 125 * (1.0 - combined_gloss)).astype(np.uint8)
    gloss_b = (190 + 65 * (1.0 - combined_gloss)).astype(np.uint8)
    shine_arr = np.stack([gloss_r, gloss_g, gloss_b, gloss_a], axis=-1)
    shine_img = Image.fromarray(shine_arr).filter(ImageFilter.GaussianBlur(8))

    # Master preview canvas for all 12 covers
    preview_canvas = Image.new('RGB', (pw * 6, ph * 2), (14, 2, 10))

    # Ensure output directories exist
    for d in OUTPUT_DIRS:
        if os.path.exists(os.path.dirname(d)):
            os.makedirs(d, exist_ok=True)

    # Process all 12 pack artworks
    for row_idx, mode in enumerate(['light', 'dark']):
        y_start = 0 if mode == 'light' else 2600
        y_end = 2400 if mode == 'light' else 4880
        splits = r0_splits if mode == 'light' else r1_splits

        for col_idx, tier in enumerate(tiers):
            print(f"Processing {mode.upper()} Tier {tier} (col {col_idx})...")
            if mode == 'dark' and tier == 25:
                # Witch: crop wide up to 6700, then cut off at seam
                x_start = int(splits[col_idx])
                x_end = 6700
                cell = im.crop((x_start, y_start, x_end, y_end))
                cell_arr = np.array(cell)
                for cy_idx in range(cell_arr.shape[0]):
                    full_y = y_start + cy_idx
                    if full_y < 2800:
                        sx = seam_xs[0]
                    elif full_y < 4800:
                        sx = seam_xs[full_y - 2800]
                    else:
                        sx = seam_xs[-1]
                    seam_in_cell = 6300 + sx - x_start
                    cell_arr[cy_idx, seam_in_cell:, 3] = 0
            elif mode == 'dark' and tier == 50:
                # Demon girl: crop from 6300 to 7680, zero out left of seam
                x_start = 6300
                x_end = int(splits[col_idx + 1])
                cell = im.crop((x_start, y_start, x_end, y_end))
                cell_arr = np.array(cell)
                for cy_idx in range(cell_arr.shape[0]):
                    full_y = y_start + cy_idx
                    if full_y < 2800:
                        sx = seam_xs[0]
                    elif full_y < 4800:
                        sx = seam_xs[full_y - 2800]
                    else:
                        sx = seam_xs[-1]
                    cell_arr[cy_idx, :sx, 3] = 0
            else:
                x_start = int(splits[col_idx])
                x_end = int(splits[col_idx + 1])
                cell = im.crop((x_start, y_start, x_end, y_end))
                cell_arr = np.array(cell)

            cell_w = cell_arr.shape[1]
            # Connected component filtering to remove edge slivers
            fg = cell_arr[:, :, 3] > 10
            labeled_fg, n_fg = label(fg)
            for fgi in range(1, n_fg + 1):
                comp_mask = (labeled_fg == fgi)
                comp_xs = np.where(comp_mask)[1]
                if len(comp_xs) == 0:
                    continue
                min_x, max_x = np.min(comp_xs), np.max(comp_xs)
                if min_x == 0 and max_x < 0.28 * cell_w:
                    cell_arr[comp_mask, 3] = 0
                elif max_x == cell_w - 1 and min_x > 0.72 * cell_w:
                    cell_arr[comp_mask, 3] = 0

            # Smooth bottom fade over 160px
            ch = cell_arr.shape[0]
            fade_len = min(160, ch)
            for fy in range(ch - fade_len, ch):
                fade_factor = (ch - 1 - fy) / float(fade_len)
                cell_arr[fy, :, 3] = (cell_arr[fy, :, 3].astype(float) * fade_factor).astype(np.uint8)

            char_img = Image.fromarray(cell_arr)
            bbox = char_img.getbbox()
            if bbox:
                char_img = char_img.crop(bbox)

            # Resize character to 68% canvas height (smaller proportion per user request)
            target_h = int(ph * 0.68)
            scale = target_h / float(char_img.height)
            target_w = int(char_img.width * scale)
            char_resized = char_img.resize((target_w, target_h), Image.Resampling.LANCZOS)

            # Composite PNG
            pack_png = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
            pack_png.alpha_composite(grad_img)

            pos_x = (pw - target_w) // 2
            pos_y = int(ph * 0.16)
            pack_png.paste(char_resized, (pos_x, pos_y), char_resized)
            pack_png.alpha_composite(shine_img)

            # Composite JPG onto seamless dark foil background
            pack_jpg = Image.new('RGBA', (pw, ph), (14, 2, 10, 255))
            pack_jpg.alpha_composite(pack_png)
            final_jpg = pack_jpg.convert('RGB')

            # Paste into preview canvas
            preview_canvas.paste(final_jpg, (col_idx * pw, row_idx * ph))

            # Base filenames
            file_keys = [
                f"bombshell_{mode}_{tier}card",
                f"bombshell_{mode}_{tier}cards",
            ]
            # Aliases for bot (light) and top (dark)
            alias_mode = "bot" if mode == "light" else "top"
            file_keys.extend([
                f"bombshell_{alias_mode}_{tier}card",
                f"bombshell_{alias_mode}_{tier}cards",
            ])

            # Save in scratch
            scratch_jpg = os.path.join(SCRATCH_DIR, f"8k_{mode}_{tier}.jpg")
            scratch_png = os.path.join(SCRATCH_DIR, f"8k_{mode}_{tier}.png")
            final_jpg.save(scratch_jpg, quality=95)
            pack_png.save(scratch_png, optimize=True)

            # Save to all target package folders
            for out_dir in OUTPUT_DIRS:
                if not os.path.exists(out_dir):
                    continue
                for fk in file_keys:
                    jpg_dest = os.path.join(out_dir, f"{fk}.jpg")
                    png_dest = os.path.join(out_dir, f"{fk}.png")
                    shutil.copyfile(scratch_jpg, jpg_dest)
                    shutil.copyfile(scratch_png, png_dest)

    # Save final composite preview
    preview_path = os.path.join(SCRATCH_DIR, "all_12_from_8k_v3_final.jpg")
    preview_canvas.save(preview_path, quality=95)
    print(f"Successfully exported all 12 covers and saved preview to {preview_path}!")

if __name__ == "__main__":
    main()
