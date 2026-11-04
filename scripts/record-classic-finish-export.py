"""Verify source identities, fitting checks and the actual skinned v6 GLB."""
from pathlib import Path
import importlib.util
import json

ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/'docs/3d-town/classic-residents-v6'
PUBLIC=ROOT/'public/assets/classic-residents/v6'
PREVIOUS=ROOT/'public/assets/classic-residents/v5'
spec=importlib.util.spec_from_file_location('portrait_export',ROOT/'scripts/record-classic-portrait-export.py')
portrait=importlib.util.module_from_spec(spec);spec.loader.exec_module(portrait)
read,write,sha=portrait.read,portrait.write,portrait.sha

def main():
    folder=PACKAGE/'resident-06'
    author,render,raw=[read(folder/n) for n in ('authoring-review.json','render-review.json','raw-export.json')]
    source=folder/'rb-gu-yuanshan.blend'
    assert sha(source)==author['sourceSha256']==render['sourceSha256']==raw['sourceSha256']
    for path,digest in author['inputs'].items():assert sha(ROOT/path)==digest
    for ledger in (ROOT/'docs/3d-town/classic-residents-v5/licensed/mrt-suit/provenance.json',ROOT/'docs/3d-town/classic-residents-v3/licensed/makehuman-system/provenance.json'):
        record=read(ledger);assert not record['upstreamProgramCodeIncluded']
        for item in record['files']:assert sha(ROOT/item['path'])==item['sha256']
    for im in author['packedTextures']:
        path=ROOT/im['path'];assert sha(path)==im['sha256'] and path.stat().st_size==im['packedBytes']
        assert max(im['dimensions'])<=2048
    assert len(author['animatedBounds'])==116 and not author['invalidWeightVertices']
    clearance=author['jacketTrouserClearance']
    assert len(clearance['frames'])==116 and clearance['maximumIntersectingTrianglePairs']==0
    assert all(r['intersectingTrianglePairs']==0 for r in clearance['frames'])
    required={'three-quarter','portrait','face-front','front','profile','back','walk-contact','walk-passing','hands'}
    assert {r['view'] for r in render['renders']}==required
    for row in render['renders']:assert sha(folder/row['path'])==row['sha256']
    raw_path,asset=folder/'rb-gu-yuanshan-raw.glb',PUBLIC/'resident-06.glb'
    assert sha(raw_path)==raw['rawSha256']
    before_doc,_,before_mats=portrait.payload(raw_path);doc,images,mats=portrait.payload(asset)
    before,after=[portrait.checks.summary(d) for d in (before_doc,doc)]
    for key in before:
        if key=='clips':
            assert before[key].keys()==after[key].keys()
            assert all(abs(before[key][n]-after[key][n])<1e-6 for n in before[key])
        else:assert before[key]==after[key],key
    assert after['triangles']==author['triangles']<60000 and after['materials']<=14
    assert len(after['joints'])==20 and {'Idle','Walk'}==set(after['clips'])
    assert asset.stat().st_size<6000000 and all(max(im['dimensions'])<=2048 for im in images)
    assert {'EXT_meshopt_compression','EXT_texture_webp'}<=set(doc['extensionsUsed'])
    assert mats.keys()==before_mats.keys()
    for name in mats:
        a,b=before_mats[name],mats[name]
        for key in ('alphaMode','alphaCutoff','doubleSided','baseColorFactor'):assert a[key]==b[key]
        if a['normalTexture']:assert a['normalTexture']['decodedRgbaSha256']==b['normalTexture']['decodedRgbaSha256']
        if a['baseColorTexture']:
            assert a['baseColorTexture']['dimensions']==b['baseColorTexture']['dimensions']
            assert b['baseColorTexture']['mimeType']=='image/webp'
    for name,expected in author['materialExpectations'].items():
        assert all(abs(a-b)<1e-6 for a,b in zip(mats[name]['baseColorFactor'],expected['baseColorFactor'])),name
    for name,expected in author['finishMaterialExpectations'].items():
        material=next(m for m in doc['materials'] if m['name']==name)
        before_material=next(m for m in before_doc['materials'] if m['name']==name)
        sheen=material['extensions']['KHR_materials_sheen']
        assert sheen==before_material['extensions']['KHR_materials_sheen']
        assert all(abs(a-b)<1e-6 for a,b in zip(sheen['sheenColorFactor'],expected['sheenColorFactor']))
        assert abs(sheen['sheenRoughnessFactor']-expected['sheenRoughnessFactor'])<1e-6
        assert abs(material['pbrMetallicRoughness']['roughnessFactor']-expected['roughnessFactor'])<1e-6
        if 'normalScale' in expected:assert abs(material['normalTexture']['scale']-expected['normalScale'])<1e-6
    finish={row['part']:row for row in author['surfaceFinishing']}
    assert finish['neck']['maximumFrontalOffsetMeters']==0 and finish['neck']['protectedFrontalVertices']>100
    assert finish['inner-collar']['closedManifold']
    assert len(finish['neck-clearance']['frames'])==116 and finish['neck-clearance']['maximumIntersectingTrianglePairs']==0
    assert all(r['intersectingTrianglePairs']==0 for r in finish['neck-clearance']['frames'])
    assert sha(ROOT/finish['wool']['albedoPath'])==finish['wool']['albedoSha256']
    manifest=read(PREVIOUS/'resident-06.json')
    manifest.update(sourceSha256=sha(source),triangles=after['triangles'],materialCount=after['materials'],
        asset={'url':'/assets/classic-residents/v6/resident-06.glb','sha256':sha(asset),'bytes':asset.stat().st_size},
        license='CC0-1.0 anatomical and portrait data plus MRT suit artwork; original project fitting, cap, pockets, shoes, skeleton and animation',
        licenseNoticeUrl='/assets/classic-residents/v6/LICENSE.ASSETS.md',
        construction='Preserved fitted CC0 tailoring with original fine wool and claret silk materials, a posterior-only neck transition and fitted inner collar. Original front face geometry, public identity and animation retained. No runtime cloth or Agent decisions.')
    write(PUBLIC/'resident-06.json',manifest)
    cast=read(PREVIOUS/'cast.json');entry=next(e for e in cast['entries'] if e['actorId']=='resident-06')
    entry.update(manifestUrl='/assets/classic-residents/v6/resident-06.json',manifestSha256=sha(PUBLIC/'resident-06.json'))
    cast['presentation']='Three fixed art residents: v3 restorer, v4 innkeeper and v6 station worker with fine wool, claret tie and refined neck transition. Idle presentation only; no Agent or case binding.'
    write(PUBLIC/'cast.json',cast)
    (PUBLIC/'LICENSE.ASSETS.md').write_text((PREVIOUS/'LICENSE.ASSETS.md').read_text(encoding='utf-8')+
        '\n\nThe v6 pass adds original low-contrast woven colour data, a claret tie material, posterior neck fitting and an inner collar stand. The MRT suit geometry, UVs and normal atlas remain CC0 source artwork; its earlier striped colour atlas is not used on the current wool. No new third-party assets or application code are introduced.\n',encoding='utf-8')
    old=read(ROOT/'docs/3d-town/classic-residents-v5/runtime-export.json')
    preserved=old['preservedOriginals']+[
        {'path':'docs/3d-town/classic-residents-v5/resident-06/rb-gu-yuanshan.blend','sha256':old['sourceSha256']},
        {'path':'public'+old['asset']['url'],'sha256':old['asset']['sha256']}]
    for item in preserved:assert sha(ROOT/item['path'])==item['sha256']
    report={'schema':'classic-finish-export.v6','actorId':'resident-06','sourceSha256':sha(source),
        'asset':manifest['asset'],'payload':after,'images':images,'materials':mats,'castSha256':sha(PUBLIC/'cast.json'),
        'preservedOriginals':preserved,'authoringReceiptSha256':sha(folder/'authoring-review.json'),
        'renderReceiptSha256':sha(folder/'render-review.json'),'optimizerSha256':sha(ROOT/'scripts/optimize-classic-finish.ps1'),
        'runtimeCloth':False,'humanArtApproved':False,'worldBound':False}
    write(PACKAGE/'runtime-export.json',report)
    print(json.dumps({'triangles':after['triangles'],'materials':after['materials'],'bytes':asset.stat().st_size,
        'preservedOriginals':len(preserved),'castSha256':report['castSha256']}))

if __name__=='__main__':main()
