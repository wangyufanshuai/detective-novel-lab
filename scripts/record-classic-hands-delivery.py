"""Bind the v8 sources, actual browser actions and bounded device observations."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib
import json

ROOT=Path(__file__).resolve().parents[1];PACKAGE=ROOT/'docs/3d-town/classic-residents-v8';QA=ROOT/'output/playwright'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))

def record(path):return {'path':path.relative_to(ROOT).as_posix(),'sha256':sha(path),'bytes':path.stat().st_size}
def write(path,data):path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def result(name):
    s=(QA/f'classic-hands-{name}.log').read_text(encoding='utf-8-sig');assert '### Error' not in s,name
    return json.JSONDecoder().raw_decode(s.split('### Result',1)[1].lstrip())[0]

def main():
    exported=read(PACKAGE/'runtime-export.json');cast_path=ROOT/'public/assets/classic-residents/v8/cast.json'
    assert sha(cast_path)==exported['castSha256'];cast=read(cast_path);manifests={}
    artifacts=[];source_evidence=[]
    for entry in cast['entries']:
        path=ROOT/('public'+entry['manifestUrl']);assert sha(path)==entry['manifestSha256'];m=read(path)
        assert m['bones']==50 and len(m['handArticulation']['jointNames'])==30
        assert sha(ROOT/('public'+m['asset']['url']))==m['asset']['sha256'];manifests[entry['actorId']]=m
        folder=PACKAGE/entry['actorId'];author=read(folder/'authoring-review.json');render=read(folder/'render-review.json')
        source=folder/(m['id']+'.blend');assert sha(source)==author['sourceSha256']==render['sourceSha256']==m['sourceSha256']
        assert len(author['frames'])==116 and author['passed'] and not author['invalidWeights']
        for row in author['frames']:assert not row['fingerPairIntersections'] and row['fingerGarmentTrianglePairs']==0
        for path,digest in author['inputs'].items():assert sha(ROOT/path)==digest
        for row in render['renders']:
            path=folder/row['path'];assert sha(path)==row['sha256'];artifacts.append(record(path))
        source_evidence += [record(folder/name) for name in ('authoring-review.json','render-review.json','raw-export.json')]
    saved=read(PACKAGE/'saved-source-review.json')
    assert saved['builderSha256']==sha(ROOT/'scripts/review-classic-resident-hands.py')
    for row in saved['residents']:
        assert all(row['checks'].values()) and row['source']['sha256']==manifests[row['actorId']]['sourceSha256']
    comparison=read(PACKAGE/'comparison-review.json')
    assert comparison['builderSha256']==sha(ROOT/'scripts/render-classic-hands-comparison.py')
    for row in comparison['comparisons']:
        for item in row['sourceInputs']+[row['stage'],row['render']]:assert sha(ROOT/item['path'])==item['sha256']
        artifacts.append(record(ROOT/row['render']['path']))
    def verify_residents(rows):
        assert {r['actorId'] for r in rows}==set(manifests)
        for row in rows:
            m=manifests[row['actorId']]
            assert row['sourceSha256']==m['sourceSha256'] and row['assetSha256']==m['asset']['sha256']
    motion=result('motion');assert motion['passed'];verify_residents(motion['residents'])
    for row in motion['residents']:
        assert row['fingerCount']==30 and len(row['deltas'])==30
        assert all(v['maximumComponentDelta']>1e-5 for v in row['deltas'])
    flows={room:result(room) for room in ('inn','bookshop','station')}
    for room,actor in [('inn','resident-08'),('bookshop','resident-03'),('station','resident-06')]:
        d=flows[room];assert d['passed'] and not d['browserErrors'] and not d['apiRequests']
        assert d['focused']['roomId']==room and d['focused']['focusActorId']==actor and d['restored']['focusActorId'] is None
        verify_residents(d['focused']['residents'])
        for view in ('portrait','play'):artifacts.append(record(QA/f'classic-hands-{room}-{view}.png'))
    samples={name:result('performance-'+name) for name in ('station','portrait','overview')}
    for name,sample in samples.items():
        verify_residents(sample['residents'])
        assert sample['viewport']=={'width':1920,'height':1080} and sample['deviceScaleFactor']==1
        assert 14500<sample['measuredMs']<16000
        assert sample['focusActorId']==('resident-06' if name=='portrait' else None)
        if name!='overview':assert sample['roomId']=='station'
        values=sorted(sample['frameMs']);assert len(values)==sample['frames']
        assert values[-1]==sample['maxMs'] and values[int(len(values)*.95)]==sample['p95Ms']
        assert sum(x>16.7 for x in values)==sample['over16_7']
    files=sorted(p for p in (ROOT/'app/town-play/art-sample').glob('*') if p.is_file())
    typecheck=read(PACKAGE/'typecheck-result.json');assert typecheck['exitCode']==0
    assert datetime.fromisoformat(typecheck['completedAt'].replace('Z','+00:00')).timestamp()>=max(p.stat().st_mtime for p in files)
    for row in exported['preservedOriginals']:assert sha(ROOT/row['path'])==row['sha256']
    visual=read(PACKAGE/'visual-review.json');assert not visual['humanArtApproved']
    assert visual['castSha256']==exported['castSha256']
    for row in visual['imagesInspected']:assert sha(ROOT/row['path'])==row['sha256']
    compact={n:{k:v for k,v in s.items() if k not in ('frameMs','character')} for n,s in samples.items()}
    performance_scope={'scope':'Three warm 15-second local art samples, not a packaged-game or long-session gate.',
        'previousV7':record(ROOT/'docs/3d-town/classic-residents-v7/runtime-review.json'),
        'historicalStallCauseEstablished':False,
        'limitation':'The historical v2 533.7 ms and v6 199.9 ms frames remain unexplained; the new samples cannot establish a fix.'}
    runtime={'schema':'classic-hands-runtime.v8','createdAt':datetime.now(timezone.utc).isoformat(),
        'castSha256':exported['castSha256'],'runtimeInputs':[record(p) for p in files],
        'flows':{n:{k:v for k,v in flow.items() if k!='steps'} for n,flow in flows.items()},
        'fingerMotion':motion,'performance':compact,'performanceAssessment':performance_scope,
        'rawEvidence':[record(QA/f'classic-hands-{n}.log') for n in list(flows)+['motion']+['performance-'+n for n in samples]+['processes']],
        'windowsMemorySnapshot':read(PACKAGE/'browser-windows-memory.json'),'typecheck':typecheck,'worldBound':False,'humanRuntimeApproved':False}
    write(PACKAGE/'runtime-review.json',runtime)
    report={'schema':'classic-hands-delivery.v8','status':'three-resident-hand-art-candidate','export':exported,
        'url':'http://127.0.0.1:3187/town-play/art-sample','runtimeInputs':runtime['runtimeInputs'],
        'checks':{'sourceRenders':27,'sameLightComparisons':3,'savedAnimationFramesPerActor':116,
            'fingerVersusFingerAndGarmentChecks':True,'unchangedRestMeshesAndUvs':True,
            'plannedBodyPoseChangesOnly':True,'animatedFingerBonesInBrowserPerActor':30,'threeKeyboardFlows':True,'typecheck':True},
        'performance':compact,'performanceAssessment':performance_scope,'artifacts':artifacts,
        'evidenceFiles':source_evidence+[record(PACKAGE/n) for n in ('runtime-export.json','runtime-review.json','saved-source-review.json','comparison-review.json','visual-review.json','brief.json','browser-console.log')],
        'productionScripts':[record(ROOT/'scripts'/n) for n in ('build-blender-resident-hands.py','review-classic-resident-hands.py','render-classic-hands-comparison.py','optimize-classic-hands.ps1','record-classic-hands-export.py','record-classic-hands-delivery.py')],
        'preservedOriginals':exported['preservedOriginals'],'humanArtApproved':False,'formalProductionApproved':False,'worldBound':False,
        'limitations':['Three art residents are modeled; nine further residents remain design drafts.',
            'The finger checks cover the labeled phalangeal cores against other digits and garments in the current Idle/Walk clips, not every possible self-intersection or future pose.',
            'The hand controls do not yet grasp, hold or release objects; object contact, facial expression and purposeful work actions remain unfinished.',
            'Station counter geometry occludes the hands in its current close inspection camera. Source comparisons show the full hand poses.',
            'Runtime lighting, anatomical finesse, hand/wrist softness and human art review remain open.',
            'The full Agent/case/save loop, twelve-resident cast, Windows package and same-world novel remain part of the active goal.']}
    write(PACKAGE/'final-report.json',report)
    print(json.dumps({'status':report['status'],'preservedOriginals':len(report['preservedOriginals']),
        'performance':{n:{k:s[k] for k in ('p95Ms','maxMs','over16_7')} for n,s in samples.items()},'goalRemainsActive':True}))

if __name__=='__main__':main()
