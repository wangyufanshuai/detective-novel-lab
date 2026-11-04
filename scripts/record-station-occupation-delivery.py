"""Bind this candidate's actual Blender, browser and device evidence."""
from pathlib import Path
import hashlib,json,datetime
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/3d-town/classic-occupations-v1';F=P/'resident-06/gesture-09'
PUBLIC=ROOT/'public/assets/classic-occupations/v1';LOG=ROOT/'output/playwright'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def ref(p):return {'path':p.relative_to(ROOT).as_posix(),'sha256':sha(p)}
def result(name):
    path=LOG/(name+'.log');text=path.read_text(encoding='utf-8');assert '### Result' in text and '### Error' not in text,name
    return json.JSONDecoder().raw_decode(text.split('### Result',1)[1].lstrip())[0]
flow=result('station-occupation-flow-final');perf=result('station-occupation-performance-final');baseline=result('station-occupation-baseline')
assert flow['passed'] and not flow['errors'] and baseline['passed'] and not baseline['browserErrors'] and not baseline['apiRequests']
actor=read(PUBLIC/'resident-06.json');scene=read(PUBLIC/'manifest.json');cast=read(PUBLIC/'cast.json')
assert sha(ROOT/('public'+scene['residentCast']['url']))==scene['residentCast']['sha256']
for e in cast['entries']:assert sha(ROOT/('public'+e['manifestUrl']))==e['manifestSha256']
for a in (actor['asset'],actor['workAction']['workstation']):assert sha(ROOT/('public'+a['url']))==a['sha256']
for key in ('working','looped','interrupted','restarted','restored'):
    clerk=next(r for r in flow[key]['residents'] if r['actorId']=='resident-06')
    assert clerk['assetSha256']==actor['asset']['sha256'] and clerk['sourceSha256']==actor['sourceSha256']
assert next(r for r in perf['residents'] if r['actorId']=='resident-06')['assetSha256']==actor['asset']['sha256']
assert perf['focusActorId']=='resident-06' and perf['viewport']=={'width':1920,'height':1080}
assert perf['frames']>=600 and 14900<perf['measuredMs']<15400
fn=read(F/'function-review.json');form=read(F/'form-review.json');renders=read(F/'render-review-02.json');raw=read(F/'raw-export.json');runtime=read(F/'runtime-export.json')
assert all(r['sourceSha256']==sha(F/'occupation.blend') for r in (fn,form,renders,raw,runtime))
assert fn['passed'] and form['passed'] and renders['complete'] and len(renders['renders'])==14
assert form['functionReviewSha256']==sha(F/'function-review.json')
for r in renders['renders']:assert sha(F/r['path'])==r['sha256']
assert raw['exporterSha256']==sha(ROOT/'scripts/export-station-occupation.py')
assert raw['maximumIdleWalkLegMatrixDifference']<1e-6
nav=read(P/'navigation-review.json');assert nav['passed'] and nav['castSha256']==sha(PUBLIC/'cast.json')
typecheck=read(ROOT/'output/classic-occupations-v1/typecheck-receipt.json');assert typecheck['passed']
for item in typecheck['files']:assert sha(ROOT/item['path'])==item['sha256']
engine=read(ROOT/'output/classic-occupations-v1/living-checks-final.log');assert engine['passed'] and engine['checks']==7
evidence=[F/'occupation.blend',F/'authoring-review.json',F/'function-review.json',F/'form-review.json',F/'render-review-02.json',F/'raw-export.json',F/'runtime-export.json',
          P/'navigation-review.json',PUBLIC/'manifest.json',PUBLIC/'cast.json',PUBLIC/'resident-06.json',PUBLIC/'resident-06.glb',PUBLIC/'workstation.glb',PUBLIC/'LICENSE.ASSETS.md',
          LOG/'station-occupation-arrival-current.log',LOG/'station-occupation-flow-final.log',LOG/'station-occupation-performance-final.log',LOG/'station-occupation-baseline.log',
          LOG/'station-occupation-working.png',LOG/'station-occupation-interrupted.png',ROOT/engine['report'],ROOT/'output/classic-occupations-v1/typecheck-receipt.json']
sources=['app/town-play/art-sample/ClassicScene.tsx','app/town-play/art-sample/sample-character.ts','app/town-play/living/LivingTown.tsx',
         'scripts/build-blender-occupations.py','scripts/retain-station-locomotion.py','scripts/render-station-occupation.py','scripts/review-station-occupation.py',
         'scripts/export-station-occupation.py','scripts/optimize-station-occupation.ps1','scripts/record-station-occupation-export.py','scripts/check-station-occupation-navigation.mjs',
         'output/playwright/station-occupation-flow.js','output/playwright/station-occupation-performance.js','output/playwright/station-occupation-baseline.js']
summary={'schema':'classic-station-occupation-delivery.v1','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status':'local-candidate-verified','goalComplete':False,'humanArtApproved':False,'formalPluginProductionApproved':False,
    'station':{'sourceSha256':actor['sourceSha256'],'bodyAsset':actor['asset'],'workplaceAsset':actor['workAction']['workstation'],
               'clip':'VerifyTimetable','durationSeconds':10,'workplaceTriangles':1716,
               'sampledFrames':len(form['frames']),'sampleHz':form['sampleHz'],'intersectionMaxima':form['maxima'],
               'maximumJacketEdgeStretchRatio':form['jacketEdgeStretchMaximum'],'loopPoseDifference':form['loopPoseMaximumDifference'],
               'functionSampledPositions':fn['sampledPositions'],'renders':14},
    'browser':{'flowPassed':True,'workingTime':flow['working']['world']['time'],'interruptedTime':flow['interrupted']['world']['time'],
               'restartedTime':flow['restarted']['world']['time'],'restoredTime':flow['restored']['world']['time'],
               'noAnimationWorldCommands':True,'baselineChecks':baseline['checks'],'pageErrors':[]},
    'performance':{k:v for k,v in perf.items() if k not in ('frameMs','character','residents')},
    'typescriptPassed':True,'livingBindingChecks':7,
    'visualReview':{'reviewer':'Codex','inspectedBlenderViews':[r['view'] for r in renders['renders']],
        'notes':['All 14 final Cycles views inspected, including corrected reflected ceiling view.',
                 'Raised runtime observation camera clears ticket-machine obstruction while keeping furniture visible.',
                 'Printed grid is original decorative art, not a live timetable or case evidence.']},
    'inn':{'candidate':'resident-08/grip-study-04','runtimeExported':False,'reason':'Thumb still intersects pen; blouse sleeves need rebinding; pickup and return not completed.'},
    'remaining':['Inn clothing, tripod grip, supported pen pickup/write/return and its ordered room/runtime review.',
                 'Continuous resident locomotion, expanded original places and distinct residents.',
                 'Real model 3-to-12 decision validation, sourced emergent case, Windows package and novel fact bridge remain open.',
                 'Human art and play review, cold start, packaged build, sustained memory and broader target-device acceptance remain open.'],
    'scope':'Current Windows browser candidate, deterministic work-state presentation; no new real-model or production-release claim.',
    'references':[ref(p) for p in evidence]+[ref(ROOT/p) for p in sources],'recorderSha256':sha(Path(__file__))}
(P/'review.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':summary['status'],'references':len(summary['references']),'frames':perf['frames'],'p95Ms':perf['p95Ms'],'goalComplete':False}))
