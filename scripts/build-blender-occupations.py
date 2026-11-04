"""Author original occupational gestures against real supported workplace props.

Background Blender only. New candidate sources; retained art is never overwritten.
"""
from pathlib import Path
import argparse
import importlib.util
import json
import math
import sys
import bpy
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'docs/3d-town/classic-occupations-v1'


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


w = module('retained_work_methods', ROOT / 'scripts/build-blender-restorer-work.py')
u, hands, inv = w.u, w.hands, w.inv
sha, read, write = w.sha, w.read, w.write
ROOM = ROOT / 'docs/3d-town/classic-bookshop-v2/classic-bookshop.blend'
FPS = 30
DURATION = 10
CONFIG = {
    'resident-06': {'id': 'rb-gu-yuanshan', 'position': [-9.25, 5.52, .18], 'clip': 'VerifyTimetable',
                    'page': [0, -.48, 1.18], 'paperSize': [.32, .28], 'angle': -.30, 'room': 'station'},
    'resident-08': {'id': 'rb-lin-ali', 'position': [5.05, 1.10, .18], 'clip': 'ReconcileRegister',
                    'page': [0, -.40, 1.097], 'paperSize': [.48, .31], 'angle': 0, 'room': 'inn'},
}


def parent_local(obj, parent):
    obj.parent = parent
    obj.matrix_parent_inverse = Matrix.Identity(4)
    return obj


def props(config, rig, actor_root):
    for mat in bpy.data.materials:
        u.MATS[mat.name] = mat
    u.material('occupation_paper', 'c9bda2', .90)
    u.material('occupation_ink', '485a52', .93)
    u.material('occupation_red_rule', '88685d', .91)
    u.material('occupation_brass', '997b4d', .45, .68)
    u.material('occupation_leather', '33463d', .73)
    u.material('occupation_pen', '282d2c', .28)
    u.LAY = 'occupation_workplace'
    u.PART = 'authored_workplace'
    root = bpy.data.objects.new('occupation_workplace', None)
    bpy.context.collection.objects.link(root)
    parent_local(root, actor_root)
    root.matrix_basis = rig.matrix_basis.copy()
    made = []

    def box(name, pos, size, mat, edge=.002, parent=root):
        obj = parent_local(u.box(name, pos, size, mat, edge), parent)
        made.append(obj)
        return obj

    def cylinder(name, pos, radius, height, mat, sides=20, parent=root):
        obj = parent_local(u.cylinder(name, pos, radius, height, mat, sides), parent)
        made.append(obj)
        return obj

    page_root = bpy.data.objects.new('occupation_document_anchor', None)
    bpy.context.collection.objects.link(page_root)
    parent_local(page_root, root)
    page_root.location = config['page']
    page_root.rotation_euler.x = config['angle']
    sx, sy = config['paperSize']
    if config['room'] == 'station':
        # Feet overlap the actual rear countertop by 1 mm. The bracket reaches
        # back toward the clerk; no freestanding stand obstructs the passage.
        counter = (1.214 - .18) / rig.matrix_basis[2][2]
        for x in (-.14, .14):
            box('timetable_bracket_foot', (x, -.642, counter + .004), (.055, .11, .010), 'occupation_brass')
            bottom, top = counter + .008, 1.176
            box('timetable_bracket_upright', (x, -.594, (bottom+top)/2), (.018, .018, top-bottom), 'occupation_brass')
            box('timetable_bracket_arm', (x, 0, -.031), (.020, .264, .021), 'occupation_brass', .001, page_root)
        box('timetable_reading_board', (0, 0, -.012), (sx + .038, sy + .028, .019), 'aged_walnut', .004, page_root)
        for x in (-sx/2-.013, sx/2+.013):
            box('timetable_side_bead', (x, 0, 0), (.012, sy + .026, .012), 'occupation_brass', .002, page_root)
        box('timetable_retaining_lip', (0, sy/2 + .010, .009), (sx + .026, .018, .030), 'occupation_brass', .002, page_root)
    else:
        box('registration_desk_top', (0, -.40, 1.045), (.78, .52, .055), 'polished_walnut', .008)
        for x in (-.335, .335):
            for y in (-.60, -.20):
                cylinder('registration_turned_leg', (x, y, .51), .026, 1.02, 'aged_walnut')
                cylinder('registration_leg_collar', (x, y, .81), .037, .046, 'polished_walnut')
        box('registration_apron_front', (0, -.635, .942), (.71, .035, .155), 'aged_walnut', .005)
        box('registration_drawer_face', (0, -.173, .958), (.52, .033, .125), 'aged_walnut', .005)
        for x in (-.13, .13):
            obj = parent_local(u.sphere('registration_drawer_handle', (x, -.15, .965), (.018, .009, .018), 'occupation_brass', 16), root)
            made.append(obj)
        box('register_bound_cover', (0, 0, -.0125), (sx+.025, sy+.017, .025), 'occupation_leather', .003, page_root)
        box('register_left_pages', (-sx/4-.003, 0, -.002), (sx/2-.005, sy, .013), 'occupation_paper', .002, page_root)
        box('register_right_pages', (sx/4+.003, 0, -.002), (sx/2-.005, sy, .013), 'occupation_paper', .002, page_root)
        box('register_gutter', (0, 0, .001), (.010, sy, .007), 'occupation_leather', .001, page_root)
        cylinder('register_inkwell_foot', (.325, -.535, 1.083), .037, .017, 'occupation_brass')
        cylinder('register_inkwell', (.325, -.535, 1.111), .030, .044, 'glass_dark')
    if config['room'] == 'station':
        box('timetable_sheet', (0, 0, .001), (sx, sy, .003), 'occupation_paper', .001, page_root)
    paper_top = .0045 if config['room'] == 'inn' else .0025
    for i in range(8):
        yy = -.105 + i * .027
        box('document_row_rule', (0, yy, paper_top+.0005), (sx-.034, .0011, .0006), 'occupation_ink', 0, page_root)
        for j in range(3 if config['room'] == 'station' else 4):
            xx = -sx/2 + .038 + j * (sx-.07)/4
            box('document_entry', (xx, yy+.010, paper_top+.0007), (.022 + (i+j)%3*.004, .0017, .0007), 'occupation_ink', 0, page_root)
    for xx in ([-.093, .025, .101] if config['room'] == 'station' else [-.171, -.063, .093, .181]):
        box('document_column_rule', (xx, 0, paper_top+.0005), (.0013, sy-.028, .0006), 'occupation_red_rule', 0, page_root)
    if config['room'] == 'station':
        box('timetable_clip', (0, -.135, .009), (.080, .026, .012), 'occupation_brass', .003, page_root)
    # An independent movable pen anchor is present only for the register.
    pen = None
    if config['room'] == 'inn':
        pen = bpy.data.objects.new('occupation_pen_anchor', None)
        bpy.context.collection.objects.link(pen)
        parent_local(pen, root)
        pen.rotation_mode = 'QUATERNION'
        cylinder('fountain_pen_barrel', (0, 0, .089), .0042, .114, 'occupation_pen', 16, pen)
        cylinder('fountain_pen_band', (0, 0, .043), .0046, .005, 'occupation_brass', 16, pen)
        tip = parent_local(u.cylinder('fountain_pen_nib', (0, 0, .019), .0003, .035, 'occupation_brass', 16, top=.004), pen)
        made.append(tip)
    return root, page_root, pen, made


def aim_arm(rig, initial, side, wrist, rotation, amount, pole=None):
    shoulder = rig.pose.bones['upperarm_' + side].head.copy()
    upper = rig.data.bones['upperarm_' + side].length
    lower = rig.data.bones['forearm_' + side].length
    sign = -1 if side == 'L' else 1
    joint = w.elbow(shoulder, wrist, upper, lower, pole or Vector((sign, .03, -.07)))
    inv.worldbone('upperarm_' + side, shoulder, joint)
    inv.worldbone('forearm_' + side, joint, wrist)
    natural = rig.pose.bones['forearm_' + side].matrix.to_3x3() @ initial['forearm_' + side].to_3x3().inverted() @ initial['hand_' + side].to_3x3()
    target = natural.to_quaternion().slerp(rotation, amount).to_matrix().to_4x4()
    target.translation = wrist
    rig.pose.bones['hand_' + side].matrix = target


def point_fingers(rig, basis, side, amount, pen=False):
    sign = -1 if side == 'L' else 1
    for finger in range(1, 6):
        for segment in range(1, 4):
            name = f'finger_{side}_{finger}_{segment}'
            rest = rig.data.bones[name]
            toward = Vector((sign * .22 if finger == 1 else 0, 1, 0))
            axis = (rest.tail_local - rest.head_local).cross(toward).normalized()
            axis = rest.matrix_local.to_3x3().inverted() @ axis
            extra = 0 if side == 'L' or finger == 1 else (-.07 if finger == 2 and not pen else (.32, .40, .19)[segment-1])
            rig.pose.bones[name].rotation_quaternion = basis[name].to_quaternion() @ Quaternion(axis, extra * amount)


def correct_uniform_weights(body):
    """Separate the lower sleeve components from the torso by actual topology.

    The retained position-only weights mistook wide jacket skirts for hands.
    No vertices, UVs, textures, bones or retained action curves are changed.
    """
    if 'UniformPart' not in body.data.attributes:
        return {'changed': [], 'components': []}
    labels = body.data.attributes['UniformPart'].data
    import numpy as np
    # UniformPart 3 is the jacket in the retained MRT garment; 1 is trousers.
    ids = [v.index for v in body.data.vertices if labels[v.index].value == 3]
    lookup = {v: i for i, v in enumerate(ids)}
    edges = [(lookup[a], lookup[b]) for edge in body.data.edges for a,b in [tuple(edge.vertices)] if a in lookup and b in lookup]
    adjacency = {i: [] for i in range(len(ids))}
    for a,b in edges:
        adjacency[a].append(b); adjacency[b].append(a)
    points = np.array([tuple(body.data.vertices[i].co) for i in ids])
    components, chosen = [], None
    for cut in (1.25, 1.20, 1.15, 1.10, 1.05):
        pending = set(np.where(points[:,2] < cut)[0].tolist()); candidate=[]
        while pending:
            seed=pending.pop(); found=[seed]; stack=[seed]
            while stack:
                for other in adjacency[stack.pop()]:
                    if other in pending:
                        pending.remove(other); found.append(other); stack.append(other)
            candidate.append(found)
        significant=[c for c in candidate if len(c)>70]
        if len(significant)>=3 and any(np.mean(points[c,0]) < -.23 for c in significant) and any(np.mean(points[c,0]) > .23 for c in significant):
            components=candidate; chosen=cut; break
    assert chosen is not None, [(len(c),float(np.mean(points[c,0]))) for c in candidate]
    # Cuff and torso components are boundary conditions for a harmonic shoulder
    # transition. Averaging over actual mesh edges avoids spatial mislabeling of
    # broad hips as wrists while retaining a continuous shoulder seam.
    weights=np.zeros((len(ids),3)); fixed=np.zeros(len(ids),dtype=bool)
    for i,p in enumerate(points):
        arm=hands.smooth((abs(p[0])-.165)/.07)
        weights[i,0]=1-arm; weights[i,1 if p[0]<0 else 2]=arm
        # Only the neckline and true shoulder cap are fixed. The old hard
        # horizontal seam at 1.44 m concentrated the shoulder deformation.
        if p[2]>=1.49: fixed[i]=True
    summary=[]
    for component in components:
        mean_x=float(np.mean(points[component,0])); label=1 if mean_x<-.23 else 2 if mean_x>.23 else 0
        weights[component,:]=0; weights[component,label]=1; fixed[component]=True
        summary.append({'count':len(component),'meanX':mean_x,'part':['torso','sleeve_L','sleeve_R'][label]})
    a=np.array([e[0] for e in edges]); b=np.array([e[1] for e in edges])
    degree=np.bincount(np.concatenate([a,b]),minlength=len(ids))[:,None]
    movable=(~fixed)&(degree[:,0]>0)
    residual=0
    for iteration in range(800):
        averaged=np.zeros_like(weights); np.add.at(averaged,a,weights[b]); np.add.at(averaged,b,weights[a])
        averaged/=np.maximum(degree,1)
        residual=float(np.max(np.abs(averaged[movable]-weights[movable])))
        weights[movable]=averaged[movable]
        if residual<1e-6:break
    changed=[]
    for local,i in enumerate(ids):
        vertex=body.data.vertices[i]; old={body.vertex_groups[g.group].name:g.weight for g in vertex.groups}; values={}
        for index,kind in enumerate(('torso','L','R')):
            goal=inv.coat_weight(vertex.co) if kind=='torso' else inv.arm_weight(kind)(vertex.co)
            if kind!='torso':
                wrist=goal.pop('hand_'+kind,0)
                goal['forearm_'+kind]=goal.get('forearm_'+kind,0)+wrist
            for name,value in goal.items():values[name]=values.get(name,0)+value*float(weights[local,index])
        values=dict(sorted(((k,v) for k,v in values.items() if v>1e-6),key=lambda item:-item[1])[:4]);total=sum(values.values())
        for group in list(vertex.groups):body.vertex_groups[group.group].remove([i])
        for name,amount in values.items():body.vertex_groups[name].add([i],amount/total,'REPLACE')
        if any(abs(old.get(k,0)-values.get(k,0)/total)>1e-6 for k in set(old)|set(values)):changed.append(i)
    return {'changed':changed,'components':summary,'seedCutHeight':chosen,'harmonicIterations':iteration+1,'residual':residual}


def correct_station_actions(rig):
    """A small shoulder abduction keeps relaxed fingers outside the coat skirt."""
    for clip,count in [('Idle',90),('Walk',24)]:
        bpy.data.actions[clip].use_fake_user=True
        hands.bind_action(rig,bpy.data.actions[clip]);poses=[]
        for frame in range(1,count+2):
            bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
            poses.append({b.name:b.matrix_basis.copy() for b in rig.pose.bones})
        for frame,pose in enumerate(poses,1):
            bpy.context.scene.frame_set(frame)
            for name,matrix in pose.items():rig.pose.bones[name].matrix_basis=matrix
            bpy.context.view_layer.update()
            for side,sign in [('L',-1),('R',1)]:
                bone=rig.pose.bones['upperarm_'+side];matrix=bone.matrix.copy()
                changed=(Quaternion((0,1,0),-sign*.11).to_matrix()@matrix.to_3x3()).to_4x4()
                changed.translation=matrix.translation;bone.matrix=changed
            bpy.context.view_layer.update()
            for bone in rig.pose.bones:w.keyed(bone,frame)
    return {'clips':['Idle','Walk'],'upperArmAbductionRadians':.11,'reason':'relaxed thumb clearance from retained jacket skirt'}



def create_action(body, rig, page, pen, config):
    hands.bind_action(rig, bpy.data.actions['Idle'])
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    basis = {b.name: b.matrix_basis.copy() for b in rig.pose.bones}
    initial = {b.name: b.matrix.copy() for b in rig.pose.bones}
    inv.RIG = rig
    inv.BONES = {b.name: (b.head_local.copy(), b.tail_local.copy()) for b in rig.data.bones}
    action = bpy.data.actions.new(config['clip'])
    action.use_fake_user = True
    hands.bind_action(rig, action)
    prop_action = None
    if pen:
        prop_action = bpy.data.actions.new('WriteRegister_Prop')
        prop_action.use_fake_user = True
        pen.animation_data_create()
        pen.animation_data.action = prop_action
    page_rotation = Quaternion((1, 0, 0), config['angle'])
    page_center = Vector(config['page'])
    normal = page_rotation @ Vector((0, 0, 1))
    corrections = {'L': 0.0, 'R': 0.0}

    def pose_at(t):
        reach = hands.smooth((t-.25)/1.45) * (1-hands.smooth((t-8.0)/1.5))
        trace = max(0, min(1, (t-2)/4.6))
        for name, matrix in basis.items():
            rig.pose.bones[name].matrix_basis = matrix
        rig.pose.bones['chest'].rotation_quaternion = basis['chest'].to_quaternion() @ Quaternion((1, 0, 0), .10 * reach)
        rig.pose.bones['head'].rotation_quaternion = basis['head'].to_quaternion() @ Quaternion((1, 0, 0), .27 * reach)
        bpy.context.view_layer.update()
        target_positions = {}
        for side in ('L', 'R'):
            # Point along the timetable; the second hand stabilizes its frame.
            lateral = -.135 if side == 'L' else -.048 + .155 * trace
            depth = .135 if side == 'L' else .142 - .023 * (hands.smooth((trace-.30)/.10) + hands.smooth((trace-.63)/.10))
            target = page_center + page_rotation @ Vector((lateral, depth, .037))
            target += normal * corrections[side]
            if pen and side == 'R':
                target = page_center + Vector((.085 + .034*math.sin(t*4), .115, .098))
            start = initial['hand_' + side].translation
            sign=-1 if side=='L' else 1
            clear=start+Vector((sign*.025,-.075,.035))
            raised=Vector((sign*.32,-.15,1.37))
            hover=target+normal*.115+Vector((sign*.035,.010,0))
            if reach < .18:
                wrist = start.lerp(clear, hands.smooth(reach/.18))
            elif reach < .50:
                wrist=clear.lerp(raised,hands.smooth((reach-.18)/.32))
            elif reach < .76:
                wrist=raised.lerp(hover,hands.smooth((reach-.50)/.26))
            else:
                wrist = hover.lerp(target, hands.smooth((reach-.76)/.24))
            amount = hands.smooth((reach-.42)/.24)
            pitch = -1.20 if pen and side == 'R' else -math.pi/2 + config['angle']
            rotation = (Quaternion((1, 0, 0), pitch).to_matrix() @ rig.data.bones['hand_' + side].matrix_local.to_3x3()).to_quaternion()
            if side == 'R' and not pen:
                rotation = page_rotation @ Quaternion((0, 1, 0), -.50) @ Quaternion((1, 0, 0), -math.pi/2) @ rig.data.bones['hand_R'].matrix_local.to_quaternion()
            aim_arm(rig, initial, side, wrist, rotation, amount, Vector((sign*.55,.05,-.85)) if not pen else None)
            point_fingers(rig, basis, side, amount, pen is not None and side == 'R')
            target_positions[side] = list(wrist)
        bpy.context.view_layer.update()
        return reach, trace, target_positions

    # Calibrate against evaluated fingertip surfaces, not just bone endpoints.
    pose_at(3.0)
    evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    transform = page.matrix_world.inverted() @ body.matrix_world
    labels = body.data.attributes['AnatomicalFinger'].data
    for side, sign in [('L', -1), ('R', 1)]:
        if pen and side == 'R':
            continue
        points = [transform @ v.co for v in mesh.vertices if labels[v.index].value*sign > 0]
        corrections[side] = .0045 - min(p.z for p in points)
    evaluated.to_mesh_clear()
    rows = []
    for frame in range(1, DURATION * FPS + 2):
        t = (frame - 1) / FPS
        bpy.context.scene.frame_set(frame)
        reach, trace, target_positions = pose_at(t)
        if pen:
            # Pilot grip follows the authored right hand; contact is measured
            # before this candidate can be exported or connected to runtime.
            hand = rig.pose.bones['hand_R'].matrix
            pen.location = hand.translation + hand.to_3x3() @ Vector((-.022, .070, -.015))
            pen.rotation_quaternion = Quaternion((1, 0, 0), -.38)
            for key in ('location', 'rotation_quaternion', 'scale'):
                pen.keyframe_insert(data_path=key, frame=frame)
        for bone in rig.pose.bones:
            w.keyed(bone, frame)
        rows.append({'frame': frame, 'time': t, 'reach': reach, 'trace': trace, 'wristTargets': target_positions, 'surfaceCorrectionsMeters': corrections.copy()})
    return rows


def measure(body, rig, page, config, rows):
    hands.bind_action(rig, bpy.data.actions[config['clip']])
    labels = body.data.attributes['AnatomicalFinger'].data
    body.data.calc_loop_triangles()
    sides = {s: [tuple(t.vertices) for t in body.data.loop_triangles if all(labels[i].value*s > 0 for i in t.vertices)] for s in (-1, 1)}
    result = []
    inverse = page.matrix_world.inverted()
    for row in rows[::10]:
        bpy.context.scene.frame_set(row['frame'])
        bpy.context.view_layer.update()
        evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = evaluated.to_mesh()
        points = [inverse @ body.matrix_world @ v.co for v in mesh.vertices]
        hand = {}
        for sign, side in [(-1, 'L'), (1, 'R')]:
            used = {i for f in sides[sign] for i in f}
            over = [points[i] for i in used if abs(points[i].x)<config['paperSize'][0]/2 and abs(points[i].y)<config['paperSize'][1]/2]
            index = [points[i] for i in used if labels[i].value == sign*2]
            hand[side] = {'minOverDocumentZ': min((v.z for v in over), default=None), 'indexBounds': [[min(v[a] for v in index), max(v[a] for v in index)] for a in range(3)]}
        evaluated.to_mesh_clear()
        result.append({**row, 'hands': hand})
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--actor', choices=list(CONFIG), default='resident-06')
    parser.add_argument('--pilot', default='gesture-01')
    parser.add_argument('--width', type=int, default=1100)
    parser.add_argument('--samples', type=int, default=32)
    parser.add_argument('--no-render', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    config = CONFIG[args.actor]
    source = ROOT / f'docs/3d-town/classic-residents-v8/{args.actor}/{config["id"]}.blend'
    manifest = read(ROOT / f'public/assets/classic-residents/v8/{args.actor}.json')
    assert sha(source) == manifest['sourceSha256']
    folder = PACKAGE / args.actor / args.pilot
    folder.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(ROOM))
    bpy.context.preferences.filepaths.save_version = 0
    with bpy.data.libraries.load(str(source), link=False) as (src, dst):
        dst.objects = [config['id']+'_rig', config['id']+'_skin']
        dst.actions = [name for name in ('Idle','Walk') if name in src.actions]
    for obj in dst.objects:
        if not obj.users_collection:
            bpy.context.collection.objects.link(obj)
    rig = bpy.data.objects[config['id']+'_rig']
    body = bpy.data.objects[config['id']+'_skin']
    root = bpy.data.objects.new('occupation_actor', None)
    bpy.context.collection.objects.link(root)
    root.location = config['position']
    parent_local(rig, root)
    before = hands.mesh_identity(body)
    weight_review = correct_uniform_weights(body) if args.actor == 'resident-06' else {'changed': [], 'components': []}
    action_review = correct_station_actions(rig) if args.actor == 'resident-06' else None
    workplace, page, pen, objects = props(config, rig, root)
    rows = create_action(body, rig, page, pen, config)
    assert hands.mesh_identity(body) == before
    bpy.context.view_layer.update()
    measurements = measure(body, rig, page, config, rows)
    devices = u.configure(args.samples, args.width)
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start = 1
    scene.frame_end = DURATION * FPS + 1
    x, y, z = config['position']
    u.camera('occupation-production', (x-.24, y-2.25, z+2.12), (x, y-.22, z+1.18), 2.75)
    u.camera('occupation-hands', (x-.20, y-.72, z+2.04), (x, y-.42, z+1.15), .87)
    u.camera('occupation-side', (x+1.75, y-.45, z+1.44), (x, y-.18, z+1.15), 1.76)
    scene.camera = bpy.data.objects['occupation-production']
    scene.frame_set(121)
    for obj in scene.objects:
        if obj.get('layer') == 'actor':
            obj.hide_render = True
        if obj.get('layer') in ('station_ceiling', 'station_roof', 'inn_upper', 'ceiling', 'station_front', 'station_side_cutaway', 'shop_neighbor_cutaway', 'shop_neighbor_furniture', 'inn_front', 'inn_side_cutaway'):
            obj.visible_camera = False
    blend = folder / 'occupation.blend'
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    (folder / 'builder.py').write_bytes(Path(__file__).read_bytes())
    report = {'schema': 'classic-occupation-pilot.v1', 'actorId': args.actor, 'sourceSha256': sha(blend),
              'inputs': {source.relative_to(ROOT).as_posix(): sha(source), ROOM.relative_to(ROOT).as_posix(): sha(ROOM)},
              'builderSha256': sha(Path(__file__)), 'meshIdentityRetained': before, 'durationSeconds': DURATION,
              'config': config, 'frames': measurements, 'uniformWeightRepair': weight_review, 'retainedActionAdjustments':action_review,'humanArtApproved': False, 'runtimeExported': False,
              'contactApproved': False, 'devices': devices, 'renders': []}
    write(folder / 'authoring-review.json', report)
    if not args.no_render:
        for name, camera, frame in [('working', 'occupation-production', 121), ('hands', 'occupation-hands', 121), ('side', 'occupation-side', 121)]:
            scene.camera = bpy.data.objects[camera]
            scene.frame_set(frame)
            image = folder / f'{name}.png'
            scene.render.filepath = str(image)
            bpy.ops.render.render(write_still=True)
            report['renders'].append({'path': image.name, 'sha256': sha(image), 'camera': camera, 'frame': frame})
        write(folder / 'authoring-review.json', report)
    print(json.dumps({'actorId': args.actor, 'source': str(blend), 'renders': len(report['renders']), 'contactApproved': False}), flush=True)


if __name__ == '__main__':
    main()
