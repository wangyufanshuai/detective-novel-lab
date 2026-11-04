"""Bind actual browser observations to the current preview sources."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/playwright'
PILOT = ROOT / 'docs/3d-town/classic-motion-v2/step-15'

def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

def read(file):
    return json.loads(file.read_text(encoding='utf-8'))

def result(name):
    file = OUT / name
    text = file.read_text(encoding='utf-8-sig')
    data = json.JSONDecoder().raw_decode(text.split('### Result', 1)[1].lstrip())[0]
    file.with_suffix('.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return data, file.with_suffix('.json')

sources = read(OUT / 'classic-motion15-final-sources.json')
for name, digest in sources.items():
    assert sha(ROOT / name) == digest, name
files, actors, work = [], [], []
for actor in ['resident-03', 'resident-06', 'resident-08']:
    data, file = result(f'classic-motion15-{actor}-final-capture.log')
    assert data['actorId'] == actor and data['completed'] and not data['errors']
    assert all(not row['alert'] for row in data['rows'])
    assert data['viewport'] == {'width': 1920, 'height': 1080}
    files.append(file)
    actors.append({'actorId': actor, 'completeRoundTrip': True, 'samples': len(data['rows']),
                   'elapsedMs': data['elapsedMs'], 'maximumObservedLiftMeters': max(r['grounding']['appliedLift'] for r in data['rows']),
                   'capturedStages': data['shots'], 'record': file.relative_to(ROOT).as_posix()})
    data, file = result(f'classic-motion15-{actor}-work.log')
    assert data['passed'] and not any(data['alerts'])
    during = data['during']['work']
    prop_error = abs(during.get('propTime', during['time']) - during['time'])
    assert prop_error < .00001
    files.append(file)
    work.append({'actorId': actor, 'completedAndRestored': data['passed'], 'propClockErrorSeconds': prop_error,
                 'record': file.relative_to(ROOT).as_posix()})
performance = []
for view in ['inn', 'overview']:
    data, file = result(f'classic-motion15-{view}-performance.log')
    assert data['frames'] > 600 and data['visibility'] == 'visible' and data['viewport'] == {'width': 1920, 'height': 1080}
    performance.append({'view': view, **data}); files.append(file)
smoke, smoke_file = result('classic-motion15-controls.log')
assert smoke['passed']
files.append(smoke_file)
legacy, legacy_file = result('classic-motion15-legacy.log')
assert legacy['passed']
files.append(legacy_file)
for file in files:
    sources[file.relative_to(ROOT).as_posix()] = sha(file)
sources['docs/3d-town/classic-motion-v2/step-15/preview-playback-diagnostic.json'] = sha(PILOT / 'preview-playback-diagnostic.json')
remaining = [
    'Author curved walking or planted route-corner turns; current route headings can change too quickly despite continuous positions.',
    'Refine the innkeeper cape silhouette and shoulder drape in Blender, then repeat source and runtime art checks.',
    'Adjust the station observation camera to avoid the ticket-window beam across the face and hands.',
    'Verify complete blended garment/prop/room contact and horizontal foot planting; sampled sole lift is not full collision or IK acceptance.'
]
report = {'schema': 'classic-browser-motion-review.v1', 'recordedAt': datetime.now(timezone.utc).isoformat(),
          'loaded': True, 'route': '/town-play/motion-sample', 'worldBound': False,
          'actors': actors, 'workActions': work, 'controls': smoke, 'legacyArtSample': legacy,
          'performance': performance, 'consoleErrorsObserved': 0,
          'consoleWarnings': ['One ANGLE shader floating-point precision warning; no observed WebGL context loss.'],
          'typecheck': {'passed': True, 'config': 'output/playwright/classic-motion15-tsconfig.json', 'scope': 'Changed preview page and its imports'},
          'sourceHashes': sources, 'remaining': remaining, 'artApproved': False, 'humanApproved': False,
          'targetDevicePerformanceAccepted': False, 'packagedWindowsTested': False, 'goalComplete': False,
          'scope': 'Actual local Chromium with RTX 4060 Laptop GPU at 1920x1080. Three completed authored round trips and work actions, UI control checks and a legacy art-sample smoke. Full playback was sampled through diagnostics and selected screenshots; not a claim of continuous human viewing, autonomous simulation, physical contact acceptance or finished art.'}
(PILOT / 'browser-review.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'loaded': True, 'actors': len(actors), 'workActions': len(work), 'frames': [r['frames'] for r in performance], 'remaining': remaining}, ensure_ascii=False))
