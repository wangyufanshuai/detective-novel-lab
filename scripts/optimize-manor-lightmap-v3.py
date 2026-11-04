"""Lossless ZIP + bounded binary16 conversion of the linear baked irradiance."""
from pathlib import Path
import bpy,numpy as np,json,hashlib
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/3d-town/snowbound-manor-v3';O=ROOT/'public/assets/snowbound-manor/v3'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
raw=P/'runtime/indirect-light.exr';denoise=json.loads((P/'runtime/lightmap-denoise.json').read_text(encoding='utf-8'))
assert denoise['inputSha256']==sha(raw) and sha(P/denoise['output'])==denoise['sha256']
original=bpy.data.images.load(str(P/denoise['output']));original.colorspace_settings.name='Non-Color'
width,height=original.size;before=np.empty(width*height*4,dtype=np.float32);original.pixels.foreach_get(before)
scene=bpy.context.scene;settings=scene.render.image_settings;settings.file_format='OPEN_EXR';settings.color_mode='RGB';settings.color_depth='16';settings.exr_codec='ZIP'
target=O/'indirect-light.exr';original.save_render(str(target),scene=scene)
converted=bpy.data.images.load(str(target),check_existing=False);after=np.empty_like(before);converted.pixels.foreach_get(after)
error=np.abs(before.reshape(-1,4)[:,:3]-after.reshape(-1,4)[:,:3]);assert np.isfinite(after).all()
assert error.max()<=max(.001,float(np.abs(before).max())*.001),'Unexpected linear-light conversion error'
record={'sourceSha256':sha(P/'snowbound-manor.blend'),'inputSha256':sha(raw),'sha256':sha(target),'bytes':target.stat().st_size,
        'width':width,'height':height,'colorSpace':'linear','storage':'RGB binary16, ZIP','maxAbsoluteError':float(error.max()),
        'generatorSha256':sha(Path(__file__)),'denoise':denoise,'errorScope':'binary16 conversion of already denoised lighting'}
(P/'runtime/lightmap-optimized.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
print(json.dumps(record),flush=True)
