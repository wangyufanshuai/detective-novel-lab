"""Verify the source-preserving hand pass and create the three runtime manifests."""
from pathlib import Path
import importlib.util
import copy
import json
import hashlib

ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/'docs/3d-town/classic-residents-v8'
PUBLIC=ROOT/'public/assets/classic-residents/v8'
spec=importlib.util.spec_from_file_location('portrait_payload',ROOT/'scripts/record-classic-portrait-export.py')
portrait=importlib.util.module_from_spec(spec);spec.loader.exec_module(portrait)
read,write,sha=portrait.read,portrait.write,portrait.sha

def record(path):return {'path':path.relative_to(ROOT).as_posix(),'sha256':sha(path)}

def summary(doc):
    assert len(doc['skins'])==1
    primitives=[p for m in doc['meshes'] for p in m['primitives']]
    assert all({'JOINTS_0','WEIGHTS_0','NORMAL','COLOR_0'}<=set(p['attributes']) for p in primitives)
    clips={a['name']:max(doc['accessors'][s['input']]['max'][0] for s in a['samplers']) for a in doc['animations']}
    assert set(clips)=={'Idle','Walk'} and abs(clips['Idle']-3)<1e-5 and abs(clips['Walk']-.8)<1e-5
    joints=[doc['nodes'][i]['name'] for i in doc['skins'][0]['joints']]
    assert len(joints)==50
    fingers=sorted(name for name in joints if name.startswith('finger_'))
    assert fingers==sorted(f'finger_{side}_{finger}_{segment}' for side in ('L','R') for finger in range(1,6) for segment in range(1,4))
    for clip in doc['animations']:
        rotations={doc['nodes'][channel['target']['node']]['name'] for channel in clip['channels'] if channel['target']['path']=='rotation'}
        assert set(fingers)<=rotations
    return {'triangles':sum(doc['accessors'][p['indices']]['count']//3 for p in primitives),
        'materials':len(doc['materials']),'primitives':len(primitives),'joints':joints,'clips':clips}

def appearance(doc):
    # Texture indices may change; scalar material semantics must not change.
    def normalize(value):
        if isinstance(value,list):return [normalize(v) for v in value]
        if not isinstance(value,dict):return value
        return {k:normalize(v) for k,v in value.items() if k not in ('index','extras')}
    return {m['name']:normalize(m) for m in doc['materials']}

def main():
    prior=read(ROOT/'docs/3d-town/classic-residents-v7/runtime-export.json')
    saved=read(PACKAGE/'saved-source-review.json')
    assert saved['builderSha256']==sha(ROOT/'scripts/review-classic-resident-hands.py')
    cast=read(ROOT/'public/assets/classic-residents/v7/cast.json')
    reports=[]
    for entry in cast['entries']:
        actor=entry['actorId'];original_path=ROOT/('public'+entry['manifestUrl'])
        assert sha(original_path)==entry['manifestSha256']
        original=read(original_path);folder=PACKAGE/actor
        author,render,raw=[read(folder/name) for name in ('authoring-review.json','render-review.json','raw-export.json')]
        source=folder/(original['id']+'.blend')
        assert sha(source)==author['sourceSha256']==render['sourceSha256']==raw['sourceSha256']
        observed=next(row for row in saved['residents'] if row['actorId']==actor)
        assert observed['source']['sha256']==sha(source) and all(observed['checks'].values())
        assert sha(ROOT/author['sourceInput']['path'])==author['sourceInput']['sha256']==original['sourceSha256']
        for path,digest in author['inputs'].items():assert sha(ROOT/path)==digest
        assert author['passed'] and author['bones']==50 and author['invalidWeights']==0
        assert len(author['frames'])==116 and all(not r['fingerPairIntersections'] and r['fingerGarmentTrianglePairs']==0 for r in author['frames'])
        assert len(render['renders'])==9
        for row in render['renders']:assert sha(folder/row['path'])==row['sha256']
        raw_path=folder/(original['id']+'-raw.glb');asset=PUBLIC/(actor+'.glb')
        assert sha(raw_path)==raw['rawSha256']
        before_doc,_,before_mats=portrait.payload(raw_path);doc,images,mats=portrait.payload(asset)
        before,after=summary(before_doc),summary(doc)
        for key in before:
            if key=='clips':
                assert before[key].keys()==after[key].keys()
                assert all(abs(before[key][name]-after[key][name])<1e-7 for name in before[key])
            else:assert before[key]==after[key],(actor,key)
        assert after['triangles']==original['triangles']<60000 and after['materials']==original['materialCount']<=14
        assert asset.stat().st_size<6000000 and all(max(im['dimensions'])<=2048 for im in images)
        assert {'EXT_meshopt_compression','EXT_texture_webp'}<=set(doc['extensionsUsed'])
        old_doc=portrait.checks.glb(ROOT/('public'+original['asset']['url']))
        assert appearance(before_doc)==appearance(doc)==appearance(old_doc),(actor,'material semantics changed')
        for name in mats:
            a,b=before_mats[name],mats[name]
            if a['normalTexture']:assert a['normalTexture']['decodedRgbaSha256']==b['normalTexture']['decodedRgbaSha256']
            if a['baseColorTexture']:
                assert a['baseColorTexture']['dimensions']==b['baseColorTexture']['dimensions']
                assert b['baseColorTexture']['mimeType']=='image/webp'
        manifest=copy.deepcopy(original)
        manifest.update(sourceSha256=sha(source),bones=50,
            asset={'url':f'/assets/classic-residents/v8/{actor}.glb','sha256':sha(asset),'bytes':asset.stat().st_size},
            handArticulation={'jointNames':[name for name in after['joints'] if name.startswith('finger_')],
                'kind':'authored-relaxed-fingers','objectGrasping':False},
            idleForearmClearanceRadians=author['idleForearmClearanceRadians'],
            licenseNoticeUrl='/assets/classic-residents/v8/LICENSE.ASSETS.md',
            construction='Retained mesh, portrait and clothing with thirty anatomical finger bones, normalized hand weights and relaxed finger posing. The skirt outfits also receive a small left Idle elbow clearance adjustment. No object grasping or Agent decisions.')
        path=PUBLIC/(actor+'.json');write(path,manifest)
        entry.update(manifestUrl=f'/assets/classic-residents/v8/{actor}.json',manifestSha256=sha(path))
        reports.append({'actorId':actor,'source':record(source),'asset':manifest['asset'],'payload':after,
            'authoring':record(folder/'authoring-review.json'),'renders':record(folder/'render-review.json'),
            'rawExport':record(folder/'raw-export.json'),'sourceInput':author['sourceInput'],
            'images':images,'materials':mats})
    cast['presentation']='Three stationary art residents with independently skinned finger chains and relaxed hands. Idle presentation only; no object grasping, Agent or case binding.'
    write(PUBLIC/'cast.json',cast)
    (PUBLIC/'LICENSE.ASSETS.md').write_text((ROOT/'public/assets/classic-residents/v7/LICENSE.ASSETS.md').read_text(encoding='utf-8')+
        '\n\nThe v8 pass adds project-authored finger skeletons, weights and poses using the preserved CC0 anatomical landmarks. No new third-party assets or program code are introduced.\n',encoding='utf-8')
    preserved=prior['preservedOriginals']+[
        {'path':'docs/3d-town/classic-residents-v7/resident-06/rb-gu-yuanshan.blend','sha256':prior['sourceSha256']},
        {'path':'public'+prior['asset']['url'],'sha256':prior['asset']['sha256']}]
    for row in preserved:assert sha(ROOT/row['path'])==row['sha256']
    write(PACKAGE/'runtime-export.json',{'schema':'classic-hands-export.v8','castSha256':sha(PUBLIC/'cast.json'),
        'residents':reports,'optimizer':record(ROOT/'scripts/optimize-classic-hands.ps1'),'savedSourceReview':record(PACKAGE/'saved-source-review.json'),
        'preservedOriginals':preserved,'humanArtApproved':False,'worldBound':False})
    print(json.dumps({'residents':[{'actorId':r['actorId'],'bytes':r['asset']['bytes'],'triangles':r['payload']['triangles'],'bones':len(r['payload']['joints'])} for r in reports],'preservedOriginals':len(preserved)}))

if __name__=='__main__':main()
