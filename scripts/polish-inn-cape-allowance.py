"""Fit a small, coherent shoulder patch without changing the checked motion."""
from pathlib import Path
import argparse, bpy, hashlib, json, math, sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/3d-town/classic-motion-v2'
p=argparse.ArgumentParser();p.add_argument('--trial',default='cape-17');args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
SOURCE=BASE/'step-16/cape-16/resident-08/resident.blend';OUT=BASE/'step-16'/args.trial/'resident-08';OUT.mkdir(parents=True,exist_ok=False)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();identity=sha(SOURCE)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));body=bpy.data.objects['rb-lin-ali_skin'];rig=bpy.data.objects['rb-lin-ali_rig'];mesh=body.data;keys=mesh.shape_keys.key_blocks
old=json.loads((SOURCE.parent/'cape-sculpt.json').read_text());patches=old['patches'];ids=sorted(r['index']for r in patches);coords={i:keys[0].data[i].co.copy()for i in ids}
labels=mesh.attributes['ArtClothLayer'].data;cape=sorted(i for i in ids if labels[i].value==2);outer=cape[:len(cape)//2];inner=cape[len(cape)//2:];pair=dict(zip(outer,inner));external=set(outer);reverse=dict(zip(inner,outer))
mesh.calc_loop_triangles();faces={v:[tuple(t.vertices)for t in mesh.loop_triangles if all(labels[i].value==v for i in t.vertices)]for v in (1,2)};cape_sets=[set(f)for f in faces[2]]
normals={i:Vector()for i in outer}
for f in faces[2]:
    if set(f)<=external:
        normal=(coords[f[1]]-coords[f[0]]).cross(coords[f[2]]-coords[f[0]])
        for i in f:normals[i]+=normal
for n in normals.values():n.normalize()

def update(changed):
    for i,q in changed.items():
        for key in keys:key.data[i].co=q
        mesh.vertices[i].co=q
    mesh.shape_keys.update_tag();mesh.update();body.update_tag();bpy.context.view_layer.update()

def evaluate(poses):
    rows=[];contact_ids=set()
    for clip,frame in poses:
        action=bpy.data.actions[clip];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
        bpy.context.scene.frame_set(math.floor(frame),subframe=frame%1);bpy.context.view_layer.update()
        e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();points=[v.co.copy()for v in m.vertices]
        tree=BVHTree.FromPolygons(points,faces[2],all_triangles=True);blouse=BVHTree.FromPolygons(points,faces[1],all_triangles=True)
        contacts=tree.overlap(blouse);self_hits=sum(a<b and not cape_sets[a]&cape_sets[b]for a,b in tree.overlap(tree))
        contact_ids.update(reverse.get(i,i)for a,b in contacts for i in faces[2][a]);e.to_mesh_clear()
        rows.append({'clip':clip,'frame':frame,'blouseCape':len(contacts),'capeSelf':self_hits})
    return rows,contact_ids

active=[('Idle',1),('Walk',1),('Walk',13),('ReconcileRegister',31),('ReconcileRegister',151),('ReconcileRegister',273)]+[('ReconcileRegister',f)for f in range(285,295)]
initial,contacts=evaluate(active);assert contacts
kd=KDTree(len(contacts))
for n,i in enumerate(contacts):kd.insert(coords[i],i)
kd.balance();influence={i:math.exp(-(kd.find(coords[i])[2]/.045)**2)for i in outer}
for i in outer:influence[pair[i]]=influence[i];normals[pair[i]]=normals[i]
boundary=KDTree(len(outer))
for i in outer:boundary.insert(coords[i],i)
boundary.balance()
for i in set(ids)-set(cape):
    j=boundary.find(coords[i])[1];influence[i]=influence[j];normals[i]=normals[j]
influence={i:w for i,w in influence.items()if w>.002}
best=None;trials=[]
directions=[('normal',None),('x',Vector((1,0,0))),('y',Vector((0,1,0))),('z',Vector((0,0,1)))]
for amount in (.002,.004,.006,.008):
    for name,direction in directions:
        for sign in ((1,)if name=='normal'else(-1,1)):
            changed={i:coords[i]+(normals[i]if direction is None else direction)*(amount*sign*w)for i,w in influence.items()}
            update(changed);rows,_=evaluate(active);score=(sum(r['capeSelf']for r in rows)>0,sum(r['blouseCape']for r in rows),amount)
            trial={'direction':name,'amountMeters':amount*sign,'pairs':score[1],'selfPairs':sum(r['capeSelf']for r in rows),'rows':rows};trials.append(trial)
            print(json.dumps({k:v for k,v in trial.items()if k!='rows'}),flush=True)
            if best is None or score<best[0]:best=(score,changed,trial)
            update({i:coords[i]for i in influence})
            if score[0]is False and score[1]==0:break
        if best and best[0][0]is False and best[0][1]==0:break
    if best and best[0][0]is False and best[0][1]==0:break
update(best[1]);full,_=evaluate([('ReconcileRegister',f)for f in range(1,302)]+[('Idle',1),('Walk',1),('Walk',13)])
for patch in patches:
    i=patch['index'];patch['after']=list(keys[0].data[i].co);patch['displacementMeters']=(keys[0].data[i].co-Vector(patch['before'])).length
action=bpy.data.actions['Idle'];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0];bpy.context.scene.frame_set(1);bpy.context.view_layer.update();bpy.context.preferences.filepaths.save_version=0
destination=OUT/'resident.blend';bpy.ops.wm.save_as_mainfile(filepath=str(destination),compress=True);assert sha(SOURCE)==identity
report={**old,'sourceSha256':sha(destination),'parentSourceSha256':identity,'patches':patches,
    'localPatch':{'vertices':len(influence),'selected':best[2],'trials':trials},'constructionRows':full,
    'constructionContactsCleared':all(not r['blouseCape']and not r['capeSelf']for r in full),
    'method':'Cape-16 double-sided pattern and exact work actions retained. A coherent small surface patch moves both cloth layers and nearby trim together, selected from actual pose contacts. No dynamic cloth or final art claim.'}
(OUT/'cape-sculpt.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
motion=json.loads((SOURCE.parent/'motion-edit.json').read_text());motion['sourceSha256']=sha(destination);(OUT/'motion-edit.json').write_text(json.dumps(motion,indent=2)+'\n',encoding='utf-8')
meta=json.loads((SOURCE.parent/'authoring-review.json').read_text());meta.update(sourceSha256=sha(destination),parentSourceSha256=identity,capeTrial=args.trial,builderSha256=sha(Path(__file__)),humanArtApproved=False)
(OUT/'authoring-review.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8');(OUT/'builder.py').write_bytes(Path(__file__).read_bytes())
print(json.dumps({'complete':True,'sourceSha256':sha(destination),'constructionContactsCleared':report['constructionContactsCleared'],'maximumPairs':max(r['blouseCape']for r in full),'maximumSelfPairs':max(r['capeSelf']for r in full)}),flush=True)
