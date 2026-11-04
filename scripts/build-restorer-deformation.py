"""Repair continuous sleeve binding from surface connectivity, then add gaze."""
from pathlib import Path
import argparse,heapq,importlib.util,json,math,sys
import bpy,numpy as np
from mathutils import Vector,Quaternion
ROOT=Path(__file__).resolve().parents[1];PACKAGE=ROOT/'docs/3d-town/classic-residents-v10'
spec=importlib.util.spec_from_file_location('retained_work',ROOT/'scripts/build-blender-restorer-work.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
SOURCE=ROOT/'docs/3d-town/classic-residents-v9/resident-03/rb-xu-zhiwei.blend'

def component(body,material):
    mesh=body.data;polys=[p for p in mesh.polygons if mesh.materials[p.material_index].name==material]
    graph={i:set() for p in polys for i in p.vertices}
    for p in polys:
        ids=list(p.vertices)
        for a,b in zip(ids,ids[1:]+ids[:1]):graph[a].add(b);graph[b].add(a)
    remaining=set(graph);out=[]
    while remaining:
        first=remaining.pop();ids=[first];stack=[first]
        while stack:
            for n in graph[stack.pop()]:
                if n in remaining:remaining.remove(n);stack.append(n);ids.append(n)
        out.append(sorted(ids))
    return sorted(out,key=len,reverse=True),graph

def distances(graph,points,seeds):
    d={i:math.inf for i in graph};heap=[]
    for i in seeds:d[i]=0;heapq.heappush(heap,(0,i))
    while heap:
        distance,i=heapq.heappop(heap)
        if distance!=d[i]:continue
        for j in graph[i]:
            candidate=distance+(points[i]-points[j]).length
            if candidate<d[j]:d[j]=candidate;heapq.heappush(heap,(candidate,j))
    return d

def rebind_blouse(body,refine_shape=False):
    parts,whole=component(body,'shirt');ids=parts[0];assert len(ids)==3255
    keep=set(ids);graph={i:{j for j in whole[i] if j in keep} for i in ids};points={i:body.data.vertices[i].co.copy() for i in ids}
    cuff={s:[i for i in ids if s*points[i].x>.23 and points[i].z<.982] for s in (-1,1)}
    d={s:distances(graph,points,cuff[s]) for s in (-1,1)}
    torso={i for i,p in points.items() if min(d[-1][i],d[1][i])>.45 and (abs(p.x)<.125 or (p.z<1.085 and abs(p.x)<.22) or (abs(p.x)<.185 and p.z<1.37 and abs(p.y)>.025))}
    arm={s:{i for i in ids if d[s][i]<.34} for s in (-1,1)}
    assert not (torso&arm[-1] or torso&arm[1] or arm[-1]&arm[1]),[(i,list(points[i]),d[-1][i],d[1][i]) for i in sorted(torso&(arm[-1]|arm[1]))[:12]]
    local={i:j for j,i in enumerate(ids)};a=np.array([local[i] for i in ids for j in graph[i]],dtype=np.int32);b=np.array([local[j] for i in ids for j in graph[i]],dtype=np.int32)
    edge_weight=np.array([1/max((points[i]-points[j]).length,1e-5) for i in ids for j in graph[i]])
    total=np.bincount(a,weights=edge_weight,minlength=len(ids));pin=np.array([i in torso or i in arm[-1] or i in arm[1] for i in ids])
    values=np.zeros((len(ids),2),dtype=float)
    for col,s in enumerate((-1,1)):values[:,col]=[1 if i in arm[s] else 0 for i in ids]
    fixed=values.copy();converged=False
    for iteration in range(4000):
        new=np.column_stack([np.bincount(a,weights=edge_weight*values[b,c],minlength=len(ids))/total for c in range(2)])
        new[pin]=fixed[pin];change=float(np.max(np.abs(new-values)));values=new
        if change<1e-7:converged=True;break
    assert converged,change
    changed=[];old_rows=[];new_rows=[];shape_changes=[]
    for row,i in enumerate(ids):
        old={body.vertex_groups[g.group].name:g.weight for g in body.data.vertices[i].groups if g.weight>1e-6}
        p=points[i];left,right=map(float,values[row]);trunk=max(0,1-left-right)
        weights={name:v*trunk for name,v in w.inv.torso(p).items()}
        for amount,side in ((left,'L'),(right,'R')):
            # Keep the wrist cloth on the forearm. The shoulder and elbow are
            # now blended along the connected fabric, rather than by X alone.
            upper=w.hands.smooth((p.z-1.14)/.14)
            weights['upperarm_'+side]=amount*upper;weights['forearm_'+side]=amount*(1-upper)
        weights={k:v for k,v in weights.items() if v>1e-5}
        # At the central torso, vanishing opposite-arm terms are irrelevant;
        # retain at most four normalized influences for the runtime skin.
        weights=dict(sorted(weights.items(),key=lambda kv:kv[1],reverse=True)[:4]);normal=sum(weights.values());weights={k:v/normal for k,v in weights.items()}
        for g in list(body.data.vertices[i].groups):body.vertex_groups[g.group].remove([i])
        for name,value in weights.items():body.vertex_groups[name].add([i],value,'REPLACE')
        if any(abs(old.get(k,0)-weights.get(k,0))>1e-6 for k in old.keys()|weights.keys()):changed.append(i)
        old_rows.append(old);new_rows.append(weights)
        if refine_shape:
            side=-1 if p.x<0 else 1;amount=w.hands.smooth((.56-d[side][i])/.16)
            if amount>0:
                rings=[(.962,.278,-.025,.035,.037),(1.02,.279,-.021,.041,.044),(1.12,.282,-.014,.049,.052),(1.192,.283,-.016,.052,.055),(1.29,.264,-.008,.053,.058),(1.38,.242,.005,.056,.062),(1.465,.223,.006,.061,.064),(1.52,.205,.009,.062,.065)]
                a,b=next(((a,b) for a,b in zip(rings,rings[1:]) if a[0]<=p.z<=b[0]),(rings[0],rings[1]) if p.z<rings[0][0] else (rings[-2],rings[-1]))
                t=max(0,min(1,(p.z-a[0])/(b[0]-a[0])));cx,cy,rx,ry=[a[j]*(1-t)+b[j]*t for j in range(1,5)];cx*=side
                angle=math.atan2((p.x-cx)/rx,-(p.y-cy)/ry)
                fold=.0015*math.exp(-((p.z-1.17)/.07)**2)*math.sin((p.z-1.13)*110+math.sin(angle))
                goal=Vector((cx+(rx+fold)*math.sin(angle),cy-(ry+fold)*math.cos(angle),p.z))
                body.data.vertices[i].co=p.lerp(goal,amount);shape_changes.append(i)
    if refine_shape:
        # Round the high-frequency corner left by the old rest-pose sleeve,
        # preserving the wrist seam and the main torso. Taubin's paired
        # passes avoid the strong shrinkage of ordinary Laplacian smoothing.
        influence={i:w.hands.smooth((min(d[-1][i],d[1][i])-.025)/.06)*w.hands.smooth((.64-min(d[-1][i],d[1][i]))/.18) for i in ids}
        shape_changes=list(sorted(set(shape_changes)|{i for i,v in influence.items() if v>0}))
        for _ in range(18):
            for coefficient in (.38,-.39):
                positions={i:body.data.vertices[i].co.copy() for i in ids}
                for i in ids:
                    if influence[i]>0:
                        average=sum((positions[j] for j in graph[i]),Vector())/len(graph[i])
                        body.data.vertices[i].co=positions[i]+(average-positions[i])*coefficient*influence[i]
    body.data.update()
    return {'blouseVertices':ids,'changedVertices':changed,'surfaceSolveIterations':iteration+1,'maximumFinalWeightUpdate':change,
        'torsoAnchors':len(torso),'armAnchors':{str(s):len(v) for s,v in arm.items()},'oldWeights':old_rows,'newWeights':new_rows,'shapeVertices':shape_changes,
        'scope':'Surface-connected harmonic shoulder weights and axial elbow weights. No runtime cloth simulation.'}

def add_gaze(body,rig):
    eyes,_=component(body,'eye_detail');assert len(eyes)==2 and all(len(ids)==181 for ids in eyes)
    centers={};indices={}
    for ids in eyes:
        points=[body.data.vertices[i].co for i in ids];center=Vector([(min(p[k] for p in points)+max(p[k] for p in points))/2 for k in range(3)])
        side='L' if center.x<0 else 'R';centers[side]=center;indices[side]=ids
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
    for side,c in centers.items():
        bone=rig.data.edit_bones.new('eye_'+side);bone.head=c;bone.tail=c+Vector((0,-.014,0));bone.parent=rig.data.edit_bones['head']
    bpy.ops.object.mode_set(mode='OBJECT')
    for side,ids in indices.items():
        group=body.vertex_groups.new(name='eye_'+side)
        for i in ids:
            for g in list(body.data.vertices[i].groups):body.vertex_groups[g.group].remove([i])
        group.add(ids,1,'REPLACE')
    collar=component(body,'shirt')[0][1];assert len(collar)==288
    for i in collar:
        for g in list(body.data.vertices[i].groups):body.vertex_groups[g.group].remove([i])
    body.vertex_groups['chest'].add(collar,1,'REPLACE')
    report=[]
    for clip,count in [('Idle',90),('Walk',24),('InspectBook',240)]:
        w.hands.bind_action(rig,bpy.data.actions[clip])
        # Capture first, before adding keys, so no partial edited curve can
        # influence the later source samples.
        baseline=[]
        for f in range(1,count+2):
            bpy.context.scene.frame_set(f);baseline.append(rig.pose.bones['head'].rotation_quaternion.copy())
        for f,base in enumerate(baseline,1):
            bpy.context.scene.frame_set(f);t=(f-1)/30
            attention=w.hands.smooth((t-.42)/.8)*(1-w.hands.smooth((t-6.5)/.8)) if clip=='InspectBook' else 0
            head=rig.pose.bones['head'];head.rotation_quaternion=base;bpy.context.view_layer.update()
            book=bpy.data.objects['restorer_book_anchor'];target=rig.matrix_world.inverted()@(book.matrix_world@Vector((0,-.06,.017)))
            extra=0
            center=(centers['L']+centers['R'])/2
            for _ in range(4):
                deformation=head.matrix@rig.data.bones['head'].matrix_local.inverted()
                direction=deformation.to_3x3().inverted()@(target-deformation@center).normalized()
                residual=math.atan2(-direction.z,math.hypot(direction.x,direction.y))
                extra=max(0,min(.60,extra+residual-.37)) if attention else 0
                head.rotation_quaternion=base@Quaternion((1,0,0),extra);bpy.context.view_layer.update()
            head.rotation_quaternion=base@Quaternion((1,0,0),extra*attention);head.keyframe_insert(data_path='rotation_quaternion',frame=f);bpy.context.view_layer.update()
            row={'clip':clip,'frame':f,'attention':attention,'additionalHeadPitchRadians':extra*attention,'target':list(target),'eyes':{}}
            for side,center in centers.items():
                bone=rig.pose.bones['eye_'+side];bone.rotation_mode='QUATERNION';bone.rotation_quaternion=Quaternion();bpy.context.view_layer.update()
                deformation=head.matrix@rig.data.bones['head'].matrix_local.inverted();eye_center=deformation@center
                local_direction=deformation.to_3x3().inverted()@(target-eye_center).normalized()
                yaw=max(-.20,min(.20,math.atan2(local_direction.x,-local_direction.y)))
                pitch=max(-.12,min(.45,math.atan2(-local_direction.z,math.hypot(local_direction.x,local_direction.y))))
                desired=Quaternion((0,0,1),yaw*attention)@Quaternion((1,0,0),pitch*attention)
                rest=rig.data.bones[bone.name].matrix_local.to_3x3();bone.rotation_quaternion=(rest.inverted()@desired.to_matrix()@rest).to_quaternion()
                bone.keyframe_insert(data_path='rotation_quaternion',frame=f)
                bpy.context.view_layer.update()
                aim=bone.matrix.to_3x3()@(rest.inverted()@Vector((0,-1,0)))
                row['eyes'][side]={'yawRadians':yaw*attention,'pitchRadians':pitch*attention,'targetAngleDegrees':math.degrees(aim.angle(target-eye_center)) if attention>.99 else None}
            report.append(row)
    return {'eyeVertices':indices,'eyeCenters':{s:list(c) for s,c in centers.items()},'collarVertices':collar,'frames':report,'scope':'Authored book gaze with bounded eyeball rotation and head pitch; no blink or facial expressions.'}

def stretch(body,ids,frames):
    chosen=set(ids);edges=[tuple(e.vertices) for e in body.data.edges if all(i in chosen for i in e.vertices)]
    lengths=[(body.data.vertices[a].co-body.data.vertices[b].co).length for a,b in edges];rows=[]
    for frame in frames:
        bpy.context.scene.frame_set(frame);bpy.context.view_layer.update();obj=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=obj.to_mesh()
        ratios=sorted((mesh.vertices[a].co-mesh.vertices[b].co).length/l for (a,b),l in zip(edges,lengths) if l>1e-5)
        rows.append({'frame':frame,'p95EdgeLengthRatio':ratios[int(len(ratios)*.95)],'maximumEdgeLengthRatio':max(ratios),'edgesOver1_5':sum(v>1.5 for v in ratios),'edgesOver2':sum(v>2 for v in ratios)})
        obj.to_mesh_clear()
    return rows

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--pilot',default='sleeves-01');parser.add_argument('--shape',action='store_true');parser.add_argument('--gaze',action='store_true');args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    folder=PACKAGE/'pilots'/args.pilot;folder.mkdir(parents=True,exist_ok=True)
    manifest=w.read(ROOT/'public/assets/classic-residents/v9/resident-03.json');assert w.sha(SOURCE)==manifest['sourceSha256']
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE));bpy.context.preferences.filepaths.save_version=0
    body=bpy.data.objects['rb-xu-zhiwei_skin'];rig=bpy.data.objects['rb-xu-zhiwei_rig'];identity=w.hands.mesh_identity(body)
    ids=component(body,'shirt')[0][0];w.hands.bind_action(rig,bpy.data.actions['InspectBook']);before=stretch(body,ids,[1,33,52,111,196,241])
    weights=rebind_blouse(body,args.shape)
    if not args.shape:assert w.hands.mesh_identity(body)==identity
    gaze=add_gaze(body,rig) if args.gaze else None
    w.hands.bind_action(rig,bpy.data.actions['InspectBook'])
    after=stretch(body,ids,[1,33,52,111,196,241])
    w.u.configure(32,1100);scene=bpy.context.scene;scene.render.resolution_y=1100
    w.u.camera('v10-shoulder',(1.5,-3,1.9),(0,-.10,1.32),1.25)
    w.u.camera('v10-back',(-2.2,3,1.7),(0,-.1,1.25),1.35)
    w.u.camera('v10-face',(.55,-2.3,1.72),(0,-.055,1.52),.70)
    scene.frame_set(111);scene.camera=bpy.data.objects['v10-shoulder'];source=folder/'restorer-deformation.blend';bpy.ops.wm.save_as_mainfile(filepath=str(source))
    (folder/'builder.py').write_bytes(Path(__file__).read_bytes())
    renders=[]
    for name,camera,frame in [('held','v10-shoulder',111),('approach','v10-shoulder',33),('back','v10-back',111),('grasp','book-contact',52),('gaze','v10-face',111),('rest','v10-shoulder',1)]:
        scene.frame_set(frame);scene.camera=bpy.data.objects[camera];path=folder/'renders'/f'{name}.png';path.parent.mkdir(parents=True,exist_ok=True);scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
        renders.append({'name':name,'frame':frame,'path':path.relative_to(folder).as_posix(),'sha256':w.sha(path)})
    w.write(folder/'authoring-review.json',{'sourceInput':{'path':SOURCE.relative_to(ROOT).as_posix(),'sha256':manifest['sourceSha256']},'sourceSha256':w.sha(source),
        'builderSha256':w.sha(Path(__file__)),'inputRestMeshIdentity':identity,'restMeshIdentity':w.hands.mesh_identity(body),'weights':weights,'gaze':gaze,'stretchBefore':before,'stretchAfter':after,'renders':renders,'worldBound':False,'humanArtApproved':False})
    print(json.dumps({'sourceSha256':w.sha(source),'changedVertices':len(weights['changedVertices']),'solveIterations':weights['surfaceSolveIterations'],'stretchBefore':before,'stretchAfter':after}))

if __name__=='__main__':main()
