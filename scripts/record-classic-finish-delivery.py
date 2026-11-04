"""Bind the v6 art candidate to the actual mixed-cast browser observations."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'docs/3d-town/classic-residents-v6'
QA = ROOT / 'output/playwright'
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
def record(p): return {'path':p.relative_to(ROOT).as_posix(), 'sha256':sha(p), 'bytes':p.stat().st_size}
def write(p,d): p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def result(name):
    value=(QA/('classic-finish-'+name+'.log')).read_text(encoding='utf-8-sig')
    assert '### Error' not in value, name+' browser command failed'
    return json.JSONDecoder().raw_decode(value.split('### Result',1)[1].lstrip())[0]


def main():
    exported=read(PACKAGE/'runtime-export.json')
    cast_path=ROOT/'public/assets/classic-residents/v6/cast.json'; cast=read(cast_path)
    assert sha(cast_path)==exported['castSha256']
    manifests={}
    for entry in cast['entries']:
        path=ROOT/('public'+entry['manifestUrl']); assert sha(path)==entry['manifestSha256']
        manifest=read(path); assert sha(ROOT/('public'+manifest['asset']['url']))==manifest['asset']['sha256']
        manifests[entry['actorId']]=manifest
    author=read(PACKAGE/'resident-06/authoring-review.json')
    assert sha(PACKAGE/'resident-06/rb-gu-yuanshan.blend')==author['sourceSha256']==exported['sourceSha256']
    for path,digest in author['inputs'].items(): assert sha(ROOT/path)==digest
    assert len(author['jacketTrouserClearance']['frames'])==116
    assert all(row['intersectingTrianglePairs']==0 for row in author['jacketTrouserClearance']['frames'])
    finishing={r['part']:r for r in author['surfaceFinishing']}
    assert finishing['neck']['maximumFrontalOffsetMeters']==0
    assert len(finishing['neck-clearance']['frames'])==116 and finishing['neck-clearance']['maximumIntersectingTrianglePairs']==0
    comparison=read(PACKAGE/'comparison-review.json')
    for path,digest in comparison['sourceInputs'].items(): assert sha(ROOT/path)==digest
    assert sha(PACKAGE/'finish-comparison.blend')==comparison['stageSourceSha256']
    assert sha(PACKAGE/'finish-comparison.png')==comparison['renderSha256']
    assert sha(ROOT/'scripts/render-classic-finish-comparison.py')==comparison['builderSha256']
    flows={room:result(room) for room in ('inn','bookshop','station')}
    def verify_cast(rows):
        assert {r['actorId'] for r in rows}==set(manifests)
        for row in rows:
            manifest=manifests[row['actorId']]
            assert row['sourceSha256']==manifest['sourceSha256']
            assert row['assetSha256']==manifest['asset']['sha256']
    for room,actor in [('inn','resident-08'),('bookshop','resident-03'),('station','resident-06')]:
        flow=flows[room]
        assert flow['passed'] and not flow['browserErrors'] and not flow['apiRequests']
        assert flow['focused']['focusActorId']==actor and flow['focused']['roomId']==room
        assert flow['restored']['focusActorId'] is None
        verify_cast(flow['focused']['residents'])
    samples={name:result('performance-'+name) for name in ('station','portrait','overview')}
    for name,sample in samples.items():
        assert sample['viewport']=={'width':1920,'height':1080} and sample['deviceScaleFactor']==1
        assert sample['focusActorId']==('resident-06' if name=='portrait' else None)
        if name!='overview': assert sample['roomId']=='station'
        verify_cast(sample['residents'])
        values=sorted(sample['frameMs'])
        assert len(values)==sample['frames'] and 14500<sample['measuredMs']<16000
        assert values[-1]==sample['maxMs'] and values[int(len(values)*.95)]==sample['p95Ms']
        assert sum(v>16.7 for v in values)==sample['over16_7']
    files=sorted(p for p in (ROOT/'app/town-play/art-sample').glob('*') if p.is_file())
    typecheck=read(PACKAGE/'typecheck-result.json')
    assert typecheck['exitCode']==0
    assert datetime.fromisoformat(typecheck['completedAt'].replace('Z','+00:00')).timestamp()>=max(p.stat().st_mtime for p in files)
    for item in exported['preservedOriginals']: assert sha(ROOT/item['path'])==item['sha256']
    visual=read(PACKAGE/'visual-review.json')
    assert visual['sourceSha256']==exported['sourceSha256'] and not visual['humanArtApproved']
    for item in visual['imagesInspected']: assert sha(ROOT/item['path'])==item['sha256']
    compact={n:{k:v for k,v in s.items() if k not in ('frameMs','character')} for n,s in samples.items()}
    diagnostic=result('stall-diagnostic')
    assert diagnostic['roomId']=='station' and diagnostic['mode']=='explore'
    assert diagnostic['viewport']=={'width':1920,'height':1080}
    verify_cast(diagnostic['residents'])
    performance_assessment={
        'scope':'Three warm 15-second local art samples; not a release or long-session performance gate.',
        'stationMaximumFrameMs':samples['station']['maxMs'],
        'stationFramesAbove33_4Ms':samples['station']['over33_4'],
        'followupMaximumFrameMs':diagnostic['maxMs'],
        'followupObservedLongTasks':len(diagnostic['observedLongTasks']),
        'causeEstablished':False,
        'interpretation':'The station sample contains a 199.9 ms frame. The follow-up did not reproduce it and cannot establish its cause or prove it fixed.'}
    runtime={'schema':'classic-finish-runtime.v6','createdAt':datetime.now(timezone.utc).isoformat(),
             'castSha256':exported['castSha256'],'runtimeInputs':[record(p) for p in files], 'flows':flows,
             'performance':compact, 'performanceAssessment':performance_assessment, 'stallDiagnostic':diagnostic,
             'typecheck':typecheck, 'windowsMemorySnapshot':read(PACKAGE/'browser-windows-memory.json'),
             'rawEvidence':[record(QA/('classic-finish-'+n+'.log')) for n in list(flows)+['performance-'+n for n in samples]+['processes','stall-diagnostic']],
             'diagnosticScript':record(QA/'classic-finish-stall-diagnostic.js'),
             'worldBound':False, 'humanRuntimeApproved':False,
             'previousStall':'The v2 533.7 ms observation remains unresolved; new short samples do not establish its cause or fix.'}
    write(PACKAGE/'runtime-review.json',runtime)
    render=read(PACKAGE/'resident-06/render-review.json'); assert render['sourceSha256']==exported['sourceSha256']
    for row in render['renders']: assert sha(PACKAGE/'resident-06'/row['path'])==row['sha256']
    report={'schema':'classic-finish-delivery.v6','status':'station-finish-local-art-candidate', 'export':exported,
            'url':'http://127.0.0.1:3187/town-play/art-sample', 'runtimeInputs':runtime['runtimeInputs'],
            'checks':{'sourceRenders':len(render['renders']),'sameLightingComparison':True,'animationFramesChecked':116,
                      'jacketTrouserIntersectionsInSampledFrames':0,'innerCollarNeckIntersectionsInSampledFrames':0,'frontFaceGeometryUnchanged':True,'threeKeyboardObservationAndReturnFlows':True,'typecheck':True},
            'performance':compact,'performanceAssessment':performance_assessment,'preservedOriginals':exported['preservedOriginals'],
            'artifacts':[record(PACKAGE/'resident-06'/r['path']) for r in render['renders']]+[record(PACKAGE/'finish-comparison.png')]
                        +[record(QA/f'classic-finish-{room}-{view}.png') for room in flows for view in ('portrait','play')],
            'evidenceFiles':[record(PACKAGE/n) for n in ('runtime-export.json','runtime-review.json','comparison-review.json','visual-review.json','browser-console.log','brief.json')],
            'productionScripts':[record(ROOT/'scripts'/n) for n in ('build-blender-resident-finish.py','optimize-classic-finish.ps1','record-classic-finish-export.py','record-classic-finish-delivery.py','render-classic-finish-comparison.py')],
            'humanArtApproved':False,'formalProductionApproved':False,'worldBound':False,
            'limitations':['Only the station worker receives the v6 neck and material pass. The restorer retains v3 and the innkeeper v4. Nine further residents remain design drafts.',
                'The CC0 suit is fitted and skinned mesh geometry. This pass uses no cloth solver and no runtime cloth simulation.',
                'The intersection checks cover jacket versus trousers and inner collar versus head/neck in the current clips. They do not certify every garment pair or future poses.',
                'The face remains static and the shoulders and nape still need further anatomical refinement. Hair, fabric wear, facial expression, speech and human art approval remain open.',
                'The v6 station sample has a 199.9 ms frame; a separate monitored window did not reproduce it. Its cause and the historical v2 half-second stall remain unresolved. Short headless Chrome samples do not prove packaged or long-session 60 fps.',
                'The twelve-resident Agent simulation, validated investigation loop, Windows release and same-world novel remain within the active overall goal.']}
    write(PACKAGE/'final-report.json',report)
    print(json.dumps({'status':report['status'],'preservedOriginals':len(report['preservedOriginals']),
        'performance':{n:{k:s[k] for k in ('p95Ms','maxMs','over16_7')} for n,s in samples.items()},'goalRemainsActive':True}))


if __name__=='__main__': main()
