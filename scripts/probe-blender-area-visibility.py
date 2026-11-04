"""Read-only opaque area-visibility feasibility probe, excluded from runtime."""
from pathlib import Path
import bpy,json,hashlib,numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
ROOT=Path(__file__).resolve().parents[1];SOURCE=ROOT/'docs/3d-rooms/candidates/blender-v8/runtime-baked.blend'
OUT=ROOT/'outputs/blender-v8-area-visibility-pilot';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=128;scene.cycles.use_denoising=False
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for device in prefs.devices:device.use=device.type=='OPTIX'
scene.cycles.device='GPU';scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=0
atlas=bpy.data.objects['Baked atlas source']
for obj in scene.objects:
    if obj.type=='MESH':obj.hide_render=obj!=atlas;obj.hide_set(obj!=atlas)
    if obj.type=='LIGHT':obj.hide_render=obj.name!='courtyard_key'
atlas.hide_render=False;atlas.hide_set(False)
material=bpy.data.materials.new('Visibility unit diffuse');material.use_nodes=True
tree=material.node_tree;tree.nodes.clear();bsdf=tree.nodes.new('ShaderNodeBsdfDiffuse');bsdf.inputs['Color'].default_value=(1,1,1,1)
out=tree.nodes.new('ShaderNodeOutputMaterial');tree.links.new(bsdf.outputs[0],out.inputs['Surface'])
atlas.data.materials.clear();atlas.data.materials.append(material)
for poly in atlas.data.polygons:poly.material_index=0
bpy.ops.object.select_all(action='DESELECT');atlas.select_set(True);bpy.context.view_layer.objects.active=atlas
scene.render.bake.use_clear=True;scene.render.bake.margin=2;scene.render.bake.use_selected_to_active=False
settings=scene.render.image_settings;size=512;arrays={};artifacts=[]
texture=tree.nodes.new('ShaderNodeTexImage');tree.nodes.active=texture
for mode in ('occluded','unoccluded'):
    atlas.visible_shadow=mode=='occluded'
    target=bpy.data.images.new('Visibility '+mode,width=size,height=size,alpha=False,float_buffer=True)
    target.colorspace_settings.name='Linear Rec.709';texture.image=target
    bpy.ops.object.bake(type='DIFFUSE',pass_filter={'DIRECT'},uv_layer='RoomLightUV')
    settings.file_format='OPEN_EXR';settings.color_depth='16';settings.color_mode='RGB';settings.exr_codec='ZIP'
    path=OUT/(mode+'.exr');target.save_render(str(path),scene=scene)
    pixels=np.empty(size*size*4,dtype=np.float32);target.pixels.foreach_get(pixels)
    arrays[mode]=pixels.reshape(size,size,4)[:,:,:3].copy()
    artifacts.append({'path':path.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
numerator=arrays['occluded'].mean(axis=2);denominator=arrays['unoccluded'].mean(axis=2)
valid=denominator>1e-4;ratio=numerator[valid]/denominator[valid]
mesh=atlas.data;mesh.calc_loop_triangles();uv=mesh.uv_layers['RoomLightUV'].data
bvh=BVHTree.FromPolygons([v.co for v in mesh.vertices],[tuple(t.vertices) for t in mesh.loop_triangles],all_triangles=True)
samples=[]
for label,origin,direction in [('under-table',(0,.5,.18),(0,0,-1)),('open-floor-east',(3,0,.5),(0,0,-1)),
                                ('open-floor-south',(0,-2.5,.5),(0,0,-1)),('west-wall',(-5.5,0,1.5),(-1,0,0)),
                                ('north-wall-away-window',(3,3.5,1.5),(0,1,0))]:
    point,normal,index,distance=bvh.ray_cast(Vector(origin),Vector(direction),10)
    if index is None:raise RuntimeError('No surface for '+label)
    tri=mesh.loop_triangles[index]
    mapped=barycentric_transform(point,*[mesh.vertices[i].co for i in tri.vertices],*[Vector((*uv[i].uv,0)) for i in tri.loops])
    x,y=np.clip((np.array([mapped.x,mapped.y])*size).astype(int),0,size-1)
    n=float(numerator[y,x]);d=float(denominator[y,x])
    samples.append({'label':label,'surfacePoint':list(point),'uv':list(mapped)[:2],
                    'occludedDirect':n,'unoccludedDirect':d,'visibility':n/d if d>1e-4 else None})
report={'schema':'game-room.area-visibility-feasibility.v1','sourceBlendSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'sourceSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'fixture':'courtyard_key','size':[size,size],
        'samplesPerBake':128,'method':'unit diffuse direct bake with opaque self-shadowing, divided by the same bake with shadow-ray visibility disabled',
        'validPixels':int(valid.sum()),'fractionStronglyOccluded':float((ratio<.1).mean()),
        'fractionNearUnoccluded':float((abs(ratio-1)<.05).mean()),'fractionAbove1Point1':float((ratio>1.1).mean()),
        'ratioQuantiles':np.quantile(ratio,[0,.1,.5,.9,1]).tolist(),'surfaceSamples':samples,'artifacts':artifacts,
        'feasibilityObserved':bool(valid.sum()>10000 and (ratio<.1).mean()>.1 and (abs(ratio-1)<.05).mean()>.05),
        'runtimeIntegrated':False,'humanApproval':False,
        'limitations':['Single source and opaque geometry only; glass was hidden.',
                       '512 px atlas is an experiment, not a macro-quality shadow asset.',
                       'Diffuse-weighted source visibility does not prove exact glossy occlusion; independent browser validation remains required.']}
(OUT/'receipt.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print('AREA_VISIBILITY='+json.dumps(report),flush=True)
