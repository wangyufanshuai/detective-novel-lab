"""Original bound registers, lidded document boxes and paneled archive cabinets."""
import math
import random
import bpy
import bmesh
from mathutils import Matrix,Vector
from lib.blender_room_art_details import remove,rich_material
from lib.blender_room_furniture_details import walnut


def authored(obj,weight=1.2):
    obj['archive_v12']=True;obj['craft_chart']=True;obj['authored_metric_uv']=True
    obj['atlas_texel_weight']=weight;obj['decorative_only']=True
    return obj


def block(base,name,size,position,mat,group,bevel=.001,weight=1.2):
    return authored(base.box(name,size,position,mat,min(bevel,min(size)*.15),group),weight)


def mesh_object(base,name,vertices,faces,mat,group,weight=2):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    obj=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(obj)
    return authored(base.finish(obj,name,mat,0,group),weight)


def profile(base,name,points,z0,z1,mat,group,weight=2):
    n=len(points);verts=[(x,y,z) for z in (z0,z1) for x,y in points]
    faces=[tuple(reversed(range(n))),tuple(range(n,n*2))]
    faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    obj=mesh_object(base,name,verts,faces,mat,group,weight);obj['archive_profile_count']=n
    return obj


def pipe(base,name,points,radius,mat,group):
    vertices=[];sides=10
    for i,p in enumerate(points):
        tangent=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])).normalized()
        u=Vector((0,1,0));v=tangent.cross(u).normalized()
        vertices.extend(Vector(p)+radius*(u*math.cos(k*2*math.pi/sides)+v*math.sin(k*2*math.pi/sides)) for k in range(sides))
    faces=[tuple(reversed(range(sides))),tuple(range((len(points)-1)*sides,len(points)*sides))]
    faces.extend((i*sides+k,i*sides+(k+1)%sides,(i+1)*sides+(k+1)%sides,(i+1)*sides+k) for i in range(len(points)-1) for k in range(sides))
    obj=mesh_object(base,name,vertices,faces,mat,group,3);obj['archive_pipe']=True
    for face in obj.data.polygons:face.use_smooth=len(face.vertices)==4
    return obj


def ribbon(base,name,x,width,yfunc,z,height,thickness,mat,group,weight=3):
    xs=[x-width/2+width*i/12 for i in range(13)]
    points=[(xx,yfunc(xx)) for xx in xs]+[(xx,yfunc(xx)+thickness) for xx in reversed(xs)]
    return profile(base,name,points,z-height/2,z+height/2,mat,group,weight)


def page_material(base):
    mat=rich_material(base,'V12 deckle page stock','bfb28a','paper',.9)
    tree=mat.node_tree;bsdf=tree.nodes.get('Principled BSDF')
    coord=tree.nodes.new('ShaderNodeTexCoord');wave=tree.nodes.new('ShaderNodeTexWave')
    wave.wave_type='BANDS';wave.bands_direction='Z';wave.inputs['Scale'].default_value=215
    wave.inputs['Distortion'].default_value=1.2;wave.inputs['Detail Scale'].default_value=7
    tree.links.new(coord.outputs['Object'],wave.inputs['Vector'])
    bump=tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.00013
    tree.links.new(wave.outputs['Color'],bump.inputs['Height']);tree.links.new(bump.outputs[0],bsdf.inputs['Normal'])
    return mat


def register(base,name,x,front,floor,width,depth,height,cover,cloth,pages,group,rng):
    start=len(base.GEOMETRY);mat=base.MATERIALS;board=.0035;bulge=.0035
    for sign in (-1,1):
        block(base,name+f'_cover_{sign}',(board,depth,height),(x+sign*(width/2-board/2),front+depth/2,floor+height/2),cloth,group,.0005,1.5)
        block(base,name+f'_quarter_binding_{sign}',(.0008,.052,height-.001),(x+sign*(width/2+.0003),front+.027,floor+height/2),cover,group,.00012,2)
    block(base,name+'_pages',(width-.011,depth-.012,height-.012),(x,front+depth/2+.003,floor+height/2),pages,group,.0008,1.4)
    surface=lambda xx:front-bulge*(1-((xx-x)/(width/2))**2)
    arc=[(x-width/2+width*i/16,surface(x-width/2+width*i/16)) for i in range(17)]
    spine=profile(base,name+'_rounded_spine',arc+[(x+width/2,front+.006),(x-width/2,front+.006)],floor,floor+height,cover,group,2.6)
    for zz in (floor+.049,floor+height-.042):
        ribbon(base,name+'_raised_band',x,width+.0003,lambda xx:surface(xx)-.0008,zz,.006,.001,cover,group,2.2)
    for zz in (floor+.003,floor+height-.003):
        ribbon(base,name+'_headcap',x,width,lambda xx:surface(xx)-.0003,zz,.004,.0006,cover,group,2)
    label_z=floor+height*(.64+rng.uniform(-.025,.025))
    ribbon(base,name+'_label',x,width*.70,lambda xx:surface(xx)-.00065,label_z,.056,.0007,mat['Cotton Paper'],group,4)
    for line in range(2):
        ribbon(base,name+'_label_rule',x,width*(.44-line*.06),lambda xx:surface(xx)-.0009,label_z+.009-line*.019,.0012,.0003,mat['Paper Ink'],group,5)
    return {'id':name,'kind':'quarter-bound-register','spine':spine.name,'widthMeters':width,'boardThicknessMeters':board,
            'depthMeters':depth,'heightMeters':height,'members':[o.name for o in base.GEOMETRY[start:]]}


def document_box(base,name,x,front,floor,width,depth,height,cover,group):
    start=len(base.GEOMETRY);mat=base.MATERIALS;wall=.005
    for sign in (-1,1):
        block(base,name+f'_side_{sign}',(wall,depth,height-.008),(x+sign*(width/2-wall/2),front+depth/2,floor+(height-.008)/2),cover,group,.0006,1.3)
    block(base,name+'_bottom',(width-.01,depth,.005),(x,front+depth/2,floor+.0025),cover,group,.0005,1.2)
    block(base,name+'_back',(width-.01,.005,height-.013),(x,front+depth-.0025,floor+(height-.013)/2+.005),cover,group,.0005,1.2)
    face=block(base,name+'_front',(width,.005,height-.01),(x,front+.0025,floor+(height-.01)/2),cover,group,.0005,2)
    # The lid is a separate closed board with a real 1 mm reveal above the body.
    block(base,name+'_lid',(width+.001,depth+.001,.007),(x,front+depth/2,floor+height-.0035),cover,group,.00065,1.4)
    label=block(base,name+'_label',(width*.64,.0008,.067),(x,front-.00035,floor+height*.67),mat['Cotton Paper'],group,.00012,4)
    for row in range(3):
        block(base,name+'_label_rule',(width*(.42-row*.055),.0003,.0012),(x,front-.0008,label.location.z+.017-row*.017),mat['Paper Ink'],group,0,4)
    # A visible brass pull attached by two seats, without implying an unmodeled hole.
    for dx in (-.021,.021):
        block(base,name+'_pull_seat',(.008,.007,.010),(x+dx,front-.0035,floor+.066),mat['Brushed Antique Brass'],group,.0007,2)
    points=[(x+.021*math.cos(i*math.pi/12),front-.004-.008*math.sin(i*math.pi/12),floor+.066-.010*math.sin(i*math.pi/12)) for i in range(13)]
    # This small handle spans a curved XY/Z path, requiring a stable perpendicular frame.
    pipe(base,name+'_pull',[(px,front-.007,pz) for px,py,pz in points],.0015,mat['Brushed Antique Brass'],group)
    return {'id':name,'kind':'lidded-document-box','front':face.name,'widthMeters':width,'wallThicknessMeters':wall,
            'depthMeters':depth,'heightMeters':height,'members':[o.name for o in base.GEOMETRY[start:]]}


def cabinet(base,side,wood,vertical,inside):
    group=f'archive_cabinet_{side}';remove(base,list(base.GROUPS[group]));start=len(base.GEOMETRY)
    mat=base.MATERIALS;records=[]
    def b(name,size,loc,material=wood,bevel=.001,weight=1.3):return block(base,group+'_'+name,size,loc,material,group,bevel,weight)
    # Canonical cabinet faces local -Y; all members receive one exact rigid transform.
    for xx in (-1.40,1.40):b('plinth_foot',(.10,.79,.075),(xx,0,.0375),vertical,.002)
    b('plinth_front',(2.80,.045,.060),(0,-.3725,.038),wood,.0015)
    b('bottom',(2.84,.80,.022),(0,0,.091),inside)
    b('back',(2.84,.018,.813),(0,.391,.5085),vertical)
    for xx in (-1.435,1.435):b('side',(.030,.80,.84),(xx,0,.495),vertical,.0016)
    for xx in (-.72,0,.72):b('divider',(.026,.75,.813),(xx,.025,.5085),inside)
    b('top',(2.98,.86,.045),(0,0,.9375),wood,.003,1.8)
    b('top_bead',(2.94,.025,.018),(0,-.408,.908),wood,.001)
    for xx in (-1.435,-.72,0,.72,1.435):b('stile',(.028,.060,.808),(xx,-.376,.506),vertical,.001)
    for z,h in ((.112,.020),(.486,.027),(.893,.028)):b('rail',(2.85,.060,h),(0,-.376,z),wood,.001)
    for row,(z,height) in enumerate(((.297,.332),(.691,.360))):
        for col,x in enumerate((-1.08,-.36,.36,1.08)):
            prefix=f'drawer_{row}_{col}';face=b(prefix+'_face',(.680,.024,height),(x,-.408,z),wood,.0014,1.9)
            for dx in (-.319,.319):b(prefix+'_stile',(.027,.003,height-.018),(x+dx,-.4215,z),vertical,.0004,1.8)
            for zz in (z-height/2+.02,z+height/2-.02):b(prefix+'_rail',(.620,.003,.023),(x,-.4215,zz),wood,.0004,1.8)
            bottom_z=z-height/2+.018
            bottom=b(prefix+'_bottom',(.652,.632,.010),(x,-.068,bottom_z),inside,.0006)
            sides=[]
            for dx in (-.325,.325):
                sides.append(b(prefix+'_side',(.014,.632,height-.035),(x+dx,-.068,bottom_z+.005+(height-.035)/2),inside,.0007))
                b(prefix+'_runner',(.032,.65,.014),(x+math.copysign(.331,dx),-.060,bottom_z-.012),wood,.0005)
            b(prefix+'_back',(.620,.014,height-.035),(x,.241,bottom_z+.005+(height-.035)/2),inside,.0007)
            b(prefix+'_label_back',(.143,.003,.054),(x,-.4215,z+.075),mat['Dark Brass'],.0004,2)
            card=b(prefix+'_label',(.124,.001,.040),(x,-.4235,z+.075),mat['Cotton Paper'],.00012,3)
            for dx in (-.068,.068):b(prefix+'_label_edge',(.007,.003,.052),(x+dx,-.4245,z+.075),mat['Brushed Antique Brass'],.0004,3)
            for dz in (-.024,.024):b(prefix+'_label_edge',(.129,.003,.005),(x,-.4245,z+.075+dz),mat['Brushed Antique Brass'],.0004,3)
            for dx in (-.047,.047):
                b(prefix+'_handle_seat',(.018,.008,.021),(x+dx,-.424,z-.025),mat['Brushed Antique Brass'],.001,2)
                b(prefix+'_handle_post',(.008,.028,.008),(x+dx,-.438,z-.025),mat['Brushed Antique Brass'],.0006,2)
            points=[(x+.047*math.cos(k*math.pi/16),-.452,z-.025-.029*math.sin(k*math.pi/16)) for k in range(17)]
            handle=pipe(base,group+'_'+prefix+'_bail',points,.0032,mat['Brushed Antique Brass'],group)
            records.append({'face':face.name,'bottom':bottom.name,'sides':[o.name for o in sides],'handle':handle.name,'label':card.name,'row':row,'column':col})
    transform=Matrix.Translation(Vector((side*5.275,1.1,0)))@Matrix.Rotation(-side*math.pi/2,4,'Z')
    bpy.context.view_layer.update()
    for obj in base.GEOMETRY[start:]:obj.matrix_world=transform@obj.matrix_world
    return {'group':group,'drawers':records,'closedDrawers':8,'interactive':False,'localToWorld':[list(row) for row in transform]}


def refine(base,cameras,details,seed):
    rng=random.Random(seed+1200);mat=base.MATERIALS
    papers=page_material(base)
    colors=['53352c','314b40','29393b','80613f']
    covers=[rich_material(base,'V12 binding '+str(i),c,'leather',.71) for i,c in enumerate(colors)]
    cloths=[rich_material(base,'V12 cloth '+str(i),c,'cloth',.88) for i,c in enumerate(['697064','846f52','455656','867b65'])]
    wood=walnut(base,'V12 cabinet horizontal walnut',0,.86);vertical=walnut(base,'V12 cabinet vertical walnut',2,.83)
    inside=walnut(base,'V12 cabinet pale interior',1,1.43)
    old=list(details['archiveShelfClearance']);volume_specs=[]
    bpy.context.view_layer.update()
    for entry in old:
        spine=bpy.data.objects[entry['id']+'_spine']
        pages=bpy.data.objects[entry['id']+'_pages']
        width=max(v.co.x for v in spine.data.vertices)-min(v.co.x for v in spine.data.vertices)
        height=max(v.co.z for v in spine.data.vertices)-min(v.co.z for v in spine.data.vertices)
        depth=max(v.co.y for v in pages.data.vertices)-min(v.co.y for v in pages.data.vertices)+.018
        volume_specs.append((entry,spine.location.x,spine.location.y-.0045,width,depth,height))
    remove(base,[o for o in base.GEOMETRY if o.name.startswith('rear_archive_') and '_bound_' in o.name])
    volumes=[];clearance=[]
    for index,(entry,x,front,width,depth,height) in enumerate(volume_specs):
        name=entry['id'];group='_'.join(name.split('_')[:3]);floor=entry['shelfTop']
        # Each old archive slot becomes either a broad file box or two slimmer registers.
        split=(index%5 in (0,1,3));kind_count=2 if split else 1
        for j in range(kind_count):
            w=(width-.010)/2 if split else width;px=x+(j-.5)*(w+.010) if split else x
            h=height-(j*.025 if split else 0);new_name=name+f'_item_{j}';start=len(base.GEOMETRY)
            record=register(base,new_name,px,front,floor,w,depth,h,covers[(index+j)%4],cloths[(index*3+j)%4],papers,group,rng) if split else document_box(base,new_name,px,front,floor,w,depth,h,cloths[index%4],group)
            for obj in base.GEOMETRY[start:]:obj['archive_volume_id']=new_name
            record['shelfTopMeters']=floor;record['ceilingMeters']=entry['nextShelfUnderside'];record['group']=group
            volumes.append(record);bpy.context.view_layer.update();low,high=base.bounds(base.GEOMETRY[start:])
            clearance.append({'id':new_name,'bottom':low[2],'top':high[2],'shelfTop':floor,'nextShelfUnderside':entry['nextShelfUnderside'],
                              'passed':low[2]>=floor-.001 and high[2]<=entry['nextShelfUnderside']-.01})
    # Shelf lips and cornice remain subordinate to the evidence desk. Labels meet their support.
    for side in (-1,1):
        group=f'rear_archive_{side}';x=side*3.5
        for z in (.16,.76,1.36,1.96):block(base,group+'_shelf_lip',(2.22,.018,.032),(x,3.196,z),wood,group,.0014)
        block(base,group+'_cornice',(2.29,.603,.031),(x,3.485,2.4255),wood,group,.002)
        for sign in (-1,1):block(base,group+'_front_stile',(.035,.016,2.15),(x+sign*1.065,3.214,1.255),vertical,group,.001)
        for obj in base.GROUPS[group]:
            if obj.name.startswith(('archive_class_plate','archive_class_title')):obj.location.y+=.012
    cabinets=[cabinet(base,side,wood,vertical,inside) for side in (-1,1)]
    archive_camera={'location':[2.30,1.76,1.68],'target':[3.43,3.30,1.43],'verticalFovDegrees':48}
    cabinet_camera={'location':[-3.13,-.37,1.38],'target':[-5.02,1.08,.59],'verticalFovDegrees':49}
    for name,spec in [('archive-detail',archive_camera),('cabinet-detail',cabinet_camera)]:cameras[name]=base.camera(name,spec['location'],spec['target'],spec['verticalFovDegrees'])
    bpy.context.view_layer.update();details['archiveShelfClearance']=clearance;details['internalShelfClearancePassed']=all(c['passed'] for c in clearance)
    objects=[o for o in base.GEOMETRY if o.get('archive_v12')]
    return {'schema':'game-room.archive-authoring.v1','seed':seed+1200,'volumes':volumes,'cabinets':cabinets,'archiveCamera':archive_camera,'cabinetCamera':cabinet_camera,
            'objectCount':len(objects),'externalDownloads':False,'humanApproval':False,'decorativeLabelsAreWorldEvidence':False,
            'passed':details['internalShelfClearancePassed'],'scope':'Original static art; no drawer interaction, simulated records or load-bearing certification.'}
