"""Verify optimized action/prop payloads and publish a versioned art cast."""
from pathlib import Path
import importlib.util,copy,json
ROOT=Path(__file__).resolve().parents[1];PACKAGE=ROOT/'docs/3d-town/classic-residents-v9';FOLDER=PACKAGE/'resident-03';PUBLIC=ROOT/'public/assets/classic-residents/v9'
spec=importlib.util.spec_from_file_location('payload',ROOT/'scripts/record-classic-portrait-export.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
read,write,sha=p.read,p.write,p.sha

def info(path):
    doc,images,mats=p.payload(path);primitives=[v for mesh in doc['meshes'] for v in mesh['primitives']]
    return doc,images,mats,{'triangles':sum(doc['accessors'][v['indices']]['count']//3 for v in primitives),
        'materials':len(doc['materials']),'clips':{a['name']:max(doc['accessors'][s['input']]['max'][0] for s in a['samplers']) for a in doc.get('animations',[])},
        'bones':sum(len(s['joints']) for s in doc.get('skins',[]))}

def record(path):return {'path':path.relative_to(ROOT).as_posix(),'sha256':sha(path)}

raw=read(FOLDER/'raw-export.json');saved=read(FOLDER/'saved-contact-review.json');render=read(FOLDER/'render-review.json');source=FOLDER/'rb-xu-zhiwei.blend'
assert sha(source)==raw['sourceSha256']==saved['sourceSha256']==render['sourceSha256']
assert saved['reopenedDeliverySource'] and all(v==0 for v in saved['maxima'].values()) and len(saved['frames'])==481
assert saved['reviewerSha256']==sha(ROOT/'scripts/finalize-restorer-book-work.py')
assert saved['evaluatorSha256']==sha(ROOT/'scripts/build-blender-restorer-work.py')
amend_path=FOLDER/saved['cameraOnlyAmendment']['path'];assert sha(amend_path)==saved['cameraOnlyAmendment']['sha256']
amend=read(amend_path);previous=read(ROOT/amend['priorAmendment']['path'])
assert sha(ROOT/amend['priorAmendment']['path'])==amend['priorAmendment']['sha256']
assert amend['modelIdentityBefore']==amend['modelIdentityAfter']==previous['modelIdentityBefore']==previous['modelIdentityAfter']
assert amend['sourceSha256']==sha(source) and previous['sourceSha256']==amend['previousSource']['sha256']
for item in (amend,previous):assert sha(ROOT/item['previousSource']['path'])==item['previousSource']['sha256']
assert previous['previousSource']['sha256']==saved['originalEvaluatedOrExportedSourceSha256']==raw['originalEvaluatedOrExportedSourceSha256']
for r in render['renders']:assert sha(FOLDER/r['path'])==r['sha256']
reports={}
for name,key in [('resident-03','resident'),('workstation','workstation')]:
    before=ROOT/raw[key]['path'];assert sha(before)==raw[key]['sha256']
    path=PUBLIC/(name+'.glb');a,ai,am,old=info(before);doc,images,mats,new=info(path)
    assert old.keys()==new.keys()
    for k in ('triangles','materials','bones'):assert old[k]==new[k]
    assert old['clips'].keys()==new['clips'].keys() and all(abs(old['clips'][k]-new['clips'][k])<1e-6 for k in old['clips'])
    assert path.stat().st_size<6500000 and all(max(im['dimensions'])<=2048 for im in images)
    assert {'EXT_meshopt_compression','EXT_texture_webp'}<=set(doc['extensionsUsed'])
    for material in mats:
        assert am[material]['baseColorFactor']==mats[material]['baseColorFactor']
        if am[material]['normalTexture']:assert am[material]['normalTexture']['decodedRgbaSha256']==mats[material]['normalTexture']['decodedRgbaSha256']
    reports[name]={'asset':{'url':f'/assets/classic-residents/v9/{name}.glb','sha256':sha(path),'bytes':path.stat().st_size},'payload':new,'images':images}
actor=reports['resident-03']['payload'];prop=reports['workstation']['payload']
assert actor['bones']==50 and actor['triangles']==36668
assert set(actor['clips'])=={'Idle','Walk','InspectBook'} and abs(actor['clips']['InspectBook']-8)<1e-5
assert prop['bones']==0 and len(prop['clips'])==1 and abs(next(iter(prop['clips'].values()))-8)<1e-5
manifest=read(ROOT/'public/assets/classic-residents/v8/resident-03.json')
manifest.update(sourceSha256=sha(source),asset=reports['resident-03']['asset'],licenseNoticeUrl='/assets/classic-residents/v9/LICENSE.ASSETS.md',
    construction='Retained character with forearm-bound cuffs shortened by 12 mm in authored coordinates, and a finite opposed-thumb closed-book inspection. Independent workstation. No Agent decisions or case binding.')
manifest['handArticulation'].update(kind='authored-relaxed-and-book-grip',objectGrasping=True)
bounds=raw['workstationBounds'];collider={'center':[(bounds[i][0]+bounds[i][1])/2 for i in (0,1)],'size':[bounds[i][1]-bounds[i][0] for i in (0,1)]}
manifest['workAction']={'id':'inspect-book','label':'查看旧书动作','clip':'InspectBook','propClip':next(iter(prop['clips'])),'durationSeconds':8,
    'workstation':reports['workstation']['asset'],'collider':collider,'binding':'authored-kinematic-contact','pageTurning':False,'physicsSimulation':False}
write(PUBLIC/'resident-03.json',manifest)
cast=read(ROOT/'public/assets/classic-residents/v8/cast.json');entry=next(e for e in cast['entries'] if e['actorId']=='resident-03')
entry.update(manifestUrl='/assets/classic-residents/v9/resident-03.json',manifestSha256=sha(PUBLIC/'resident-03.json'))
cast['presentation']='Three stationary art residents. The restorer offers a finite user-triggered closed-book inspection with a separate workstation. Other residents retain v8. No Agent or case binding.'
write(PUBLIC/'cast.json',cast)
lic=(ROOT/'public/assets/classic-residents/v8/LICENSE.ASSETS.md').read_text(encoding='utf-8')
lic+='\n\n## v9 book inspection\nThe closed book, felt cradle, wooden workstand and inspection animation are authored in this project. No pages are turned. Walnut materials reuse the retained Poly Haven wood_table_001 CC0-1.0 textures already documented in classic-station/v1/CREDITS.md and its source Blender file. No new third-party assets or program code are introduced. The body retains the existing anatomical/texture attribution above. Cuff weights and hem positions are adjusted for wrist movement.\n'
(PUBLIC/'LICENSE.ASSETS.md').write_text(lic,encoding='utf-8')
prior=read(ROOT/'docs/3d-town/classic-residents-v8/runtime-export.json');preserved=copy.deepcopy(prior['preservedOriginals'])
for r in prior['residents']:
    preserved.extend([r['source'],{'path':'public'+r['asset']['url'],'sha256':r['asset']['sha256']}])
preserved.append(record(ROOT/'public/assets/classic-residents/v8/cast.json'))
preserved.extend([record(ROOT/'docs/3d-town/classic-station-v1/classic-station.blend'),record(ROOT/'public/assets/classic-station/v1/CREDITS.md')])
for r in preserved:assert sha(ROOT/r['path'])==r['sha256']
write(PACKAGE/'runtime-export.json',{'schema':'classic-restorer-work-export.v9','source':record(source),'cast':record(PUBLIC/'cast.json'),
    'assets':reports,'savedSourceReview':record(FOLDER/'saved-contact-review.json'),'renders':record(FOLDER/'render-review.json'),
    'rawExport':record(FOLDER/'raw-export.json'),'cameraAmendment':record(amend_path),'optimizer':record(ROOT/'scripts/optimize-restorer-book-work.ps1'),'workstationCollider':collider,
    'preservedOriginals':preserved,'worldBound':False,'humanArtApproved':False})
print(json.dumps({'assets':{k:{'bytes':v['asset']['bytes'],**v['payload']} for k,v in reports.items()},'preservedOriginals':len(preserved)}))
