"""Package the checked Blender candidate without replacing the live world."""
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'docs/3d-town/classic-motion-v2'
PILOT = BASE / 'step-15'
EXPORT = PILOT / 'export-candidate-02'
DEST = ROOT / 'public/assets/classic-motion/v2-step15'
URL = '/assets/classic-motion/v2-step15/'

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def write(name, value):
    file = DEST / name
    file.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return {'url': URL + name, 'sha256': sha(file)}

assert not DEST.exists(), 'Preserve the existing candidate bundle'
ground = read(PILOT / 'optimized-runtime-grounding-diagnostic.json')
assert ground['complete'] and ground['passed']
assert ground['helperSha256'] == sha(ROOT / 'app/town-play/art-sample/character-grounding.ts')
for name in ['cloth-form-review.json', 'route-mesh-diagnostic.json', 'retention-review.json']:
    assert read(PILOT / name)['passed']
cast = read(BASE / 'layout-01/cast-candidate.json')
old_scene = read(ROOT / 'public/assets/classic-occupations/v2/manifest.json')
sources = {}
assets = {}
for entry in ['scene'] + [row['actorId'] for row in cast['entries']]:
    folder = EXPORT / entry
    export, optimization = read(folder / 'export-review.json'), read(folder / 'optimization-review.json')
    asset = folder / 'optimized.glb'
    assert export['complete'] and optimization['complete']
    assert optimization['exportReviewSha256'] == sha(folder / 'export-review.json')
    assert sha(asset) == optimization['optimized']['sha256']
    assert optimization['sourceAssetSha256'] == export['asset']['sha256']
    if entry != 'scene':
        review = read(folder / 'optimized-roundtrip-review.json')
        assert review['passed'] and review['assetSha256'] == sha(asset)
        assert ground['assetHashes'][asset.relative_to(ROOT).as_posix()] == sha(asset)
        assert export['sourceSha256'] == sha(PILOT / entry / 'resident.blend')
    else:
        assert export['sourceSha256'] == sha(BASE / 'layout-01/room.blend')
    assets[entry] = {'path': asset, 'export': export, 'optimization': optimization}
    sources[asset.relative_to(ROOT).as_posix()] = sha(asset)

DEST.mkdir(parents=True)
for entry, asset in assets.items():
    shutil.copyfile(asset['path'], DEST / (entry + '.glb'))
scene_hash = sha(DEST / 'scene.glb')
for row in cast['entries']:
    actor = row['actorId']
    file = ROOT / ('public' + row['manifestUrl'])
    assert sha(file) == row['manifestSha256']
    manifest = read(file)
    manifest.update(status='art-motion-candidate', sourceSha256=assets[actor]['export']['sourceSha256'],
                    worldBound=False, humanArtApproved=False,
                    construction='Retained authored anatomy, clothing, hand and work actions; independent fitted garment morphs and explicit retreat, turn and approach clips. See source-bound step-15 reviews.',
                    motionPreview={'rootNode': 'movement_actor', 'clips': ['BackAway', 'TurnLeft', 'ApproachWork'], 'maximumGroundingLiftMeters': .012})
    manifest['asset'] = {'url': URL + actor + '.glb', 'sha256': sha(DEST / (actor + '.glb')), 'bytes': (DEST / (actor + '.glb')).stat().st_size}
    # Counts inherited from older authoring snapshots are not current evidence.
    for stale in ['triangles', 'materialCount', 'bones']:
        manifest.pop(stale, None)
    manifest['clips'] = assets[actor]['export']['clips']
    spec = write(actor + '.json', manifest)
    row['manifestUrl'], row['manifestSha256'] = spec['url'], spec['sha256']
cast.update(sceneAssetSha256=scene_hash, status='art-motion-candidate', presentation='Authored visual rehearsal. No autonomous decisions or world mutations.')
cast_spec = write('cast.json', cast)
navigation = read(EXPORT / 'scene/navigation-raw.json')
navigation['assetSha256'] = scene_hash
nav_spec = write('navigation.json', navigation)
routes = read(PILOT / 'routes.json')
assert routes['passed']
motion = {'schema': 'classic-motion-preview.v1', 'worldBound': False, 'sceneAssetSha256': scene_hash,
          'sourceRoutesSha256': sha(PILOT / 'routes.json'), 'routes': []}
for route in routes['routes']:
    if not route['home']:
        continue
    motion['routes'].append({'actorId': route['passage']['actorId'], 'kind': route['passage']['kind'], 'seconds': route['seconds'],
                             'samples': [[r['t'], r['clip'], (r['frame'] - 1) / 30, *r['position'], r['yaw']] for r in route['trace']]})
motion_spec = write('motion.json', motion)
manifest = {'schema': 'classic-bookshop-runtime.v2', 'status': 'art-motion-candidate',
            'sourceSha256': assets['scene']['export']['sourceSha256'],
            'asset': {'url': URL + 'scene.glb', 'sha256': scene_hash, 'bytes': (DEST / 'scene.glb').stat().st_size},
            'navigation': nav_spec, 'residentCast': cast_spec, 'motionPreview': motion_spec,
            'lights': read(EXPORT / 'scene/lighting.json')['fixtures'],
            'worldBound': False, 'humanArtApproved': False,
            'licenseDocuments': old_scene['licenseDocuments'], 'thirdPartyAssets': old_scene['thirdPartyAssets'],
            'lighting': old_scene['lighting'], 'sourceReviews': 'docs/3d-town/classic-motion-v2/step-15'}
bundle = write('manifest.json', manifest)
report = {'complete': True, 'manifest': bundle, 'sourceAssets': sources,
          'publicFiles': {p.name: sha(p) for p in sorted(DEST.iterdir())},
          'packagerSha256': sha(Path(__file__)), 'worldBound': False, 'humanApproved': False,
          'browserIntegrated': False, 'scope': 'Separate immutable visual rehearsal bundle; previous live world profile and saves retained.'}
(PILOT / 'runtime-package-review.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
shutil.copyfile(__file__, PILOT / 'runtime-packager.py')
print(json.dumps({'complete': True, 'manifest': bundle, 'bundleBytes': sum(p.stat().st_size for p in DEST.iterdir())}))
