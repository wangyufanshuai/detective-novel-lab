import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const [input, output, widthValue = "1536", heightValue = "1024", maxBytesValue = "360000"] = process.argv.slice(2);
if (!input || !output) throw new Error("Usage: node scripts/process-noir-asset.mjs <input> <output> [width] [height] [maxBytes]");
const width = Number(widthValue);
const height = Number(heightValue);
const maxBytes = Number(maxBytesValue);
const python = process.env.CODEX_BUNDLED_PYTHON || "python";
fs.mkdirSync(path.dirname(output), { recursive: true });
const code = String.raw`
from PIL import Image
import os, sys
source, target, width, height, maximum = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
image = Image.open(source).convert("RGB")
source_ratio = image.width / image.height
target_ratio = width / height
if source_ratio > target_ratio:
    crop_width = round(image.height * target_ratio)
    left = (image.width - crop_width) // 2
    image = image.crop((left, 0, left + crop_width, image.height))
elif source_ratio < target_ratio:
    crop_height = round(image.width / target_ratio)
    top = (image.height - crop_height) // 2
    image = image.crop((0, top, image.width, top + crop_height))
image = image.resize((width, height), Image.Resampling.LANCZOS)
quality = 88
while quality >= 48:
    image.save(target, "WEBP", quality=quality, method=6)
    if os.path.getsize(target) <= maximum:
        break
    quality -= 4
if os.path.getsize(target) > maximum:
    raise RuntimeError(f"asset remains {os.path.getsize(target)} bytes above {maximum}")
print(f"{image.width}x{image.height} {os.path.getsize(target)} bytes quality={quality}")
`;
const run = spawnSync(python, ["-c", code, input, output, String(width), String(height), String(maxBytes)], { encoding: "utf8" });
if (run.status !== 0) throw new Error(run.stderr || run.stdout || "asset processing failed");
process.stdout.write(run.stdout);
