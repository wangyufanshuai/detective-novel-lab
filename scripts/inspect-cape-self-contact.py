"""Compare nonadjacent cape-face self-contact at representative poses."""
from pathlib import Path
import argparse, bpy, hashlib, json, sys
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]; BASE=ROOT/'docs/3d-town/classic-motion-v2'
p=argparse.ArgumentParser();p.add_argument('--trial',default='cape-08');p.add_argument('--layers',action='store_true');args=p.parse_args(sys.argv[sys.argv.index('--')+1:]if'--'in sys.argv else [])
OUT=BASE/'step-16'/args.trial
rows=[]
for tag,file in [('retained',BASE/'step-15/resident-08/resident.blend'),('candidate',OUT/'resident-08/resident.blend')]:
 bpy.ops.wm.open_mainfile(filepath=str(file));body=bpy.data.objects['rb-lin-ali_skin'];rig=bpy.data.objects['rb-lin-ali_rig'];origin=bpy.data.objects['movement_actor']
 origin.animation_data_clear();origin.location=(0,0,0);origin.rotation_euler=(0,0,0)
 mesh=body.data;mesh.calc_loop_triangles();labels=mesh.attributes['ArtClothLayer'].data
 ids=sorted(v.index for v in mesh.vertices if labels[v.index].value==2);half=len(ids)//2;outer=set(ids[:half]);inner=set(ids[half:]);paired=dict(zip(ids[:half],ids[half:]))
 faces=[tuple(t.vertices)for t in mesh.loop_triangles if all(labels[i].value==2 for i in t.vertices)];sets=[set(f)for f in faces]
 for clip,frame in [('Idle',1),('Walk',1),('Walk',13),('ReconcileRegister',31),('ReconcileRegister',151),('ReconcileRegister',273)]:
  action=bpy.data.actions[clip];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
  bpy.context.scene.frame_set(frame);bpy.context.view_layer.update();e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();p=[v.co.copy()for v in m.vertices]
  tree=BVHTree.FromPolygons(p,faces,all_triangles=True)
  contacts=[(a,b)for a,b in tree.overlap(tree)if a<b and not sets[a]&sets[b]]
  counts={'outer':0,'inner':0,'pairedShell':0,'otherCrossShell':0,'rim':0}
  for a,b in contacts:
   if sets[a]<=outer and sets[b]<=outer:counts['outer']+=1
   elif sets[a]<=inner and sets[b]<=inner:counts['inner']+=1
   elif (sets[a]<=outer and sets[b]<=inner)or(sets[b]<=outer and sets[a]<=inner):
    oa,ib=(sets[a],sets[b])if sets[a]<=outer else(sets[b],sets[a]);counts['pairedShell'if{paired[i]for i in oa}==ib else'otherCrossShell']+=1
   else:counts['rim']+=1
  row={'variant':tag,'sourceSha256':hashlib.sha256(file.read_bytes()).hexdigest(),'clip':clip,'frame':frame,'nonAdjacentPairs':len(contacts),'layers':counts,'firstFaces':[{'a':faces[a],'b':faces[b]}for a,b in contacts[:5]]}
  rows.append(row);e.to_mesh_clear();print(json.dumps(row),flush=True)
report={'complete':True,'rows':rows,'candidatePassed':all(r['nonAdjacentPairs']==0 for r in rows if r['variant']=='candidate'),'humanApproved':False,'scope':'Actual cape triangles only, six representative poses in retained and candidate source. Pairs sharing vertex indices are excluded. No trim, full-time self-contact, blends or runtime claim.'}
suffix='-layers'if args.layers else''
(OUT/('cape-self-contact'+suffix+'-diagnostic.json')).write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
(OUT/('cape-self-contact'+suffix+'-inspector.py')).write_bytes(Path(__file__).read_bytes())
