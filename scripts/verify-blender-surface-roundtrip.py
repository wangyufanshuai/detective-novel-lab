"""Read the actual compressed GLB back into Blender and measure geometry drift."""
import hashlib
import json
from pathlib import Path

import bpy
from mathutils import kdtree,Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/3d-rooms/candidates/blender-v6'


def geometry(objects):
    deps=bpy.context.evaluated_depsgraph_get()
    groups={}
    triangles=0
    for obj in objects:
        if obj.type!='MESH':
            continue
        group=obj.get('review_group','architecture')
        evaluated=obj.evaluated_get(deps)
        mesh=evaluated.to_mesh()
        mesh.calc_loop_triangles()
        triangles+=len(mesh.loop_triangles)
        groups.setdefault(group,[]).extend(obj.matrix_world@v.co for v in mesh.vertices)
        evaluated.to_mesh_clear()
    return groups,triangles


def distance(source,target):
    tree=kdtree.KDTree(len(target))
    for index,point in enumerate(target):
        tree.insert(point,index)
    tree.balance()
    return max(tree.find(point)[2] for point in source)


def envelope_top_probe(objects):
    deps=bpy.context.evaluated_depsgraph_get()
    positions=[];faces=[];normals=[]
    for obj in objects:
        if obj.type!='MESH' or obj.get('review_group')!='hero-evidence-table-01':continue
        evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh();mesh.calc_loop_triangles()
        start=len(positions);positions.extend(obj.matrix_world@v.co for v in mesh.vertices)
        normal_matrix=obj.matrix_world.to_3x3().inverted().transposed()
        for triangle in mesh.loop_triangles:
            faces.append(tuple(start+i for i in triangle.vertices))
            normals.append((normal_matrix@sum((mesh.corner_normals[i].vector for i in triangle.loops),Vector())).normalized())
        evaluated.to_mesh_clear()
    tree=BVHTree.FromPolygons(positions,faces,all_triangles=True)
    hit,normal,index,_=tree.ray_cast(Vector((.39716,.82083,1.09)),Vector((0,0,-1)),.2)
    if index is None:return {'passed':False,'reason':'Envelope top probe missed'}
    return {'position':list(hit),'geometricNormal':list(normal),'shadingNormal':list(normals[index]),
            'passed':abs(hit.z-.9691)<.00005 and normal.z>.99 and normals[index].z>.99}


def main():
    blend=OUT/'fog-lamp-evidence-room.blend'
    glb=OUT/'review-room-candidate.glb'
    bpy.ops.wm.open_mainfile(filepath=str(blend))
    original=[obj for obj in bpy.context.scene.objects if obj.get('asset_origin')=='project-local-authored']
    expected,triangles=geometry(original)
    source_surface=envelope_top_probe(original)
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    bpy.context.view_layer.update()
    decoded=[obj for obj in bpy.data.objects if obj not in before]
    actual,decoded_triangles=geometry(decoded)
    decoded_surface=envelope_top_probe(decoded)
    if set(expected)!=set(actual):
        raise RuntimeError('Decoded semantic groups differ: '+str(set(expected)^set(actual)))
    records=[]
    for group in sorted(expected):
        a=distance(expected[group],actual[group])
        b=distance(actual[group],expected[group])
        records.append({'group':group,'sourceVertices':len(expected[group]),'decodedVertices':len(actual[group]),
                        'maxSourceToDecodedMeters':a,'maxDecodedToSourceMeters':b,'passed':max(a,b)<=.00005})
    sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
    passed=all(item['passed'] for item in records) and triangles==decoded_triangles and source_surface['passed'] and decoded_surface['passed']
    receipt={'schema':'game-room.geometry-roundtrip.v1','method':'all evaluated vertices, bidirectional nearest positions within each semantic group',
             'sourceBlendSha256':sha(blend),'reviewGlbSha256':sha(glb),'verifierSha256':sha(Path(__file__)),
             'sourceTriangles':triangles,'decodedTriangles':decoded_triangles,'maximumDeviationAllowedMeters':.00005,
             'envelopeTopNormals':{'source':source_surface,'decoded':decoded_surface},
             'groups':records,'passed':passed,'scope':'geometric positions, triangle count and semantic retention; not a material or lighting equivalence claim'}
    (OUT/'export-roundtrip-audit.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
    print('ROUNDTRIP='+json.dumps({'passed':passed,'triangles':triangles,'decodedTriangles':decoded_triangles,
        'maximumDeviationMeters':max(max(item['maxSourceToDecodedMeters'],item['maxDecodedToSourceMeters']) for item in records)}))
    if not passed:
        raise RuntimeError('Decoded geometry exceeded the declared tolerance.')


if __name__=='__main__':
    main()

