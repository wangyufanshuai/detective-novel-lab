"""Assemble bounded art/runtime evidence for the three portrait candidates."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'docs/3d-town/classic-residents-v3'
PUBLIC = ROOT / 'public/assets/classic-residents/v3'
QA = ROOT / 'output/playwright'


def read(path): return json.loads(path.read_text(encoding='utf-8-sig'))
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def record(path): return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}
def write(path, value): path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
def result(name):
    value = (QA / f'classic-portrait-{name}.log').read_text(encoding='utf-8-sig')
    return json.JSONDecoder().raw_decode(value.split('### Result', 1)[1].lstrip())[0]


def main():
    exported = read(PACKAGE / 'runtime-export.json')
    cast = read(PUBLIC / 'cast.json')
    assert sha(PUBLIC / 'cast.json') == exported['castSha256']
    manifests = {entry['actorId']: read(ROOT / ('public' + entry['manifestUrl'])) for entry in cast['entries']}
    renders = []
    for entry in cast['entries']:
        assert sha(ROOT / ('public' + entry['manifestUrl'])) == entry['manifestSha256']
        manifest = manifests[entry['actorId']]
        assert sha(ROOT / ('public' + manifest['asset']['url'])) == manifest['asset']['sha256']
        folder = PACKAGE / entry['actorId']; source = folder / (manifest['id'] + '.blend')
        author = read(folder / 'authoring-review.json'); views = read(folder / 'render-review.json')
        assert sha(source) == manifest['sourceSha256'] == author['sourceSha256'] == views['sourceSha256']
        for path, expected in author['inputs'].items():
            assert sha(ROOT / path) == expected
        for view in views['renders']:
            image = folder / view['path']; assert sha(image) == view['sha256']; renders.append(record(image))
    lineup = read(PACKAGE / 'portrait-lineup-review.json')
    for path, expected in lineup['sourceInputs'].items():
        assert sha(ROOT / path) == expected
    assert sha(PACKAGE / 'portrait-lineup.blend') == lineup['stageSourceSha256']
    assert sha(PACKAGE / 'portrait-lineup.png') == lineup['renderSha256']
    assert sha(ROOT / 'scripts/render-classic-portrait-lineup.py') == lineup['stageBuilderSha256']
    visual = read(PACKAGE / 'visual-review.json')
    assert visual['castSha256'] == exported['castSha256'] and not visual['humanArtApproved']
    for path, expected in visual['sourceInputs'].items():
        assert sha(ROOT / path) == expected
    for inspected in visual['imagesInspected']:
        assert sha(ROOT / inspected['path']) == inspected['sha256']
    flows = {room: result(room) for room in ('inn', 'bookshop', 'station')}

    def validate_residents(rows):
        assert {r['actorId'] for r in rows} == set(manifests)
        for row in rows:
            manifest = manifests[row['actorId']]
            assert row['assetSha256'] == manifest['asset']['sha256']
            assert row['sourceSha256'] == manifest['sourceSha256']
    for room, actor in [('inn', 'resident-08'), ('bookshop', 'resident-03'), ('station', 'resident-06')]:
        flow = flows[room]
        assert flow['passed'] and not flow['browserErrors'] and not flow['apiRequests']
        assert flow['focused']['focusActorId'] == actor and flow['restored']['focusActorId'] is None
        assert flow['focused']['roomId'] == room
        validate_residents(flow['focused']['residents'])
    samples = {name: result('performance-' + name) for name in ('inn', 'bookshop', 'portrait', 'station', 'overview')}
    for name, sample in samples.items():
        assert sample['viewport'] == {'width': 1920, 'height': 1080} and sample['deviceScaleFactor'] == 1
        assert sample['focusActorId'] == ('resident-03' if name == 'portrait' else None)
        if name not in ('portrait', 'overview'):
            assert sample['roomId'] == name
        validate_residents(sample['residents'])
        values = sorted(sample['frameMs'])
        assert len(values) == sample['frames'] and 14500 < sample['measuredMs'] < 16000
        assert values[-1] == sample['maxMs'] and values[int(len(values) * .95)] == sample['p95Ms']
        assert sum(v > 16.7 for v in values) == sample['over16_7']
    files = sorted(p for p in (ROOT / 'app/town-play/art-sample').glob('*') if p.is_file())
    inputs = [record(p) for p in files]
    compiler = read(PACKAGE / 'typecheck-result.json'); latest = max(p.stat().st_mtime for p in files)
    assert compiler['exitCode'] == 0
    assert datetime.fromisoformat(compiler['completedAt'].replace('Z', '+00:00')).timestamp() >= latest
    for name in list(flows) + ['performance-' + name for name in samples]:
        assert (QA / ('classic-portrait-' + name + '.log')).stat().st_mtime >= latest
    baseline = read(ROOT / 'docs/3d-town/classic-residents-v2/final-report.json')
    preserved = list(baseline['preservedOriginals'])
    preserved += [
        {'path': 'docs/3d-town/classic-residents-v2/resident-03/rb-xu-zhiwei.blend', 'sha256': baseline['export']['sourceSha256']},
        {'path': 'public/assets/classic-residents/v2/resident-03.glb', 'sha256': baseline['export']['assetSha256']},
    ]
    for item in preserved:
        assert sha(ROOT / item['path']) == item['sha256'], item['path']
    compact = {name: {k: v for k, v in sample.items() if k not in ('frameMs', 'character')} for name, sample in samples.items()}
    runtime = {'schema': 'classic-portrait-runtime.v3', 'createdAt': datetime.now(timezone.utc).isoformat(),
               'castSha256': exported['castSha256'], 'runtimeInputs': inputs, 'flows': flows, 'performance': compact,
               'windowsMemorySnapshot': read(PACKAGE / 'browser-windows-memory.json'),
               'typecheck': {**compiler, 'log': record(PACKAGE / 'typecheck.log')},
               'rawEvidence': [record(QA / ('classic-portrait-' + name + '.log')) for name in list(flows) + ['performance-' + n for n in samples] + ['processes']],
               'humanRuntimeApproved': False, 'worldBound': False,
               'previousStall': 'The v2 533.7 ms frame remains an unresolved historical observation. These new windows do not prove its cause or resolution.'}
    write(PACKAGE / 'runtime-review.json', runtime)
    report = {'schema': 'classic-portrait-delivery.v3', 'status': 'three-refined-residents-local-art-candidate',
              'url': 'http://127.0.0.1:3187/town-play/art-sample', 'export': exported,
              'visualReviewStatus': visual['status'],
              'checks': {'sourceBoundRenders': len(renders), 'sharedLightingPortrait': True, 'sampledAnimationFramesPerActor': 116,
                         'threeKeyboardObservationAndReturnFlows': True, 'typecheck': True, 'allCurrentAssetsVerified': True,
                         'stableSixtyFpsProven': False, 'windowsReleaseProven': False},
              'performance': compact, 'preservedOriginals': preserved, 'runtimeInputs': inputs,
              'artifacts': renders + [record(PACKAGE / 'portrait-lineup.png')]
                           + [record(QA / f'classic-portrait-{room}-{view}.png') for room in flows for view in ('portrait', 'play')],
              'evidenceFiles': [record(PACKAGE / name) for name in ('runtime-export.json', 'runtime-review.json', 'browser-console.log', 'portrait-lineup-review.json', 'visual-review.json', 'licensed/makehuman-system/provenance.json')],
              'productionScripts': [record(ROOT / 'scripts' / name) for name in ('build-blender-resident-portraits.py', 'classic-resident-portrait-assets.py', 'vendor-classic-portrait-assets.py', 'optimize-classic-portraits.ps1', 'record-classic-portrait-export.py', 'record-classic-portrait-delivery.py', 'render-classic-portrait-lineup.py')],
              'qaScripts': [record(QA / f'classic-portrait-{room}.js') for room in flows] + [record(QA / 'classic-cast-performance.js')],
              'humanArtApproved': False, 'formalProductionApproved': False, 'worldBound': False,
              'limitations': [
                  'Three residents are built; nine other profiles remain drafts. These remain fixed Idle art placements without actual Agent decisions or testimony.',
                  'Faces are textured static surfaces. Facial expression, eye movement and speech animation are not implemented.',
                  'The authored low bun, shawl, collars, lapels and cloth still require more art refinement. These checks do not certify cinematic or top-tier art quality.',
                  'CC0 short02 and curled-under bob are fitted and adapted source assets. The two bun candidates with conflicting licenses were excluded.',
                  'Colour textures use lossy WebP quality 90; normal textures use pixel-verified lossless WebP. Download compression does not reduce decoded GPU texture memory.',
                  'Five warm 15-second headless Chrome development-route samples on one Windows computer do not certify a packaged release, long sessions, twelve agents or model latency.',
                  'The earlier half-second stall is retained as unresolved. No cause or fix is inferred from its absence in another sample.',
                  'The full autonomous simulation, investigation consequences, desktop release and novel branch remain part of the active overall goal.',
              ]}
    write(PACKAGE / 'final-report.json', report)
    print(json.dumps({'status': report['status'], 'sourceBoundRenders': len(renders), 'preservedOriginals': len(preserved),
                      'performance': {name: {k: v[k] for k in ('p95Ms', 'maxMs', 'over16_7')} for name, v in samples.items()},
                      'goalRemainsActive': True}))


if __name__ == '__main__':
    main()
