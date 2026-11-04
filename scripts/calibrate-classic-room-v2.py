"""Record the explicit runtime fixture calibration separately from Blender watts."""
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parents[1];PACKAGE=ROOT/'docs/3d-town/classic-railway-v2';OUTPUT=ROOT/'public/assets/classic-railway/v2'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
manifest=json.loads((OUTPUT/'manifest.json').read_text(encoding='utf-8'))
assert manifest['asset']['sha256']==sha(OUTPUT/'classic-railway.glb')
overrides={'hearth-embers':{'color':'#ff5620','runtimeIntensity':1.3}}
for fixture in manifest['lights']:
    if fixture['id'] in overrides:fixture.update(overrides[fixture['id']])
manifest['runtimeFixtureCalibration']={'scriptSha256':sha(Path(__file__)),'overrides':overrides,'reason':'Keep a localized warm ember source in the cutaway WebGL view; artistic calibration, not radiometric or offline-render equivalence.'}
for file in (OUTPUT/'manifest.json',PACKAGE/'runtime-export.json'):file.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
