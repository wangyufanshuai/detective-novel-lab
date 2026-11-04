"""Compare retained source data and the actual saved Walk action, v6 to v7."""
from pathlib import Path
import hashlib
import json
import struct
import bpy

ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/'docs/3d-town/classic-residents-v7'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()


def floats(values):
    digest=hashlib.sha256()
    for value in values:digest.update(struct.pack('<f',value))
    return digest.hexdigest()


def capture(version):
    path=ROOT/f'docs/3d-town/classic-residents-v{version}/resident-06/rb-gu-yuanshan.blend'
    bpy.ops.wm.open_mainfile(filepath=str(path))
    body=bpy.data.objects['rb-gu-yuanshan_skin'];rig=bpy.data.objects['rb-gu-yuanshan_rig']
    labels=body.data.attributes['UniformPart'].data
    neck=body.data.attributes['NeckLayer'].data
    head=[v for v in body.data.vertices if neck[v.index].value==1]
    hem=[v.index for v in body.data.vertices if labels[v.index].value==3 and v.co.z<.900 and v.co.y<-.050 and abs(v.co.x)<.160]
    assert head and hem
    data={'source':path.relative_to(ROOT).as_posix(),'sourceSha256':sha(path),'vertices':len(body.data.vertices),
        'headVertices':len(head),'headRestSha256':floats(c for v in head for c in v.co),
        'uvSha256':floats(c for loop in body.data.uv_layers.active.data for c in loop.uv),
        'boneRestSha256':floats(c for b in rig.data.bones for v in (b.head_local,b.tail_local) for c in v),
        'frontHemVertices':len(hem),'savedWalkFrames':[]}
    data['_uvValues']=[float(c) for loop in body.data.uv_layers.active.data for c in loop.uv]
    data['_uvParts']=[labels[loop.vertex_index].value for loop in body.data.loops]
    face_uv=[];uv_materials={}
    for face in body.data.polygons:
        corners=[]
        for index in face.loop_indices:
            uv=body.data.uv_layers.active.data[index].uv
            corners.append((body.data.loops[index].vertex_index,float(uv.x),float(uv.y)))
            uv_materials[index]=body.data.materials[face.material_index].name
        face_uv.append((tuple(sorted(face.vertices)),sorted(corners)))
    data['canonicalUvSha256']=hashlib.sha256(json.dumps(sorted(face_uv),separators=(',',':')).encode()).hexdigest()
    data['_uvMaterials']=uv_materials
    action=bpy.data.actions['Walk'];rig.animation_data_create();rig.animation_data.action=action
    if action.slots:rig.animation_data.action_slot=action.slots[0]
    for frame in range(1,26):
        bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
        evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh()
        points=[body.matrix_world@mesh.vertices[i].co for i in hem]
        angles=[]
        for side in ('L','R'):
            bone=rig.pose.bones['tail_'+side];rest=rig.data.bones[bone.name]
            angles.append((rest.tail_local-rest.head_local).angle(bone.tail-bone.head))
        data['savedWalkFrames'].append({'frame':frame,'frontHemMeanZ':sum(p.z for p in points)/len(points),
            'frontHemHighestZ':max(p.z for p in points),'tailAnglesRadians':angles})
        evaluated.to_mesh_clear()
    return data


old,new=capture(6),capture(7)
old_uv,new_uv=old.pop('_uvValues'),new.pop('_uvValues')
old_parts,new_parts=old.pop('_uvParts'),new.pop('_uvParts')
old_materials,new_materials=old.pop('_uvMaterials'),new.pop('_uvMaterials')
assert len(old_uv)==len(new_uv) and old_parts==new_parts
uv_changes=[(i,abs(a-b),old_parts[i//2]) for i,(a,b) in enumerate(zip(old_uv,new_uv)) if a!=b]
print(json.dumps({'uvChanges':len(uv_changes),'maximumUvChange':max((r[1] for r in uv_changes),default=0),
    'changedParts':{str(part):sum(r[2]==part for r in uv_changes) for part in set(r[2] for r in uv_changes)},
    'largestChanges':[(i,delta,part,old_materials[i//2]) for i,delta,part in sorted(uv_changes,key=lambda r:r[1],reverse=True)[:8]],
    'canonicalUvEqual':old['canonicalUvSha256']==new['canonicalUvSha256']}),flush=True)
for key in ('vertices','headVertices','headRestSha256','canonicalUvSha256','boneRestSha256','frontHemVertices'):
    assert old[key]==new[key],key
old_max=max(max(f['tailAnglesRadians']) for f in old['savedWalkFrames'])
new_max=max(max(f['tailAnglesRadians']) for f in new['savedWalkFrames'])
assert new_max<=.21001 and new_max<old_max
report={'schema':'classic-resident-saved-silhouette-review.v7','builderSha256':sha(Path(__file__)),
    'previous':old,'candidate':new,
    'checks':{'headRestGeometryUnchanged':True,'fullMeshUvsUnchanged':True,'boneRestGeometryUnchanged':True,
        'vertexCountUnchanged':True,'savedWalkActionShortHemLimit':True},
    'observations':{'oldMaximumTailAngleRadians':old_max,'newMaximumTailAngleRadians':new_max,
        'walkPassingFrame':7,'oldPassingFrontHemHighestZ':old['savedWalkFrames'][6]['frontHemHighestZ'],
        'newPassingFrontHemHighestZ':new['savedWalkFrames'][6]['frontHemHighestZ']},
    'uvComparison':{'method':'Canonical face vertex IDs and their corner UV bindings; independent of polygon loop starting order.',
        'rawLoopCoordinateOrderChanged':bool(uv_changes),'canonicalCornerBindingsUnchanged':True},
    'scope':'Data identity and actual saved animation evaluation. These checks do not establish artistic acceptance.',
    'humanArtApproved':False}
(PACKAGE/'saved-source-review.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'checks':report['checks'],'observations':report['observations']}))
