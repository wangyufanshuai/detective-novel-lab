"""Record current restorer art and the bounded real-browser checks."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'docs/3d-town/classic-residents-v2'
PUBLIC = ROOT / 'public/assets/classic-residents/v2'
QA = ROOT / 'output/playwright'


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def record(path):
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def result(name):
    data = (QA / f'classic-tailoring-{name}.log').read_text(encoding='utf-8-sig')
    return json.JSONDecoder().raw_decode(data.split('### Result', 1)[1].lstrip())[0]


def main():
    exported = read(PACKAGE / 'runtime-export.json')
    cast = read(PUBLIC / 'cast.json')
    assert sha(PUBLIC / 'cast.json') == exported['castSha256']
    manifests = {r['actorId']: read(ROOT / ('public' + r['manifestUrl'])) for r in cast['entries']}
    for entry in cast['entries']:
        assert sha(ROOT / ('public' + entry['manifestUrl'])) == entry['manifestSha256']
        manifest = manifests[entry['actorId']]
        assert sha(ROOT / ('public' + manifest['asset']['url'])) == manifest['asset']['sha256']
    author = read(PACKAGE / 'resident-03/authoring-review.json')
    renders = read(PACKAGE / 'resident-03/render-review.json')
    assert author['sourceSha256'] == renders['sourceSha256'] == exported['sourceSha256']
    for path, identity in author['inputs'].items():
        assert sha(ROOT / path) == identity, path
    for render in renders['renders']:
        assert sha(PACKAGE / 'resident-03' / render['path']) == render['sha256']
    flow = result('bookshop')
    assert flow['passed'] and not flow['browserErrors'] and not flow['apiRequests']
    assert flow['focused']['focusActorId'] == 'resident-03' and flow['restored']['focusActorId'] is None

    def validate_residents(rows):
        assert {r['actorId'] for r in rows} == set(manifests)
        for row in rows:
            manifest = manifests[row['actorId']]
            assert row['assetSha256'] == manifest['asset']['sha256']
            assert row['sourceSha256'] == manifest['sourceSha256']
    validate_residents(flow['focused']['residents'])
    performance = {name: result('performance-' + name) for name in ('bookshop', 'portrait')}
    for name, sample in performance.items():
        assert sample['viewport'] == {'width': 1920, 'height': 1080} and sample['deviceScaleFactor'] == 1
        assert sample['roomId'] == 'bookshop'
        assert sample['focusActorId'] == ('resident-03' if name == 'portrait' else None)
        validate_residents(sample['residents'])
        frames = sorted(sample['frameMs'])
        assert len(frames) == sample['frames'] and 14500 < sample['measuredMs'] < 16000
        assert abs(frames[-1] - sample['maxMs']) < 1e-6
        assert abs(frames[int(len(frames) * .95)] - sample['p95Ms']) < 1e-6
        assert sum(v > 16.7 for v in frames) == sample['over16_7']
    trace = result('stall-trace')
    validate_residents(trace['residents'])
    assert trace['roomId'] == 'bookshop' and trace['traceEvents'] > 0
    runtime_files = sorted(p for p in (ROOT / 'app/town-play/art-sample').glob('*') if p.is_file())
    inputs = [record(p) for p in runtime_files]
    compiler = read(PACKAGE / 'typecheck-result.json')
    assert compiler['exitCode'] == 0
    assert datetime.fromisoformat(compiler['completedAt'].replace('Z', '+00:00')).timestamp() >= max(p.stat().st_mtime for p in runtime_files)
    for name in ('bookshop', 'performance-bookshop', 'performance-portrait', 'stall-trace'):
        assert (QA / f'classic-tailoring-{name}.log').stat().st_mtime >= max(p.stat().st_mtime for p in runtime_files)
    baseline = read(ROOT / 'docs/3d-town/classic-residents-v1/final-report.json')
    protected = list(baseline['preservedOriginals'])
    for m in baseline['residents']:
        protected.extend([
            {'path': f"docs/3d-town/classic-residents-v1/{m['actorId']}/{m['id']}.blend", 'sha256': m['sourceSha256']},
            {'path': 'public' + m['asset']['url'], 'sha256': m['asset']['sha256']},
        ])
    for item in protected:
        assert sha(ROOT / item['path']) == item['sha256'], item['path']
    compact = {name: {k: v for k, v in sample.items() if k not in ('frameMs', 'character')} for name, sample in performance.items()}
    runtime = {
        'schema': 'classic-tailoring-runtime.v2', 'createdAt': datetime.now(timezone.utc).isoformat(),
        'castSha256': exported['castSha256'], 'runtimeInputs': inputs, 'flow': flow,
        'performance': compact, 'stallDiagnostic': {k: v for k, v in trace.items() if k != 'frameMs'},
        'stallStatus': 'An initial 533.7 ms frame was observed. It was not reproduced in the separate traced 20-second window. Cause is not established and no fix is claimed.',
        'measurementContext': 'The initial bookshop sample overlapped display of two saved screenshots in Codex. This is a possible shared-device disturbance, not a proven cause or reason to discard the stall.',
        'typecheck': {**compiler, 'log': record(PACKAGE / 'typecheck.log'), 'unchangedInputsAtRecording': inputs},
        'windowsMemorySnapshot': read(PACKAGE / 'browser-windows-memory.json'),
        'rawEvidence': [record(QA / f'classic-tailoring-{name}.log') for name in ('bookshop', 'performance-bookshop', 'performance-portrait', 'stall-trace', 'processes')],
        'humanRuntimeApproved': False, 'worldBound': False,
    }
    write(PACKAGE / 'runtime-review.json', runtime)
    report = {
        'schema': 'classic-tailoring-delivery.v2', 'status': 'one-refined-resident-local-art-candidate',
        'url': 'http://127.0.0.1:3187/town-play/art-sample', 'export': exported,
        'cast': [{'actorId': key, 'sourceSha256': m['sourceSha256'], 'asset': m['asset']} for key, m in manifests.items()],
        'clothAuthoring': author['clothAuthoring'], 'sculptedGarments': author['sculptedGarments'],
        'checks': {'actualSourceBoundRenders': len(renders['renders']), 'sampledAnimationFrames': len(author['animatedBounds']),
                   'typecheck': True, 'bookshopKeyboardObservationAndReturn': True,
                   'allThreeCurrentResidentIdentitiesLoaded': True, 'noWorldApiRequestsInRecordedFlow': True,
                   'stableSixtyFpsProven': False},
        'performance': compact, 'stallStatus': runtime['stallStatus'],
        'preservedOriginals': protected,
        'artifacts': [record(PACKAGE / 'resident-03' / r['path']) for r in renders['renders']]
                      + [record(QA / f'classic-tailoring-bookshop-{view}.png') for view in ('portrait', 'play')],
        'runtimeInputs': inputs,
        'evidenceFiles': [record(PACKAGE / name) for name in ('runtime-review.json', 'runtime-export.json', 'resident-03/authoring-review.json', 'resident-03/render-review.json', 'browser-console.log')],
        'productionScripts': [record(ROOT / 'scripts' / name) for name in ('build-blender-resident-tailoring.py', 'record-classic-tailoring-export.py', 'record-classic-tailoring-delivery.py')],
        'qaScripts': [record(QA / name) for name in ('classic-tailoring-bookshop.js', 'classic-cast-performance.js', 'classic-tailoring-stall-trace.js', 'classic-station-processes.js')],
        'humanArtApproved': False, 'formalProductionApproved': False, 'worldBound': False, 'runtimeCloth': False,
        'limitations': [
            'Only the restorer received this second pass. The station worker and innkeeper retain first-pass meshes; nine other profiles remain drafts.',
            'Shirt folds are authored directly; only skirt and apron have accepted authoring-time cloth results. Rejected full-shirt cloth experiments are not used.',
            'Hair is still a simplified continuous shell with a strand normal texture. Skin detail, expression and occupational gestures remain unfinished.',
            'Two warm stationary 15-second development-route samples and one separate traced diagnostic window do not establish full-game or Windows-release performance.',
            'The long stall remains unresolved. Earlier first-pass inn/overview outliers remain in the archived first-pass evidence as well.',
            'The scene still uses three fixed Idle placements. Real Agent decisions, the twelve-person cast, investigation consequences, saves, Windows delivery and the novel branch remain part of the active overall goal.',
        ],
    }
    write(PACKAGE / 'final-report.json', report)
    print(json.dumps({'status': report['status'], 'sourceSha256': exported['sourceSha256'], 'assetBytes': exported['assetBytes'],
                      'preservedOriginals': len(protected), 'performance': {n: {k: v[k] for k in ('p95Ms', 'maxMs', 'over16_7')} for n, v in performance.items()},
                      'goalRemainsActive': True}))


if __name__ == '__main__':
    main()
