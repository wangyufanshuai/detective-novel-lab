"""Read the actual compressed GLB back into Blender and measure geometry drift."""
import hashlib
import json
from pathlib import Path

import bpy,bmesh
from mathutils import kdtree,Vector,Matrix
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/3d-rooms/candidates/blender-v11'


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


def lens_geometry(objects):
    lens=next(obj for obj in objects if obj.type=='MESH' and 'magnifier_lens' in obj.name)
    bm=bmesh.new();bm.from_mesh(lens.data);bm.transform(lens.matrix_world)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000002)
    bm.normal_update();closed=all(edge.is_manifold for edge in bm.edges);volume=bm.calc_volume(signed=True)
    vertices=[vertex.co.copy() for vertex in bm.verts];bm.free()
    center=sum(vertices,Vector())/len(vertices)
    thickness=max(v.z for v in vertices)-min(v.z for v in vertices)
    radial=[((v.x-center.x)**2+(v.y-center.y)**2)**.5 for v in vertices]
    edge=[v for v,r in zip(vertices,radial) if r>.05645]
    edge_thickness=max(v.z for v in edge)-min(v.z for v in edge)
    return {'centerThicknessMeters':thickness,'edgeThicknessMeters':edge_thickness,'closedAfterMicronWeld':closed,
            'signedVolumeMeters3':volume,'passed':closed and volume>0 and abs(thickness-.012)<.00005 and abs(edge_thickness-.0024)<.00005}


def paper_layers(objects):
    deps=bpy.context.evaluated_depsgraph_get();positions=[];faces=[]
    for obj in objects:
        if obj.type!='MESH' or obj.get('review_group')!='hero-evidence-table-01':continue
        evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh();mesh.calc_loop_triangles();start=len(positions)
        positions.extend(obj.matrix_world@v.co for v in mesh.vertices)
        faces.extend(tuple(start+i for i in t.vertices) for t in mesh.loop_triangles);evaluated.to_mesh_clear()
    tree=BVHTree.FromPolygons(positions,faces,all_triangles=True);records=[]
    # Unprinted common leaf area, above the folder. Inspect both surfaces of
    # each sheet directly in the decoded semantic mesh, without object names.
    turn=Matrix.Rotation(.07,3,'Z')
    for x in [-.21,-.14,-.07,0,.07,.14,.21]:
        p=Vector((-.16,.33,0))+turn@Vector((x,-.125,0));z=1.02;hits=[]
        for _ in range(24):
            hit=tree.ray_cast(Vector((p.x,p.y,z)),Vector((0,0,-1)),.10)[0]
            if hit is None or hit.z<.96440:break
            hits.append(hit.z);z=hit.z-.000002
        thickness=[hits[i]-hits[i+1] for i in range(0,len(hits)-1,2)]
        gaps=[hits[i]-hits[i+1] for i in range(1,len(hits)-1,2)]
        passed=len(hits)==8 and len(thickness)==4 and max(abs(t-.0003) for t in thickness)<.000025 and min(gaps)>.00002
        records.append({'xy':[p.x,p.y],'surfaceHits':hits,'thicknessMeters':thickness,'gapsMeters':gaps,'passed':passed})
    return {'records':records,'passed':all(r['passed'] for r in records),'scope':'Seven unprinted XY rays; eight distinct paper surfaces per ray after actual GLB decode.'}


def main():
    blend=OUT/'fog-lamp-evidence-room.blend'
    glb=OUT/'review-room-candidate.glb'
    bpy.ops.wm.open_mainfile(filepath=str(blend))
    original=[obj for obj in bpy.context.scene.objects if obj.get('asset_origin')=='project-local-authored']
    expected,triangles=geometry(original)
    source_surface=envelope_top_probe(original)
    source_lens=lens_geometry(original)
    source_paper=paper_layers(original)
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    bpy.context.view_layer.update()
    decoded=[obj for obj in bpy.data.objects if obj not in before]
    actual,decoded_triangles=geometry(decoded)
    decoded_surface=envelope_top_probe(decoded)
    decoded_lens=lens_geometry(decoded)
    decoded_paper=paper_layers(decoded)
    if set(expected)!=set(actual):
        raise RuntimeError('Decoded semantic groups differ: '+str(set(expected)^set(actual)))
    records=[]
    for group in sorted(expected):
        a=distance(expected[group],actual[group])
        b=distance(actual[group],expected[group])
        records.append({'group':group,'sourceVertices':len(expected[group]),'decodedVertices':len(actual[group]),
                        'maxSourceToDecodedMeters':a,'maxDecodedToSourceMeters':b,'passed':max(a,b)<=.00005})
    sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
    passed=all(item['passed'] for item in records) and triangles==decoded_triangles and source_surface['passed'] and decoded_surface['passed'] and source_lens['passed'] and decoded_lens['passed'] and source_paper['passed'] and decoded_paper['passed']
    receipt={'schema':'game-room.geometry-roundtrip.v1','method':'all evaluated vertices, bidirectional nearest positions within each semantic group',
             'sourceBlendSha256':sha(blend),'reviewGlbSha256':sha(glb),'verifierSha256':sha(Path(__file__)),
             'sourceTriangles':triangles,'decodedTriangles':decoded_triangles,'maximumDeviationAllowedMeters':.00005,
             'envelopeTopNormals':{'source':source_surface,'decoded':decoded_surface},
             'lensGeometry':{'source':source_lens,'decoded':decoded_lens},
             'paperLayers':{'source':source_paper,'decoded':decoded_paper},
             'groups':records,'passed':passed,'scope':'geometric positions, triangle count and semantic retention; not a material or lighting equivalence claim'}
    (OUT/'export-roundtrip-audit.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
    print('ROUNDTRIP='+json.dumps({'passed':passed,'triangles':triangles,'decodedTriangles':decoded_triangles,
        'maximumDeviationMeters':max(max(item['maxSourceToDecodedMeters'],item['maxDecodedToSourceMeters']) for item in records)}))
    if not passed:
        raise RuntimeError('Decoded geometry exceeded the declared tolerance.')


if __name__=='__main__':
    main()

