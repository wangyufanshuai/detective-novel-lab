"""V6 outward-facing surfaces and physically seated drawing tools."""
import math
import bpy,bmesh
from mathutils import Vector


def signed_volume(obj,evaluated=False):
    mesh=bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get())) if evaluated else obj.data
    bm=bmesh.new();bm.from_mesh(mesh)
    value=bm.calc_volume(signed=True)*obj.matrix_world.to_3x3().determinant()
    closed=all(edge.is_manifold for edge in bm.edges)
    bm.free()
    if evaluated:bpy.data.meshes.remove(mesh)
    return value,closed


def refine(base):
    corrected=[]
    for name in ['envelope_flap','archive-lamp-left_shade','archive-lamp-right_shade']:
        obj=bpy.data.objects[name]
        before,closed=signed_volume(obj)
        if not closed or before>=0:raise RuntimeError('Expected known inward closed surface: '+name)
        bm=bmesh.new();bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        bm.to_mesh(obj.data);bm.free();obj.data.update()
        # Imported custom normals otherwise retain the pre-repair orientation.
        obj.data.normals_split_custom_set([(0,0,0)]*len(obj.data.loops))
        after,closed=signed_volume(obj,evaluated=True)
        if not closed or after<=0:raise RuntimeError('Surface orientation repair failed: '+name)
        corrected.append({'object':name,'beforeSignedVolumeMeters3':before,'afterSignedVolumeMeters3':after,'closed':closed})

    group='hero-evidence-table-01'
    felt=next(obj for obj in base.GROUPS[group] if 'tray-felt' in obj.name)
    low,high=base.bounds([felt]);surface=high[2]
    graphite=base.material('Pencil Graphite v6','343633',.83,.08)
    pencil_groups=[]
    for index in range(2):
        body=bpy.data.objects['cedar_pencil_'+str(index)]
        body.location.y+=.23  # Move the barrel wholly onto the writing pad.
        for modifier in body.modifiers:
            if modifier.type=='BEVEL':modifier.width=.0003
        axis=body.rotation_euler.to_matrix()@Vector((0,0,1))
        members=[body]
        for suffix,start,length,radius_a,radius_b,material in [
            ('sharpened-cedar',.11,.026,.004,.00095,base.MATERIALS['Pencil Cedar']),
            ('graphite-tip',.136,.006,.00095,0,graphite)
        ]:
            center=body.location+axis*(start+length/2)
            bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=radius_a,radius2=radius_b,depth=length,location=center)
            tip=bpy.context.object;tip.rotation_euler=body.rotation_euler
            base.finish(tip,'pencil_'+str(index)+'_'+suffix,material,0,group)
            members.append(tip)
        bottom=base.bounds(members)[0][2]
        for member in members:member.location.z+=surface+.00008-bottom
        bounds=base.bounds(members)
        pencil_groups.append({'index':index,'members':[obj.name for obj in members],
                              'supportGapMeters':bounds[0][2]-surface,
                              'insidePadXY':bounds[0][0]>=low[0] and bounds[1][0]<=high[0] and bounds[0][1]>=low[1] and bounds[1][1]<=high[1]})

    # Outwardness is distinct from manifoldness. Audit every final evaluated mesh.
    negative=[];nonclosed=[]
    for obj in base.GEOMETRY:
        value,closed=signed_volume(obj,evaluated=True)
        if value < -1e-12:negative.append({'object':obj.name,'signedVolumeMeters3':value})
        if not closed:nonclosed.append(obj.name)
    flap=bpy.data.objects['envelope_flap']
    deps=bpy.context.evaluated_depsgraph_get();mesh=bpy.data.meshes.new_from_object(flap.evaluated_get(deps))
    major=sorted(mesh.polygons,key=lambda p:p.area,reverse=True)[:2]
    major=sorted(major,key=lambda p:(flap.matrix_world@p.center).z)
    flap_normals=[list(p.normal) for p in major]
    bpy.data.meshes.remove(mesh)
    passed=not negative and not nonclosed and flap_normals[0][2]<-.99 and flap_normals[1][2]>.99 and all(p['insidePadXY'] and 0<=p['supportGapMeters']<.001 for p in pencil_groups)
    return {'schema':'game-room.surface-orientation-review.v1','correctedSurfaces':corrected,
            'evaluatedMeshes':len(base.GEOMETRY),'negativeVolumeObjects':negative,'nonClosedObjects':nonclosed,
            'envelopeBottomTopNormals':flap_normals,'pencils':pencil_groups,
            'passed':passed,'humanApproval':False}
