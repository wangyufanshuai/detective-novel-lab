"""Compare captured static visibility on/off with unchanged cameras and BRDF."""
from pathlib import Path
import bpy,json,hashlib,numpy as np,shutil,re
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/3d-rooms/candidates/blender-v11'
def sha(file):return hashlib.sha256(file.read_bytes()).hexdigest()
raw=(ROOT/'outputs/blender-v11-visibility-browser.log').read_text(encoding='utf-8-sig')
report=json.loads(re.search(r'### Result\r?\n([\s\S]+?)\r?\n### Ran Playwright code',raw).group(1))
if report['assetSha256']!=sha(OUT/'review-room-candidate.glb') or report['errors']:raise RuntimeError('Visibility captures do not match the loaded candidate')
def pixels(file):
    image=bpy.data.images.load(str(file),check_existing=False)
    if list(image.size)!=[1600,900]:raise RuntimeError('Camera dimensions differ')
    data=np.empty(1600*900*4,dtype=np.float32);image.pixels.foreach_get(data)
    return data.reshape(900,1600,4)[:,:,:3]
(OUT/'visibility-comparison').mkdir(exist_ok=True);measurements=[];captures=[]
for camera in ['production','hero-detail','lens-macro','joinery-detail','paper-detail']:
    reference=pixels(OUT/f'renders/{camera}.png');metrics={}
    for enabled in [True,False]:
        record=next(c for c in report['captures'] if c['camera']==camera and c['enabled']==enabled)
        label='on' if enabled else 'off';source=ROOT/record['file'];target=OUT/f'visibility-comparison/{camera}-{label}.png'
        shutil.copyfile(source,target);image=pixels(target);metrics[label]=float(np.abs(image-reference).mean())
        captures.append({'camera':camera,'enabled':enabled,'path':target.relative_to(OUT).as_posix(),'sha256':sha(target)})
    measurements.append({'camera':camera,'meanAbsoluteRGBError':metrics,'relativeReduction':1-metrics['on']/metrics['off']})
inputs=[]
for file in [Path(__file__),ROOT/'scripts/capture-blender-patina-visibility.cjs',ROOT/'scripts/lib/blender-patina-pass-viewer.html',
             ROOT/'scripts/lib/blender-craft-visibility.mjs',ROOT/'scripts/lib/blender-craft-disk-light.mjs',
             ROOT/'scripts/lib/blender-optics-disk-light.mjs',ROOT/'scripts/serve-blender-room-patina-pass.mjs',
             OUT/'review-room-candidate.glb',OUT/'area-visibility-receipt.json',
             *[OUT/f'renders/{camera}.png' for camera in ['production','hero-detail','lens-macro','joinery-detail','paper-detail']]]:
    inputs.append({'path':file.relative_to(ROOT).as_posix(),'sha256':sha(file)})
result={'schema':'game-room.static-visibility-comparison.v1','inputs':inputs,'captures':captures,'measurements':measurements,
        'gpuSamples':report['visibility']['measurements'],'scope':report['scope'],'humanApproval':False,
        'allViewsLowerImageError':all(m['relativeReduction']>0 for m in measurements),'artAcceptance':False}
(OUT/'visibility-image-comparison.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print('VISIBILITY_COMPARISON='+json.dumps(measurements),flush=True)
