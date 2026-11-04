"""Validate optimized geometry, cutaway roots, textures, tints and provenance."""
from pathlib import Path
import hashlib,io,json,struct
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];PACKAGE=ROOT/'docs/3d-town/classic-bookshop-v1';OUTPUT=ROOT/'public/assets/classic-bookshop/v1'
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def glb(p):
    b=p.read_bytes();assert b[:4]==b'glTF';n=struct.unpack_from('<I',b,12)[0];return json.loads(b[20:20+n]),b[28+n:]

def main():
    raw=PACKAGE/'meshes/classic-street-raw.glb';final=OUTPUT/'classic-street.glb';manifest=read(PACKAGE/'runtime/raw-export.json');brief=read(PACKAGE/'room-brief.json')
    assert manifest['asset']['sha256']==sha(raw)
    original,_=glb(raw);g,binary=glb(final)
    triangles=lambda d:sum(d['accessors'][p['indices']]['count']//3 for m in d['meshes'] for p in m['primitives'])
    assert triangles(original)==triangles(g)==manifest['sourceTriangles']
    scene=read(PACKAGE/'scene-contract.json');names={n.get('name') for n in g['nodes']}
    required={'sample_player','sample_leg_left','sample_leg_right','sample_arm_left','sample_arm_right','layer_bookshop_interior','layer_bookshop_shell'}|{'layer_'+layer for room in scene['interiors'] for layer in room['cutawayLayers']}
    assert required<=names,required-names
    images=[]
    for item in g['images']:
        view=g['bufferViews'][item['bufferView']];start=view.get('byteOffset',0);payload=binary[start:start+view['byteLength']]
        with Image.open(io.BytesIO(payload)) as im:w,h=im.size
        assert max(w,h)<=512
        images.append({'name':item.get('name'),'format':item['mimeType'],'size':[w,h],'bytes':len(payload)})
    gpu=round(sum(i['size'][0]*i['size'][1]*4*4/3 for i in images))
    assert final.stat().st_size<=brief['performanceBudget']['maxVLowBytes']
    assert gpu<=brief['performanceBudget']['maxHighTextureBytes']
    materials=[];expected=read(PACKAGE/'authoring-receipt.json')['baseColorFactors']
    for name in ['aged_walnut','polished_walnut','oxblood_leather']+['parquet_oak_'+str(i) for i in range(5)]:
        mat=next(m for m in g['materials'] if m['name']==name);before=next(m for m in original['materials'] if m['name']==name);pbr=mat['pbrMetallicRoughness']
        assert 'baseColorTexture' in pbr and 'metallicRoughnessTexture' in pbr and 'normalTexture' in mat,name
        assert pbr.get('baseColorFactor')==before['pbrMetallicRoughness'].get('baseColorFactor'),name
        assert all(abs(a-b)<1e-6 for a,b in zip(pbr.get('baseColorFactor',[1,1,1,1]),expected[name])),name
        materials.append({'name':name,'baseColorTexture':True,'roughnessTexture':True,'normalTexture':True,'baseColorFactor':pbr.get('baseColorFactor',[1,1,1,1])})
    optimization={'tool':'@gltf-transform/cli@4.5.1','steps':['resize all textures to at most 512x512','WebP quality 90 for baseColorTexture only; normals remain PNG','meshopt high, position 16, normal 10, texcoord 16 bits requested; repeating UVs preserved as floats by tool'],'rawSha256':sha(raw),'rawBytes':raw.stat().st_size,'finalSha256':sha(final),'finalBytes':final.stat().st_size,'trianglesBefore':triangles(original),'trianglesAfter':triangles(g),'images':images,'estimatedRgbaTextureBytesWithMipmaps':gpu,'gpuEstimateNote':'Texture storage estimate only; excludes render targets, geometry buffers, browser and process memory.','extensionsRequired':g.get('extensionsRequired',[]),'rawExportReceiptSha256':sha(PACKAGE/'runtime/raw-export.json'),'recorderSha256':sha(Path(__file__))}
    write(PACKAGE/'runtime/optimization.json',optimization);write(PACKAGE/'runtime/material-check.json',{'passed':True,'assetSha256':sha(final),'materials':materials,'requiredNodes':sorted(required),'scriptSha256':sha(Path(__file__))})
    nav=read(OUTPUT/'navigation.json');nav['assetSha256']=sha(final);write(OUTPUT/'navigation.json',nav)
    manifest['rawAsset']={'path':'meshes/classic-street-raw.glb','sha256':sha(raw),'bytes':raw.stat().st_size}
    manifest['asset']['sha256']=sha(final);manifest['asset']['bytes']=final.stat().st_size;manifest['navigation']['sha256']=sha(OUTPUT/'navigation.json')
    manifest['optimization']={'path':'runtime/optimization.json','sha256':sha(PACKAGE/'runtime/optimization.json'),'decoder':'Three.js bundled MeshoptDecoder','textures':'512px; WebP base color, PNG normal'}
    manifest['lighting']='Runtime PBR with hemisphere/key/fixture lights, RoomEnvironment reflections and reduced-resolution GTAO. No baked-lightmap or offline-render equivalence claim.'
    write(OUTPUT/'manifest.json',manifest);write(PACKAGE/'runtime-export.json',manifest)
    print(json.dumps({'bytes':final.stat().st_size,'triangles':triangles(g),'estimatedTextureBytes':gpu,'assetSha256':sha(final)}))

if __name__=='__main__':main()
