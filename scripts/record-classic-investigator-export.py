"""Validate the actual compressed skin/clip payload before exposing its manifest."""
from pathlib import Path
import hashlib
import json
import struct

ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/'docs/3d-town/classic-investigator-v1'
PUBLIC=ROOT/'public/assets/classic-investigator/v1'


def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def glb(p):
    data=p.read_bytes()
    assert data[:4]==b'glTF' and struct.unpack_from('<I',data,8)[0]==len(data)
    return json.loads(data[20:20+struct.unpack_from('<I',data,12)[0]])


def summary(doc):
    triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
    clips={a['name']:max(doc['accessors'][s['input']]['max'][0] for s in a['samplers']) for a in doc['animations']}
    for a in doc['animations']:
        assert min(doc['accessors'][s['input']]['min'][0] for s in a['samplers'])==0
    joints=[doc['nodes'][j]['name'] for j in doc['skins'][0]['joints']]
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            assert {'JOINTS_0','WEIGHTS_0','NORMAL'}<=set(primitive['attributes'])
    return {'triangles':triangles,'clips':clips,'joints':joints,'skinCount':len(doc['skins']),'materialCount':len(doc['materials'])}


def main():
    author=read(PACKAGE/'authoring-review.json');renders=read(PACKAGE/'render-review.json');raw=read(PACKAGE/'raw-export.json')
    source=PACKAGE/'classic-investigator.blend';identity=sha(source)
    assert identity==author['sourceSha256']==renders['sourceSha256']==raw['sourceSha256']
    assert sha(ROOT/'scripts/build-blender-classic-investigator.py')==author['inputs']['builder']
    assert sha(ROOT/'scripts/build-blender-classic-railway.py')==author['inputs']['geometryHelper']
    assert sha(PACKAGE/'investigator-raw.glb')==raw['rawSha256']
    required={'front','back','profile','three-quarter','tailoring','walk-contact','walk-passing'}
    assert required=={r['view'] for r in renders['renders']}
    for entry in renders['renders']:assert sha(PACKAGE/entry['path'])==entry['sha256']
    original=summary(glb(PACKAGE/'investigator-raw.glb'))
    asset=PUBLIC/'investigator.glb';doc=glb(asset);final=summary(doc)
    for key in original:
        if key=='clips':
            assert original[key].keys()==final[key].keys()
            for name in original[key]:assert abs(original[key][name]-final[key][name])<1e-6
        else:assert original[key]==final[key]
    assert final['skinCount']==1 and len(final['joints'])==20
    assert final['triangles']==author['triangles']
    assert abs(final['clips']['Walk']-.8)<.001 and abs(final['clips']['Idle']-3)<.001
    assert 'EXT_meshopt_compression' in doc.get('extensionsUsed',[])
    assert asset.stat().st_size<3_000_000
    bounds=author['animatedBounds']
    manifest={'schema':'classic-investigator-runtime.v1','status':'original-skinned-art-candidate','sourceSha256':identity,
              'asset':{'url':'/assets/classic-investigator/v1/investigator.glb','sha256':sha(asset),'bytes':asset.stat().st_size},
              'animation':{'idle':'Idle','walk':'Walk','strideMeters':.96,'walkDurationSeconds':.8},'playerSpeed':1.55,
              'triangles':final['triangles'],'bones':len(final['joints']),'materialCount':final['materialCount'],
              'units':'metres','forwardAxis':'glTF +Z','footOrigin':'floor at local Y=0',
              'maxAnimatedHeight':max(f['bounds'][2][1] for f in bounds),
              'sceneCompanion':'/assets/classic-railway/v1/manifest.json','worldBound':False,'humanArtApproved':False,
              'rights':author['rights'],'limits':['Original stylized realism study, not final cinematic character fidelity.','Authored skin and secondary coat motion; no cloth or hand IK simulation.','Only one character; the twelve residents have not been replaced.']}
    write(PUBLIC/'manifest.json',manifest)
    write(PACKAGE/'runtime-export.json',{'sourceSha256':identity,'manifest':manifest,'rawBytes':raw['bytes'],'payloadComparison':final,'pipeline':'Blender 5.2 GLB -> glTF Transform 4.5.1 meshopt, position16/normal10/texcoord16','evidence':{name:sha(PACKAGE/name) for name in ['authoring-review.json','render-review.json','raw-export.json']}})
    print(json.dumps(manifest,ensure_ascii=False))


if __name__=='__main__':main()
