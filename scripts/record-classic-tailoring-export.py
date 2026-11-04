"""Check the refined restorer and assemble an explicitly mixed-version cast."""
from pathlib import Path
import importlib.util
import json

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'docs/3d-town/classic-residents-v2'
PUBLIC = ROOT / 'public/assets/classic-residents/v2'
BASE = ROOT / 'public/assets/classic-residents/v1'
spec = importlib.util.spec_from_file_location('resident_export_checks', ROOT / 'scripts/record-classic-residents-export.py')
checks = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checks)
read, write, sha = checks.read, checks.write, checks.sha


def main():
    actor = 'resident-03'
    folder = PACKAGE / actor
    old = read(BASE / (actor + '.json'))
    author = read(folder / 'authoring-review.json')
    renders = read(folder / 'render-review.json')
    raw = read(folder / 'raw-export.json')
    source = folder / (old['id'] + '.blend')
    identity = sha(source)
    assert identity == author['sourceSha256'] == renders['sourceSha256'] == raw['sourceSha256']
    for path, expected in author['inputs'].items():
        assert sha(ROOT / path) == expected, path
    assert len(author['clothAuthoring']) == 2 and len(author['sculptedGarments']) == 1
    assert not author['runtimeCloth'] and not author['humanArtApproved'] and not author['worldBound']
    for cloth in author['clothAuthoring']:
        assert cloth['maximumEdgeStretch'] < 1.4 and cloth['maxDisplacementMeters'] < .24
        assert sha(ROOT / cloth['cachePath']) == cloth['cacheSha256']
    expected_views = {'three-quarter', 'tailoring', 'portrait', 'face-front', 'front', 'profile', 'back', 'walk-contact', 'walk-passing', 'hands'}
    assert {r['view'] for r in renders['renders']} == expected_views
    for render in renders['renders']:
        assert sha(folder / render['path']) == render['sha256']
    raw_path = folder / (old['id'] + '-raw.glb')
    assert sha(raw_path) == raw['rawSha256']
    asset = PUBLIC / (actor + '.glb')
    before, after = checks.summary(checks.glb(raw_path)), checks.summary(checks.glb(asset))
    for key in before:
        if key == 'clips':
            assert before[key].keys() == after[key].keys()
            assert all(abs(before[key][n] - after[key][n]) < 1e-6 for n in before[key])
        else:
            assert before[key] == after[key], key
    assert after['triangles'] == author['triangles'] < 45000
    assert len(after['joints']) == 20 and after['materials'] <= 11
    assert asset.stat().st_size < 2_500_000
    manifest = dict(old, sourceSha256=identity,
                    asset={'url': '/assets/classic-residents/v2/resident-03.glb', 'sha256': sha(asset), 'bytes': asset.stat().st_size},
                    triangles=after['triangles'], materialCount=after['materials'],
                    licenseNoticeUrl='/assets/classic-residents/v2/LICENSE.ASSETS.md',
                    construction='Directly shaped blouse; authoring-time settled skirt/apron; natural Idle. No runtime cloth or autonomous actions.')
    write(PUBLIC / (actor + '.json'), manifest)
    (PUBLIC / 'LICENSE.ASSETS.md').write_bytes((BASE / 'LICENSE.ASSETS.md').read_bytes())
    cast = read(BASE / 'cast.json')
    for entry in cast['entries']:
        if entry['actorId'] == actor:
            entry['manifestUrl'] = '/assets/classic-residents/v2/resident-03.json'
            entry['manifestSha256'] = sha(PUBLIC / (actor + '.json'))
        else:
            assert sha(ROOT / ('public' + entry['manifestUrl'])) == entry['manifestSha256']
    cast['presentation'] = 'Three authored stationary art placements. Restorer uses the second tailoring pass; station worker and innkeeper retain first-pass assets. Idle only; no Agent decisions or testimony.'
    write(PUBLIC / 'cast.json', cast)
    write(PACKAGE / 'runtime-export.json', {
        'schema': 'classic-tailoring-export.v2', 'status': 'one-refined-resident-with-two-preserved-first-pass-residents',
        'sourceSha256': identity, 'assetSha256': sha(asset), 'assetBytes': asset.stat().st_size,
        'castSha256': sha(PUBLIC / 'cast.json'), 'baselineCastSha256': sha(BASE / 'cast.json'),
        'payload': after, 'authoringReceiptSha256': sha(folder / 'authoring-review.json'),
        'renderReceiptSha256': sha(folder / 'render-review.json'), 'rendererViews': len(renders['renders']),
        'humanArtApproved': False, 'worldBound': False, 'runtimeCloth': False,
    })
    print(json.dumps({'actorId': actor, 'triangles': after['triangles'], 'bytes': asset.stat().st_size,
                      'castSha256': sha(PUBLIC / 'cast.json')}))


if __name__ == '__main__':
    main()
