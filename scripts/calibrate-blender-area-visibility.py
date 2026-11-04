"""Independent empty, opaque and half-source controls for direct visibility."""
from pathlib import Path
import bpy,json,hashlib,numpy as np
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/3d-rooms/candidates/blender-v9/calibration'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1024
scene.cycles.use_denoising=False;scene.world.use_nodes=True
scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=0
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for device in prefs.devices:device.use=device.type=='OPTIX'
scene.cycles.device='GPU'
bpy.ops.mesh.primitive_plane_add(size=2);receiver=bpy.context.object;receiver.name='Unit receiver'
mat=bpy.data.materials.new('Unit diffuse');mat.use_nodes=True;nodes=mat.node_tree.nodes;nodes.clear()
out=nodes.new('ShaderNodeOutputMaterial');diffuse=nodes.new('ShaderNodeBsdfDiffuse');diffuse.inputs['Color'].default_value=(1,1,1,1)
mat.node_tree.links.new(diffuse.outputs[0],out.inputs[0]);receiver.data.materials.append(mat)
tex=nodes.new('ShaderNodeTexImage');nodes.active=tex
light_data=bpy.data.lights.new('Control source','AREA');light_data.shape='DISK';light_data.size=1;light_data.energy=100;light_data.normalize=True
light=bpy.data.objects.new('Control source',light_data);scene.collection.objects.link(light);light.location=(0,0,2)
bpy.ops.mesh.primitive_plane_add(size=2,location=(0,0,1));blocker=bpy.context.object;blocker.name='Opaque blocker'
blocker.data.materials.append(mat)
bpy.ops.object.select_all(action='DESELECT');receiver.select_set(True);bpy.context.view_layer.objects.active=receiver
scene.render.bake.margin=0;scene.render.bake.use_clear=True
records=[]
for mode in ['empty','full','half']:
    blocker.hide_render=mode=='empty';blocker.location.x=-1 if mode=='half' else 0
    values={}
    for shadows in [False,True]:
        blocker.visible_shadow=shadows;receiver.visible_shadow=shadows
        img=bpy.data.images.new(f'{mode}-{shadows}',width=64,height=64,alpha=False,float_buffer=True)
        img.colorspace_settings.name='Linear Rec.709';tex.image=img
        bpy.ops.object.bake(type='DIFFUSE',pass_filter={'DIRECT'})
        pixels=np.empty(64*64*4,dtype=np.float32);img.pixels.foreach_get(pixels)
        values['occluded' if shadows else 'unoccluded']=float(pixels.reshape(64,64,4)[30:34,30:34,:3].mean())
    expected={'empty':1,'full':0,'half':.5}[mode];ratio=values['occluded']/values['unoccluded']
    records.append({'mode':mode,**values,'visibility':ratio,'expectedVisibility':expected,'absoluteError':abs(ratio-expected),
                    'passed':abs(ratio-expected)<.03})
report={'schema':'game-room.area-visibility-calibration.v1','blenderVersion':bpy.app.version_string,
        'sourceSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'samples':1024,'receiver':'2m horizontal plane at z=0',
        'source':'1m disk, 100W at z=2','blocker':'2m opaque plane at z=1, centered or shifted x=-1m',
        'records':records,'tolerance':.03,'passed':all(r['passed'] for r in records),'humanApproval':False,
        'scope':'direct diffuse visibility under known symmetric controls; not a proof of arbitrary view-dependent glossy visibility'}
(OUT.parent/'area-visibility-calibration.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('VISIBILITY_CONTROL='+json.dumps(report),flush=True)
if not report['passed']:raise RuntimeError('Independent area visibility controls failed')
