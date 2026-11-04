"""Denoise the numeric indirect-light bake using Blender's compositor OIDN."""
from pathlib import Path
import bpy,json,hashlib,numpy as np
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/3d-town/snowbound-manor-v2';R=P/'runtime'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
raw=R/'indirect-light.exr';bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1;scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=scene.render.resolution_y=8;scene.render.resolution_percentage=100
scene.render.compositor_device='CPU';scene.render.compositor_denoise_device='CPU';scene.render.compositor_denoise_final_quality='HIGH'
camera=bpy.data.objects.new('empty-camera',bpy.data.cameras.new('empty-camera'));scene.collection.objects.link(camera);scene.camera=camera
graph=bpy.data.node_groups.new('Indirect atlas denoise','CompositorNodeTree');scene.compositing_node_group=graph
src=graph.nodes.new('CompositorNodeImage');src.image=bpy.data.images.load(str(raw));src.image.colorspace_settings.name='Non-Color'
denoise=graph.nodes.new('CompositorNodeDenoise');denoise.inputs['HDR'].default_value=True
output=graph.nodes.new('CompositorNodeOutputFile');folder=R/'denoised';folder.mkdir(exist_ok=True)
output.directory=str(folder);output.file_name='indirect-denoised';output.save_as_render=False
output.format.media_type='IMAGE';output.format.file_format='OPEN_EXR';output.format.color_mode='RGB';output.format.color_depth='16';output.format.exr_codec='ZIP'
output.file_output_items.new('RGBA','lightmap');graph.links.new(src.outputs['Image'],denoise.inputs['Image']);graph.links.new(denoise.outputs['Image'],output.inputs['lightmap'])
bpy.ops.render.render()
files=list(folder.glob('*.exr'));assert len(files)==1,files
image=bpy.data.images.load(str(files[0]));assert list(image.size)==[2048,2048]
data=np.empty(2048*2048*4,dtype=np.float32);image.pixels.foreach_get(data);assert np.isfinite(data).all() and data.max()>0
record={'schema':'manor-lightmap-denoise.v1','inputSha256':sha(raw),'output':files[0].relative_to(P).as_posix(),'sha256':sha(files[0]),
        'generatorSha256':sha(Path(__file__)),'method':'Blender compositor OIDN high, HDR; indirect illumination only, no guide textures',
        'scope':'Noise reduction for a static lighting candidate; no exact pixel/energy parity claim.'}
(R/'lightmap-denoise.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8');print(json.dumps(record),flush=True)
