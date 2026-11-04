"""Bind the three-room candidate to actual source, export and browser evidence."""
from pathlib import Path
import hashlib,json,time
ROOT=Path(__file__).resolve().parents[1];PACKAGE=ROOT/'docs/3d-town/classic-station-v1';PUBLIC=ROOT/'public/assets/classic-station/v1';BASE=ROOT/'docs/3d-town/classic-railway-v2';QA=ROOT/'output/playwright'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def result(name):return json.JSONDecoder().raw_decode((PACKAGE/name).read_text(encoding='utf-8').split('### Result',1)[1].lstrip())[0]
def record(p):return {'path':str(p.relative_to(ROOT)).replace('\\','/'),'sha256':sha(p),'bytes':p.stat().st_size}

def main():
    source=sha(PACKAGE/'classic-station.blend');asset=sha(PUBLIC/'classic-street.glb')
    author=read(PACKAGE/'authoring-receipt.json');renders=read(PACKAGE/'render-receipt.json');fn=read(PACKAGE/'function-review.json');form=read(PACKAGE/'form-review.json');manifest=read(PUBLIC/'manifest.json');opt=read(PACKAGE/'runtime/optimization.json')
    assert source==author['source']['sha256']==renders['sourceSha256']==fn['sourceSha256']==form['sourceSha256']==manifest['sourceSha256']
    assert asset==manifest['asset']['sha256']==opt['finalSha256']
    assert renders['complete'] and fn['passed'] and form['candidatePreviewEligible']
    assert fn['stage']=='function-candidate'
    for item in author['inputs']:assert sha(ROOT/item['path'])==item['sha256'],item['path']
    for item in renders['renders']:assert sha(PACKAGE/item['path'])==item['sha256'],item['path']
    for file,identity in manifest['proofs'].items():assert sha(PACKAGE/file)==identity,file
    assert sha(PUBLIC/'navigation.json')==manifest['navigation']['sha256']
    provenance=read(BASE/'licensed/provenance.json');assert sha(BASE/'licensed/provenance.json')==manifest['materialProvenanceSha256']
    for item in provenance['assets']:
        for m in item.get('maps',{}).values():assert sha(BASE/m['path'])==m['sha256']
        if 'path' in item:assert sha(BASE/item['path'])==item['sha256']
    for file in ('CREDITS.md','font-OFL.txt'):assert sha(PUBLIC/file)==sha(BASE/'licensed'/file)
    flows={name:result('browser-'+name+'.log') for name in ('walk','room-switch','tour','return-to-station')}
    for name,r in flows.items():
        assert r['passed'] and r['after']['assetSha256']==asset and r['after']['sourceSha256']==source,name
    assert not flows['walk']['browserErrors'] and not flows['tour']['browserErrors'] and not flows['tour']['worldApiRequests']
    performance={name:result('performance-'+name+'.log') for name in ('inn','bookshop','station','overview')}
    for name,r in performance.items():
        assert r['assetSha256']==asset and r['sourceSha256']==source
        assert r['viewport']=={'width':1920,'height':1080} and r['deviceScaleFactor']==1
        assert r['roomId']==('' if name=='overview' else name)
        assert 14500<r['measuredMs']<16000 and len(r['frameMs'])==r['frames']
    compiler=read(PACKAGE/'typecheck-result.json');assert compiler['exitCode']==0 and sha(PACKAGE/'typecheck.log')==compiler['logSha256']
    for item in compiler['inputs']:assert sha(ROOT/item['path'])==item['sha256'],item['path']
    material=read(PACKAGE/'runtime/material-check.json');assert material['passed'] and material['assetSha256']==asset
    video=read(PACKAGE/'video-inspection.json');assert any(s['codec_name']=='h264' and s['width']==1280 and s['height']==720 for s in video['streams'])
    assert int(video['format']['size'])==(QA/'classic-station-tour.mp4').stat().st_size
    memory=read(PACKAGE/'browser-windows-memory.json');assert memory['measuredProcesses']==memory['reportedProcesses']
    runtime={'schema':'classic-station-runtime-review.v1','createdAtUnix':time.time(),'sourceSha256':source,'assetSha256':asset,'manifestSha256':sha(PUBLIC/'manifest.json'),'flows':flows,'performance':performance,'windowsMemorySnapshot':memory,'typecheck':compiler,'humanRuntimeApproved':False,'reviewerScriptSha256':sha(Path(__file__))}
    write(PACKAGE/'runtime-review.json',runtime)
    protected=[('docs/3d-town/classic-railway-v1/classic-railway.blend','52d1ddda0adea7b1fb9af2aea99beb6a182f4ffa83357b718943a5b4de66876b'),('public/assets/classic-railway/v1/classic-railway.glb','c08f6e837c57aff35cba0f6dc0697699f099c7c5b425a891d16bac601e7e9c13'),('docs/3d-town/classic-railway-v2/classic-railway.blend','0032d8201d58393302d7f2928d63cc5dacbb43fc994988be36166f21772b0495'),('public/assets/classic-railway/v2/classic-railway.glb','a107c65a7939a3d97e91639a48ab206de80bde33e2b272e6975efb2a758575e1'),('docs/3d-town/riverbend-v1/riverbend-town.blend','cf3124649d1f11e6990e198cf063b3236d2974cf8b79d5ba18307d5ed31c4551'),('public/assets/riverbend/v1/town.glb','763d45d4c549d51e96953ffc099950dd2511d31c1567d9bf9686ee6e687acbc3'),('docs/3d-town/classic-investigator-v1/classic-investigator.blend','655652dfd1003ef4114f7fbe15f5e104a3cfc6213d88883e301d3c2461bdffd8'),('public/assets/classic-investigator/v1/investigator.glb','df916077fcc65e446da2e985947890b8299897d93f692297b0a431786ad25853')]
    protected += [('docs/3d-town/classic-bookshop-v1/classic-bookshop.blend','c5fa8589dd996f94d7593093b0e55b2b4a6d45909aa3986f753ac72c818ee3c8'),('public/assets/classic-bookshop/v1/classic-street.glb','07a5affd09090ce6f50e4a6c03d989ad5906d64b64210b98c87691eb3b6a6c6b')]
    for path,identity in protected:assert sha(ROOT/path)==identity,path
    artifacts=[record(p) for p in sorted(QA.glob('classic-station-*.png'))]+[record(QA/'classic-station-tour.mp4'),record(QA/'classic-station-tour.webm')]
    inputs=[record(p) for p in sorted((ROOT/'app/town-play/art-sample').glob('*')) if p.is_file()]+[record(PUBLIC/'manifest.json'),record(PUBLIC/'navigation.json'),record(ROOT/'public/assets/classic-investigator/v1/manifest.json')]
    report={'schema':'classic-station-delivery.v1','createdAtUnix':time.time(),'status':'local-three-room-art-and-navigation-candidate','url':'http://127.0.0.1:3187/town-play/art-sample','sourceSha256':source,'asset':manifest['asset'],'characterCompanion':read(ROOT/'public/assets/classic-investigator/v1/manifest.json')['asset'],'geometry':{'sceneAssetTriangles':fn['evaluatedTriangles'],'renderViews':len(renders['renders']),'authoredStation':read(PACKAGE/'placements.json'),'textureBytesWithMipmapsEstimate':opt['estimatedRgbaTextureBytesWithMipmaps']},'localCandidateChecks':{'actualBackgroundBlenderRenders':True,'selectedFunctionRoutes':fn['passed'],'sampledMeshRouteClearance':fn['meshRouteClearance']['passed'],'selectedSupports':all(s['passed'] for s in fn['measuredSupports']),'materialTexturesAndTintsSurvivedExport':material['passed'],'actualKeyboardAndRoomSwitches':True,'noWorldApiRequestsDuringTour':not flows['tour']['worldApiRequests'],'typecheck':True},'performance':{name:{k:v for k,v in r.items() if k not in ('frameMs','character')} for name,r in performance.items()},'windowsMemorySnapshot':memory,'video':video,'artifacts':artifacts,'runtimeInputs':inputs,'qaScripts':[record(p) for p in sorted(QA.glob('classic-station-*.js'))],'preservedOriginals':[{'path':p,'sha256':s} for p,s in protected],'humanArtApproved':False,'formalProductionApproved':False,'formalSkillReports':['formal-skill-function.log','formal-skill-form.log','formal-skill-runtime.log'],'limitations':['A local art/navigation sample, not the complete Agent world, emergent case loop, novel workbench or Windows package.','Four warm, stationary, 15-second headless Chrome windows on this Windows device are not a full-game or long-session performance acceptance. Frame timestamps are not independent GPU timer queries.','The Windows memory snapshot includes this QA browser process set; summed working sets can double-count shared pages and private commit is not VRAM.','The declared 1.2 m circulation target is not certified across every secondary aisle. Function proves only the recorded conservative player-capsule routes, selected mesh samples and eleven support pairs; station aisle sections are recorded separately.','Lighting uses separate runtime artistic calibration; no baked-lightmap or Cycles-equivalence claim.','Repeated shelf and suitcase styling, simplified decorative ticket objects, character face/cloth detail and surrounding inhabited street context still need further art work.','A cold-visit D3D shader constant-folding precision warning remains recorded. It was not a page runtime exception.','Human Function/Form/Runtime review and the formal production-package schema remain incomplete. User authorization permits this narrower autonomous candidate work.']}
    report['geometry']['measuredStationAisleSections']=fn['measuredAisleSections']
    report['warmFrameBudget']={'targetMs':16.7,'allWindowsP95WithinTarget':all(r['p95Ms']<=16.7 for r in performance.values()),'allFramesWithinTarget':all(r['over16_7']==0 for r in performance.values()),'framesAboveTarget':sum(r['over16_7'] for r in performance.values()),'scope':'Four warm stationary 15-second samples only. Retains every observed outlier; not a claim of complete-game stability.'}
    overview=performance['overview']
    report['limitations'].append(f"The overview sample contains {overview['over16_7']} frame(s) above 16.7 ms, with a maximum of {overview['maxMs']:.1f} ms. Its raw frame log is retained; the sample is not described as completely stutter-free.")
    report['evidenceFiles']=[record(PACKAGE/f) for f in ('browser-console.log','function-review.json','form-review.json','runtime-review.json','typecheck-result.json','video-inspection.json')]
    write(PACKAGE/'final-report.json',report)
    direction_path=ROOT/'docs/vision/classic-detection-2026-10-08/direction.json';direction=read(direction_path)
    direction['status']='three-connected-interior-runtime-candidate-art-acceptance-pending'
    direction['runtimeSample'].update(package='../../3d-town/classic-station-v1/README.zh-CN.md',sourceSha256=source,assetSha256=asset,scope='Original railway inn, antiquarian bookshop and connected station with real openings, room-specific cutaways, original furniture, skinned investigator and local observation notebook; no Agent/case binding.')
    write(direction_path,direction)
    print(json.dumps({'sourceSha256':source,'assetSha256':asset,'bytes':manifest['asset']['bytes'],'triangles':fn['evaluatedTriangles'],'performance':{name:{k:r[k] for k in ('frames','p95Ms','maxMs','over16_7')} for name,r in performance.items()},'humanArtApproved':False}))

if __name__=='__main__':main()
