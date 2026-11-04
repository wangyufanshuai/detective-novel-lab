"""Check actual v4 sources, cloth caches and compressed skinned GLB."""
from pathlib import Path
import importlib.util
import json

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'docs/3d-town/classic-residents-v4'
PUBLIC = ROOT / 'public/assets/classic-residents/v4'
PREVIOUS = ROOT / 'public/assets/classic-residents/v3'
spec = importlib.util.spec_from_file_location('portrait_export', ROOT / 'scripts/record-classic-portrait-export.py')
portrait = importlib.util.module_from_spec(spec); spec.loader.exec_module(portrait)
read, write, sha = portrait.read, portrait.write, portrait.sha


def main():
    folder = PACKAGE / 'resident-08'
    author = read(folder / 'authoring-review.json'); render = read(folder / 'render-review.json')
    raw = read(folder / 'raw-export.json'); source = folder / 'rb-lin-ali.blend'
    assert sha(source) == author['sourceSha256'] == render['sourceSha256'] == raw['sourceSha256']
    for path, digest in author['inputs'].items(): assert sha(ROOT / path) == digest
    assert author['packedTextures']
    for image in author['packedTextures']:
        path = ROOT / image['path']
        assert sha(path) == image['sha256'] and path.stat().st_size == image['packedBytes']
        assert max(image['dimensions']) <= 2048
    assert len(author['animatedBounds']) == 116 and not author['invalidWeightVertices']
    clearance = author['capeBlouseClearance']
    assert len(clearance['frames']) == 116 and clearance['maximumIntersectingTrianglePairs'] == 0
    assert all(row['intersectingTrianglePairs'] == 0 for row in clearance['frames'])
    required = {'three-quarter', 'portrait', 'face-front', 'front', 'profile', 'back', 'walk-contact', 'walk-passing', 'hands'}
    assert {r['view'] for r in render['renders']} == required
    for image in render['renders']: assert sha(folder / image['path']) == image['sha256']
    for item in author['topologyChecks']:
        assert not item['nonmanifoldEdges'] and not item['degenerateFaces']
        assert item['boundaryEdges'] == (80 if item['name'] == 'continuous-scalp-before-thickness' else 0)
    assert {c['object'] for c in author['clothAuthoring']} == {'settled_wool_shoulder_cape', 'settled_gored_wool_skirt'}
    for cloth in author['clothAuthoring']:
        path = ROOT / cloth['cachePath']; cached = read(path)
        assert sha(path) == cloth['cacheSha256'] and cached['passed']
        assert cloth['maxDisplacementMeters'] < .24 and cloth['maximumEdgeStretch'] < 1.4
        assert cloth['frames'] == 72
    raw_path, asset = folder / 'rb-lin-ali-raw.glb', PUBLIC / 'resident-08.glb'
    assert sha(raw_path) == raw['rawSha256']
    before_doc, _, before_mats = portrait.payload(raw_path)
    doc, images, mats = portrait.payload(asset)
    before, after = [portrait.checks.summary(d) for d in (before_doc, doc)]
    for key in before:
        if key == 'clips':
            assert before[key].keys() == after[key].keys()
            assert all(abs(before[key][name] - after[key][name]) < 1e-6 for name in before[key])
        else: assert before[key] == after[key], key
    assert after['triangles'] == author['triangles'] < 60000 and after['materials'] <= 14
    assert asset.stat().st_size < 6000000 and all(max(i['dimensions']) <= 2048 for i in images)
    assert {'EXT_meshopt_compression', 'EXT_texture_webp'} <= set(doc['extensionsUsed'])
    assert mats.keys() == before_mats.keys()
    for name in mats:
        a, b = before_mats[name], mats[name]
        for key in ('alphaMode', 'alphaCutoff', 'doubleSided', 'baseColorFactor'): assert a[key] == b[key]
        if a['normalTexture']:
            assert a['normalTexture']['decodedRgbaSha256'] == b['normalTexture']['decodedRgbaSha256']
        if a['baseColorTexture']:
            assert a['baseColorTexture']['dimensions'] == b['baseColorTexture']['dimensions']
            assert b['baseColorTexture']['mimeType'] == 'image/webp'
    manifest = read(PREVIOUS / 'resident-08.json')
    manifest.update(sourceSha256=sha(source), triangles=after['triangles'], materialCount=after['materials'],
                    asset={'url': '/assets/classic-residents/v4/resident-08.glb', 'sha256': sha(asset), 'bytes': asset.stat().st_size},
                    licenseNoticeUrl='/assets/classic-residents/v4/LICENSE.ASSETS.md',
                    construction='Original continuous scalp, chignon and collar; Blender-settled shoulder cape and skirt frozen into the retained skeleton. Preserved CC0 anatomical and portrait data. No runtime cloth or Agent decisions.')
    write(PUBLIC / 'resident-08.json', manifest)
    cast = read(PREVIOUS / 'cast.json')
    entry = next(e for e in cast['entries'] if e['actorId'] == 'resident-08')
    entry.update(manifestUrl='/assets/classic-residents/v4/resident-08.json', manifestSha256=sha(PUBLIC / 'resident-08.json'))
    cast['presentation'] = 'Three fixed art residents: v3 restorer and station worker, v4 innkeeper with continuous coiffure and settled shoulder cape. Idle animation only; no Agent or case binding.'
    write(PUBLIC / 'cast.json', cast)
    (PUBLIC / 'LICENSE.ASSETS.md').write_text((PREVIOUS / 'LICENSE.ASSETS.md').read_text(encoding='utf-8') +
        '\n\nThe v4 innkeeper adds original continuous hair, neckline, shoulder cape, hem and woven colour textures. Museum catalogue records informed garment construction only; no museum media or models are included.\n', encoding='utf-8')
    preserved = read(ROOT / 'docs/3d-town/classic-residents-v3/final-report.json')['preservedOriginals']
    previous_export = read(ROOT / 'docs/3d-town/classic-residents-v3/runtime-export.json')
    for resident in previous_export['residents']:
        preserved += [{'path': resident['sourcePath'], 'sha256': resident['sourceSha256']},
                      {'path': 'public' + resident['asset']['url'], 'sha256': resident['asset']['sha256']}]
    for item in preserved: assert sha(ROOT / item['path']) == item['sha256']
    report = {'schema':'classic-drape-export.v4', 'actorId':'resident-08', 'sourceSha256':sha(source),
              'asset':manifest['asset'], 'payload':after, 'images':images, 'materials':mats,
              'castSha256':sha(PUBLIC / 'cast.json'), 'preservedOriginals':preserved,
              'authoringReceiptSha256':sha(folder / 'authoring-review.json'),
              'renderReceiptSha256':sha(folder / 'render-review.json'),
              'optimizerSha256':sha(ROOT / 'scripts/optimize-classic-drape.ps1'),
              'runtimeCloth':False, 'humanArtApproved':False, 'worldBound':False}
    write(PACKAGE / 'runtime-export.json', report)
    print(json.dumps({'triangles':after['triangles'], 'materials':after['materials'], 'bytes':asset.stat().st_size, 'preservedOriginals':len(preserved), 'castSha256':report['castSha256']}))


if __name__ == '__main__': main()
