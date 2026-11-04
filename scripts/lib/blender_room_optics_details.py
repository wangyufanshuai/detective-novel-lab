"""Original biconvex glass, lathed brass housing and fitted leather grip."""
import math
import bpy,bmesh
from mathutils import Vector
from lib.blender_room_art_details import remove,type_mesh
from lib.blender_room_surface_details import signed_volume
from io_scene_gltf2.blender.com.material_helpers import create_settings_group


def mesh_object(base,name,vertices,faces,material,group):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    obj=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(obj)
    for face in mesh.polygons:face.use_smooth=True
    return base.finish(obj,name,material,0,group)


def lathe(base,name,profile,position,material,group,segments=64,axis=(0,0,1),closed_profile=True):
    vertices=[(r*math.cos(2*math.pi*i/segments),r*math.sin(2*math.pi*i/segments),z) for r,z in profile for i in range(segments)]
    faces=[]
    steps=len(profile) if closed_profile else len(profile)-1
    for row in range(steps):
        next_row=(row+1)%len(profile)
        for i in range(segments):
            j=(i+1)%segments
            faces.append((row*segments+i,row*segments+j,next_row*segments+j,next_row*segments+i))
    if not closed_profile:
        faces.extend([tuple(reversed(range(segments))),tuple((len(profile)-1)*segments+i for i in range(segments))])
    obj=mesh_object(base,name,vertices,faces,material,group);obj.location=position
    obj.rotation_euler=Vector(axis).to_track_quat('Z','Y').to_euler()
    # Turned shoulders and caps retain real corners, while circles shade smoothly.
    for edge in obj.data.edges:
        if edge.vertices[0]//segments==edge.vertices[1]//segments:edge.use_edge_sharp=True
    return obj


def biconvex(base,position,material,group):
    radius=.0565;center=.012;edge=.0024;sag=(center-edge)/2
    curvature=(radius*radius+sag*sag)/(2*sag)
    vertices=[];faces=[];segments=64;rings=12
    for sign in (1,-1):
        offset=len(vertices);vertices.append((0,0,sign*center/2))
        for j in range(1,rings+1):
            r=radius*j/rings;z=center/2-curvature+math.sqrt(curvature*curvature-r*r)
            vertices.extend((r*math.cos(2*math.pi*i/segments),r*math.sin(2*math.pi*i/segments),sign*z) for i in range(segments))
        for i in range(segments):faces.append((offset,offset+1+i,offset+1+(i+1)%segments))
        for j in range(rings-1):
            a=offset+1+j*segments;b=a+segments
            faces.extend((a+i,a+(i+1)%segments,b+(i+1)%segments,b+i) for i in range(segments))
    lower=1+rings*segments
    top_edge=1+(rings-1)*segments;bottom_edge=lower+1+(rings-1)*segments
    faces.extend((top_edge+i,top_edge+(i+1)%segments,bottom_edge+(i+1)%segments,bottom_edge+i) for i in range(segments))
    obj=mesh_object(base,'magnifier_lens',vertices,faces,material,group);obj.location=position
    return obj,{'radiusMeters':radius,'centerThicknessMeters':center,'edgeThicknessMeters':edge,'curvatureRadiusMeters':curvature,
                'radialRingsPerFace':rings,'circumferenceSegments':segments}


def refine(base,cameras):
    group='hero-evidence-table-01';felt=next(obj for obj in base.GROUPS[group] if 'tray-felt' in obj.name)
    surface=base.bounds([felt])[1][2]
    remove(base,[obj for obj in base.GEOMETRY if obj.name.startswith('magnifier_')])
    start=len(base.GEOMETRY)
    glass=base.MATERIALS['Optical Glass'];tree=glass.node_tree;bsdf=tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(.985,.995,1,1)
    bsdf.inputs['Transmission Weight'].default_value=1;bsdf.inputs['IOR'].default_value=1.52
    bsdf.inputs['Roughness'].default_value=.025
    # Use the installed exporter's canonical group. Its Occlusion socket is
    # also the sentinel that prevents exporter inlining from dropping Thickness.
    metadata=create_settings_group('glTF Material Output')
    node=tree.nodes.new('ShaderNodeGroup');node.node_tree=metadata;node.inputs['Thickness'].default_value=.012
    # Thickness is a portable center-thickness approximation. Cycles uses the actual two curved boundaries.
    brass=base.material('Optics Satin Brass','b7914e',.24,1)
    edge_brass=base.material('Optics Polished Edge','cfad66',.17,1)
    leather=base.MATERIALS['Oxblood Leather']
    x,y=.63,.40;card_top=surface+.00075;z=card_top+.00008+.008
    base.box('optics_reference_card',(.155,.16,.0007),(x,y+.018,surface+.0004),base.MATERIALS['Cotton Paper'],.0002,group)
    # Decorative registration scale makes transmission visible, but carries no game evidence.
    for i in range(11):
        base.box('optics_scale_tick',(.00065,.004 if i%5 else .008,.00016),(x-.045+i*.009,y+.007,card_top+.00009),base.MATERIALS['Paper Ink'],0,group)
    base.box('optics_scale_rule',(.098,.00065,.00016),(x,y+.003,card_top+.00009),base.MATERIALS['Paper Ink'],0,group)
    type_mesh(base,'optics_card_number','07', (x-.020,y-.027,card_top+.00010),.018,base.MATERIALS['Paper Ink'],group)
    type_mesh(base,'optics_card_caption','ARCHIVE', (x,y+.078,card_top+.00010),.009,base.MATERIALS['Paper Ink'],group)
    lens,dimensions=biconvex(base,(x,y,z),glass,group)
    profile=[(.0555,-.0015),(.0568,-.0015),(.0568,.0016),(.0555,.0016),(.0555,.0035),
             (.0665,.0035),(.069,.0022),(.069,-.0028),(.0682,-.0034),(.069,-.004),(.069,-.0068),(.0675,-.008),(.0555,-.008)]
    housing=lathe(base,'magnifier_retaining_ring',profile,(x,y,z),brass,group)
    lathe(base,'magnifier_polished_lip',[(.0555,.0035),(.0555,.004),(.058,.004),(.058,.0035)],(x,y,z),edge_brass,group)
    axis=Vector((.64,-.768,0)).normalized();neck_start=Vector((x,y,z))+axis*.065
    neck=lathe(base,'magnifier_neck',[(.007,0),(.008,.004),(.008,.025),(.009,.032)],neck_start,edge_brass,group,32,axis,False)
    grip_start=neck_start+axis*.032
    # Slightly waisted handle with eight inset rings modeled into its silhouette.
    grip_profile=[(.009,0),(.010,.004)]
    for i in range(1,9):
        t=.018+i*.018;r=.010+.002*math.sin(math.pi*t/.186)
        grip_profile.extend([(r,t-.0015),(r-.0007,t),(r,t+.0015)])
    grip_profile.extend([(.010,.185),(.009,.192)])
    lathe(base,'magnifier_grip',grip_profile,grip_start,leather,group,32,axis,False)
    lathe(base,'magnifier_endcap',[(.009,0),(.0105,.002),(.0105,.007),(.009,.010)],grip_start+axis*.192,edge_brass,group,32,axis,False)
    # Rest the grip on the felt while the brass housing rests on the thin card.
    grip_members=[obj for obj in base.GEOMETRY[start:] if obj.name in ('magnifier_grip','magnifier_endcap')]
    grip_low=base.bounds(grip_members)[0][2]
    for obj in grip_members:obj.location.z+=surface+.00008-grip_low
    neck.location.z=(grip_members[0].location.z+z)/2
    bpy.context.view_layer.update()
    geometry=[]
    for obj in base.GEOMETRY[start:]:
        volume,closed=signed_volume(obj,True)
        geometry.append({'name':obj.name,'closed':closed,'signedVolumeMeters3':volume})
    low,high=base.bounds([lens]);housing_bounds=base.bounds([housing]);grip_bounds=base.bounds(grip_members)
    curve=dimensions['curvatureRadiusMeters'];seat_radius=.0555
    face_at_seat=dimensions['centerThicknessMeters']/2-curve+math.sqrt(curve*curve-seat_radius*seat_radius)
    camera={'location':[.99,-.20,1.43],'target':[.70,.28,.98],'verticalFovDegrees':38}
    cameras['lens-macro']=base.camera('lens-macro',camera['location'],camera['target'],camera['verticalFovDegrees'])
    checks={'housingSupportGapMeters':housing_bounds[0][2]-card_top,'gripSupportGapMeters':grip_bounds[0][2]-surface,
            'glassToCardGapMeters':low[2]-card_top,'radialSeatClearanceMeters':.0568-dimensions['radiusMeters'],
            'lowerSeatGapMeters':.0015-face_at_seat,'upperSeatGapMeters':.0016-face_at_seat,
            'actualCenterThicknessMeters':high[2]-low[2]}
    passed=all(g['closed'] and g['signedVolumeMeters3']>0 for g in geometry) and all(v>0 for v in checks.values())
    passed=passed and checks['housingSupportGapMeters']<.001 and checks['gripSupportGapMeters']<.001
    return {'schema':'game-room.optics-model-review.v1','geometry':geometry,'lens':dimensions,'checks':checks,'macroCamera':camera,
            'glass':{'transmission':1,'ior':1.52,'roughness':.025,'gltfCenterThicknessMeters':.012},
            'decorativeScaleIsWorldEvidence':False,'passed':passed,'humanApproval':False,
            'limitations':['Browser volume uses the center thickness uniformly; no full two-surface ray-optical solver or measured focal calibration.']}
