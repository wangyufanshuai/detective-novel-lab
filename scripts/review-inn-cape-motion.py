"""Independently re-open parent/candidate and check work arm changes at 240 Hz."""
from pathlib import Path
import argparse, bpy, hashlib, json, sys
import numpy as np
from mathutils import Matrix, Vector

ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/3d-town/classic-motion-v2'
p=argparse.ArgumentParser();p.add_argument('--trial',required=True);args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
P=BASE/'step-16'/args.trial;candidate=P/'resident-08/resident.blend';parent=BASE/'step-16/cape-12/resident-08/resident.blend'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
edit=json.loads((candidate.parent/'motion-edit.json').read_text());assert edit['sourceSha256']==sha(candidate)and edit['parentSourceSha256']==sha(parent)
assert edit.get('horizontalPath')=='lift-first-v1'
def capture(file):
    bpy.ops.wm.open_mainfile(filepath=str(file));rig=bpy.data.objects['rb-lin-ali_rig'];action=bpy.data.actions['ReconcileRegister']
    rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
    names=[b.name for b in rig.pose.bones];transforms=[];gaps=[]
    for n in range(2401):
        f=1+n*.125;bpy.context.scene.frame_set(int(f),subframe=f%1);bpy.context.view_layer.update()
        transforms.append([np.array(rig.pose.bones[name].matrix)for name in names])
        gaps.append(max((rig.pose.bones[a+s].tail-rig.pose.bones[b+s].head).length for s in ('L','R')for a,b in [('upperarm_','forearm_'),('forearm_','hand_')]))
    return names,np.array(transforms),gaps
names,old,old_gaps=capture(parent);new_names,new,gaps=capture(candidate);assert names==new_names
def smooth(x):
    x=max(0,min(1,x));return x*x*(3-2*x)
def influence(t,side):
    if side=='L':t=min(t,10-t)
    x=smooth((t-.25)/.5)*(1-smooth((t-1.05)/.4))
    if side=='R':x+=smooth((t-8.75)/.35)*(1-smooth((t-9.45)/.35))
    return x
unaffected=[i for i,n in enumerate(names)if not n.startswith(('upperarm_','forearm_','hand_','finger_'))]
rows=[]
for side,sign in [('L',-1),('R',1)]:
    members=[i for i,n in enumerate(names)if n=='hand_'+side or n.startswith('finger_'+side+'_')]
    max_position=max_rotation=max_contact=0;unchanged=0
    for n in range(2401):
        t=n/240;amount=influence(t,side);clock=min(t,10-t)if side=='L'else t
        horizontal=smooth((clock-.75)/.25)*(1-smooth((clock-1.05)/.4))
        if side=='R':horizontal+=smooth((t-8.75)/.35)*(1-smooth((t-9.45)/.10))
        shift=np.array([-.06*sign*horizontal,-.12*horizontal,.02*amount])
        for i in members:
            error=float(np.linalg.norm(new[n,i,:3,3]-old[n,i,:3,3]-shift));max_position=max(max_position,error)
            angle=Matrix(old[n,i].tolist()).to_quaternion().rotation_difference(Matrix(new[n,i].tolist()).to_quaternion()).angle
            angle=min(angle,abs(2*np.pi-angle));max_rotation=max(max_rotation,angle)
            if amount==0:max_contact=max(max_contact,error)
        if amount==0:unchanged+=1
    rows.append({'side':side,'maximumHandAndFingerTargetErrorMeters':max_position,'maximumRotationErrorRadians':max_rotation,
        'maximumUnchangedContactPositionErrorMeters':max_contact,'unchangedSamples':unchanged})
unaffected_error=float(np.max(np.abs(new[:,unaffected]-old[:,unaffected])))
added_gap=max(max(0,a-b)for a,b in zip(gaps,old_gaps))
transition_gap=max(g for n,g in enumerate(gaps)if any(influence(n/240,s)>0 for s in ('L','R')))
passed=unaffected_error<1e-6 and added_gap<.001 and transition_gap<.001 and all(r['maximumHandAndFingerTargetErrorMeters']<.001 and r['maximumRotationErrorRadians']<.003 and r['maximumUnchangedContactPositionErrorMeters']<.001 for r in rows)
report={'complete':True,'passed':passed,'sourceSha256':sha(candidate),'parentSourceSha256':sha(parent),'samples':2401,'rateHz':240,
    'unchangedOtherBoneMatrixError':unaffected_error,'maximumJointGapMeters':max(gaps),'parentMaximumJointGapMeters':max(old_gaps),'maximumAddedJointGapMeters':added_gap,'maximumChangedTransitionJointGapMeters':transition_gap,'rows':rows,
    'inspectorSha256':sha(Path(__file__)),'humanApproved':False,
    'scope':'Actual saved Blender pose evaluation at 240 Hz. Each hand/finger world transform is checked against the original plus the declared transition-only translation. Other bones remain unchanged. New transition chain closure and additional gap are bounded to 1 mm; pre-existing unchanged source interpolation gaps are reported separately. Does not prove full cloth, all hand-surface or runtime contact.'}
(P/'motion-retention-review.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');(P/'motion-retention-inspector.py').write_bytes(Path(__file__).read_bytes())
print(json.dumps(report),flush=True)
