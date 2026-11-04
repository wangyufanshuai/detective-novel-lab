"""Bake one linear HDR indirect-diffuse atlas on a read-only scene derivative."""
from pathlib import Path
import bpy, hashlib, json, math, numpy as np

def bake(package):
    source=package/'snowbound-manor.blend';identity=hashlib.sha256(source.read_bytes()).hexdigest()
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=64
    scene.render.threads_mode='FIXED';scene.render.threads=4
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='OPTIX';prefs.get_devices()
    for device in prefs.devices:device.use=device.type=='OPTIX'
    scene.cycles.device='GPU'
    selected=[]
    materials={'wood','dark_wood','edge_wood','ivory','plaster','damask','stone','sandstone','slate','rug','curtain','coal','black'}
    for obj in list(scene.objects):
        if obj.type!='MESH' or obj.get('instance'):continue
        if obj.get('layer') not in {'hall_floor','hall_front','hall_back','hall_west','hall_east','ceiling','interior'}:continue
        if any(m and m.name not in materials for m in obj.data.materials):continue
        selected.append(obj)
    original_names=[o.name for o in selected]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in selected:obj.select_set(True)
    bpy.context.view_layer.objects.active=selected[0]
    # Apply the evaluated geometry before joining so UV and bevel geometry agree.
    bpy.ops.object.convert(target='MESH');bpy.ops.object.join()
    target=bpy.context.object;target.name='baked_architecture';target['layer']='baked_architecture'
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    mesh=target.data
    uv=mesh.uv_layers.new(name='LightmapUV');mesh.uv_layers.active_index=len(mesh.uv_layers)-1
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(70),island_margin=.003,area_weight=.5,correct_aspect=True,scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    atlas=bpy.data.images.new('manor_indirect_linear',width=2048,height=2048,alpha=False,float_buffer=True)
    atlas.colorspace_settings.name='Non-Color'
    nodes=[]
    for material in mesh.materials:
        node=material.node_tree.nodes.new('ShaderNodeTexImage');node.image=atlas
        material.node_tree.nodes.active=node;nodes.append((material,node))
    scene.render.bake.use_pass_direct=False;scene.render.bake.use_pass_indirect=True;scene.render.bake.use_pass_color=False
    scene.render.bake.margin=6;scene.render.bake.use_clear=True
    # Freeze the joined derivative, then rebuild Blender's dependency graph.
    # In 5.2, baking immediately after a multi-object join crashed in index_mask.
    frozen=package/'runtime/bake-derivative.blend';frozen.parent.mkdir(exist_ok=True)
    bpy.context.view_layer.update();bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(frozen));bpy.ops.wm.open_mainfile(filepath=str(frozen))
    scene=bpy.context.scene;target=bpy.data.objects['baked_architecture'];mesh=target.data
    uv=mesh.uv_layers['LightmapUV'];atlas=bpy.data.images['manor_indirect_linear']
    bpy.ops.object.select_all(action='DESELECT');target.select_set(True);bpy.context.view_layer.objects.active=target
    print('BAKING INDIRECT DIFFUSE 2048, 64 SAMPLES',flush=True)
    bpy.ops.object.bake(type='DIFFUSE',pass_filter={'INDIRECT'},uv_layer='LightmapUV')
    output=package/'runtime/indirect-light.exr';output.parent.mkdir(exist_ok=True)
    atlas.filepath_raw=str(output);atlas.file_format='OPEN_EXR';atlas.save()
    pixels=np.empty(2048*2048*4,dtype=np.float32);atlas.pixels.foreach_get(pixels);rgb=pixels.reshape(-1,4)[:,:3]
    assert np.isfinite(rgb).all() and rgb.max()>0,'Empty or invalid indirect atlas'
    uvs=np.array([tuple(loop.uv) for loop in uv.data],dtype=np.float32)
    assert uvs.min()>=-.00001 and uvs.max()<=1.00001
    for material in mesh.materials:
        for node in list(material.node_tree.nodes):
            if node.type=='TEX_IMAGE' and node.image==atlas:material.node_tree.nodes.remove(node)
    mesh.uv_layers.active_index=0
    for layer in mesh.uv_layers:layer.active_render=layer.name!='LightmapUV'
    record={'schema':'manor-indirect-bake.v1','sourceSha256':identity,'generatorSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            'image':{'path':'runtime/indirect-light.exr','sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'bytes':output.stat().st_size,'width':2048,'height':2048,'colorSpace':'linear'},
            'parameters':{'engine':'Cycles','samples':64,'passes':['INDIRECT_DIFFUSE'],'direct':False,'color':False,'marginPixels':6,'uvLayer':'LightmapUV'},
            'receiverObjects':original_names,'receiverMeshes':len(original_names),'receiverVertices':len(mesh.vertices),
            'uvSha256':hashlib.sha256(uvs.tobytes()).hexdigest(),'valueRange':[float(rgb.min()),float(rgb.max())],
            'rgbMean':[float(v) for v in rgb.mean(axis=0)],'runtimeIntensity':math.pi,
            'normalization':'Cycles diffuse lighting without albedo is multiplied by pi before Three BRDF_Lambert divides irradiance by pi; runtime fixture powers remain separately calibrated.',
            'fullLightingParityClaimed':False}
    (package/'runtime/lightmap-bake.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
    assert hashlib.sha256(source.read_bytes()).hexdigest()==identity
    print(json.dumps({'bakedMeshes':len(original_names),'atlasBytes':output.stat().st_size,'max':float(rgb.max())}),flush=True)
    return record
