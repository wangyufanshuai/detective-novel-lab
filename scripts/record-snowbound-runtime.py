"""Validate optimized geometry/material contracts and publish a local manifest."""
from pathlib import Path
from io import BytesIO
import hashlib,json,struct
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/3d-town/snowbound-manor-v1';O=ROOT/'public/assets/snowbound-manor/v1'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def glb(path):
    data=path.read_bytes();assert data[:4]==b'glTF' and struct.unpack_from('<I',data,8)[0]==len(data)
    length=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+length]);return doc,data[28+length:]
def topology(doc):
    return [(doc['materials'][p['material']]['name'],doc['accessors'][p['indices']]['count']//3) for m in doc['meshes'] for p in m['primitives']]
raw=read(P/'runtime/raw-export.json');g,_=glb(ROOT/raw['rawAsset']['path']);source=sha(P/'snowbound-manor.blend')
assert source==raw['sourceSha256']
tiers={}
for name,size in [('high',1024),('balanced',512)]:
    path=O/f'manor-{name}.glb';doc,bin_data=glb(path)
    assert sorted(topology(doc))==sorted(topology(g)),name+' topology/material mismatch'
    dimensions=[]
    for im in doc.get('images',[]):
        view=doc['bufferViews'][im['bufferView']];start=view.get('byteOffset',0)
        with Image.open(BytesIO(bin_data[start:start+view['byteLength']])) as image: dims=list(image.size)
        assert max(dims)<=size,(im,dims)
        dimensions.append(dims)
    for material in doc['materials']:
        original=next(m for m in g['materials'] if m['name']==material['name'])
        a=original.get('pbrMetallicRoughness',{});b=material.get('pbrMetallicRoughness',{})
        assert a.get('baseColorFactor',[1,1,1,1])==b.get('baseColorFactor',[1,1,1,1]),material['name']
        assert ('baseColorTexture' in a)==('baseColorTexture' in b),material['name']
        assert ('normalTexture' in original)==('normalTexture' in material),material['name']
        assert original.get('alphaMode','OPAQUE')==material.get('alphaMode','OPAQUE'),material['name']
    tiers[name]={'url':f'/assets/snowbound-manor/v1/manor-{name}.glb','sha256':sha(path),'bytes':path.stat().st_size,
        'maxTextureDimension':size,'imageCount':len(dimensions),'decodedRGBABytesEstimate':sum(w*h*4 for w,h in dimensions),
        'triangles':sum(c for _,c in topology(doc)),'primitives':len(topology(doc))}
nav=read(O/'navigation.json');nav.update(sourceSha256=source,assetSha256=tiers['high']['sha256'],allowedAssetSha256=[t['sha256'] for t in tiers.values()])
for item in nav['interactions']:
    x,y=item['position'];bounds=nav['interior']['bounds']
    assert bounds[0]<=x<=bounds[1] and bounds[2]<=y<=bounds[3]
    item['roomId']='hall'
write(O/'navigation.json',nav)
manifest={'schema':'snowbound-browser-candidate.v1','sourceSha256':source,'asset':tiers['high'],'tiers':tiers,
    'navigation':{'url':'/assets/snowbound-manor/v1/navigation.json','sha256':sha(O/'navigation.json')},
    'fixtures':raw['fixtures'],'fixturesSha256':raw['fixturesSha256'],'lighting':'runtime PBR and fixture calibration; not Cycles equivalence',
    'humanArtApproved':False,'agentWorldBound':False,'exporterSha256':raw['exporterSha256'],
    'optimizerSha256':sha(ROOT/'scripts/optimize-snowbound-manor.py'),'validationSha256':sha(Path(__file__)),
    'thirdPartyProvenanceSha256':sha(P/'licensed/provenance.json'),'licenseDocuments':['/assets/snowbound-manor/v1/CREDITS.md','/assets/snowbound-manor/v1/font-OFL.txt']}
write(O/'manifest.json',manifest);write(P/'runtime-export.json',manifest)
print(json.dumps({'tiers':tiers,'sourceSha256':source,'materialAndTopologyChecks':True}),flush=True)
