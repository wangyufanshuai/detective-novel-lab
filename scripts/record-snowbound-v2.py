"""Verify and bind the delivered manor candidate to actual source and observations."""
from pathlib import Path
from datetime import datetime,timezone
import json,hashlib,subprocess
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/3d-town/snowbound-manor-v2';BASE=ROOT/'docs/3d-town/snowbound-manor-v1'
O=ROOT/'public/assets/snowbound-manor/v2';Q=ROOT/'output/playwright'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def observation(name):
    text=(Q/name).read_text(encoding='utf-8-sig');assert '### Error' not in text,name
    result=text.split('### Result',1)[1].split('### Ran Playwright code',1)[0].strip();return json.loads(result)

source=sha(P/'snowbound-manor.blend');author=read(P/'authoring-receipt.json');manifest=read(O/'manifest.json');raw=read(P/'runtime/raw-export.json')
assert source==author['source']['sha256']==manifest['sourceSha256']==raw['sourceSha256']
assert sha(BASE/'snowbound-manor.blend')==author['parentSource']['sha256']
assert sha(ROOT/'scripts/refine-snowbound-manor.py')==author['generatorSha256']
assert sha(ROOT/'scripts/build-snowbound-manor.py')==author['helperSha256']
for script,key in [('export-snowbound-manor-v2.py','exporterSha256'),('optimize-snowbound-manor-v2.py','optimizerSha256'),('record-snowbound-runtime-v2.py','validationSha256')]:
    assert sha(ROOT/'scripts'/script)==manifest[key]
assert sha(ROOT/'scripts/bake-manor-indirect.py')==raw['lightmap']['generatorSha256']
assert sha(ROOT/'scripts/author-manor-fire.py')==raw['fire']['generatorSha256']
assert sha(ROOT/'scripts/denoise-manor-lightmap.py')==manifest['lightmap']['denoise']['generatorSha256']
for name,hashvalue in raw['proofs'].items():assert sha(P/name)==hashvalue,name
for name in ['function-review.json','contact-review.json','form-review.json']:assert read(P/name)['sourceSha256']==source
assert read(P/'function-review.json')['passedAutomatedSubset'] and read(P/'contact-review.json')['passed']
images=[]
for filename in ['renders/render-receipt.json','plans/render-receipt.json']:
    record=read(P/filename);assert record['sourceSha256']==source
    for item in record['renders']:assert sha(P/item['path'])==item['sha256'];images.append(item['path'])
for asset in [*manifest['tiers'].values(),manifest['navigation'],manifest['lightmap'],manifest['fire']]:
    assert sha(ROOT/'public'/asset['url'].lstrip('/'))==asset['sha256'],asset['url']
credits=read(BASE/'licensed/provenance.json');verified=[]
assert sha(BASE/'licensed/provenance.json')==author['licensedProvenance']['sha256']==manifest['thirdPartyProvenanceSha256']
for asset in credits['assets']:
    for f in asset['files']:
        actual=BASE/f['path'];assert sha(actual)==f['sha256'];verified.append(actual.relative_to(ROOT).as_posix())
shared=ROOT/'docs/3d-town/classic-railway-v2';shared_credits=read(shared/'licensed/provenance.json')
for asset in shared_credits['assets']:
    if asset['id']=='wood_table_001':
        for f in asset['maps'].values():
            actual=shared/f['path'];assert sha(actual)==f['sha256'];verified.append(actual.relative_to(ROOT).as_posix())
    elif asset['id']=='railway-serif-study':
        actual=shared/asset['path'];assert sha(actual)==asset['sha256'];verified.append(actual.relative_to(ROOT).as_posix())
        assert sha(shared/asset['licensePath'])==asset['licenseSha256']==sha(O/'font-OFL.txt')
write(P/'source-verification.json',{'allMatched':True,'files':verified,'mainLedger':{'path':(BASE/'licensed/provenance.json').relative_to(ROOT).as_posix(),'sha256':sha(BASE/'licensed/provenance.json')},'sharedLedger':{'path':(shared/'licensed/provenance.json').relative_to(ROOT).as_posix(),'sha256':sha(shared/'licensed/provenance.json')}})

entry=observation('snowbound-v2-entry-transcript.txt');interaction=observation('snowbound-v2-interaction-transcript.txt');fallback=observation('snowbound-v2-fallback-transcript.txt')
assert entry['start']==[0,-7.8] and 1<entry['entered'][1]<2.5 and entry['inspect']==1
note=interaction['note'];assert note['before']==note['after'] and note['dialog'] and note['focusedInside']
quality=interaction['quality'];assert quality['before']==quality['after'] and quality['assetSha']==manifest['tiers']['balanced']['sha256']
collision=interaction['collision'];assert 6.1<collision['position'][1]<6.26 and collision['teaPrompt']==1
assert fallback['source']==author['parentSource']['sha256'] and fallback['lightmap']=='false' and fallback['volumeFire']=='false'
assert read(Q/'snowbound-v2-network.json')['apiRequests']==[]
measurements=[]
for name in ['high','balanced','gate']:
    row=read(Q/f'snowbound-v2-{name}-performance.json')
    assert row['sourceSha']==source and row['assetSha']==manifest['tiers'][row['metrics']['quality']]['sha256']
    assert row['lightmap']==row['volumeFire']=='true' and row['metrics']['sampledFrames']==600
    row['observed60HzFrameBudgetMet']=row['metrics']['p95FrameMs']<=1000/60;measurements.append(row)
assert all(m['observed60HzFrameBudgetMet'] for m in measurements)
console=(Q/'snowbound-v2-console-final.log').read_text(encoding='utf-8-sig');assert 'Errors: 0, Warnings: 0' in console
config=read(BASE/'runtime/tsconfig.json');write(P/'runtime/tsconfig.json',config)
previous=read(P/'browser-review.json') if (P/'browser-review.json').exists() else None
typed_files=[*sorted((ROOT/'app/snowbound-manor').glob('*')),ROOT/'app/town-play/art-sample/sample-navigation.ts']
reuse=previous and previous['checks']['scopedTypecheckExitCode']==0 and all(previous['sourceFiles'].get(f.relative_to(ROOT).as_posix())==sha(f) for f in typed_files if f.is_file())
if not reuse:
    result=subprocess.run(['D:/nvm/v24.14.0/node.exe','node_modules/typescript/bin/tsc','--project',str(P/'runtime/tsconfig.json'),'--noEmit','--pretty','false'],cwd=ROOT,capture_output=True,text=True,encoding='utf-8')
    (P/'runtime/typecheck.log').write_text(result.stdout+result.stderr,encoding='utf-8');assert result.returncode==0,result.stdout
files=[*sorted((ROOT/'app/snowbound-manor').glob('*')),ROOT/'app/town-play/art-sample/sample-navigation.ts',O/'manifest.json',O/'navigation.json']
files += [ROOT/'scripts'/n for n in ['refine-snowbound-manor.py','author-manor-fire.py','review-snowbound-manor.py','review-manor-contacts.py','render-snowbound-review-plans-v2.py','export-snowbound-manor-v2.py','bake-manor-indirect.py','denoise-manor-lightmap.py','optimize-manor-lightmap.py','optimize-snowbound-manor-v2.py','record-snowbound-runtime-v2.py']]
screenshots=[]
for name in ['gate-final','hall-final','balanced-final','narrow-final','register']:
    f=Q/f'snowbound-v2-{name}.png';screenshots.append({'path':f.relative_to(ROOT).as_posix(),'sha256':sha(f)})
report={'schema':'snowbound-browser-review.v2','status':'local-browser-candidate-checked','recordedAt':datetime.now(timezone.utc).isoformat(),
        'url':'http://127.0.0.1:3187/snowbound-manor','sourceSha256':source,'manifestSha256':sha(O/'manifest.json'),
        'humanArtApproved':False,'agentWorldBound':False,'caseOrSaveWrites':False,
        'checks':{'keyboardEntry':entry,'interactions':interaction,'previousVersionFallback':fallback,'apiRequests':[],
                  'scopedTypecheckExitCode':0,'typecheckReusedForUnchangedRoute':bool(reuse),'finalConsole':{'errors':0,'warnings':0}},
        'performance':{'scope':'Current Windows/Chromium on RTX 4060 Laptop GPU, 1600x900, local development server; short rolling samples only.',
                       'measurements':measurements,'longSoakTested':False,'windowsPackagedBuildTested':False,'crossDeviceTested':False},
        'visualReview':{'reviewer':'assistant inspection of actual browser screenshots','observations':['Main hall, gate and narrow layout inspected.','Noisy light bake was denoised before default promotion. Original authored volume replaces the old flame sheets.'],
                       'limitations':['Native Cycles and browser lighting are still distinct.','Narrow viewport is a layout check, not a mobile-device measurement.','Snow and static facade/forest repetition need further art development.']},
        'sourceFiles':{f.relative_to(ROOT).as_posix():sha(f) for f in files if f.is_file()},'screenshots':screenshots,
        'observations':{f.name:sha(f) for f in Q.glob('snowbound-v2-*') if f.suffix in {'.json','.txt','.log'}},
        'fullRepositoryTypecheck':'Not claimed; earlier broad check had unrelated classic-motion-v2 BufferAttribute type errors.'}
write(P/'browser-review.json',report)
summary={'schema':'snowbound-candidate-completion.v2','status':'first-reviewable-native-and-browser-sample-complete','sourceSha256':source,
         'nativeImagesVerified':len(images),'licenseSourceFilesVerified':len(verified),'functionSubset':True,'primaryContactSubset':True,'browserSubset':True,
         'lightmapBaked':True,'volumeFireSharedDensity':True,'humanArtApproved':False,'fullFunctionGate':False,'fullFormGate':False,'fullReleaseRuntimeGate':False,
         'scope':'Snowbound manor exterior, entry and hall art sample. No Agent, residents, case engine, new side rooms or Windows package in this milestone.',
         'evidence':['authoring-receipt.json','renders/render-receipt.json','plans/render-receipt.json','function-review.json','contact-review.json','form-review.json','runtime-export.json','browser-review.json'],
         'corrections':['Ceiling mount inset corrected.','Fire field rebuilt as an original 3D density texture.','Blender bake crash resolved by saving and reopening the isolated derivative; crash logs retained.','Indirect light bake noise removed with the compositor denoiser.'],
         'remainingArtWork':['More lived-in books, stone and props.','More varied surrounding forest and storm presentation.','Human assessment of classical detective atmosphere.'],
         'futureProjectWork':['Visible character and resident Agent binding.','Case evidence, temporal state and novel-workbench links.','Side-room interiors and Windows packaging.','Long-duration and cross-device validation.'],
         'skillAdapter':'Original/CC0 candidate; generic room validator with alternate openings schema and human/Meshy fields is not claimed passed.',
         'verificationScriptSha256':sha(Path(__file__))}
write(P/'final-report.json',summary)
write(P/'package-verification.json',{'sourceSha256':source,'nativeImages':images,'verifiedLicenseFiles':verified,'browserReviewSha256':sha(P/'browser-review.json'),'finalReportSha256':sha(P/'final-report.json'),'passedCandidateScope':True,'humanApproved':False})
print(json.dumps({'status':summary['status'],'images':len(images),'licensedFiles':len(verified),'p95Ms':[m['metrics']['p95FrameMs'] for m in measurements]},ensure_ascii=False),flush=True)
