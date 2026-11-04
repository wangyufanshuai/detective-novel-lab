"""Verify optimized payloads and create a separate three-occupation cast."""
from pathlib import Path
import argparse,importlib.util,json
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('payload',ROOT/'scripts/record-classic-portrait-export.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
read,write,sha=p.read,p.write,p.sha
parser=argparse.ArgumentParser();parser.add_argument('--pilot',required=True);args=parser.parse_args()
P=ROOT/'docs/3d-town/classic-occupations-v1/resident-08'/args.pilot;OUT=ROOT/'public/assets/classic-occupations/v2'
source=P/'occupation.blend';raw=read(P/'raw-export.json');form=read(P/'form-review.json');fn=read(P/'function-review.json')
assert raw['sourceSha256']==form['sourceSha256']==fn['sourceSha256']==sha(source) and raw['sourceUnchanged'] and fn['passed'] and form['passed']
payloads={}
for name,key in [('resident-08','resident'),('workstation','workstation')]:
    original=ROOT/raw[key]['path'];assert sha(original)==raw[key]['sha256']
    a,images_a,mats_a=p.payload(original);b,images_b,mats_b=p.payload(OUT/(name+'.glb'))
    def describe(d):
        return {'triangles':sum(d['accessors'][v['indices']]['count']//3 for m in d['meshes'] for v in m['primitives']),
            'bones':sum(len(s['joints']) for s in d.get('skins',[])),'materials':len(d['materials']),
            'clips':{a['name']:max(d['accessors'][s['input']]['max'][0] for s in a['samplers']) for a in d.get('animations',[])}}
    before,after=describe(a),describe(b);assert all(before[k]==after[k] for k in ('triangles','bones','materials'))
    assert before['clips'].keys()==after['clips'].keys() and all(abs(v-after['clips'][k])<1e-6 for k,v in before['clips'].items())
    assert 'EXT_meshopt_compression' in b.get('extensionsUsed',[])
    for mat in mats_a:
        assert mats_a[mat]['baseColorFactor']==mats_b[mat]['baseColorFactor']
        if mats_a[mat]['normalTexture']:assert mats_a[mat]['normalTexture']['decodedRgbaSha256']==mats_b[mat]['normalTexture']['decodedRgbaSha256']
    payloads[name]=after
body=payloads['resident-08'];assert body['bones']==52 and body['triangles']==58532
assert set(body['clips'])=={'Idle','Walk','ReconcileRegister'} and abs(body['clips']['ReconcileRegister']-10)<1e-6
assert set(payloads['workstation']['clips'])=={'WriteRegister_Prop'} and abs(payloads['workstation']['clips']['WriteRegister_Prop']-10)<1e-6
def asset(name):
    f=OUT/name;return {'url':'/assets/classic-occupations/v2/'+name,'sha256':sha(f),'bytes':f.stat().st_size}
assert asset('resident-08.glb')['bytes']<7000000
base=ROOT/'public/assets/classic-occupations/v1/manifest.json';scene=read(base);cast=read(ROOT/('public'+scene['residentCast']['url']))
assert sha(ROOT/('public'+scene['residentCast']['url']))==scene['residentCast']['sha256']
manifest=read(ROOT/'public/assets/classic-residents/v8/resident-08.json');bounds=raw['workstationBounds']
manifest.update(sourceSha256=sha(source),asset=asset('resident-08.glb'),bones=52,licenseNoticeUrl='/assets/classic-occupations/v2/LICENSE.ASSETS.md',
    construction='Original ten-second pen pickup, writing and return. Repaired blouse and capelet tailoring, linen cuffs and 2 eye controls. Retained topology, UV, anatomy, materials, original rest bones and Idle/Walk body motion. Register markings are decorative.')
manifest['handArticulation'].update(kind='authored-tripod-writing-grip',objectGrasping=True)
manifest['gazeArticulation']={'jointNames':['eye_L','eye_R'],'headJoint':'head'}
manifest['workAction']={'id':'reconcile-guest-register','label':'核对住客登记','clip':'ReconcileRegister','propClip':'WriteRegister_Prop','propAnchor':'occupation_pen_anchor','durationSeconds':10,
    'workstation':asset('workstation.glb'),'collider':{'center':[(bounds[a][0]+bounds[a][1])/2 for a in (0,1)],'size':[bounds[a][1]-bounds[a][0] for a in (0,1)]}}
write(OUT/'resident-08.json',manifest)
entry=next(e for e in cast['entries'] if e['actorId']=='resident-08');entry.update(manifestUrl='/assets/classic-occupations/v2/resident-08.json',manifestSha256=sha(OUT/'resident-08.json'))
cast['presentation']='Three classical residents with authored work gestures; accepted world work controls playback and visibility.';write(OUT/'cast.json',cast)
scene['residentCast']={'url':'/assets/classic-occupations/v2/cast.json','sha256':sha(OUT/'cast.json')}
scene['occupationCandidates']=[scene.pop('occupationCandidate'),{'residentId':'resident-08','sourceSha256':sha(source),'humanArtApproved':False}]
write(OUT/'manifest.json',scene)
license=(ROOT/'public/assets/classic-occupations/v1/LICENSE.ASSETS.md').read_text(encoding='utf-8')
license+='\n\n## Inn writing candidate\nProject-authored register, pen, hollow brass rest, desk, writing cycle, garment tailoring and gaze. No new external model. Retained room materials: /assets/classic-bookshop/v2/CREDITS.md. Human art approval remains pending.\n'
(OUT/'LICENSE.ASSETS.md').write_text(license,encoding='utf-8')
write(P/'runtime-export.json',{'sourceSha256':sha(source),'assets':{n:asset(n+'.glb') for n in payloads},'payloads':payloads,'sceneManifest':asset('manifest.json'),
    'cast':asset('cast.json'),'baseSceneManifestSha256':sha(base),'rawExportSha256':sha(P/'raw-export.json'),'formReviewSha256':sha(P/'form-review.json'),
    'functionReviewSha256':sha(P/'function-review.json'),'recorderSha256':sha(Path(__file__)),'humanArtApproved':False,'browserAccepted':False})
print(json.dumps({'payloads':payloads,'assets':{n:asset(n+'.glb')['bytes'] for n in payloads}}))
