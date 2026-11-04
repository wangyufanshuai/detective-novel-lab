"""Check export payloads before creating the opt-in living scene manifest."""
from pathlib import Path
import importlib.util,json
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('payload',ROOT/'scripts/record-classic-portrait-export.py')
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
read,write,sha=p.read,p.write,p.sha
P=ROOT/'docs/3d-town/classic-occupations-v1/resident-06/gesture-09'
OUT=ROOT/'public/assets/classic-occupations/v1';raw=read(P/'raw-export.json')
source=P/'occupation.blend';form=read(P/'form-review.json');fn=read(P/'function-review.json')
assert raw['sourceSha256']==form['sourceSha256']==fn['sourceSha256']==sha(source)
assert form['passed'] and fn['passed'] and raw['sourceUnchanged']
payloads={}
for name,key in [('resident-06','resident'),('workstation','workstation')]:
    original=ROOT/raw[key]['path'];assert sha(original)==raw[key]['sha256']
    a,images_a,mats_a=p.payload(original);b,images_b,mats_b=p.payload(OUT/(name+'.glb'))
    def describe(d):
        return {'triangles':sum(d['accessors'][v['indices']]['count']//3 for m in d['meshes'] for v in m['primitives']),
                'bones':sum(len(s['joints']) for s in d.get('skins',[])),'materials':len(d['materials']),
                'clips':{a['name']:max(d['accessors'][s['input']]['max'][0] for s in a['samplers']) for a in d.get('animations',[])}}
    before,after=describe(a),describe(b)
    assert all(before[k]==after[k] for k in ('triangles','bones','materials'))
    assert before['clips'].keys()==after['clips'].keys()
    assert all(abs(v-after['clips'][k])<1e-6 for k,v in before['clips'].items())
    assert 'EXT_meshopt_compression' in b.get('extensionsUsed',[])
    for mat in mats_a:
        assert mats_a[mat]['baseColorFactor']==mats_b[mat]['baseColorFactor']
        if mats_a[mat]['normalTexture']:assert mats_a[mat]['normalTexture']['decodedRgbaSha256']==mats_b[mat]['normalTexture']['decodedRgbaSha256']
    payloads[name]=after
body=payloads['resident-06'];assert body['bones']==50 and body['triangles']==58752
assert set(body['clips'])=={'Idle','Walk','VerifyTimetable'} and abs(body['clips']['VerifyTimetable']-10)<1e-6
assert payloads['workstation']['clips']=={}
def asset(name):
    file=OUT/name;return {'url':'/assets/classic-occupations/v1/'+name,'sha256':sha(file),'bytes':file.stat().st_size}
assert asset('resident-06.glb')['bytes']<7000000
base_manifest=ROOT/'public/assets/classic-bookshop/v2/manifest.json'
scene=read(base_manifest);base_cast=ROOT/('public'+scene['residentCast']['url']);assert sha(base_cast)==scene['residentCast']['sha256']
cast=read(base_cast);manifest=read(ROOT/'public/assets/classic-residents/v8/resident-06.json')
bounds=raw['workstationBounds']
manifest.update(sourceSha256=sha(source),asset=asset('resident-06.glb'),licenseNoticeUrl='/assets/classic-occupations/v1/LICENSE.ASSETS.md',
    construction='Original timetable rack and authored pointing loop. Retained topology, UV, anatomy, textures and rest bones. Rebound jacket shoulders and skirts; Idle/Walk shoulders abducted by 0.11 rad for coat clearance. Original leg animation retained.')
manifest['workAction']={'id':'verify-timetable','label':'核对时刻表','clip':'VerifyTimetable','durationSeconds':10,
    'propAnchor':'occupation_document_anchor','workstation':asset('workstation.glb'),
    'collider':{'center':[(bounds[a][0]+bounds[a][1])/2 for a in (0,1)],'size':[bounds[a][1]-bounds[a][0] for a in (0,1)]}}
write(OUT/'resident-06.json',manifest)
entry=next(e for e in cast['entries'] if e['actorId']=='resident-06')
entry.update(manifestUrl='/assets/classic-occupations/v1/resident-06.json',manifestSha256=sha(OUT/'resident-06.json'))
cast['presentation']='Three classical art residents; station timetable gesture candidate. Authoritative work and presence are supplied separately by the living world controller.'
write(OUT/'cast.json',cast)
scene['residentCast']={'url':'/assets/classic-occupations/v1/cast.json','sha256':sha(OUT/'cast.json')}
scene['occupationCandidate']={'residentId':'resident-06','sourceSha256':sha(source),'humanArtApproved':False}
write(OUT/'manifest.json',scene)
license=(ROOT/'public/assets/classic-residents/v8/LICENSE.ASSETS.md').read_text(encoding='utf-8')
license+='\n\n## Station occupation candidate\nProject-authored timetable rack, paper graphics, pointing animation and uniform skin weights. No new external models. Retained room materials and their attribution: /assets/classic-bookshop/v2/CREDITS.md. Human art approval remains pending.\n'
(OUT/'LICENSE.ASSETS.md').write_text(license,encoding='utf-8')
write(P/'runtime-export.json',{'sourceSha256':sha(source),'assets':{name:asset(name+'.glb') for name in payloads},'payloads':payloads,
    'sceneManifest':asset('manifest.json'),'cast':asset('cast.json'),'baseSceneManifestSha256':sha(base_manifest),
    'rawExportSha256':sha(P/'raw-export.json'),'functionReviewSha256':sha(P/'function-review.json'),'formReviewSha256':sha(P/'form-review.json'),
    'recorderSha256':sha(Path(__file__)),'humanArtApproved':False,'browserAccepted':False})
print(json.dumps({'payloads':payloads,'assets':{name:asset(name+'.glb')['bytes'] for name in payloads}}))
