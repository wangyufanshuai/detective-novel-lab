"""Bind the three resident art candidates to their actual renders and browser run."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import math

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'docs/3d-town/classic-residents-v1'
PUBLIC = ROOT / 'public/assets/classic-residents/v1'
QA = ROOT / 'output/playwright'


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def record(path):
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path),
            'bytes': path.stat().st_size}


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def result(name):
    path = QA / f'classic-cast-{name}.log'
    text = path.read_text(encoding='utf-8-sig')
    assert '### Result' in text, path
    return json.JSONDecoder().raw_decode(text.split('### Result', 1)[1].lstrip())[0]


def main():
    now = datetime.now(timezone.utc).isoformat()
    exported = read(PACKAGE / 'runtime-export.json')
    cast = read(PUBLIC / 'cast.json')
    assert sha(PUBLIC / 'cast.json') == exported['castSha256']
    assert not cast['worldBound'] and not exported['humanArtApproved']
    entries = {r['actorId']: r for r in cast['entries']}
    manifests = {actor: read(ROOT / ('public' + r['manifestUrl'])) for actor, r in entries.items()}
    assert set(entries) == {'resident-03', 'resident-06', 'resident-08'}
    scene_asset = exported['sceneAssetSha256']
    scene_source = exported['sceneSourceSha256']
    assert scene_asset == cast['sceneAssetSha256']
    assert sha(ROOT / 'public/assets/classic-station/v1/classic-street.glb') == scene_asset
    assert sha(ROOT / 'docs/3d-town/classic-station-v1/classic-station.blend') == scene_source
    assert sha(ROOT / 'packages/engine/src/riverbend-world.ts') == exported['publicIdentitySourceSha256']
    ledger = PACKAGE / 'licensed/mpfb/provenance.json'
    assert sha(ledger) == exported['sourceDataLedgerSha256']
    for item in read(ledger)['files']:
        assert sha(ROOT / item['path']) == item['sha256'], item['path']

    render_records, authoring_records = [], []
    for actor, manifest in manifests.items():
        folder = PACKAGE / actor
        assert sha(PUBLIC / f'{actor}.json') == entries[actor]['manifestSha256']
        assert sha(ROOT / ('public' + manifest['asset']['url'])) == manifest['asset']['sha256']
        assert sha(folder / (manifest['id'] + '.blend')) == manifest['sourceSha256']
        assert not manifest['worldBound'] and not manifest['humanArtApproved']
        author = read(folder / 'authoring-review.json')
        renders = read(folder / 'render-review.json')
        assert author['sourceSha256'] == renders['sourceSha256'] == manifest['sourceSha256']
        assert not author['invalidWeightVertices'] and author['bones'] == 20
        assert len(author['animatedBounds']) == 116
        assert all(frame['bounds'][2][0] >= -.012 for frame in author['animatedBounds'])
        for path, identity in author['inputs'].items():
            assert sha(ROOT / path) == identity, path
        assert len(renders['renders']) == 9 and renders['engine'] == 'Cycles'
        for r in renders['renders']:
            path = folder / r['path']
            assert sha(path) == r['sha256'], path
            render_records.append(record(path))
        authoring_records.append(record(folder / 'authoring-review.json'))
    lineup = read(PACKAGE / 'cast-lineup-review.json')
    for path, identity in lineup['sourceInputs'].items():
        assert sha(ROOT / path) == identity, path
    assert sha(ROOT / 'scripts/render-classic-cast-lineup.py') == lineup['stageBuilderSha256']
    assert sha(PACKAGE / 'cast-lineup.blend') == lineup['stageSourceSha256']
    assert sha(PACKAGE / 'cast-lineup.png') == lineup['renderSha256']

    runtime_paths = sorted(p for p in (ROOT / 'app/town-play/art-sample').glob('*') if p.is_file())
    runtime_inputs = [record(p) for p in runtime_paths]
    latest_runtime_edit = max(p.stat().st_mtime for p in runtime_paths)
    compiler = read(PACKAGE / 'typecheck-result.json')
    assert compiler['exitCode'] == 0
    assert datetime.fromisoformat(compiler['completedAt'].replace('Z', '+00:00')).timestamp() >= latest_runtime_edit
    # Hashes are captured at delivery, after verifying no runtime source was
    # edited after the recorded compiler completion or browser evidence.
    compiler = dict(compiler, log=record(PACKAGE / 'typecheck.log'),
                    unchangedRuntimeInputsAtRecording=runtime_inputs, recordedAt=now)

    def check_residents(residents):
        assert {r['actorId'] for r in residents} == set(entries)
        for r in residents:
            manifest = manifests[r['actorId']]
            assert r['assetSha256'] == manifest['asset']['sha256']
            assert r['sourceSha256'] == manifest['sourceSha256']
            assert r['position'] == entries[r['actorId']]['position']

    names = ('inn', 'bookshop', 'station', 'regression', 'move-inn', 'move-bookshop')
    flows = {name: result(name) for name in names}
    for name, flow in flows.items():
        assert flow['passed'] and not flow['browserErrors'] and not flow['apiRequests'], name
        assert (QA / f'classic-cast-{name}.log').stat().st_mtime >= latest_runtime_edit
        if name in ('inn', 'bookshop', 'station'):
            actor = {'inn': 'resident-08', 'bookshop': 'resident-03', 'station': 'resident-06'}[name]
            assert flow['focused']['focusActorId'] == actor
            assert flow['restored']['focusActorId'] is None
            assert manifests[actor]['name'] in flow['dialogText']
            assert '\ufffd' not in flow['dialogText']
            check_residents(flow['focused']['residents'])
        elif name.startswith('move-'):
            check_residents(flow['after']['residents'])
    regression = flows['regression']['after']
    assert regression['sourceSha256'] == scene_source and regression['assetSha256'] == scene_asset
    collision = flows['move-inn']['collision']
    assert collision['minimumClearance'] >= collision['playerRadius'] + collision['padding']

    performance = {name: result('performance-' + name)
                   for name in ('station', 'portrait', 'overview', 'inn', 'bookshop')}
    for name, sample in performance.items():
        assert sample['sourceSha256'] == scene_source and sample['assetSha256'] == scene_asset
        assert sample['viewport'] == {'width': 1920, 'height': 1080} and sample['deviceScaleFactor'] == 1
        assert sample['roomId'] == ('station' if name == 'portrait' else '' if name == 'overview' else name)
        assert sample['mode'] == ('overview' if name == 'overview' else 'explore')
        assert sample['focusActorId'] == ('resident-06' if name == 'portrait' else None)
        assert 14500 < sample['measuredMs'] < 16000
        check_residents(sample['residents'])
        frames = sorted(sample['frameMs'])
        assert len(frames) == sample['frames'] and all(math.isfinite(v) and v >= 0 for v in frames)
        assert abs(sum(frames) - sample['measuredMs']) < .001
        assert abs(frames[math.floor(len(frames) * .95)] - sample['p95Ms']) < 1e-7
        assert abs(frames[-1] - sample['maxMs']) < 1e-7
        assert sum(v > 16.7 for v in frames) == sample['over16_7']
        assert sum(v > 33.4 for v in frames) == sample['over33_4']
        assert (QA / f'classic-cast-performance-{name}.log').stat().st_mtime >= latest_runtime_edit

    memory = read(PACKAGE / 'browser-windows-memory.json')
    processes = result('processes')
    assert {p['id'] for p in processes['processes']} == {p['pid'] for p in memory['processes']}
    assert memory['reportedProcesses'] == memory['measuredProcesses'] == len(memory['processes'])
    protected = read(ROOT / 'docs/3d-town/classic-station-v1/final-report.json')['preservedOriginals']
    protected = protected + [
        {'path': 'docs/3d-town/classic-station-v1/classic-station.blend', 'sha256': scene_source},
        {'path': 'public/assets/classic-station/v1/classic-street.glb', 'sha256': scene_asset},
    ]
    for item in protected:
        assert sha(ROOT / item['path']) == item['sha256'], item['path']

    compact_performance = {name: {k: v for k, v in sample.items() if k not in ('frameMs', 'character')}
                           for name, sample in performance.items()}
    runtime = {
        'schema': 'classic-residents-runtime-review.v1', 'createdAt': now,
        'castSha256': exported['castSha256'], 'sceneAssetSha256': scene_asset,
        'runtimeInputs': runtime_inputs, 'flows': flows, 'performance': compact_performance,
        'windowsMemorySnapshot': memory, 'typecheck': compiler,
        'rawFrameLogs': [record(QA / f'classic-cast-performance-{n}.log') for n in performance],
        'retainedFailedRoute': {
            **record(QA / 'classic-cast-station-route-first.log'),
            'reason': 'The initial greedy test route met a street bench. The revised keyboard route went around it; product collision was not weakened.'},
        'console': {**record(PACKAGE / 'browser-console.log'),
                    'knownWarning': 'D3D shader constant-folding precision warning X4122; not a page runtime exception.'},
        'humanRuntimeApproved': False, 'worldBound': False,
    }
    write(PACKAGE / 'runtime-review.json', runtime)
    scripts = ('vendor-classic-resident-anatomy.py', 'classic-resident-anatomy.py',
               'build-blender-classic-residents.py', 'optimize-classic-residents.ps1',
               'record-classic-residents-export.py', 'render-classic-cast-lineup.py',
               'record-classic-residents-delivery.py')
    report = {
        'schema': 'classic-residents-delivery.v1', 'createdAt': now,
        'status': 'three-resident-art-candidates-with-local-runtime-checks',
        'url': 'http://127.0.0.1:3187/town-play/art-sample',
        'castSha256': exported['castSha256'], 'sceneSourceSha256': scene_source,
        'sceneAssetSha256': scene_asset, 'residents': list(manifests.values()),
        'geometry': {'residentTriangles': sum(m['triangles'] for m in manifests.values()),
                     'residentAssetBytes': sum(m['asset']['bytes'] for m in manifests.values()),
                     'characterRenders': len(render_records), 'lineupRenders': 1,
                     'sampledAnimationFramesPerResident': 116},
        'candidateChecks': {'currentSourceRenderAndExportIdentities': True,
                            'licensedSourceBytesMatchLedger': True,
                            'publicIdentityFieldsMatchWorldSource': True,
                            'threeActualKeyboardApproachesAndObservationCards': True,
                            'stationObservationAndStaffPassageRegression': True,
                            'selectedResidentNavigationProxyCollision': True,
                            'noWorldApiRequestsDuringRecordedFlows': True,
                            'typecheck': True},
        'performance': compact_performance,
        'warmFrameBudget': {'targetMs': 16.7,
                            'allSamplesP95WithinTarget': all(r['p95Ms'] <= 16.7 for r in performance.values()),
                            'allFramesWithinTarget': all(r['over16_7'] == 0 for r in performance.values()),
                            'framesAboveTarget': sum(r['over16_7'] for r in performance.values()),
                            'worstFrameMs': max(r['maxMs'] for r in performance.values()),
                            'scope': 'Five warm, stationary, 15-second headless Chrome samples. Frame timestamps are not independent GPU timer queries.'},
        'windowsMemorySnapshot': memory,
        'runtimeInputs': runtime_inputs,
        'productionScripts': [record(ROOT / 'scripts' / s) for s in scripts],
        'qaScripts': [record(p) for p in sorted(QA.glob('classic-cast-*.js'))] + [record(QA / 'classic-station-processes.js')],
        'evidenceFiles': [record(PACKAGE / name) for name in (
            'runtime-review.json', 'runtime-export.json', 'typecheck-result.json',
            'browser-console.log', 'browser-windows-memory.json', 'cast-lineup-review.json',
            'licensed/mpfb/provenance.json', 'brief.json', 'profiles.json')]
            + authoring_records + [record(QA / f'classic-cast-{n}.log') for n in names],
        'artifacts': render_records + [record(PACKAGE / 'cast-lineup.png')]
            + [record(p) for p in sorted(QA.glob('classic-cast-*.png'))],
        'preservedOriginals': protected,
        'humanArtApproved': False, 'formalProductionApproved': False, 'worldBound': False,
        'remainingResidentProfilesAreDrafts': 9,
        'limitations': [
            'Three fixed authored placements with Idle only. Exported Walk is checked geometrically but is not driven by accepted Agent actions in this sample.',
            'Cloth drape and folds, lapel thickness, hair layering, skin detail and natural character gestures still need art work; the approved concept has not become a human-approved final model.',
            'The five performance windows exclude cold load, travel, long-session stalls, Windows packaging, other devices and the twelve-Agent world. Inn observed 49.9 ms and bookshop 22.2 ms maxima remain in the evidence.',
            'The memory snapshot covers this dedicated QA browser process set. Working-set sums can double-count shared pages; private commit is not VRAM and this is not a leak test.',
            'Selected collision checks use the runtime navigation proxy and recorded paths, not exhaustive animated garment collision.',
            'No autonomous testimony, case truth, consequence, save or novel-generation flow was validated by the art sample.',
            'Human art and gameplay review, remaining residents, real Agent binding and desktop release acceptance remain pending. The overall goal is active.',
        ],
    }
    write(PACKAGE / 'final-report.json', report)
    print(json.dumps({'status': report['status'], 'geometry': report['geometry'],
                      'warmFrameBudget': report['warmFrameBudget'],
                      'preservedOriginals': len(protected), 'humanArtApproved': False}))


if __name__ == '__main__':
    main()
