"""Bake original procedural PBR surfaces, retaining semantic pick groups.

No lightmap, external texture or third-party asset is synthesized or claimed.
"""
import math
import time

import bpy


def triangulated_copy(mesh):
    """Keep the evaluator's triangles, UV corners and custom normals exactly."""
    mesh.calc_loop_triangles()
    triangles=list(mesh.loop_triangles)
    corners=mesh.corner_normals
    output=bpy.data.meshes.new(mesh.name+' Triangles')
    output.from_pydata([v.co for v in mesh.vertices],[],[tuple(t.vertices) for t in triangles])
    output.update()
    for mat in mesh.materials:
        output.materials.append(mat)
    source_loops=[index for tri in triangles for index in tri.loops]
    for layer in mesh.uv_layers:
        uv=output.uv_layers.new(name=layer.name)
        uv.data.foreach_set('uv',[value for index in source_loops for value in layer.data[index].uv])
    for poly,tri in zip(output.polygons,triangles):
        source=mesh.polygons[tri.polygon_index]
        poly.use_smooth=source.use_smooth
        poly.material_index=source.material_index
    output.normals_split_custom_set([corners[i].vector for i in source_loops])
    bpy.data.meshes.remove(mesh)
    return output


def bake_runtime(base, output, size=2048):
    scene=bpy.context.scene
    deps=bpy.context.evaluated_depsgraph_get()
    texture_dir=output/'textures'
    texture_dir.mkdir(exist_ok=True)
    group_names=sorted({obj.get('review_group','architecture') for obj in base.GEOMETRY})
    groups={name:index for index,name in enumerate(group_names)}
    duplicates=[]
    retained=[]
    for obj in base.GEOMETRY:
        mesh=bpy.data.meshes.new_from_object(obj.evaluated_get(deps),preserve_all_data_layers=True,depsgraph=deps)
        source_materials=[slot.material for slot in obj.material_slots]
        used_indices=sorted({poly.material_index for poly in mesh.polygons})
        if not source_materials or any(index>=len(source_materials) or source_materials[index] is None for index in used_indices):
            raise RuntimeError('Missing authored material on '+obj.name)
        # Applied Boolean cutters can leave unused empty slots. Preserve every
        # face assignment while dropping slots that no evaluated face uses.
        mesh.materials.clear()
        for index in used_indices:
            mesh.materials.append(source_materials[index])
        material_remap={index:i for i,index in enumerate(used_indices)}
        for poly in mesh.polygons:
            poly.material_index=material_remap[poly.material_index]
        mesh=triangulated_copy(mesh)
        # Preserve per-object procedural coordinates before consolidation. Otherwise
        # Object/Generated shaders silently change when the whole room is joined.
        local=[vertex.co.copy() for vertex in mesh.vertices]
        low=[min(v[i] for v in local) for i in range(3)]
        high=[max(v[i] for v in local) for i in range(3)]
        object_coords=mesh.attributes.new('bake_object_coord','FLOAT_VECTOR','POINT')
        object_coords.data.foreach_set('vector',[value for vertex in local for value in vertex])
        generated=mesh.attributes.new('bake_generated_coord','FLOAT_VECTOR','POINT')
        generated.data.foreach_set('vector',[(v[i]-low[i])/max(high[i]-low[i],1e-8) for v in local for i in range(3)])
        mesh.transform(obj.matrix_world)
        copy=bpy.data.objects.new('BAKE_'+obj.name,mesh)
        scene.collection.objects.link(copy)
        copy['review_group']=obj.get('review_group','architecture')
        attribute=mesh.attributes.new('room_semantic','INT','FACE')
        attribute.data.foreach_set('value',[groups[copy['review_group']]]*len(mesh.polygons))
        if mesh.materials[0].name in ('Optical Glass','Warm Diffuser'):
            copy.name=copy['review_group']+'__'+obj.name
            retained.append(copy)
        else:
            duplicates.append(copy)
        obj.hide_render=True
        obj.hide_set(True)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in duplicates:
        obj.select_set(True)
    bpy.context.view_layer.objects.active=duplicates[0]
    bpy.ops.object.join()
    atlas=bpy.context.object
    atlas.name='Baked atlas source'
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.002,area_weight=.5,correct_aspect=True,scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    atlas.data.uv_layers.active.name='RoomAtlasUV'
    atlas_uv=atlas.data.uv_layers.active.data
    semantic=atlas.data.attributes['room_semantic'].data
    # Spend texels on the close-up investigation surface, rather than letting
    # the large architectural shell dominate a uniformly scaled room atlas.
    weights={groups['hero-evidence-table-01']:3.2,groups['caseboard-east']:1.4,groups['caseboard-west']:1.4}
    for poly in atlas.data.polygons:
        weight=weights.get(semantic[poly.index].value,1)
        for index in poly.loop_indices:
            atlas_uv[index].uv*=weight
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(rotate=True,scale=True,margin=.002,margin_method='FRACTION')
    bpy.ops.object.mode_set(mode='OBJECT')
    missing=[poly.index for poly in atlas.data.polygons if atlas.data.materials[poly.material_index] is None]
    if missing:
        raise RuntimeError('Joined atlas has faces with no material: '+str(missing[:10]))
    materials=list(dict.fromkeys(mat for mat in atlas.data.materials if mat is not None))
    for mat in materials:
        tree=mat.node_tree
        for coord in [node for node in tree.nodes if node.type=='TEX_COORD']:
            for socket,attribute_name in [('Object','bake_object_coord'),('Generated','bake_generated_coord')]:
                links=list(coord.outputs[socket].links)
                if not links:
                    continue
                attribute=tree.nodes.new('ShaderNodeAttribute')
                attribute.attribute_name=attribute_name
                for link in links:
                    tree.links.new(attribute.outputs['Vector'],link.to_socket)
    scene.render.bake.use_clear=True
    scene.render.bake.margin=6
    scene.render.bake.use_selected_to_active=False
    scene.cycles.samples=16
    images={}
    timings={}

    def image(name, colorspace, fill):
        result=bpy.data.images.new('Room '+name,width=size,height=size,alpha=False)
        result.generated_color=(*fill,1)
        result.colorspace_settings.name=colorspace
        result.filepath_raw=str(texture_dir/(name+'.png'))
        result.file_format='PNG'
        return result

    for channel,colorspace,fill in [('albedo','sRGB',(0,0,0)),('orm','Non-Color',(1,.5,0)),('normal','Non-Color',(.5,.5,1))]:
        target=image(channel,colorspace,fill)
        images[channel]=target
        changes=[]
        target_nodes=[]
        try:
            for mat in materials:
                tree=mat.node_tree
                bsdf=tree.nodes.get('Principled BSDF')
                output_node=next(n for n in tree.nodes if n.type=='OUTPUT_MATERIAL' and n.is_active_output)
                tex=tree.nodes.new('ShaderNodeTexImage')
                tex.image=target
                tree.nodes.active=tex
                target_nodes.append((tree,tex))
                if channel=='normal':
                    continue
                original=list(output_node.inputs['Surface'].links)
                emission=tree.nodes.new('ShaderNodeEmission')
                emission.inputs['Strength'].default_value=1
                extra=[]
                if channel=='albedo':
                    color=bsdf.inputs['Base Color']
                    if color.is_linked:
                        tree.links.new(color.links[0].from_socket,emission.inputs['Color'])
                    else:
                        emission.inputs['Color'].default_value=color.default_value
                else:
                    combine=tree.nodes.new('ShaderNodeCombineColor')
                    combine.mode='RGB'
                    combine.inputs['Red'].default_value=1  # No baked occlusion is asserted.
                    for name,socket in [('Roughness','Green'),('Metallic','Blue')]:
                        value=bsdf.inputs[name]
                        if value.is_linked:
                            tree.links.new(value.links[0].from_socket,combine.inputs[socket])
                        else:
                            combine.inputs[socket].default_value=value.default_value
                    tree.links.new(combine.outputs['Color'],emission.inputs['Color'])
                    extra.append(combine)
                sources=[link.from_socket for link in original]
                tree.links.new(emission.outputs['Emission'],output_node.inputs['Surface'])
                changes.append((tree,output_node,sources,[emission]+extra))
            start=time.perf_counter()
            bpy.ops.object.bake(type='NORMAL' if channel=='normal' else 'EMIT',normal_space='TANGENT')
            timings[channel]=round(time.perf_counter()-start,2)
            target.save()
            target.pack()
            print('MATERIAL_BAKED='+channel+' '+str(timings[channel]),flush=True)
        finally:
            for tree,output_node,sources,nodes in changes:
                for link in list(output_node.inputs['Surface'].links):
                    tree.links.remove(link)
                for source in sources:
                    tree.links.new(source,output_node.inputs['Surface'])
                for node in nodes:
                    tree.nodes.remove(node)
            for tree,node in target_nodes:
                tree.nodes.remove(node)

    baked=bpy.data.materials.new('Room Baked PBR')
    baked.use_nodes=True
    tree=baked.node_tree
    bsdf=tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value=.65
    nodes={}
    for channel,img in images.items():
        tex=tree.nodes.new('ShaderNodeTexImage')
        tex.image=img
        nodes[channel]=tex
    tree.links.new(nodes['albedo'].outputs['Color'],bsdf.inputs['Base Color'])
    separate=tree.nodes.new('ShaderNodeSeparateColor')
    separate.mode='RGB'
    tree.links.new(nodes['orm'].outputs['Color'],separate.inputs['Color'])
    tree.links.new(separate.outputs['Green'],bsdf.inputs['Roughness'])
    tree.links.new(separate.outputs['Blue'],bsdf.inputs['Metallic'])
    normal=tree.nodes.new('ShaderNodeNormalMap')
    tree.links.new(nodes['normal'].outputs['Color'],normal.inputs['Color'])
    tree.links.new(normal.outputs['Normal'],bsdf.inputs['Normal'])

    # Split by original semantic group without changing UVs, winding or split normals.
    mesh=atlas.data
    semantic=mesh.attributes['room_semantic'].data
    uv=mesh.uv_layers.active.data
    corners=mesh.corner_normals
    runtime=[]
    for name,identifier in groups.items():
        polygons=[poly for poly in mesh.polygons if semantic[poly.index].value==identifier]
        if not polygons:
            continue
        vertex_ids=sorted({index for poly in polygons for index in poly.vertices})
        remap={index:i for i,index in enumerate(vertex_ids)}
        part=bpy.data.meshes.new('Runtime '+name)
        part.from_pydata([mesh.vertices[i].co for i in vertex_ids],[],[[remap[i] for i in poly.vertices] for poly in polygons])
        part.update()
        uv_out=part.uv_layers.new(name='RoomAtlasUV')
        source_loops=[i for poly in polygons for i in poly.loop_indices]
        uv_out.data.foreach_set('uv',[value for index in source_loops for value in uv[index].uv])
        for poly,source in zip(part.polygons,polygons):
            poly.use_smooth=source.use_smooth
        part.normals_split_custom_set([corners[i].vector for i in source_loops])
        part.materials.append(baked)
        obj=bpy.data.objects.new(name,part)
        scene.collection.objects.link(obj)
        obj['review_group']=name
        obj['asset_status']='candidate-only'
        runtime.append(obj)
    atlas.hide_render=True
    atlas.hide_set(True)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in runtime+retained:
        obj.select_set(True)
    bpy.context.view_layer.objects.active=runtime[0]
    path=output/'review-room-candidate.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,
                             export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=True,export_tangents=True,
                             export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,
                             export_draco_position_quantization=20,export_draco_normal_quantization=14,
                             export_draco_texcoord_quantization=20,export_draco_color_quantization=16,export_draco_generic_quantization=16)
    blend=output/'runtime-baked.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    return {'schema':'game-room.pbr-bake-receipt.v1','atlasSize':[size,size],
            'source':'original local procedural Blender materials','bakePasses':timings,
            'textures':[{'channel':name,'path':str(img.filepath_raw).replace('\\','/').split(output.as_posix()+'/')[-1],
                         'sha256':base.sha(texture_dir/(name+'.png')),'bytes':(texture_dir/(name+'.png')).stat().st_size,
                         'colorSpace':img.colorspace_settings.name} for name,img in images.items()],
            'semanticGroups':group_names,'runtimeMeshObjects':len(runtime+retained),
            'reviewGlbSha256':base.sha(path),'runtimeBlendSha256':base.sha(blend),
            'bakedChannels':['baseColor','roughness','metallic','tangentNormal'],
            'compression':{'method':'KHR_draco_mesh_compression','quantizationBits':{'position':20,'normal':14,'uv':20,'generic':16},'simplification':False},
            'atlasPolicy':{'heroLinearTexelWeight':3.2,'caseboardLinearTexelWeight':1.4,'normalizedGutter':.002},
            'ambientOcclusionBaked':False,'lightingBaked':False,'humanApproval':False}
