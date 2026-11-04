"""Check source, render and GLB identities before publishing the three art residents."""
from pathlib import Path
import hashlib,json,struct,math,re

ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/'docs/3d-town/classic-residents-v1'
PUBLIC=ROOT/'public/assets/classic-residents/v1'
IDS=['resident-03','resident-06','resident-08']
PLACEMENTS={
 'resident-03':{'roomId':'bookshop','position':[.55,4.95],'observationPosition':[-.65,4.97],
    'appearanceDescription':'许知微 · 旧书修复师。细框眼镜、深色短发与工作围裙；口袋里收着修复刷。'},
 'resident-06':{'roomId':'station','position':[-9.25,5.52],'observationPosition':[-9.25,3.72],
    'appearanceDescription':'顾远山 · 车站值班员。深蓝灰制服、铜色纽扣与有帽檐的值班帽。'},
 'resident-08':{'roomId':'inn','position':[5.05,1.10],'observationPosition':[4.65,1.72],
    'appearanceDescription':'林阿梨 · 旅馆老板。盘起的发髻、宽披肩、胸针与长裙。'},
}


def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def glb(p):
    data=p.read_bytes();assert data[:4]==b'glTF' and struct.unpack_from('<I',data,8)[0]==len(data)
    return json.loads(data[20:20+struct.unpack_from('<I',data,12)[0]])


def summary(doc):
    assert len(doc['skins'])==1
    primitives=[p for m in doc['meshes'] for p in m['primitives']]
    assert all({'JOINTS_0','WEIGHTS_0','NORMAL','COLOR_0'}<=set(p['attributes']) for p in primitives)
    clips={a['name']:max(doc['accessors'][s['input']]['max'][0] for s in a['samplers']) for a in doc['animations']}
    assert set(clips)=={'Idle','Walk'} and abs(clips['Idle']-3)<1e-5 and abs(clips['Walk']-.8)<1e-5
    joints=[doc['nodes'][i]['name'] for i in doc['skins'][0]['joints']]
    assert len(joints)==20
    return {'triangles':sum(doc['accessors'][p['indices']]['count']//3 for p in primitives),
        'materials':len(doc['materials']),'primitives':len(primitives),'joints':joints,'clips':clips}


def clearance(position,collider):
    dx=position[0]-collider['center'][0];dy=position[1]-collider['center'][1];a=collider['angle']
    x=math.cos(a)*dx+math.sin(a)*dy;y=-math.sin(a)*dx+math.cos(a)*dy
    return math.hypot(max(abs(x)-collider['size'][0]/2,0),max(abs(y)-collider['size'][1]/2,0))


def main():
    profiles={p['actorId']:p for p in read(PACKAGE/'profiles.json')['profiles']}
    # Read only these allowlisted public fields into the export contract. The
    # source world also holds private facts, which must never enter art payloads.
    world=ROOT/'packages/engine/src/riverbend-world.ts'
    world_lines=world.read_text(encoding='utf-8').splitlines()
    for actor in IDS:
        row=next(line for line in world_lines if actor in line)
        for key in ('actorId','id','name','role'):
            match=re.search(r'\b'+key+r':\s*["\x27]([^"\x27]*)',row)
            assert match and match.group(1)==profiles[actor][key],(actor,key)
    ledger=read(PACKAGE/'licensed/mpfb/provenance.json')
    for file in ledger['files']:assert sha(ROOT/file['path'])==file['sha256']
    scene=read(ROOT/'public/assets/classic-station/v1/manifest.json');nav=read(ROOT/('public'+scene['navigation']['url']))
    entries=[];reviews=[]
    for actor in IDS:
        p=profiles[actor];folder=PACKAGE/actor;author=read(folder/'authoring-review.json');render=read(folder/'render-review.json');raw=read(folder/'raw-export.json')
        source=folder/(p['id']+'.blend');identity=sha(source)
        assert identity==author['sourceSha256']==render['sourceSha256']==raw['sourceSha256']
        for file,h in author['inputs'].items():assert sha(ROOT/file)==h,file
        required={'three-quarter','portrait','face-front','front','profile','back','walk-contact','walk-passing','hands'}
        assert {r['view'] for r in render['renders']}==required
        for r in render['renders']:assert sha(folder/r['path'])==r['sha256']
        original=folder/(p['id']+'-raw.glb');assert sha(original)==raw['rawSha256']
        asset=PUBLIC/(actor+'.glb');doc=glb(asset);final=summary(doc);before=summary(glb(original))
        for key in before:
            if key=='clips':
                assert before[key].keys()==final[key].keys()
                assert all(abs(before[key][name]-final[key][name])<1e-6 for name in before[key])
            else:assert before[key]==final[key],(actor,key,before[key],final[key])
        assert final['triangles']==author['triangles']
        assert 'EXT_meshopt_compression' in doc.get('extensionsUsed',[])
        assert final['triangles']<45000 and asset.stat().st_size<2_500_000
        placement=PLACEMENTS[actor];room=next(r for r in nav['interiors'] if r['id']==placement['roomId'])
        x,y=placement['position'];b=room['bounds'];assert b[0]+.32<x<b[1]-.32 and b[2]+.32<y<b[3]-.32
        gap=min(clearance(placement['position'],c) for c in nav['colliders']);assert gap>.32,(actor,gap)
        assert min(clearance(placement['observationPosition'],c) for c in nav['colliders'])>.272
        manifest={'schema':'classic-resident-runtime.v1','status':'art-candidate','actorId':actor,'id':p['id'],'name':p['name'],'role':p['role'],
            'sourceSha256':identity,'asset':{'url':f'/assets/classic-residents/v1/{actor}.glb','sha256':sha(asset),'bytes':asset.stat().st_size},
            'animation':{'idle':'Idle','walk':'Walk','strideMeters':author['strideMeters'],'walkDurationSeconds':.8},
            'playerSpeed':1.2*p['height']/1.802,'triangles':final['triangles'],'materialCount':final['materials'],'bones':20,
            'units':'metres','forwardAxis':'glTF +Z','worldBound':False,'humanArtApproved':False,
            'license':'CC0-1.0 anatomy; project-authored clothing, hair, props and animation',
            'licenseNoticeUrl':'/assets/classic-residents/v1/LICENSE.ASSETS.md'}
        write(PUBLIC/(actor+'.json'),manifest)
        entry={'actorId':actor,'name':p['name'],'role':p['role'],'manifestUrl':f'/assets/classic-residents/v1/{actor}.json',
            'manifestSha256':sha(PUBLIC/(actor+'.json')),'yaw':0,**placement}
        entries.append(entry);reviews.append({'actorId':actor,'sourceSha256':identity,'assetSha256':sha(asset),'rawBytes':raw['bytes'],
            'assetBytes':asset.stat().st_size,'payload':final,'renderCount':len(render['renders']),'fixtureClearanceMeters':gap,
            'renderReceiptSha256':sha(folder/'render-review.json'),'authoringReceiptSha256':sha(folder/'authoring-review.json')})
    (PUBLIC/'LICENSE.ASSETS.md').write_bytes((PACKAGE/'licensed/mpfb/LICENSE.ASSETS.md').read_bytes())
    index={'schema':'classic-resident-cast.v1','worldBound':False,'sceneAssetSha256':scene['asset']['sha256'],
        'entries':entries,'presentation':'Three authored stationary art placements with idle animation; no Agent decisions or testimony.'}
    write(PUBLIC/'cast.json',index)
    write(PACKAGE/'runtime-export.json',{'schema':'classic-resident-runtime-export.v1','castSha256':sha(PUBLIC/'cast.json'),
        'sceneSourceSha256':scene['sourceSha256'],'sceneAssetSha256':scene['asset']['sha256'],'residents':reviews,
        'publicIdentitySourceSha256':sha(world),'publicIdentityFields':['actorId','id','name','role'],
        'sourceDataLedgerSha256':sha(PACKAGE/'licensed/mpfb/provenance.json'),'humanArtApproved':False,'worldBound':False})
    print(json.dumps({'residents':[{k:r[k] for k in ['actorId','assetBytes','fixtureClearanceMeters']}|{'triangles':r['payload']['triangles']} for r in reviews],'castSha256':sha(PUBLIC/'cast.json')}))


if __name__=='__main__':main()
