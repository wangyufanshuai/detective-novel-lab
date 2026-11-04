"""Add anatomical finger controls to the three retained resident sources.

Runs in background Blender. Existing meshes, materials, UVs, source files and
body actions are retained except the hand poses and small skirt-clearance elbow
clearance adjustment. No old source file is edited.
"""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import math
import struct
import sys
import bpy
from mathutils import Vector, Matrix, Quaternion
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/'docs/3d-town/classic-residents-v8'
VERSIONS={'resident-03':3,'resident-06':7,'resident-08':4}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))

def write(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

spec=importlib.util.spec_from_file_location('pinned_anatomy',ROOT/'scripts/classic-resident-anatomy.py')
anatomy=importlib.util.module_from_spec(spec);spec.loader.exec_module(anatomy)

def smooth(x):
    x=max(0,min(1,x));return x*x*(3-2*x)

def numeric_hash(values):
    h=hashlib.sha256()
    for value in values:h.update(struct.pack('<f',value))
    return h.hexdigest()

def mesh_identity(body):
    return {'vertices':len(body.data.vertices),
        'positions':numeric_hash(c for v in body.data.vertices for c in v.co),
        'uvs':numeric_hash(c for item in body.data.uv_layers.active.data for c in item.uv),
        'topology':sha_bytes(json.dumps([list(f.vertices) for f in body.data.polygons]).encode()),
        'materials':[m.name for m in body.data.materials]}

def sha_bytes(data):return hashlib.sha256(data).hexdigest()

def bind_action(rig,action):
    rig.animation_data_create();rig.animation_data.action=action
    if action.slots:rig.animation_data.action_slot=action.slots[0]

def hand_mapping(body,profile):
    points,faces,joint=anatomy.read_source(profile)
    skin={i for f in body.data.polygons if 'skin' in body.data.materials[f.material_index].name for i in f.vertices}
    hands=[]
    for sign,side,source in [(-1,'L','r'),(1,'R','l')]:
        wrist=joint(source+'-hand');tip=joint(source+'-finger-3-4')
        length=(tip-wrist).normalized()
        width=joint(source+'-finger-5-1')-joint(source+'-finger-2-1')
        width=(width-length*width.dot(length)).normalized();normal=width.cross(length).normalized()
        scale=.166/(tip-wrist).length;origin=Vector((sign*.278,-.025,.953))
        def convert(p):
            d=(p-wrist)*scale;q=origin+Vector((sign*d.dot(width),sign*d.dot(normal),-d.dot(length)))
            curl=max(0,min(1,(.895-q.z)/.10));q.x=origin.x+(q.x-origin.x)*(1-.07*curl)
            q.y+=.015*curl*curl;q.z+=.008*curl*curl
            t=max(0,min(1,(.886-q.z)/.09));q.y+=.027*t*t;q.z+=.008*t*t
            return q
        group=body.vertex_groups['hand_'+side].index
        ids=[v.index for v in body.data.vertices if v.index in skin and any(g.group==group and g.weight>.999 for g in v.groups)]
        selected=[f for f in faces if all(sign*points[i].x>3.7 and (points[i]-wrist).dot(length)>-.18 for i in f)]
        source_ids=sorted({i for f in selected for i in f});tree=KDTree(len(source_ids))
        for i in source_ids:tree.insert(convert(points[i]),i)
        tree.balance();matched=[tree.find(body.data.vertices[i].co) for i in ids]
        assert len(ids)==len(source_ids) and max(d for _,_,d in matched)<1e-7
        assert len({i for _,i,_ in matched})==len(ids)
        hands.append({'side':side,'sign':sign,'ids':ids,'mappingError':max(d for _,_,d in matched),
            'joints':{f:[convert(joint(f'{source}-finger-{f}-{k}')) for k in range(1,5)] for f in range(1,6)}})
    return hands

def nearest_chain(point,knots):
    best=None;length=0
    for index,(a,b) in enumerate(zip(knots,knots[1:])):
        line=b-a;t=max(0,min(1,(point-a).dot(line)/line.length_squared))
        distance=(point-a-line*t).length
        row=(distance,length+t*line.length,index)
        if best is None or distance<best[0]:best=row
        length+=line.length
    return best

def finger_name(side,finger,segment):return f'finger_{side}_{finger}_{segment+1}'

def add_controls(body,rig,hands):
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
    rig.animation_data.action=None
    for bone in rig.pose.bones:bone.matrix_basis=Matrix.Identity(4)
    bpy.ops.object.mode_set(mode='EDIT')
    for hand in hands:
        for finger,knots in hand['joints'].items():
            for segment in range(3):
                bone=rig.data.edit_bones.new(finger_name(hand['side'],finger,segment))
                bone.head=knots[segment];bone.tail=knots[segment+1]
                bone.parent=rig.data.edit_bones['hand_'+hand['side'] if segment==0 else finger_name(hand['side'],finger,segment-1)]
                bone.use_connect=segment>0
    bpy.ops.object.mode_set(mode='OBJECT')
    labels=body.data.attributes.new('AnatomicalFinger','INT','POINT')
    axes={};weighted=0;hand_ids=set()
    for hand in hands:
        side=hand['side'];hand_group=body.vertex_groups['hand_'+side]
        groups={(f,s):body.vertex_groups.new(name=finger_name(side,f,s)) for f in range(1,6) for s in range(3)}
        for finger,knots in hand['joints'].items():
            for segment in range(3):
                name=finger_name(side,finger,segment);rest=rig.data.bones[name]
                toward=Vector((hand['sign']*.22 if finger==1 else 0,1,0))
                axis=(rest.tail_local-rest.head_local).cross(toward).normalized()
                axes[name]=rest.matrix_local.to_3x3().inverted()@axis
        for index in hand['ids']:
            hand_ids.add(index);point=body.data.vertices[index].co
            candidates=[(nearest_chain(point,knots),f) for f,knots in hand['joints'].items()]
            (distance,along,_),finger=min(candidates,key=lambda r:r[0][0])
            knots=hand['joints'][finger]
            root_along=(point-knots[0]).dot((knots[1]-knots[0]).normalized())
            influence=smooth((root_along+.006)/.014)*smooth(((.028 if finger==1 else .022)-distance)/.010)
            if influence<1e-6:continue
            lengths=[(b-a).length for a,b in zip(knots,knots[1:])]
            first=smooth((along-lengths[0]+.006)/.012)
            second=smooth((along-lengths[0]-lengths[1]+.005)/.010)
            weights=[1-first,first*(1-second),second]
            # Transitions never overlap because source phalanges exceed 11 mm.
            total=sum(weights);weights=[w/total for w in weights]
            hand_group.add([index],1-influence,'REPLACE')
            for segment,w in enumerate(weights):
                if influence*w>1e-6:groups[finger,segment].add([index],influence*w,'REPLACE')
            if influence>.7:labels.data[index].value=hand['sign']*finger
            weighted+=1
    for bone in rig.pose.bones:bone.rotation_mode='QUATERNION'
    return axes,hand_ids,weighted

def actions(rig,poses,axes,profile):
    angles={1:(.055,.080,.045),2:(.09,.12,.06),3:(.13,.17,.085),4:(.17,.20,.095),5:(.20,.22,.11)}
    strength={'resident-03':.90,'resident-06':1.,'resident-08':1.05}[profile['actorId']]
    for kind,samples in poses.items():
        action=bpy.data.actions.new(kind);action.use_fake_user=True
        rig.animation_data.action=action
        for index,saved in enumerate(samples):
            bpy.context.scene.frame_set(index+1)
            phase=index/(len(samples)-1)
            for bone in rig.pose.bones:bone.matrix_basis=Matrix.Identity(4)
            for name,matrix in saved.items():rig.pose.bones[name].matrix_basis=matrix
            if kind=='Idle' and profile['actorId'] in ('resident-03','resident-08'):
                # The left resting hand sat against the flared skirt. Open the
                # elbow slightly instead of flattening the fingers or skirt.
                bpy.context.view_layer.update()
                forearm=rig.pose.bones['forearm_L']
                axis=forearm.matrix.to_3x3().inverted()@Vector((0,1,0))
                forearm.rotation_quaternion=forearm.rotation_quaternion@Quaternion(axis,.040)
            for name,axis in axes.items():
                _,side,finger,segment=name.split('_');f,s=int(finger),int(segment)-1
                wave=math.sin(math.tau*phase+(0 if side=='L' else math.pi))
                amount=angles[f][s]*strength*(1+(.035 if kind=='Idle' else .02)*wave)
                rig.pose.bones[name].rotation_quaternion=Quaternion(axis,amount)
                if f==1 and s==0:
                    # Bring the thumb alongside the relaxed fingers. Its source
                    # spread otherwise catches the jacket during this pose.
                    inward=Vector((0,-1 if side=='R' else 1,0))
                    local=rig.data.bones[name].matrix_local.to_3x3().inverted()@inward
                    rig.pose.bones[name].rotation_quaternion=Quaternion(local,.40)@rig.pose.bones[name].rotation_quaternion
            for side,sign in [('L',-1),('R',1)]:
                hand=rig.pose.bones['hand_'+side]
                hand.rotation_quaternion=hand.rotation_quaternion@Quaternion((0,1,0),sign*-.10)
            for bone in rig.pose.bones:
                for prop in ('location','rotation_quaternion','scale'):bone.keyframe_insert(data_path=prop,frame=index+1,group=bone.name)
        rig.animation_data.action=None
    bind_action(rig,bpy.data.actions['Idle']);bpy.context.scene.frame_set(1);bpy.context.view_layer.update()

def validate(body,rig,hand_ids,identity):
    assert mesh_identity(body)==identity
    invalid=[]
    for v in body.data.vertices:
        weights=[g.weight for g in v.groups if g.weight>1e-6]
        if abs(sum(weights)-1)>1e-5 or len(weights)>4:invalid.append(v.index)
    assert not invalid
    mesh=body.data;mesh.calc_loop_triangles();labels=mesh.attributes['AnatomicalFinger'].data
    finger_faces={key:[] for key in list(range(-5,0))+list(range(1,6))}
    garment=[]
    for tri in mesh.loop_triangles:
        ids=tuple(tri.vertices);key=labels[ids[0]].value
        if key and all(labels[i].value==key for i in ids):finger_faces[key].append(ids)
        if not any(i in hand_ids for i in ids):garment.append(ids)
    assert all(finger_faces.values())
    frames=[]
    for kind,count in [('Idle',90),('Walk',24)]:
        bind_action(rig,bpy.data.actions[kind])
        for frame in range(1,count+2):
            bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
            evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get());posed=evaluated.to_mesh()
            points=[v.co.copy() for v in posed.vertices]
            trees={key:BVHTree.FromPolygons(points,faces,all_triangles=True) for key,faces in finger_faces.items()}
            other=BVHTree.FromPolygons(points,garment,all_triangles=True)
            pairs=[];contact=0;by_finger={}
            for keys in (list(range(-5,0)),list(range(1,6))):
                for i,a in enumerate(keys):
                    overlap=trees[a].overlap(other);contact+=len(overlap)
                    if overlap:by_finger[str(a)]=len(overlap)
                    for b in keys[i+1:]:
                        n=len(trees[a].overlap(trees[b]))
                        if n:pairs.append([a,b,n])
            frames.append({'clip':kind,'frame':frame,'fingerPairIntersections':pairs,'fingerGarmentTrianglePairs':contact,'fingerGarmentContacts':by_finger})
            evaluated.to_mesh_clear()
    bind_action(rig,bpy.data.actions['Idle']);bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
    return {'restMeshIdentity':identity,'invalidWeights':len(invalid),'bones':len(rig.data.bones),
        'fingerTriangles':{str(k):len(v) for k,v in finger_faces.items()},'frames':frames,
        'maximumFingerPairIntersections':max(sum(p[2] for p in row['fingerPairIntersections']) for row in frames),
        'maximumFingerGarmentIntersections':max(row['fingerGarmentTrianglePairs'] for row in frames)}

def camera(name,position,target,scale):
    data=bpy.data.cameras.new(name);data.type='ORTHO';data.ortho_scale=scale
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=position
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--ids',default=','.join(VERSIONS));parser.add_argument('--pilot')
    parser.add_argument('--views',default='hands,hand-palm,hand-side,three-quarter,front,portrait,back,walk-contact,walk-passing')
    parser.add_argument('--samples',type=int,default=48);parser.add_argument('--width',type=int,default=1000)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    package=PACKAGE/'pilots'/args.pilot if args.pilot else PACKAGE
    profiles=read(ROOT/'docs/3d-town/classic-residents-v1/profiles.json')['profiles']
    ledger=read(anatomy.DATA/'provenance.json')
    for row in ledger['files']:assert sha(ROOT/row['path'])==row['sha256']
    cast=read(ROOT/'public/assets/classic-residents/v7/cast.json')
    for actor in args.ids.split(','):
        profile=next(p for p in profiles if p['actorId']==actor);version=VERSIONS[actor]
        source=ROOT/f'docs/3d-town/classic-residents-v{version}'/actor/(profile['id']+'.blend')
        entry=next(e for e in cast['entries'] if e['actorId']==actor);manifest=ROOT/('public'+entry['manifestUrl'])
        assert sha(manifest)==entry['manifestSha256']
        assert sha(source)==read(manifest)['sourceSha256']
        bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.preferences.filepaths.save_version=0
        body=bpy.data.objects[profile['id']+'_skin'];rig=bpy.data.objects[profile['id']+'_rig']
        identity=mesh_identity(body);old_bones=[b.name for b in rig.data.bones];poses={}
        for kind,count in [('Idle',90),('Walk',24)]:
            old=bpy.data.actions[kind];bind_action(rig,old);poses[kind]=[]
            for frame in range(1,count+2):
                bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
                poses[kind].append({b.name:b.matrix_basis.copy() for b in rig.pose.bones})
        rig.animation_data.action=None
        for action in list(bpy.data.actions):bpy.data.actions.remove(action)
        hands=hand_mapping(body,profile);axes,hand_ids,weighted=add_controls(body,rig,hands)
        assert len(rig.data.bones)==50
        actions(rig,poses,axes,profile);review=validate(body,rig,hand_ids,identity)
        passed=review['maximumFingerPairIntersections']==0 and review['maximumFingerGarmentIntersections']==0
        scene=bpy.context.scene;scene.render.fps=30;scene.render.engine='CYCLES';scene.cycles.samples=args.samples
        scene.render.resolution_x=args.width;scene.render.resolution_y=args.width;scene.render.resolution_percentage=100
        palm=body.matrix_world@Vector((.278,-.00,.860))
        camera('hand-palm',(palm.x+.08,palm.y-1.2,palm.z+.08),palm,.34)
        camera('hand-side',(palm.x+1.2,palm.y-.02,palm.z+.05),palm,.34)
        folder=package/actor;folder.mkdir(parents=True,exist_ok=True)
        path=folder/(profile['id']+'.blend');scene.camera=bpy.data.objects['three-quarter']
        bpy.ops.wm.save_as_mainfile(filepath=str(path));source_hash=sha(path)
        review.update(schema='classic-resident-finger-rig.v8',profile=profile,sourceSha256=source_hash,
            sourceInput={'path':source.relative_to(ROOT).as_posix(),'sha256':sha(source)},
            inputs={Path(__file__).relative_to(ROOT).as_posix():sha(Path(__file__)),
                'scripts/classic-resident-anatomy.py':sha(ROOT/'scripts/classic-resident-anatomy.py'),
                (anatomy.DATA/'provenance.json').relative_to(ROOT).as_posix():sha(anatomy.DATA/'provenance.json')},
            handVertices=len(hand_ids),weightedFingerVertices=weighted,oldBones=old_bones,
            mappings=[{'side':h['side'],'vertices':len(h['ids']),'maximumError':h['mappingError']} for h in hands],
            idleForearmClearanceRadians={'forearm_L':.040} if actor in ('resident-03','resident-08') else {},
            passed=passed,humanArtApproved=False,worldBound=False,
            scope='Three phalanges per digit, normalized skinning and relaxed poses on retained body actions. Finger-core triangle checks cover distinct digits and garments in the two saved clips; not all self-intersections or arbitrary future grasps.')
        write(folder/'authoring-review.json',review)
        renders=[]
        for name in args.views.split(','):
            kind='Walk' if name.startswith('walk') else 'Idle';bind_action(rig,bpy.data.actions[kind]);scene.frame_set(7 if name=='walk-passing' else 1)
            scene.camera=bpy.data.objects['front' if name.startswith('walk') else name]
            out=folder/'renders'/f'{name}.png';out.parent.mkdir(parents=True,exist_ok=True);scene.render.filepath=str(out)
            bpy.ops.render.render(write_still=True);renders.append({'view':name,'path':out.relative_to(folder).as_posix(),'sha256':sha(out)})
        write(folder/'render-review.json',{'sourceSha256':source_hash,'engine':'Cycles','samples':args.samples,'renders':renders,'humanArtApproved':False})
        assert passed,(actor,review['maximumFingerPairIntersections'],review['maximumFingerGarmentIntersections'])
        bind_action(rig,bpy.data.actions['Idle']);scene.frame_set(1)
        bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True)
        raw=folder/(profile['id']+'-raw.glb')
        bpy.ops.export_scene.gltf(filepath=str(raw),export_format='GLB',use_selection=True,export_animations=True,
            export_animation_mode='ACTIONS',export_force_sampling=True,export_anim_slide_to_zero=True,export_skins=True,
            export_apply=False,export_extras=True,export_cameras=False,export_lights=False,export_yup=True)
        write(folder/'raw-export.json',{'sourceSha256':source_hash,'rawSha256':sha(raw),'bytes':raw.stat().st_size})
        print(json.dumps({'actorId':actor,'sourceSha256':source_hash,'bones':len(rig.data.bones),'passed':passed,'rawBytes':raw.stat().st_size}),flush=True)

if __name__=='__main__':main()
