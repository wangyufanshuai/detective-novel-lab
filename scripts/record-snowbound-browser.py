"""Bind actual CLI browser observations to the current sample and its source.

The browser actions are performed with Playwright CLI. This script records
those observations; it does not emulate a browser or declare human approval.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib,json,subprocess
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/3d-town/snowbound-manor-v1';O=ROOT/'public/assets/snowbound-manor/v1';Q=ROOT/'output/playwright'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
manifest=read(O/'manifest.json');source=sha(P/'snowbound-manor.blend')
assert source==manifest['sourceSha256']
for name,asset in manifest['tiers'].items():assert sha(ROOT/'public'/asset['url'].lstrip('/'))==asset['sha256']
assert sha(O/'navigation.json')==manifest['navigation']['sha256']
assert sha(ROOT/'scripts/export-snowbound-manor.py')==manifest['exporterSha256']
assert sha(ROOT/'scripts/optimize-snowbound-manor.py')==manifest['optimizerSha256']
assert sha(ROOT/'scripts/record-snowbound-runtime.py')==manifest['validationSha256']
entry=read(Q/'snowbound-entry-register.json');note=read(Q/'snowbound-note.json');quality=read(Q/'snowbound-quality-switch.json');collision=read(Q/'snowbound-collision.json')
assert entry['start']==[0,-7.8] and 1<entry['entered'][1]<2.5 and entry['inspect']
assert note['before']==note['after'] and note['dialog'] and note['focusedInside']
assert quality['before']==quality['after'] and quality['assetSha']==manifest['tiers']['balanced']['sha256']
assert 6.1<collision['position'][1]<6.26 and collision['teaPrompt']
measurements=[]
for filename in ['snowbound-high-performance.json','snowbound-balanced-performance.json','snowbound-gate-performance.json']:
    item=read(Q/filename);assert item['sourceSha']==source
    assert item['assetSha']==manifest['tiers'][item['metrics']['quality']]['sha256']
    assert item['metrics']['sampledFrames']==600 and item['metrics']['p95FrameMs']>0
    item['observed60HzFrameBudgetMet']=item['metrics']['p95FrameMs']<=1000/60
    measurements.append(item)
command=['D:/nvm/v24.14.0/node.exe','node_modules/typescript/bin/tsc','--project','docs/3d-town/snowbound-manor-v1/runtime/tsconfig.json','--noEmit','--pretty','false']
check=subprocess.run(command,cwd=ROOT,capture_output=True,text=True,encoding='utf-8')
(P/'runtime/typecheck.log').write_text(check.stdout+check.stderr,encoding='utf-8');assert check.returncode==0,check.stdout
files=[*sorted((ROOT/'app/snowbound-manor').glob('*')),ROOT/'app/town-play/art-sample/sample-navigation.ts',O/'manifest.json',O/'navigation.json',ROOT/'scripts/export-snowbound-manor.py',ROOT/'scripts/optimize-snowbound-manor.py',ROOT/'scripts/record-snowbound-runtime.py']
shots=['snowbound-manor-gate-final.png','snowbound-manor-hall-final.png','snowbound-manor-narrow-final.png','snowbound-manor-register.png','snowbound-manor-walk-entry.png','snowbound-manor-balanced-final.png']
assert all((Q/name).is_file() for name in shots)
console=(Q/'snowbound-console-final.log').read_text(encoding='utf-8-sig')
assert 'Errors: 0, Warnings: 0' in console
report={'schema':'snowbound-browser-review.v1','recordedAt':datetime.now(timezone.utc).isoformat(),
 'status':'local-browser-candidate-checked','url':'http://127.0.0.1:3187/snowbound-manor','sourceSha256':source,
 'manifestSha256':sha(O/'manifest.json'),'humanArtApproved':False,'agentWorldBound':False,'caseOrSaveWrites':False,
 'checks':{'keyboardEntry':entry,'registerNoteAndPause':note,'qualityKeepsPosition':quality,'tableCollision':collision,
           'scopedTypecheck':{'exitCode':check.returncode,'configuration':'runtime/tsconfig.json','log':'runtime/typecheck.log'},
           'finalConsole':{'errors':0,'warnings':0,'evidence':'output/playwright/snowbound-console-final.log'}},
 'performance':{'scope':'Current Windows computer, visible Chromium, local Next development server. Short rolling frame samples; not an installation-package or cross-device benchmark.',
                'measurements':measurements,'realMobileDeviceTested':False,'windowsPackagedBuildTested':False},
 'visualReview':{'reviewer':'assistant inspection of actual browser screenshots','humanApproved':False,
  'observations':['Exterior and main hall load from the reviewed native model. Warm windows, furniture textures, panels and the rug remain visible.',
                  'Initial overbright lighting and chandelier silhouette shadows were corrected. Window panes use a documented transparent approximation.',
                  'A narrow viewport was inspected for layout only; it does not establish mobile-device performance.'],
  'openIssues':['Fire remains simplified flame sheets.','Runtime indirect lighting differs from Cycles; no baked lightmap parity.',
                'Only exterior and hall are furnished. Visible playable character and Agent simulation are not connected.',
                'Both tiers retain 1.12 million triangles and 26-28 MB transfer size; further geometric LOD and instancing remain desirable.']},
 'previousFailuresCorrected':['Npm stderr notices interrupted the first PowerShell optimizer; Python subprocess execution now captures notices without misclassifying success.',
                              'Interaction prompts were absent because derived room bindings were missing; recording now binds and checks hall observation positions.',
                              'The first balanced render lacked multisample anti-aliasing; the corrected tier uses two samples.'],
 'sourceFiles':{str(f.relative_to(ROOT)).replace('\\','/'):sha(f) for f in files if f.is_file()},
 'screenshots':[{'path':'output/playwright/'+name,'sha256':sha(Q/name)} for name in shots],
 'observations':{f.name:sha(f) for f in Q.glob('snowbound-*.json')},
 'recordScriptSha256':sha(Path(__file__)),
 'fullRepositoryTypecheck':'The initial broad check reported unrelated errors in docs/3d-town/classic-motion-v2/step-15/runtime-grounding-helper-initial.ts. The current strict route/dependency check passed; no repository-wide pass is claimed.'}
write(P/'browser-review.json',report)
print(json.dumps({'status':report['status'],'checks':len(report['checks']),'frameSamples':[{'mode':m['mode'],'quality':m['metrics']['quality'],'p95Ms':m['metrics']['p95FrameMs']} for m in measurements],'humanArtApproved':False},ensure_ascii=False),flush=True)
