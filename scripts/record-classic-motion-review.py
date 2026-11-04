"""Record this movement candidate without promoting failed mesh art gates."""
from pathlib import Path
import datetime,hashlib,json
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/3d-town/classic-motion-v1'
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def relative(p):return p.relative_to(ROOT).as_posix()
def cli_result(name):
 text=(ROOT/'output/playwright'/name).read_text(encoding='utf-8-sig')
 assert text.startswith('### Result\n'),name
 return json.JSONDecoder().raw_decode(text.split('### Result\n',1)[1])[0]
def check_sources(report):
 for file,identity in report.get('sources',{}).items():assert sha(ROOT/file)==identity,file
def latest_check(log):
 entry=json.loads((ROOT/'output/classic-motion-v1'/log).read_text(encoding='utf-8-sig').strip().splitlines()[-1])
 assert entry['passed'];path=Path(entry['report']);report=read(path);assert report['passed'];check_sources(report)
 return {'report':relative(path),'sha256':sha(path),'checks':report['checks']}
routes=read(P/'routes.json');assert routes['passed'] and len(routes['routes'])==42;check_sources(routes)
mesh=read(P/'mesh-diagnostic.json');assert mesh['routesSha256']==sha(P/'routes.json') and mesh['inspectorSha256']==sha(ROOT/'scripts/inspect-classic-motion-meshes.py')
for path,identity in mesh['sourceHashes'].items():assert sha(ROOT/path)==identity
renders=P/'visitor-review-02/render-review.json';render=read(renders)
assert render['complete'] and len(render['renders'])==9 and render['sourceSha256']==sha(renders.parent/'visitor.blend')
assert render['scriptSha256']==sha(ROOT/'scripts/render-classic-visitor.py')
for frame in render['renders']:assert sha(renders.parent/frame['path'])==frame['sha256']
browser=cli_result('classic-motion-audit.log');assert browser['passed'] and not browser['errors']
typecheck=read(ROOT/'output/classic-motion-v1/typecheck-current-receipt.json');assert typecheck['exitCode']==0;check_sources(typecheck)
sources=['app/town-play/art-sample/ClassicScene.tsx','app/town-play/living/LivingTown.tsx','app/town-play/art-sample/living-motion.ts',
 'app/town-play/art-sample/living-presentation.ts','app/town-play/art-sample/motion-clearance.ts','app/town-play/art-sample/sample-navigation.ts',
 'app/town-play/art-sample/sample-character.ts','app/town-play/useTownWorld.ts','lib/world/town-exploration-store.ts','lib/town-play-contract.ts',
 'packages/engine/src/town/observed-passages.ts','packages/engine/src/town/daily-routine.ts','lib/classic-living-contract.ts',
 'public/assets/classic-occupations/v2/manifest.json','public/assets/classic-occupations/v2/cast.json',
 'scripts/check-classic-motion-routes.mjs','scripts/run-classic-motion-checks.mjs','scripts/inspect-classic-motion-meshes.py',
 'scripts/bake-classic-clearance.py','scripts/render-classic-visitor.py','scripts/record-classic-motion-review.py',
 'output/playwright/classic-motion-arrival.js','output/playwright/classic-motion-guests.js']
contacts=[{'passage':r['passage'],'sampleCount':r['samples'],'contactSamples':len(r['contacts']),
           'objects':sorted({o for frame in r['contacts'] for o in frame['objects']})}for r in mesh['rows'] if r['contacts']]
prior_path=P/'diagnostic-02/mesh-diagnostic.json';prior=read(prior_path)
assert prior['inspectorSha256']==mesh['inspectorSha256'] and prior['sourceHashes']==mesh['sourceHashes']
assert sorted(r['passage']['id']for r in prior['rows'])==sorted(r['passage']['id']for r in mesh['rows'])
stance=[min(s['minimumSoleGap'].values()) for r in mesh['rows'] for s in r['soleSamples'] if all(v is not None for v in s['minimumSoleGap'].values())]
report={'schema':'classic-motion-review.v1','recordedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'status':'functional-candidate-art-review-incomplete','goalComplete':False,'humanApproved':False,
 'sources':{p:sha(ROOT/p)for p in sources},'worldChecks':latest_check('motion-engine-current.log'),
 'livingChecks':latest_check('living-checks-current.log'),'typecheck':{'path':'output/classic-motion-v1/typecheck-current-receipt.json','sha256':sha(ROOT/'output/classic-motion-v1/typecheck-current-receipt.json')},
 'function':{'routeCount':42,'controllerRoutesPassed':True,'routesSha256':sha(P/'routes.json'),
 'scope':'Source-bound static geometry, occupied-room body checks handled separately; no live model decision claim.'},
 'form':{'passed':False,'meshDiagnosticSha256':sha(P/'mesh-diagnostic.json'),'routesWithMeshContacts':contacts,
 'sameInspectorAndAssetComparison':{'priorReport':relative(prior_path),'priorReportSha256':sha(prior_path),'priorContactRoutes':sum(bool(r['contacts'])for r in prior['rows']),'currentContactRoutes':len(contacts)},
 'minimumSampledSoleGap':min(stance),'maximumSampledStanceGap':max(stance),'renderReviewSha256':sha(renders),
 'viewedRenders':[r['path']for r in render['renders']],
 'visualFindings':['Production view preserves room composition and visitor placement.','SE corner and low entry have strong doorway occlusion.','NW/NE corner and opposite ceiling view have foreground resident occlusion.','Workplace departure/arrival needs an authored retreat and turn with verified body clearance.']},
 'browser':{'passed':True,'path':'output/playwright/classic-motion-audit.log','sha256':sha(ROOT/'output/playwright/classic-motion-audit.log'),
 'observedEvents':browser['events'],'finalTime':browser['final']['world']['time'],'restoredTime':browser['restored']['world']['time'],'postCount':browser['posts']},
 'performance':{'status':'not-accepted-for-current-source','reason':'Resolve motion Form failures before isolated browser/device performance acceptance.'},
 'groundPrototype':{'promotedToRuntime':False,'reason':'Point rays can fall into threshold joints while soles have support. Direct sampled root height also produced 4 cm frame changes; retain a diagnostic prototype until gait-aware support is reviewed.'},
 'priorFailureNotes':['One earlier UI save returned HTTP 500; its exact pending action succeeded through the retry button. A separate 132-command afternoon reproduction passed. The original transient cause is unresolved.',
 'Initial visitor QA timed out because the player was blocking the visitor. Actual stepping aside completed the visit without another command.',
 'visitor-review-01 stopped after misplaced detached workstation props were seen. visitor-review-02 evaluates linked transforms before detaching; all nine views were rendered and inspected.'],
 'next':['Rearrange clearance behind workstations, starting with the bookshop parcel shelf and the station counter.','Author and review retreat/turn/approach phases in background Blender.','Rerun source mesh and sole support checks at the accepted poses, then actual browser and target-device performance.']}
(P/'review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':report['status'],'routes':42,'meshContactRoutes':len(contacts),'browserPassed':True,'goalComplete':False}),flush=True)
