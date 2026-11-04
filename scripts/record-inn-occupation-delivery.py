"""Bind the inn candidate to its current source, art review and actual UI evidence."""
from pathlib import Path
import datetime
import hashlib
import importlib.util
import json

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / 'docs/3d-town/classic-inn-occupation-v1'
F = ROOT / 'docs/3d-town/classic-occupations-v1/resident-08/gesture-14'
PUBLIC = ROOT / 'public/assets/classic-occupations/v2'
LOG = ROOT / 'output/playwright'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def ref(path):
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path)}

def result(name):
    text = (LOG / (name + '.log')).read_text(encoding='utf-8-sig')
    assert '### Result' in text and '### Error' not in text, name
    return json.JSONDecoder().raw_decode(text.split('### Result', 1)[1].lstrip())[0]

flow = result('inn-occupation-flow-final')
perf = result('inn-occupation-performance-final')
baseline = result('inn-occupation-baseline')
station = result('inn-station-regression-flow')
arrival = result('inn-occupation-arrival-final')
assert flow['passed'] and not flow['errors'] and not arrival['errors']
assert baseline['passed'] and not baseline['browserErrors'] and not baseline['apiRequests']
assert station['passed'] and not station['errors']
actor, scene, cast = [read(PUBLIC / n) for n in ('resident-08.json', 'manifest.json', 'cast.json')]
assert sha(ROOT / ('public' + scene['residentCast']['url'])) == scene['residentCast']['sha256']
for entry in cast['entries']:
    assert sha(ROOT / ('public' + entry['manifestUrl'])) == entry['manifestSha256']
for asset in (actor['asset'], actor['workAction']['workstation']):
    assert sha(ROOT / ('public' + asset['url'])) == asset['sha256']
for key in ('seated', 'working', 'looped', 'interrupted', 'restarted', 'restored'):
    person = next(r for r in flow[key]['residents'] if r['actorId'] == 'resident-08')
    assert person['assetSha256'] == actor['asset']['sha256'] and person['sourceSha256'] == actor['sourceSha256']
    assert person['work']['workstationSha256'] == actor['workAction']['workstation']['sha256']
assert next(r for r in perf['residents'] if r['actorId'] == 'resident-08')['assetSha256'] == actor['asset']['sha256']
assert perf['focusActorId'] == 'resident-08' and perf['viewport'] == {'width': 1920, 'height': 1080}
assert perf['frames'] >= 600 and 14900 < perf['measuredMs'] < 15500
station_entry = next(e for e in cast['entries'] if e['actorId'] == 'resident-06')
station_actor = read(ROOT / ('public' + station_entry['manifestUrl']))
assert next(r for r in station['working']['residents'] if r['actorId'] == 'resident-06')['assetSha256'] == station_actor['asset']['sha256']

fn, form, renders, raw, runtime = [read(F / n) for n in ('function-review.json', 'form-review.json', 'render-review.json', 'raw-export.json', 'runtime-export.json')]
assert all(r['sourceSha256'] == sha(F / 'occupation.blend') for r in (fn, form, renders, raw, runtime))
assert fn['passed'] and form['passed'] and renders['complete'] and len(renders['renders']) == 14
assert form['functionReviewSha256'] == sha(F / 'function-review.json')
assert form['renderReviewSha256'] == sha(F / 'render-review.json')
assert form['inspectorSha256'] == sha(ROOT / 'scripts/inspect-inn-motion.py')
for item in renders['renders']:
    assert sha(F / item['path']) == item['sha256']
assert raw['exporterSha256'] == sha(ROOT / 'scripts/export-inn-occupation.py')
assert runtime['recorderSha256'] == sha(ROOT / 'scripts/record-inn-occupation-export.py')
assert raw['maximumRetainedIdleWalkMatrixDifference'] == 0
assert raw['oldMeshIdentity']['positions'] != raw['newMeshIdentity']['positions']
assert raw['topologyAndUvRetained'] and raw['originalRestBonesRetained']
nav = read(P / 'navigation-review.json')
assert nav['passed'] and nav['castSha256'] == sha(PUBLIC / 'cast.json')
assert nav['navigatorSha256'] == sha(ROOT / 'app/town-play/art-sample/sample-navigation.ts')

spec = importlib.util.spec_from_file_location('payload', ROOT / 'scripts/record-classic-portrait-export.py')
payload = importlib.util.module_from_spec(spec)
spec.loader.exec_module(payload)
_, _, original_mats = payload.payload(F / 'workstation-raw.glb')
_, _, final_mats = payload.payload(PUBLIC / 'workstation.glb')
normal_count = 0
for name, material in original_mats.items():
    if material['normalTexture']:
        normal_count += 1
        assert material['normalTexture']['sha256'] == final_mats[name]['normalTexture']['sha256']
assert normal_count > 0

typecheck = read(ROOT / 'output/classic-occupations-v1/inn-typecheck-receipt.json')
assert typecheck['passed'] and typecheck['exitCode'] == 0
for item in typecheck['files']:
    assert sha(ROOT / item['path']) == item['sha256']
engine = read(ROOT / 'output/classic-occupations-v1/inn-living-checks.log')
engine_report = read(Path(engine['report']))
assert engine['passed'] and engine_report['passed'] and engine['checks'] == len(engine_report['checks']) == 7
for path, identity in engine_report['sources'].items():
    assert sha(ROOT / path) == identity, path

evidence = [F / n for n in ('occupation.blend', 'authoring-review.json', 'function-review.json', 'form-review.json', 'render-review.json', 'raw-export.json', 'runtime-export.json')]
evidence += [F / item['path'] for item in renders['renders']]
evidence += [PUBLIC / n for n in ('manifest.json', 'cast.json', 'resident-08.json', 'resident-08.glb', 'workstation.glb', 'LICENSE.ASSETS.md')]
evidence += [LOG / (n + '.log') for n in ('inn-occupation-arrival-final', 'inn-occupation-flow-final', 'inn-occupation-performance-final', 'inn-occupation-baseline', 'inn-station-regression-arrival', 'inn-station-regression-flow')]
evidence += [LOG / n for n in ('inn-occupation-working.png', 'inn-occupation-interrupted.png', 'inn-occupation-baseline-held.png', 'inn-station-regression-working.png')]
evidence += [P / 'navigation-review.json', Path(engine['report']), ROOT / 'output/classic-occupations-v1/inn-typecheck-receipt.json']
sources = ['app/town-play/art-sample/ClassicScene.tsx', 'app/town-play/art-sample/sample-character.ts', 'app/town-play/living/LivingTown.tsx',
           'scripts/render-inn-occupation.py', 'scripts/review-inn-function.py', 'scripts/inspect-inn-motion.py', 'scripts/export-inn-occupation.py',
           'scripts/optimize-inn-occupation.ps1', 'scripts/record-inn-occupation-export.py', 'scripts/check-inn-occupation-navigation.mjs',
           'output/playwright/inn-occupation-arrival.js', 'output/playwright/inn-occupation-flow.js', 'output/playwright/inn-occupation-performance.js',
           'output/playwright/inn-occupation-baseline.js', 'output/playwright/inn-station-regression-flow.js']
summary = {
    'schema': 'classic-inn-occupation-delivery.v1', 'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'local-candidate-verified', 'goalComplete': False, 'humanArtApproved': False, 'formalPluginProductionApproved': False,
    'inn': {'sourceSha256': actor['sourceSha256'], 'bodyAsset': actor['asset'], 'workplaceAsset': actor['workAction']['workstation'],
            'clip': 'ReconcileRegister', 'propClip': 'WriteRegister_Prop', 'durationSeconds': 10, 'payloads': runtime['payloads'],
            'sampledWorkPoses': len(form['rows']), 'sampleHz': form['sampleHz'], 'sampledLocomotionPoses': len(form['locomotion']),
            'intersectionAndStretchMaxima': form['maxima'], 'loopMatrixDifference': form['loopMatrixDifference'],
            'tripodGapMaximumMeters': form['tripodGapMaximumMeters'], 'gazeMaximumErrorDegrees': form['gazeMaximumErrorDegrees'],
            'functionRoutes': len(fn['routes']), 'functionSampledPositions': fn['sampledPositions'], 'renders': 14,
            'positionsModifiedForGarments': True, 'retainedTopologyAndUv': True, 'addedEyeBones': 2,
            'originalIdleWalkBodyMatricesIdentical': True, 'workplaceNormalTextureBlobsIdentical': True},
    'browser': {'flowPassed': True, 'workingTime': flow['working']['world']['time'], 'interruptedTime': flow['interrupted']['world']['time'],
                'restartedTime': flow['restarted']['world']['time'], 'restoredTime': flow['restored']['world']['time'],
                'noAnimationWorldCommands': True, 'baselineChecks': baseline['checks'], 'stationRegressionPassed': True, 'pageErrors': []},
    'performance': {k: v for k, v in perf.items() if k not in ('frameMs', 'character', 'residents')},
    'typescriptPassed': True, 'livingBindingChecks': 7,
    'visualReview': {'reviewer': 'Codex', 'inspectedBlenderViews': [r['view'] for r in renders['renders']],
                    'notes': ['All 14 final-source renders inspected individually, including ceiling and low entry.',
                              'Runtime working and interrupted views inspected; pen, paper and both hands visible above the desk.',
                              'Door wall partly occludes the resident from low entry; routes remain clear.',
                              'Stylized cloth and face remain candidates for human aesthetic review.']},
    'limitations': ['Surface intersections are sampled, not a continuous collision guarantee.',
                    'Decorative register strokes are not guest records or event-generated evidence; no runtime ink or cloth simulation.',
                    'Work animation follows accepted deterministic work. It does not establish real-model autonomy.',
                    'Performance is 15 seconds in HeadlessChrome with the visible tab and development server on this Windows device. No packaged, cold-start, sustained-memory or model-latency acceptance.'],
    'remaining': ['Continuous resident travel and expanded distinct residents and original places.',
                  'Real-model decision validation from three to twelve residents and an event-sourced solvable case.',
                  'Windows package, source-bound novel bridge and original candidate chapters.',
                  'Human art and play review and longer target-device testing.'],
    'references': [ref(path) for path in evidence] + [ref(ROOT / path) for path in sources], 'recorderSha256': sha(Path(__file__))}
P.mkdir(parents=True, exist_ok=True)
(P / 'review.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'status': summary['status'], 'references': len(summary['references']), 'frames': perf['frames'], 'p95Ms': perf['p95Ms'], 'goalComplete': False}))
