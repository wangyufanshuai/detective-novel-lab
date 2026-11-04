"""Measure the unit-world diffuse bake convention independently of the room."""
import bpy,json,hashlib,numpy as np
from pathlib import Path
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=64
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='OPTIX'
scene.cycles.device='GPU';scene.world.use_nodes=True
bg=scene.world.node_tree.nodes.get('Background');bg.inputs['Color'].default_value=(1,1,1,1);bg.inputs['Strength'].default_value=1
bpy.ops.mesh.primitive_plane_add(size=2)
obj=bpy.context.object
mat=bpy.data.materials.new('Calibration diffuse');mat.use_nodes=True;obj.data.materials.append(mat)
tree=mat.node_tree;tree.nodes.clear();output=tree.nodes.new('ShaderNodeOutputMaterial');diffuse=tree.nodes.new('ShaderNodeBsdfDiffuse')
tree.links.new(diffuse.outputs[0],output.inputs['Surface'])
target=bpy.data.images.new('Calibration image',width=32,height=32,float_buffer=True)
target.colorspace_settings.name='Linear Rec.709'
tex=tree.nodes.new('ShaderNodeTexImage');tex.image=target;tree.nodes.active=tex
records=[]
for value in (.2,.8):
    diffuse.inputs['Color'].default_value=(value,value,value,1)
    bpy.ops.object.bake(type='DIFFUSE',pass_filter={'DIRECT','INDIRECT'})
    pixels=np.empty(32*32*4,dtype=np.float32);target.pixels.foreach_get(pixels)
    rgb=pixels.reshape(32,32,4)[4:-4,4:-4,:3]
    records.append({'albedo':value,'meanBakedRadiance':float(rgb.mean()),'maximumDeviationFromUnit':float(np.abs(rgb-1).max())})
passed=all(abs(v['meanBakedRadiance']-1)<.03 for v in records)
root=Path(__file__).resolve().parents[1]
report={'schema':'game-room.diffuse-unit-calibration.v1','blenderVersion':bpy.app.version_string,
        'worldRadiance':1,'records':records,'bakeConvention':'unit Lambert reflected radiance without surface color',
        'threeLightMapIntensity':float(np.pi),'passed':passed,
        'sourceSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
(root/'docs/3d-rooms/candidates/blender-v5/lightmap-calibration.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print('CALIBRATION='+json.dumps(report))
if not passed:raise RuntimeError('Unexpected diffuse-light bake normalization.')
