"""Metric face charts with a minimum texel span for modeled desk microgeometry."""
import bpy

PREFIXES=('index_tray_','index_card_','notebook_','folio_','envelope_','wax_',
          'cedar_pencil_','pencil_','optics_reference_','optics_scale_','optics_card_')


def author(base):
    records=[];bevels=[]
    for obj in base.GEOMETRY:
        if not obj.name.startswith(PREFIXES):continue
        weight=20 if obj.name.startswith(('index_tray_','cedar_pencil_','pencil_')) else 10
        obj['craft_chart']=True;obj['authored_metric_uv']=True;obj['atlas_texel_weight']=weight
        # Oversized bevels clamp thin objects into zero-area faces. Preserve a
        # real central side band and round only a fifth of the smallest extent.
        smallest=min(max(v[i] for v in obj.bound_box)-min(v[i] for v in obj.bound_box) for i in range(3))
        for modifier in obj.modifiers:
            if modifier.type=='BEVEL' and modifier.width>smallest*.2:
                old=modifier.width;modifier.width=smallest*.2
                bevels.append({'object':obj.name,'beforeMeters':old,'afterMeters':modifier.width})
        records.append({'object':obj.name,'weight':weight,'chartMinimumMetricSpan':.012})
    return {'schema':'game-room.craft-uv-authoring.v1','objects':records,'bevelCorrections':bevels,'geometryModified':bool(bevels),'humanApproval':False}


def evaluated_charts(mesh,obj):
    if not obj.get('craft_chart'):return
    # Work on the evaluated bevel geometry, keeping all authored split normals.
    uv=mesh.uv_layers[0] if mesh.uv_layers else mesh.uv_layers.new(name='RoomAtlasUV')
    uv.name='RoomAtlasUV'
    mesh.uv_layers.active=uv;groups={};keys={};parents={};edges={}
    for face in mesh.polygons:
        axis=max(range(3),key=lambda i:abs(face.normal[i]))
        key=(axis,face.normal[axis]>=0)
        keys[face.index]=key;parents[face.index]=face.index
    def find(i):
        while parents[i]!=i:parents[i]=parents[parents[i]];i=parents[i]
        return i
    for face in mesh.polygons:
        for edge in face.edge_keys:
            key=(keys[face.index],tuple(sorted(edge)))
            if key in edges:parents[find(face.index)]=find(edges[key])
            else:edges[key]=face.index
    for face in mesh.polygons:groups.setdefault((keys[face.index],find(face.index)),[]).append(face)
    offset=0.0
    for ((axis,positive),component),faces in sorted(groups.items()):
        axes=[i for i in range(3) if i!=axis]
        points=[mesh.vertices[mesh.loops[i].vertex_index].co for face in faces for i in face.loop_indices]
        low=[min(v[i] for v in points) for i in axes];high=[max(v[i] for v in points) for i in axes]
        spans=[high[i]-low[i] for i in range(2)];expanded=[max(.012,s) for s in spans]
        for face in faces:
            for index in face.loop_indices:
                v=mesh.vertices[mesh.loops[index].vertex_index].co
                a=(v[axes[0]]-low[0])/max(spans[0],1e-9)*expanded[0]
                b=(v[axes[1]]-low[1])/max(spans[1],1e-9)*expanded[1]
                uv.data[index].uv=(offset+a,b)
        offset+=expanded[0]+.02
