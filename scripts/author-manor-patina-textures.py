"""Original, deterministic material maps and fictional set-dressing typography.

No photographed artwork, generated concept image or external text is used.
The OFL font is already tracked by the project's shared provenance ledger.
"""
from pathlib import Path
import hashlib, json, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / 'docs/3d-town/snowbound-manor-v3/textures'
FONT = ROOT / 'docs/3d-town/classic-railway-v2/licensed/railway-serif-study.ttf'
P.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(19341023)


def font(size): return ImageFont.truetype(str(FONT), size)
def save(name, array):
    image = Image.fromarray(np.uint8(np.clip(array, 0, 255)))
    image.save(P / name)


def noise(size, scale):
    small = Image.fromarray(np.uint8(rng.random((scale, scale)) * 255))
    return np.asarray(small.resize((size, size), Image.Resampling.BICUBIC), dtype=float) / 255 - .5


n = 1024
y, x = np.mgrid[0:n, 0:n]
grain = noise(n, 256) * 8 + noise(n, 64) * 6 + noise(n, 8) * 14
leather = np.broadcast_to(np.array([93., 77., 57.]), (n, n, 3)).copy() + grain[..., None]
save('leather-grain.png', leather)
save('leather-rough.png', np.repeat((185 + grain * 1.6)[..., None], 3, 2))
stone = noise(n, 5) * 15 + noise(n, 19) * 10 + noise(n, 128) * 8 + noise(n, 512) * 4
vein = np.sin(x / 34 + np.sin(y / 70) * 2.8 + noise(n, 17) * 2)
stone -= np.clip((vein - .86) * 25, 0, 4)
save('honed-limestone.png', np.array([154., 146., 128.]) + stone[..., None])
save('honed-limestone-rough.png', np.repeat((204 + stone * .9)[..., None], 3, 2))
dy, dx = np.gradient(stone / 255)
normal = np.stack((-dx * 2, -dy * 2, np.ones_like(dx)), -1)
normal /= np.linalg.norm(normal, axis=2, keepdims=True)
save('honed-limestone-normal.png', (normal * .5 + .5) * 255)

# Sixteen weathered spine designs. Gold is printed into the base map, not emissive.
atlas = Image.new('RGB', (1024, 1024))
colors = [(72, 33, 26), (33, 48, 40), (37, 46, 60), (80, 63, 38),
          (57, 36, 34), (51, 58, 45), (72, 46, 30), (28, 34, 38)]
titles = ['TRAVELS', 'HISTORY', 'THE\nATLAS', 'NATURAL\nHISTORY', 'ESSAYS', 'POETRY',
          'VOYAGES', 'MEMOIRS', 'BOTANY', 'THE\nALPS', 'LETTERS', 'CHRONICLE',
          'FOLK\nTALES', 'GARDENS', 'COLLECTED\nWORKS', 'JOURNAL']
for i, title in enumerate(titles):
    col, row = i % 8, i // 8
    a = np.array(colors[i % 8]) + grain[:512, :128, None] * .65
    border = np.minimum(np.arange(128), np.arange(128)[::-1])[None, :, None]
    a = a * (.72 + .28 * np.clip(border / 12, 0, 1))
    tile = Image.fromarray(np.uint8(np.clip(a, 0, 255)))
    draw = ImageDraw.Draw(tile)
    gold = (164, 136, 86)
    draw.rectangle((11, 20, 116, 490), outline=(116, 91, 55), width=2)
    for z in [42, 55, 151, 351, 451, 466]:
        draw.line((8, z, 119, z), fill=gold, width=3 if z in [55, 451] else 1)
    draw.rectangle((17, 175, 110, 311), outline=gold, width=2)
    draw.multiline_text((64, 242), title, font=font(17 if len(title) < 10 else 13),
                        fill=(188, 161, 108), anchor='mm', align='center', spacing=8)
    draw.text((64, 395), ['I', 'II', 'III', 'IV'][i % 4], font=font(23), fill=gold, anchor='mm')
    # Worn raised bands and scuffs; fixed seed prevents each build changing the set.
    for _ in range(75):
        xx, yy = int(rng.integers(6, 122)), int(rng.integers(10, 502))
        draw.line((xx, yy, xx + int(rng.integers(1, 5)), yy), fill=(96, 76, 50))
    atlas.paste(tile, (col * 128, row * 512))
atlas.save(P / 'library-spines.png')

pages = np.empty((512, 512, 3), dtype=float)
lines = np.sin(np.arange(512)[:, None] * math.tau / 3.1) * 7
pages[:] = np.array([183., 171., 141.]) + lines[..., None] + noise(512, 128)[..., None] * 8
save('cut-paper-edges.png', pages)

paper = np.array([203., 192., 162.]) + noise(n, 128)[..., None] * 9 + noise(n, 6)[..., None] * 8
news = Image.fromarray(np.uint8(paper)); draw = ImageDraw.Draw(news)
ink = (47, 44, 35)
draw.text((512, 79), 'CEDAR COUNTY GAZETTE', font=font(49), fill=ink, anchor='mm')
draw.line((54, 125, 970, 125), fill=ink, width=3)
draw.text((57, 147), 'WINTER EDITION  /  SATURDAY, 17 FEBRUARY 1934', font=font(17), fill=ink)
draw.line((54, 180, 970, 180), fill=ink, width=2)
draw.text((512, 238), 'SNOW CLOSES THE MOUNTAIN PASS', font=font(32), fill=ink, anchor='mm')
draw.text((512, 284), 'Last arrivals reach the valley before nightfall', font=font(22), fill=ink, anchor='mm')
copy = [
    'Heavy snow swept over the northern hills late',
    'yesterday. The coach service was suspended',
    'after the final journey from the valley station.',
    'Travellers have been advised to remain indoors',
    'until the road is cleared. The lodge has kept',
    'its lamps burning for the expected arrivals.',
    'At the station, the porter reported that the',
    'last passengers carried their luggage through',
    'the snow. No further trains are due tonight.',
    'The village post will resume its regular rounds',
    'when the weather permits. The morning forecast',
    'promises more snow across the higher ground.',
]
for column in range(2):
    for j in range(24):
        draw.text((60 + column * 474, 347 + j * 23), copy[(j + column * 4) % len(copy)], font=font(17), fill=ink)
draw.line((514, 336, 514, 924), fill=(107, 96, 73), width=1)
draw.line((54, 945, 970, 945), fill=ink, width=2)
draw.text((512, 976), 'Fictional scenic prop - Cedar Hollow study', font=font(16), fill=ink, anchor='mm')
news.save(P / 'winter-gazette.png')

files = [{'path': f.name, 'sha256': hashlib.sha256(f.read_bytes()).hexdigest()} for f in sorted(P.glob('*.png'))]
(P / 'authored-textures.json').write_text(json.dumps({
    'schema': 'manor-original-materials.v1', 'seed': 19341023,
    'generatorSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'font': {'path': FONT.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(FONT.read_bytes()).hexdigest(), 'license': 'OFL-1.1; existing project ledger'},
    'source': 'Original mathematical textures, spine designs and fictional newspaper copy',
    'canonicalCaseEvidence': False, 'files': files,
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'originalTextures': len(files), 'package': str(P)}), flush=True)
