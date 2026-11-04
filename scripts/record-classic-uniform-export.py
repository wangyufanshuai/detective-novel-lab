"""Verify source identities, fitting checks and the actual skinned v5 GLB."""
from pathlib import Path
import importlib.util
import json

ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/'docs/3d-town/classic-residents-v5'
PUBLIC=ROOT/'public/assets/classic-residents/v5'
PREVIOUS=ROOT/'public/assets/classic-residents/v4'
spec=importlib.util.spec_from_file_location('portrait_export',ROOT/'scripts/record-classic-portrait-export.py')
portrait=importlib.util.module_from_spec(spec);spec.loader.exec_module(portrait)
read,write,sha=portrait.read,portrait.write,portrait.sha

def main():
    folder=PACKAGE/'resident-06'
    author,render,raw=[read(folder/n) for n in ('authoring-review.json','render-review.json','raw-export.json')]
    source=folder/'rb-gu-yuanshan.blend'
    assert sha(source)==author['sourceSha256']==render['sourceSha256']==raw['sourceSha256']
    for path,digest in author['inputs'].items():assert sha(ROOT/path)==digest
    for ledger in (PACKAGE/'licensed/mrt-suit/provenance.json',ROOT/'docs/3d-town/classic-residents-v3/licensed/makehuman-system/provenance.json'):
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
    for name in ('mrt_fitted_uniform','mrt_shirt_and_tie'):
        material=next(m for m in doc['materials'] if m['name']==name)
        assert abs(material['normalTexture']['scale']-.18)<1e-6
    manifest=read(ROOT/'public/assets/classic-residents/v3/resident-06.json')
    manifest.update(sourceSha256=sha(source),triangles=after['triangles'],materialCount=after['materials'],
        asset={'url':'/assets/classic-residents/v5/resident-06.glb','sha256':sha(asset),'bytes':asset.stat().st_size},
        license='CC0-1.0 anatomical and portrait data plus MRT suit artwork; original project fitting, cap, pockets, shoes, skeleton and animation',
        licenseNoticeUrl='/assets/classic-residents/v5/LICENSE.ASSETS.md',
        construction='CC0 MRT double-breasted tailoring independently fitted to the original character and skeleton, preserving source UVs. Original curved welt pockets and neck/hem fitting. Preserved portrait features, cap and shoes. No runtime cloth or Agent decisions.')
    write(PUBLIC/'resident-06.json',manifest)
    cast=read(PREVIOUS/'cast.json');entry=next(e for e in cast['entries'] if e['actorId']=='resident-06')
    entry.update(manifestUrl='/assets/classic-residents/v5/resident-06.json',manifestSha256=sha(PUBLIC/'resident-06.json'))
    cast['presentation']='Three fixed art residents: v3 restorer, v4 innkeeper and v5 station worker with fitted CC0 tailoring. Idle presentation only; no Agent or case binding.'
    write(PUBLIC/'cast.json',cast)
    (PUBLIC/'LICENSE.ASSETS.md').write_text((PREVIOUS/'LICENSE.ASSETS.md').read_text(encoding='utf-8')+
        '\n\nThe v5 station worker uses Margaret Toigo / MRT male double-breasted suit artwork under CC0-1.0. Source: https://static.makehumancommunity.org/assets/assetpacks/suits01.html . Both OBJ and MHCLO headers explicitly state CC0. Textures and UVs come from that selected asset. Project adaptations include landmark fitting, normalized game skinning, collar and hem fitting, material factors and original curved welt pockets. No upstream application code is included. This is original fictional costume design, not a historical railway uniform replica.\n',encoding='utf-8')
    old=read(ROOT/'docs/3d-town/classic-residents-v4/runtime-export.json')
    preserved=old['preservedOriginals']+[
        {'path':'docs/3d-town/classic-residents-v4/resident-08/rb-lin-ali.blend','sha256':old['sourceSha256']},
        {'path':'public'+old['asset']['url'],'sha256':old['asset']['sha256']}]
    for item in preserved:assert sha(ROOT/item['path'])==item['sha256']
    report={'schema':'classic-uniform-export.v5','actorId':'resident-06','sourceSha256':sha(source),
        'asset':manifest['asset'],'payload':after,'images':images,'materials':mats,'castSha256':sha(PUBLIC/'cast.json'),
        'preservedOriginals':preserved,'authoringReceiptSha256':sha(folder/'authoring-review.json'),
        'renderReceiptSha256':sha(folder/'render-review.json'),'optimizerSha256':sha(ROOT/'scripts/optimize-classic-uniform.ps1'),
        'runtimeCloth':False,'humanArtApproved':False,'worldBound':False}
    write(PACKAGE/'runtime-export.json',report)
    print(json.dumps({'triangles':after['triangles'],'materials':after['materials'],'bytes':asset.stat().st_size,
        'preservedOriginals':len(preserved),'castSha256':report['castSha256']}))

if __name__=='__main__':main()
