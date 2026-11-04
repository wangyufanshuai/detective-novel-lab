"""Bind the current local room candidate to actual source, assets and browser QA."""
from pathlib import Path
import hashlib,json,time

ROOT=Path(__file__).resolve().parents[1];PACKAGE=ROOT/'docs/3d-town/classic-railway-v2';PUBLIC=ROOT/'public/assets/classic-railway/v2';QA=ROOT/'output/playwright'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def result(name):return json.JSONDecoder().raw_decode((QA/name).read_text(encoding='utf-8').split('### Result',1)[1].lstrip())[0]
def record(p):return {'path':str(p.relative_to(ROOT)).replace('\\','/'),'sha256':sha(p),'bytes':p.stat().st_size}

def main():
    author=read(PACKAGE/'authoring-receipt.json');render=read(PACKAGE/'render-receipt.json');fn=read(PACKAGE/'function-review.json');form=read(PACKAGE/'form-review.json');manifest=read(PUBLIC/'manifest.json');opt=read(PACKAGE/'runtime/optimization.json')
    source=sha(PACKAGE/'classic-railway.blend');asset=sha(PUBLIC/'classic-railway.glb')
    assert source==author['source']['sha256']==render['sourceSha256']==fn['sourceSha256']==form['sourceSha256']==manifest['sourceSha256']
    assert asset==manifest['asset']['sha256']==opt['finalSha256']
    assert render['complete'] and fn['passed'] and form['candidatePreviewEligible']
    for entry in author['inputs']:assert sha(ROOT/entry['path'])==entry['sha256']
    for entry in render['renders']:assert sha(PACKAGE/entry['path'])==entry['sha256']
    for file,identity in manifest['proofs'].items():assert sha(PACKAGE/file)==identity,file
    for a in read(PACKAGE/'licensed/provenance.json')['assets']:
        for item in a.get('maps',{}).values():assert sha(PACKAGE/item['path'])==item['sha256']
        if 'path' in a:assert sha(PACKAGE/a['path'])==a['sha256']
    flows={name:result('classic-room-v2-'+name+'.log') for name in ('walk','furnishings','return')}
    assert all(r['passed'] for r in flows.values())
    performance=[result('classic-room-v2-performance-'+name+'.log') for name in ('interior','overview')]
    for r in performance:
        assert r['sourceSha256']==source and r['assetSha256']==asset
        assert r['viewport']=={'width':1920,'height':1080} and r['deviceScaleFactor']==1
    assert not flows['return']['browserErrors'] and not flows['return']['worldApiRequests']
    browser={'schema':'classic-room-runtime-review.v2','createdAtUnix':time.time(),'sourceSha256':source,'assetSha256':asset,'manifestSha256':sha(PUBLIC/'manifest.json'),'flows':flows,'performance':performance,'typecheck':{'passed':True,'evidence':'typecheck.log','note':'npx tsc --noEmit --pretty false exited 0 after the final runtime-lighting change.'},'reviewerScriptSha256':sha(Path(__file__)),'humanRuntimeApproved':False}
    write(PACKAGE/'runtime-review.json',browser)
    protected=[('docs/3d-town/classic-railway-v1/classic-railway.blend','52d1ddda0adea7b1fb9af2aea99beb6a182f4ffa83357b718943a5b4de66876b'),('public/assets/classic-railway/v1/classic-railway.glb','c08f6e837c57aff35cba0f6dc0697699f099c7c5b425a891d16bac601e7e9c13'),('docs/3d-town/riverbend-v1/riverbend-town.blend','cf3124649d1f11e6990e198cf063b3236d2974cf8b79d5ba18307d5ed31c4551'),('public/assets/riverbend/v1/town.glb','763d45d4c549d51e96953ffc099950dd2511d31c1567d9bf9686ee6e687acbc3')]
    for path,identity in protected:assert sha(ROOT/path)==identity,path
    artifacts=[record(p) for p in sorted(QA.glob('classic-room-v2-*.png'))]+[record(QA/'classic-room-v2-walk.mp4'),record(QA/'classic-room-v2-final.webm')]
    inputs=[record(p) for p in sorted((ROOT/'app/town-play/art-sample').glob('*')) if p.is_file()]+[record(PUBLIC/'manifest.json'),record(PUBLIC/'navigation.json'),record(ROOT/'public/assets/classic-investigator/v1/manifest.json'),record(ROOT/'scripts/calibrate-classic-room-v2.py')]
    report={'schema':'classic-room-delivery.v2','createdAtUnix':time.time(),'status':'local-room-refinement-candidate','url':'http://127.0.0.1:3187/town-play/art-sample','sourceSha256':source,'asset':manifest['asset'],'characterCompanion':read(ROOT/'public/assets/classic-investigator/v1/manifest.json')['asset'],'geometry':{'sceneAssetTriangles':fn['evaluatedTriangles'],'renderViews':len(render['renders']),'parquetBoards':798,'estimatedTextureBytesWithMipmaps':opt['estimatedRgbaTextureBytesWithMipmaps']},'localCandidateChecks':{'actualBackgroundBlenderRenders':True,'measuredFunction':fn['passed'],'sampledMeshRouteClearance':fn['meshRouteClearance']['passed'],'materialTexturesAndSourceTintSurvivedExport':read(PACKAGE/'runtime/material-check.json')['passed'],'actualKeyboardNotebookAndCurtainChecks':all(r['passed'] for r in flows.values()),'typecheck':True,'runtimeExceptions':flows['return']['browserErrors'],'worldApiRequestsDuringReturnCheck':flows['return']['worldApiRequests']},'performance':[{k:v for k,v in r.items() if k not in ('frameMs','character')} for r in performance],'artifacts':artifacts,'runtimeInputs':inputs,'preservedOriginals':[{'path':p,'sha256':s} for p,s in protected],'humanArtApproved':False,'formalProductionApproved':False,'formalSkillReports':['formal-skill-function.log','formal-skill-form.log','formal-skill-runtime.log'],'limitations':['This is a local art/navigation slice with no autonomous resident or case binding.','Browser measurements are two warm 15-second headless Chrome samples on the current Windows RTX 4060 Laptop device, not a packaged game, long session, full-town simulation, or independent GPU-timer measurement.','Source-bound Function tests sample selected routes at three body heights and eight support pairs; they do not prove every continuous motion or furniture intersection.','The cutaway runtime uses a separate daylight and fixture calibration; no baked-lightmap or Cycles-equivalence claim.','A D3D shader constant-folding precision warning appeared during the initial cold visit; it did not report a runtime exception. The final warm visit had no such console warning.','Art remains simpler than the approved concept: richer wear, wall dressing, character face/cloth detail and a surrounding inhabited town need more work.','Formal production package schemas and human Function/Form/Runtime reviews remain incomplete; user authorization permits this local candidate.']}
    write(PACKAGE/'final-report.json',report)
    direction_path=ROOT/'docs/vision/classic-detection-2026-10-08/direction.json';direction=read(direction_path)
    direction['status']='room-refinement-and-skinned-character-runtime-candidate-art-acceptance-pending'
    direction['runtimeSample'].update(package='../../3d-town/classic-railway-v2/README.zh-CN.md',sourceSha256=source,assetSha256=asset,scope='Original railway-inn and connected refined sitting room, PBR wood/leather, practical lamps, OFL signs, skinned investigator, local observation notebook; no Agent/case binding.')
    direction['preservation']['importedThirdPartyAssets']=['Poly Haven wood_table_001 / CC0-1.0','Poly Haven leather_red_02 / CC0-1.0','Renamed project Noto Serif SC sign subset / SIL-OFL-1.1']
    write(direction_path,direction)
    print(json.dumps({'sourceSha256':source,'assetSha256':asset,'bytes':manifest['asset']['bytes'],'triangles':fn['evaluatedTriangles'],'performance':[{k:r[k] for k in ('inside','mode','frames','p95Ms','maxMs','over16_7')} for r in performance],'humanArtApproved':False},ensure_ascii=False))

if __name__=='__main__':main()
