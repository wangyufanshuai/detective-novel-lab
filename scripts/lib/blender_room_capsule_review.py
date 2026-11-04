"""Conservative continuous-envelope checks against evaluated room triangles."""
import math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from .blender_room_spatial_review import evaluated_geometry


def review(geometry,routes):
    # The named horizontal walking substrate is an intentional support contact.
    obstacles=[o for o in geometry if not o.name.startswith(('floor_tile_','SHELL_floor','foyer_floor'))]
    tree=BVHTree.FromPolygons(*evaluated_geometry(obstacles))
    radius=.30; height=1.78; foot=.015; move_step=.08; axis_step=.14
    axis_start=radius+foot; axis_end=height-radius+foot
    count=math.ceil((axis_end-axis_start)/axis_step)
    heights=[axis_start+(axis_end-axis_start)*i/count for i in range(count+1)]
    # Distance is 1-Lipschitz. Inflation bounds all unsampled points in both
    # the vertical capsule axis and each horizontal motion interval.
    inflation=(axis_end-axis_start)/count/2+move_step/2
    clearance_radius=radius+inflation

    def sample(points):
        closest=float('inf'); location=None; checked=0
        for start,end in zip(points,points[1:]):
            steps=max(1,math.ceil(math.dist(start,end)/move_step))
            for step in range(steps+1):
                x,y=[start[i]+(end[i]-start[i])*step/steps for i in range(2)]
                for z in heights:
                    hit,normal,index,distance=tree.find_nearest(Vector((x,y,z)))
                    checked+=1
                    if distance<closest:closest=distance;location=[x,y,z]
        return {'samples':checked,'minimumAxisDistanceMeters':round(closest,6),
                'conservativeEnvelopeMarginMeters':round(closest-clearance_radius,6),
                'tightestAxisPoint':location,'clear':closest>=clearance_radius}
    valid=[{'route':r['route'],**sample(r['points'])} for r in routes]
    invalid=[{'probe':name,**sample(points)} for name,points in [
        ('through-table',[(0,-1),(0,.8)]),('through-south-wall',[(3,-4.3),(3,-3.2)]),
        ('through-window-sill',[(0,3),(0,4.4)])]]
    return {'schema':'game-room.capsule-envelope.v1','method':'evaluated triangle BVH nearest distance; conservative Lipschitz inflation over swept capsule axis',
            'capsule':{'radiusMeters':radius,'heightMeters':height,'footClearanceMeters':foot},
            'horizontalStepMeters':move_step,'axisSamples':len(heights),'inflationMeters':inflation,
            'intentionalSupportExclusions':['SHELL_floor*','floor_tile_*','foyer_floor*'],
            'routes':valid,'negativeControls':invalid,
            'passed':all(v['clear'] for v in valid) and all(not v['clear'] for v in invalid),
            'limitations':['Static evaluated geometry; not the player controller, animation envelope, stairs or dynamic-obstacle test.',
                           'Collision negatives must fail; sample centers start outside closed obstacles.'],
            'humanApproval':False}
