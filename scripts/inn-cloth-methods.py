"""Surface-connected binding adapted for Lin Ali's 3324-vertex blouse."""
from pathlib import Path
import importlib.util, math
import numpy as np
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('retained_cloth',ROOT/'scripts/build-restorer-deformation.py')
retained=importlib.util.module_from_spec(spec);spec.loader.exec_module(retained)
w=retained.w
component=retained.component
distances=retained.distances

def rebind_blouse(body,refine_shape=False):
    parts,whole=component(body,'coat');ids=parts[0];assert len(ids)==3324
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
