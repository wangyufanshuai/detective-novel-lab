"""Capture local scene reflection including calibrated, camera-only area sources."""
import math,time
import bpy
import numpy as np
from mathutils import Matrix


def render_probe(base,output):
    scene=bpy.context.scene
    calibration=base.read(output/'reflection-calibration.json')
    if not calibration['passed'] or not calibration['cameraOnlyProxy']['passed']:
        raise RuntimeError('Independent reflection calibration is required.')
    proxies=[];proxy_records=[];temporary_materials=[]
    for fixture in base.LIGHTS:
        light=bpy.data.objects[fixture['id']];data=light.data
        if data.type!='AREA':continue
        if not data.normalize or abs(data.spread-math.pi)>1e-5 or data.shape not in ('DISK','SQUARE'):
            raise RuntimeError('Area source is outside the measured normalization/shape/spread scope.')
        size=data.size;area=math.pi*(size/2)**2 if data.shape=='DISK' else size**2
        if data.shape=='DISK':
            bpy.ops.mesh.primitive_circle_add(vertices=96,radius=size/2,fill_type='NGON')
        else:bpy.ops.mesh.primitive_plane_add(size=size)
        obj=bpy.context.object;obj.name='Probe-only '+light.name
        obj.matrix_world=light.matrix_world@Matrix.Rotation(math.pi,4,'X')
        for prop in ('visible_diffuse','visible_glossy','visible_transmission','visible_volume_scatter','visible_shadow'):
            setattr(obj,prop,False)
        mat=bpy.data.materials.new(obj.name);mat.use_nodes=True;mat.cycles.emission_sampling='NONE'
        tree=mat.node_tree;tree.nodes.clear()
        emission=tree.nodes.new('ShaderNodeEmission');emission.inputs['Color'].default_value=(*data.color,1)
        intensity=data.energy*(2**data.exposure)/area*calibration['normalizedAreaRadianceFactor']
        emission.inputs['Strength'].default_value=intensity
        transparent=tree.nodes.new('ShaderNodeBsdfTransparent');geometry=tree.nodes.new('ShaderNodeNewGeometry')
        mix=tree.nodes.new('ShaderNodeMixShader');out=tree.nodes.new('ShaderNodeOutputMaterial')
        tree.links.new(geometry.outputs['Backfacing'],mix.inputs[0]);tree.links.new(emission.outputs[0],mix.inputs[1])
        tree.links.new(transparent.outputs[0],mix.inputs[2]);tree.links.new(mix.outputs[0],out.inputs['Surface'])
        obj.data.materials.append(mat);proxies.append(obj);temporary_materials.append(mat)
        proxy_records.append({'fixture':light.name,'shape':data.shape,'diameterOrSideMeters':size,'areaMeters2':area,
                              'powerWatts':data.energy,'exposure':data.exposure,'linearColor':list(data.color),
                              'radiance':intensity,'cameraOnly':True,'emissionSampling':'NONE'})
    original_camera=scene.camera
    original_resolution=(scene.render.resolution_x,scene.render.resolution_y)
    original_settings=(scene.render.image_settings.file_format,scene.render.image_settings.color_depth,scene.render.image_settings.color_mode)
    original_filepath=scene.render.filepath
    data=bpy.data.cameras.new('Local reflection capture')
    camera=bpy.data.objects.new('Local reflection capture',data);scene.collection.objects.link(camera)
    camera.location=(0,.50,1.45)
    # Equirectangular u=.5 points toward glTF +X; increasing u points to glTF +Z.
    # Blender Z-up is exported as glTF Y-up: (x,y,z) -> (x,z,-y).
    camera.rotation_euler=(math.pi/2,0,-math.pi/2)
    data.type='PANO';data.panorama_type='EQUIRECTANGULAR'
    scene.camera=camera;scene.render.resolution_x=1024;scene.render.resolution_y=512
    settings=scene.render.image_settings
    settings.file_format='OPEN_EXR';settings.color_depth='16';settings.color_mode='RGB';settings.exr_codec='ZIP'
    path=output/'textures/room-reflection.exr';path.parent.mkdir(exist_ok=True)
    scene.render.filepath=str(path)
    started=time.perf_counter()
    try:
        for obj in proxies:obj.hide_render=True
        bpy.ops.render.render(write_still=True)
        image=bpy.data.images.load(str(path),check_existing=False)
        values=np.empty(image.size[0]*image.size[1]*4,dtype=np.float32);image.pixels.foreach_get(values)
        rgb=values.reshape(-1,4)[:,:3]
        stats={'finite':bool(np.isfinite(rgb).all()),'min':float(rgb.min()),'max':float(rgb.max()),'mean':float(rgb.mean())}
        if not stats['finite'] or stats['max']<=1 or path.read_bytes()[:4]!=bytes((0x76,0x2f,0x31,0x01)):
            raise RuntimeError('Reflection capture must contain finite HDR scene radiance.')
        report={'schema':'game-room.local-reflection-probe.v1','path':'textures/room-reflection.exr',
                'sha256':base.sha(path),'bytes':path.stat().st_size,'size':[1024,512],'positionBlender':[0,.50,1.45],
                'positionGltf':[0,1.45,-.50],'projection':'equirectangular','centerDirectionGltf':[1,0,0],
                'encoding':'OpenEXR RGB half-float ZIP','colorSpace':'linear Rec.709','samples':scene.cycles.samples,
                'seconds':round(time.perf_counter()-started,2),'statistics':stats,'externalSource':False,
                'sourceBlendSha256':base.sha(output/'fog-lamp-evidence-room.blend'),
                'calibrationSha256':base.sha(output/'reflection-calibration.json'),'cameraOnlyAreaProxies':proxy_records,
                'areaSourcePolicy':'exclude analytic source cores from the runtime panorama; evaluate calibrated disk specular at the receiver position',
                'limitations':['Single static capture near the desk; no parallax correction or moving-object reflections.',
                               'Area-source radiance is represented in the panorama; analytic spot-source cores are not represented by camera proxies.'],
                'humanApproval':False}
        # Retain the unsuccessful infinite-distance source capture as an explicit
        # comparison artifact, never as the runtime environment.
        for obj in proxies:obj.hide_render=False
        comparison=output/'textures/room-reflection-with-sources.exr'
        scene.render.filepath=str(comparison);bpy.ops.render.render(write_still=True)
        report['sourceProxyComparison']={'path':'textures/room-reflection-with-sources.exr','sha256':base.sha(comparison),
                                         'bytes':comparison.stat().st_size,'runtimeAsset':False}
        base.write(output/'reflection-probe-receipt.json',report)
        return report
    finally:
        scene.camera=original_camera
        scene.render.resolution_x,scene.render.resolution_y=original_resolution
        settings.file_format,settings.color_depth,settings.color_mode=original_settings
        scene.render.filepath=original_filepath
        bpy.data.objects.remove(camera,do_unlink=True);bpy.data.cameras.remove(data)
        for obj in proxies:
            mesh=obj.data;bpy.data.objects.remove(obj,do_unlink=True);bpy.data.meshes.remove(mesh)
        for mat in temporary_materials:bpy.data.materials.remove(mat)
