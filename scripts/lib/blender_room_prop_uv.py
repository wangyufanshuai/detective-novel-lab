"""Continuous, metric lathe UVs for the original close-up optical props."""
import math
import bpy


def author(base):
    records=[]
    for name,segments,closed in [('magnifier_grip',32,False),('magnifier_neck',32,False),
                                 ('magnifier_endcap',32,False),('magnifier_retaining_ring',64,True),
                                 ('magnifier_polished_lip',64,True)]:
        obj=bpy.data.objects[name];mesh=obj.data;rows=len(mesh.vertices)//segments
        profile=[mesh.vertices[i*segments].co for i in range(rows)]
        distances=[0.0]
        for i in range(1,rows):distances.append(distances[-1]+(profile[i]-profile[i-1]).length)
        perimeter=distances[-1]+((profile[-1]-profile[0]).length if closed else 0)
        radius=max(math.hypot(v.x,v.y) for v in profile)
        uv=mesh.uv_layers.new(name='RoomAtlasUV');mesh.uv_layers.active=uv
        for face in mesh.polygons:
            ids=[mesh.loops[i].vertex_index for i in face.loop_indices]
            ring_ids=[i//segments for i in ids];columns=[i%segments for i in ids]
            side=len(set(ring_ids))>1
            for loop_index,vertex_id,row,col in zip(face.loop_indices,ids,ring_ids,columns):
                if side:
                    # Duplicate the two chart seams in UV space, not in geometry.
                    u=(segments if max(columns)==segments-1 and col==0 else col)/segments
                    v=perimeter if closed and max(ring_ids)==rows-1 and row==0 else distances[row]
                    uv.data[loop_index].uv=(u*2*math.pi*radius,v)
                else:
                    point=mesh.vertices[vertex_id].co
                    uv.data[loop_index].uv=(point.x+radius,point.y+radius+perimeter+.01+row*(2*radius+.01))
        obj['authored_metric_uv']=True;obj['atlas_texel_weight']=16.0
        records.append({'object':name,'radialSegments':segments,'profileRows':rows,'closedProfile':closed,
                        'texelWeight':16.0,'chartType':'continuous metric revolution with separate end caps'})
    return {'schema':'game-room.prop-uv-authoring.v1','objects':records,'geometryModified':False,'humanApproval':False}
