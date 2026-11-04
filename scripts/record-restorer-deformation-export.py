"""Publish a versioned source-checked sleeve and gaze art candidate."""
from pathlib import Path
import importlib.util,json,copy
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/3d-town/classic-residents-v10';F=P/'resident-03';PUBLIC=ROOT/'public/assets/classic-residents/v10'
spec=importlib.util.spec_from_file_location('payload',ROOT/'scripts/record-classic-portrait-export.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
read,write,sha=p.read,p.write,p.sha
def ref(path):return {'path':path.relative_to(ROOT).as_posix(),'sha256':sha(path)}
def info(path):
    doc,images,mats=p.payload(path);primitives=[v for mesh in doc['meshes'] for v in mesh['primitives']]
    return doc,images,mats,{'triangles':sum(doc['accessors'][v['indices']]['count']//3 for v in primitives),'materials':len(doc['materials']),
        'clips':{a['name']:max(doc['accessors'][s['input']]['max'][0] for s in a['samplers']) for a in doc.get('animations',[])},'bones':sum(len(s['joints']) for s in doc.get('skins',[]))}
raw=read(F/'raw-export.json');saved=read(F/'saved-source-review.json');renders=read(F/'render-review.json');source=F/'rb-xu-zhiwei.blend'
assert sha(source)==raw['sourceSha256']==saved['sourceSha256']==renders['sourceSha256']
assert saved['reviewerSha256']==sha(ROOT/'scripts/finalize-restorer-deformation.py') and saved['reopenedDeliverySource']
assert all(v==0 for v in saved['maxima'].values()) and len(saved['frames'])==481
assert saved['sleeveStretchMaxima']['maximumEdgeLengthRatio']<2 and saved['maximumAttentiveGazeAngleDegrees']<6
for r in renders['renders']:assert sha(F/r['path'])==r['sha256']
assert len(renders['renders'])==12
before=ROOT/raw['resident']['path'];assert sha(before)==raw['resident']['sha256']
asset=PUBLIC/'resident-03.glb';a,ai,am,old=info(before);doc,images,mats,new=info(asset)
assert all(old[k]==new[k] for k in ('bones','triangles','materials'))
assert old['clips'].keys()==new['clips'].keys() and all(abs(old['clips'][k]-new['clips'][k])<1e-6 for k in old['clips'])
assert new['bones']==52 and new['triangles']==36668 and new['materials']==11
assert set(new['clips'])=={'Idle','Walk','InspectBook'} and abs(new['clips']['InspectBook']-8)<1e-6
assert asset.stat().st_size<6500000 and all(max(im['dimensions'])<=2048 for im in images)
assert {'EXT_meshopt_compression','EXT_texture_webp'}<=set(doc['extensionsUsed'])
for name in mats:
    assert am[name]['baseColorFactor']==mats[name]['baseColorFactor']
    if am[name]['normalTexture']:assert am[name]['normalTexture']['decodedRgbaSha256']==mats[name]['normalTexture']['decodedRgbaSha256']
for animation in doc['animations']:
    animated={doc['nodes'][c['target']['node']]['name'] for c in animation['channels'] if c['target']['path']=='rotation'}
    assert {'eye_L','eye_R','head'}<=animated,(animation['name'],animated)
manifest=read(ROOT/'public/assets/classic-residents/v9/resident-03.json');work=manifest['workAction']['workstation']
assert work==raw['workstationReuse'] and sha(ROOT/('public'+work['url']))==work['sha256']
manifest.update(sourceSha256=sha(source),asset={'url':'/assets/classic-residents/v10/resident-03.glb','sha256':sha(asset),'bytes':asset.stat().st_size},bones=52,
    licenseNoticeUrl='/assets/classic-residents/v10/LICENSE.ASSETS.md',construction='Retained anatomy, topology, UV, textures and 50 rest bones. Resculpted connected blouse with harmonic shoulder and elbow skin weights. Added two eye bones and book-aware head pitch to the authored work action. Workstation and hand paths retain v9.')
manifest['gazeArticulation']={'jointNames':['eye_L','eye_R'],'headJoint':'head','kind':'authored-book-attention','blink':False,'worldBound':False}
write(PUBLIC/'resident-03.json',manifest)
cast=read(ROOT/'public/assets/classic-residents/v9/cast.json');entry=next(e for e in cast['entries'] if e['actorId']=='resident-03')
entry.update(manifestUrl='/assets/classic-residents/v10/resident-03.json',manifestSha256=sha(PUBLIC/'resident-03.json'))
cast['presentation']='Three stationary art residents. Restorer sleeve deformation and authored gaze refined; other residents retain v8 and workstation retains v9. No Agent or case binding.'
write(PUBLIC/'cast.json',cast)
license=(ROOT/'public/assets/classic-residents/v9/LICENSE.ASSETS.md').read_text(encoding='utf-8')
license+='\n\n## v10 sleeve and gaze refinement\nProject-authored sleeve silhouette, skin-weight adjustment, eye bones and book-attention animation. Existing topology, UV, textures and upstream CC0 attribution retained. No new third-party assets or program code.\n'
(PUBLIC/'LICENSE.ASSETS.md').write_text(license,encoding='utf-8')
prior=read(ROOT/'docs/3d-town/classic-residents-v9/runtime-export.json');preserved=copy.deepcopy(prior['preservedOriginals'])
preserved += [prior['source'],prior['cast'],ref(ROOT/'public/assets/classic-residents/v9/resident-03.json')]
preserved += [{'path':'public'+r['asset']['url'],'sha256':r['asset']['sha256']} for r in prior['assets'].values()]
for item in preserved:assert sha(ROOT/item['path'])==item['sha256']
write(P/'runtime-export.json',{'schema':'classic-restorer-deformation-export.v10','source':ref(source),'cast':ref(PUBLIC/'cast.json'),'asset':manifest['asset'],
    'payload':new,'images':images,'reusedWorkstation':work,'savedSourceReview':ref(F/'saved-source-review.json'),'renders':ref(F/'render-review.json'),
    'rawExport':ref(F/'raw-export.json'),'optimizer':ref(ROOT/'scripts/optimize-restorer-deformation.ps1'),'preservedOriginals':preserved,'worldBound':False,'humanArtApproved':False})
print(json.dumps({'bytes':asset.stat().st_size,**new,'preservedOriginals':len(preserved)}))
