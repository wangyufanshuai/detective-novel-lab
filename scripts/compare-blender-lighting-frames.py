"""Compare actual matched-camera PNG buffers, without retouching any image."""
from pathlib import Path
import hashlib,json,math
import bpy
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/3d-rooms/candidates/blender-v5'
files={'reference':OUT/'renders/production.png','baked':OUT/'browser/matched-baked.png','dynamic':OUT/'browser/matched-dynamic.png'}
arrays={};inputs=[]
for name,path in files.items():
    image=bpy.data.images.load(str(path),check_existing=False)
    if list(image.size)!=[1600,900]:raise RuntimeError('Camera comparison needs equal 1600x900 frames.')
    values=np.empty(1600*900*4,dtype=np.float32);image.pixels.foreach_get(values)
    arrays[name]=values.reshape(900,1600,4)[:,:,:3]
    inputs.append({'role':name,'path':path.relative_to(OUT).as_posix(),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
metrics={}
for name in ('dynamic','baked'):
    delta=arrays[name]-arrays['reference']
    metrics[name]={'meanAbsoluteRGBError':float(np.abs(delta).mean()),'rootMeanSquareRGBError':float(np.sqrt(np.square(delta).mean())),
                   'meanRGB':arrays[name].mean(axis=(0,1)).tolist()}
metrics['relativeMAEReduction']=1-metrics['baked']['meanAbsoluteRGBError']/metrics['dynamic']['meanAbsoluteRGBError']
report={'schema':'game-room.lighting-image-comparison.v1','camera':'production','size':[1600,900],
        'method':'whole-image absolute and RMS differences of identically loaded Blender PNG RGB buffers; no alignment, crop or exposure adjustment',
        'inputs':inputs,'metrics':metrics,'sourceSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'limitations':['One camera, one static scene and one desktop browser; not perceptual or human art acceptance.',
                       'Tone mapping, specular approximation, texture sampling and renderers still differ.'],
        'humanApproval':False}
(OUT/'lighting-image-comparison.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print('LIGHTING_COMPARISON='+json.dumps(metrics))
