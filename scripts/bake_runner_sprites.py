"""Pack the v5 runner sheets without dropping animations or frame directions."""

import argparse
import json
from pathlib import Path
from statistics import median

from PIL import Image

CELL = 192
FRAMES = 16
SKINS = ("classic", "neon", "bodypaint")

# Standing body height in the supplied 360px cells, excluding weapons, raised
# hands and effects. Some v5 sheets change drawing scale after their first pose.
# Calibrate that change rather than stretching crouches/jumps to standing height.
# Unlisted moves share their outfit's idle drawing scale.
BODY_HEIGHTS = {
    "classic": {
        "idle": [(0, 174)],
        "butt_hipbounce": [(0, 160)],
        "butt_lookback": [(0, 152)],
        "peace_bounce3": [(0, 152)],
        "butt_twerk": [(0, 306)],
        "butt_hipcircle": [(0, 253), (1, 299), (2, 305)],
        "butt_squatpop": [(0, 227), (1, 245)],
        "peace_bounce": [(0, 174), (4, 174), (6, 210)],
        "resurrect": [(0, 210)],
        "turn_around": [(0, 174), (2, 189)],
    },
    "neon": {
        "idle": [(0, 176)],
        "run": [(0, 176), (1, 200)],
        "block": [(0, 176), (1, 187), (2, 225), (3, 238)],
        "hurt": [(0, 176), (2, 210)],
        "jump_attack": [(0, 176), (2, 200)],
        "resurrect": [(0, 176), (7, 176), (10, 215)],
        "taunt": [(0, 190)],
        "turn_around": [(0, 234)],
        "peace_bounce": [(0, 239)],
        "peace_bounce4": [(0, 234)],
        "butt_bounce": [(0, 238)],
        "butt_archwiggle": [(0, 235)],
        "butt_cheekclap": [(0, 234)],
        "butt_wiggle": [(0, 241)],
        "butt_twerk": [(0, 333)],
        "butt_hipcircle": [(0, 321), (2, 337)],
    },
    "bodypaint": {
        "idle": [(0, 219)],
        "taunt": [(0, 253)],
        "throw": [(0, 252)],
        "djump": [(0, 251)],
        "peace_bounce4": [(0, 252)],
        "butt_archwiggle": [(0, 252)],
        "butt_cheekclap": [(0, 253)],
        "butt_wiggle": [(0, 176)],
    },
}


def body_height(skin, name, frame):
    keys = BODY_HEIGHTS[skin].get(name, BODY_HEIGHTS[skin]["idle"])
    for (a, ah), (b, bh) in zip(keys, keys[1:]):
        if a <= frame < b:
            return ah + (bh - ah) * (frame - a) / (b - a)
    return keys[-1][1]


def frame_metrics(cell, skin, name, frame):
    alpha = cell.getchannel("A").point(lambda a: 255 if a >= 100 else 0)
    bounds = alpha.getbbox()
    if not bounds:
        raise ValueError(f"Empty {skin}/{name} frame {frame}")
    left, top, right, bottom = bounds
    if "boomerang" in name:
        # Keep a spinning projectile's diameter and centre stable over its loop.
        return ((left + right) / 720, (top + bottom) / 720, max(right - left, bottom - top) / 360)
    # Warm skin pixels locate the body without letting a scythe or glow pull its
    # pivot sideways. The full bottom bound includes both boots in wide stances.
    body_x = [index % 360 for index, (r, g, b, a) in enumerate(cell.getdata())
              if a >= 100 and g > 60 and r > g * 1.1 and r > b * 1.15 and g > b * 0.9]
    pivot = median(body_x) if body_x else (left + right) / 2
    return (pivot / 360, bottom / 360, body_height(skin, name, frame) / 360)


def clean_cell(cell, skin, name):
    # These three supplied Neon strips contain a second, cropped character at
    # the cell edge. Retain the complete main figure and its connected scythe.
    if skin != "neon" or name not in ("butt_hipbounce", "butt_lookback", "peace_bounce3"):
        return cell
    points = {i for i, a in enumerate(cell.getchannel("A").tobytes()) if a >= 100}
    largest = []
    while points:
        start = points.pop()
        queue, component = [start], [start]
        while queue:
            i = queue.pop()
            x = i % 360
            neighbors = [i - 360, i + 360]
            if x > 0:
                neighbors.append(i - 1)
            if x < 359:
                neighbors.append(i + 1)
            for neighbor in neighbors:
                if neighbor in points:
                    points.remove(neighbor)
                    queue.append(neighbor)
                    component.append(neighbor)
        if len(component) > len(largest):
            largest = component
    if not largest:
        raise ValueError(f"Empty {skin}/{name}")
    left = max(0, min(i % 360 for i in largest) - 3)
    right = min(360, max(i % 360 for i in largest) + 4)
    result = Image.new("RGBA", cell.size)
    result.paste(cell.crop((left, 0, right, 360)), (left, 0))
    return result


def pack(source, output):
    output.mkdir(parents=True, exist_ok=True)
    manifest = {"cell": CELL, "frames": FRAMES, "skins": {}}
    for skin in SKINS:
        manifest["skins"][skin] = {}
        for direction, folder in [("right", skin), ("left", skin + "_left")]:
            files = sorted((source / folder).glob("*_sheet_h.png"))
            if not files:
                raise ValueError(f"No sprite sheets in {source / folder}")
            animations = {}
            for path in files:
                name = path.name.removesuffix("_sheet_h.png").removeprefix("neon_")
                animations[name] = path
            animations.setdefault("shared_boomerang", source / "shared_boomerang_sheet_h.png")
            atlas = Image.new("RGBA", (CELL * FRAMES, CELL * len(animations)))
            entries = {}
            for row, (name, path) in enumerate(animations.items()):
                with Image.open(path) as strip:
                    if strip.size != (360 * FRAMES, 360):
                        raise ValueError(f"Unexpected sheet dimensions for {path}")
                    mirror = direction == "left" and path.parent == source
                    entries[name] = {"row": row, "frames": []}
                    for frame in range(FRAMES):
                        cell = strip.crop((frame * 360, 0, (frame + 1) * 360, 360)).convert("RGBA")
                        cell = clean_cell(cell, skin, name)
                        if mirror:
                            cell = cell.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                        pivot, baseline, height = frame_metrics(cell, skin, name, frame)
                        entries[name]["frames"].append({
                            "pivot": round(pivot, 5), "baseline": round(baseline, 5), "height": round(height, 5),
                        })
                        # NEAREST preserves the supplied pixel-art edges.
                        cell = cell.resize((CELL, CELL), Image.Resampling.NEAREST)
                        atlas.paste(cell, (frame * CELL, row * CELL))
            path = output / f"runner-{skin}-{direction}.webp"
            temporary = path.with_suffix(".tmp")
            atlas.save(temporary, "WEBP", quality=86, method=4, exact=True)
            temporary.replace(path)
            manifest["skins"][skin][direction] = entries
            print(f"{path.name}: {len(entries)} animations, {path.stat().st_size:,} bytes")
    temporary = output / "runnerSprites.tmp"
    temporary.write_text(json.dumps(manifest, indent=2) + "\n")
    temporary.replace(output / "runnerSprites.json")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    args = parser.parse_args()
    destination = Path(__file__).resolve().parents[1] / "src/game/secret/assets"
    pack(args.source, destination)
