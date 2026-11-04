"""Background-only original resident authoring. Never overwrites the v1 town source."""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import math
import sys
import time

import bpy
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "docs/3d-town/riverbend-residents-v2"
SOURCE = PACKAGE / "riverbend-residents.blend"
BASE = ROOT / "docs/3d-town/riverbend-v1/riverbend-town.blend"
HELPER = ROOT / "scripts/build-blender-riverbend-town.py"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


spec = importlib.util.spec_from_file_location("riverbend_geometry", HELPER)
geo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(geo)


def empty(name, parent=None, location=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    return obj


def author_resident(record):
    actor_id = record["id"]
    root = empty("actor_" + actor_id, location=(*record["position"], .04))
    root["actorId"] = actor_id
    root["artRevision"] = "riverbend-residents.v2"
    root["origin"] = "project-local-original"
    root["roleSilhouette"] = record["prop"]
    root["motionScope"] = "local-observed-place-presentation"
    scale = record["height"] / 1.80
    width = record["build"]
    coat, accent = record["coat"], record["accent"]
    head_mat = "silver" if record["hair"] == "silver-bun" else "hair"
    roots = {"body": root}
    pivots = {"body": Vector((0, 0, 0))}
    for side, sign in (("left", -1), ("right", 1)):
        for part, pivot, parent_part in (
            ("leg_" + side, (sign * .115 * width, 0, .88), "body"),
            ("knee_" + side, (sign * .115 * width, 0, .48), "leg_" + side),
            ("arm_" + side, (sign * .235 * width, 0, 1.33), "body"),
        ):
            absolute = Vector((pivot[0] * scale, pivot[1] * scale, pivot[2] * scale))
            joint = empty(actor_id + "_" + part, roots[parent_part], absolute - pivots[parent_part])
            joint["joint"] = part
            roots[part], pivots[part] = joint, absolute
    roots["head"] = empty(actor_id + "_head", root, (0, 0, 1.49 * scale))
    pivots["head"] = Vector((0, 0, 1.49 * scale))
    roots["head"]["joint"] = "head"

    def attach(obj, joint="body"):
        # Helpers author in actor coordinates; retain those positions under the pivot.
        obj.location *= scale
        obj.scale *= scale
        obj.parent = roots[joint]
        obj.location -= pivots[joint]
        obj["actor_id"] = actor_id
        obj["resident_part"] = joint
        return obj

    def ball(name, pos, size, mat, joint="body"):
        return attach(geo.sphere(actor_id + "_" + name, pos, size, mat, actor_id), joint)

    def block(name, pos, size, mat, joint="body", rotation=None):
        return attach(geo.box(actor_id + "_" + name, pos, size, mat, actor_id, rotation), joint)

    def rod(name, a, b, radius, mat, joint="body"):
        return attach(geo.rod(actor_id + "_" + name, a, b, radius, mat, actor_id, 10), joint)

    def disc(name, pos, radius, height, mat, joint="body", top=None):
        return attach(geo.cylinder(actor_id + "_" + name, pos, radius, height, mat, actor_id, 20, top), joint)

    def cloth(name, rings, mat):
        # Elliptical tailored profile instead of a cylindrical coat.
        sides = 16
        vertices = [(math.cos(i * math.tau / sides) * x * width,
                     math.sin(i * math.tau / sides) * y, z)
                    for x, y, z in rings for i in range(sides)]
        faces = [tuple(reversed(range(sides))), tuple(range((len(rings) - 1) * sides, len(rings) * sides))]
        for ring in range(len(rings) - 1):
            for i in range(sides):
                faces.append((ring * sides + i, ring * sides + (i + 1) % sides,
                              (ring + 1) * sides + (i + 1) % sides, (ring + 1) * sides + i))
        return attach(geo.mesh(actor_id + "_" + name, vertices, faces, mat, actor_id, True))

    for side, sign in (("left", -1), ("right", 1)):
        x = sign * .115 * width
        rod("trouser_" + side, (x, 0, .48), (x, 0, .87), .086 * width, "trousers", "leg_" + side)
        ball("knee_shape_" + side, (x, 0, .48), (.077 * width, .084, .09), "trousers", "knee_" + side)
        rod("shin_" + side, (x, 0, .17), (x, 0, .48), .065 * width, "trousers", "knee_" + side)
        ball("shoe_" + side, (x, -.055, .09), (.091 * width, .159, .085), "iron", "knee_" + side)
        block("sole_" + side, (x, -.045, .035), (.168 * width, .27, .036), "wood", "knee_" + side)
        rod("sleeve_" + side, (sign * .235 * width, 0, 1.32), (sign * .295 * width, -.006, 1.07), .079, coat, "arm_" + side)
        rod("cuff_" + side, (sign * .295 * width, -.006, 1.07), (sign * .30 * width, -.036, .91), .061, coat, "arm_" + side)
        ball("hand_" + side, (sign * .30 * width, -.036, .865), (.057, .055, .071), "skin", "arm_" + side)
    long_coat = record["prop"] in ("camera", "teacher", "shawl")
    cloth("tailored_coat", [(.245, .155, .70 if long_coat else .87), (.205, .145, 1.05), (.223, .162, 1.28), (.20, .12, 1.39)], coat)
    ball("shoulder_fabric", (0, 0, 1.335), (.247 * width, .153, .105), coat)
    block("collar_left", (-.075, -.141, 1.35), (.094, .025, .15), accent, rotation=(0, -.22, -.15))
    block("collar_right", (.075, -.141, 1.35), (.094, .025, .15), accent, rotation=(0, .22, .15))
    for z in (1.09, 1.20, 1.29):
        ball("button_" + str(z), (0, -.165, z), (.014, .012, .014), "brass")
    disc("neck", (0, 0, 1.445), .061, .11, "skin")
    ball("face", (0, -.003, 1.615), (.127, .114, .151), "skin", "head")
    ball("hair_crown", (0, .025, 1.697), (.136, .117, .084), head_mat, "head")
    ball("fringe", (-.05, -.071, 1.714), (.086, .064, .05), head_mat, "head")
    for sign in (-1, 1):
        ball("ear_" + str(sign), (sign * .128, 0, 1.61), (.023, .036, .043), "skin", "head")
        ball("eye_" + str(sign), (sign * .046, -.109, 1.638), (.011, .009, .013), "iron", "head")
        rod("eyebrow_" + str(sign), (sign * .03, -.109, 1.664), (sign * .07, -.099, 1.662), .006, head_mat, "head")
    ball("nose", (0, -.118, 1.603), (.023, .027, .031), "skin", "head")
    rod("mouth", (-.023, -.109, 1.56), (.023, -.109, 1.56), .004, "rust", "head")
    hairstyle = record["hair"]
    if "bun" in hairstyle:
        ball("hair_bun", (0, .119, 1.696), (.09, .081, .081), head_mat, "head")
    if hairstyle in ("bob", "braid"):
        for sign in (-1, 1):
            ball("hair_side_" + str(sign), (sign * .112, .021, 1.627), (.052, .103, .117), head_mat, "head")
    if hairstyle == "braid":
        for i in range(5):
            ball("braid_" + str(i), (.025 * (-1) ** i, .13, 1.58 - i * .048), (.043, .043, .048), head_mat, "head")
    prop = record["prop"]
    if prop in ("mailbag", "police", "station"):
        disc("cap", (0, .006, 1.764), .147, .065, coat, "head", .135)
        block("cap_peak", (0, -.11, 1.746), (.24, .19, .021), "iron", "head")
        ball("cap_badge", (0, -.141, 1.777), (.022, .008, .022), "brass", "head")
    if prop in ("apron", "book-apron", "flower-bag"):
        apron_mat = "rust" if prop == "apron" else "cream" if prop == "book-apron" else "sage"
        block("apron_bib", (0, -.165, 1.21), (.245, .029, .29), apron_mat)
        block("apron_skirt", (0, -.169, .945), (.35, .032, .29), apron_mat)
        block("apron_pocket", (.03, -.192, 1.02), (.17, .024, .085), accent)
        for sign in (-1, 1):
            rod("apron_strap_" + str(sign), (sign * .10, -.162, 1.33), (sign * .12, .08, 1.385), .016, apron_mat)
    if prop == "vest":
        for sign in (-1, 1):
            block("waistcoat_" + str(sign), (sign * .107, -.16, 1.175), (.18, .032, .28), "cream")
        block("postal_card", (-.10, -.186, 1.225), (.087, .013, .058), "ivory")
    if prop in ("mailbag", "repair", "flower-bag"):
        bag_mat = "wood" if prop != "flower-bag" else "ochre"
        block("shoulder_bag", (.285, .0, .98), (.18, .27, .27), bag_mat)
        block("bag_flap", (.286, -.143, 1.04), (.19, .025, .13), accent)
        rod("bag_strap", (-.16, -.169, 1.37), (.28, -.164, 1.06), .019, bag_mat)
        if prop == "mailbag":
            block("envelope", (.29, -.16, 1.106), (.135, .014, .07), "cream")
        if prop == "flower-bag":
            for i in range(4):
                x, y = .26 + i * .027, .045 * (-1) ** i
                rod("flower_stem_" + str(i), (x, y, 1.05), (x, y, 1.33 + i % 2 * .07), .006, "sage")
                ball("flower_" + str(i), (x, y, 1.33 + i % 2 * .07), (.035, .035, .031), "rust" if i % 2 else "cream")
    if prop in ("police", "station"):
        block("uniform_belt", (0, -.152, 1.00), (.43 * width, .033, .044), "iron")
        ball("uniform_badge", (-.115, -.17, 1.285), (.032, .012, .038), "brass")
    if prop == "toolbelt":
        block("tool_belt", (0, -.172, 1.035), (.48, .037, .07), "wood")
        for sign in (-1, 1):
            block("tool_pocket_" + str(sign), (sign * .205, -.168, .93), (.10, .08, .15), "wood")
        rod("hammer_handle", (.225, -.177, .95), (.225, -.177, 1.16), .017, "ochre")
        block("hammer_head", (.225, -.177, 1.17), (.11, .044, .036), "iron")
    if prop == "camera":
        block("camera_body", (0, -.245, 1.16), (.18, .09, .115), "iron")
        lens = disc("camera_lens", (0, -.32, 1.16), .043, .061, "brass")
        lens.rotation_euler.x = math.pi / 2
        for sign in (-1, 1):
            rod("camera_strap_" + str(sign), (sign * .09, -.143, 1.395), (sign * .09, -.23, 1.2), .012, "wood")
    if prop in ("shawl", "teacher"):
        cloth("shawl", [(.27, .171, 1.19), (.287, .174, 1.32), (.12, .12, 1.42)], accent)
        block("shawl_tail", (-.12, -.19, 1.04), (.12, .028, .40), accent, rotation=(0, -.12, 0))
    if prop in ("book-apron", "teacher"):
        block("book_cover", (-.275, -.12, 1.10), (.06, .20, .27), "navy")
        block("book_pages", (-.28, -.12, 1.10), (.066, .17, .24), "cream")
    if prop in ("teacher", "repair"):
        for sign in (-1, 1):
            x = sign * .047
            # Four thin sides give readable original spectacle rims without textures.
            for z in (1.614, 1.654):
                rod("glasses_h_" + str(sign) + str(z), (x - .033, -.123, z), (x + .033, -.123, z), .004, "iron", "head")
            for xx in (x - .033, x + .033):
                rod("glasses_v_" + str(xx), (xx, -.123, 1.614), (xx, -.123, 1.654), .004, "iron", "head")
        rod("glasses_bridge", (-.014, -.124, 1.64), (.014, -.124, 1.64), .004, "iron", "head")
    return root


def configure_render(samples, width):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    devices = []
    try:
        prefs.compute_device_type = "OPTIX"
        prefs.get_devices()
        for device in prefs.devices:
            device.use = device.type == "OPTIX"
            if device.use:
                devices.append(device.name)
        scene.cycles.device = "GPU" if devices else "CPU"
    except Exception:
        scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = width, round(width * 9 / 16)
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    return devices


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--render-existing", action="store_true")
    parser.add_argument("--views", default="all")
    parser.add_argument("--samples", type=int, default=40)
    parser.add_argument("--width", type=int, default=1440)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    brief_path = PACKAGE / "brief.json"
    brief = json.loads(brief_path.read_text(encoding="utf-8"))
    assert sha(BASE) == brief["baseSourceSha256"], "Base source changed"
    inputs = [{"path":str(p.relative_to(ROOT)).replace("\\", "/"), "sha256":sha(p)} for p in (Path(__file__), HELPER, brief_path)]
    if args.render_existing:
        old = json.loads((PACKAGE / "authoring-receipt.json").read_text(encoding="utf-8"))
        assert old["inputs"] == inputs and old["source"]["sha256"] == sha(SOURCE), "Source inputs changed"
        bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    else:
        bpy.ops.wm.open_mainfile(filepath=str(BASE))
        for obj in list(bpy.data.objects):
            if str(obj.get("actor_id", "")).startswith("resident-"):
                bpy.data.objects.remove(obj, do_unlink=True)
        geo.MATS.update({m.name:m for m in bpy.data.materials})
        geo.material("silver", "B8B3A4", .8)
        for record in brief["residents"]:
            author_resident(record)
        stage = geo.box("cast_review_stage", (0, -45, -.13), (24, 10, .26), "stone", "review-only")
        stage["reviewOnly"] = True
        stage.hide_render = True
        for name, data in {
            "cast-front":{"position":[3, -57, 7.5], "target":[0, -45, .95], "ortho":16.4},
            "cast-back":{"position":[-3, -34, 6], "target":[0, -45, .9], "ortho":16.4},
            "cast-walk":{"position":[3, -54, 5], "target":[0, -45, .9], "ortho":16.4},
            "cafe-residents":{"position":[-5, -4, 5.5], "target":[-10, 3.0, 1.2], "ortho":10.5},
        }.items():
            geo.camera(name, data)
        bpy.context.scene["candidate_scope"] = "Resident art companion; private simulation and case facts are not encoded in this source"
        configure_render(args.samples, args.width)
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
        write(PACKAGE / "authoring-receipt.json", {"schema":"riverbend-resident-authoring.v2", "inputs":inputs,
              "source":{"path":SOURCE.name,"sha256":sha(SOURCE),"bytes":SOURCE.stat().st_size},
              "baseSourceSha256":sha(BASE),"blenderVersion":bpy.app.version_string,"actors":12,
              "jointsPerActor":7,"sourceGeometry":"original mesh + rigid joint hierarchy","humanArtAccepted":False})
    devices = configure_render(args.samples, args.width)
    views = brief["requiredViews"] if args.views == "all" else args.views.split(",")
    receipt_path = PACKAGE / "render-receipt.json"
    renders = []
    if receipt_path.exists():
        previous = json.loads(receipt_path.read_text(encoding="utf-8"))
        if previous["sourceSha256"] == sha(SOURCE) and previous["inputs"] == inputs:
            renders = [r for r in previous["renders"] if r["view"] not in views]
    (PACKAGE / "renders").mkdir(exist_ok=True)
    roots = [bpy.data.objects["actor_" + r["id"]] for r in brief["residents"]]
    saved = [root.matrix_basis.copy() for root in roots]
    for view in views:
        assert view in brief["requiredViews"]
        stage = bpy.data.objects["cast_review_stage"]
        stage.hide_render = not view.startswith("cast-")
        for index, root in enumerate(roots):
            root.matrix_basis = saved[index]
            if view.startswith("cast-"):
                root.location = ((index - 5.5) * 1.08, -45, .04)
                root.rotation_euler.z = -.13 if view == "cast-walk" else 0
            for joint in [o for o in root.children_recursive if "joint" in o]:
                joint.rotation_euler = (0, 0, 0)
                if view == "cast-walk":
                    name = joint["joint"]
                    sign = -1 if name.endswith("left") else 1
                    if name.startswith("leg_"): joint.rotation_euler.x = sign * .32
                    if name.startswith("arm_"): joint.rotation_euler.x = -sign * .25
                    if name == "knee_left": joint.rotation_euler.x = -.42
        scene = bpy.context.scene
        scene.camera = bpy.data.objects[view]
        output = PACKAGE / "renders" / (view + ".png")
        scene.render.filepath = str(output)
        started = time.perf_counter()
        bpy.ops.render.render(write_still=True)
        entry = {"view":view,"path":"renders/"+output.name,"sha256":sha(output),
                 "size":[scene.render.resolution_x,scene.render.resolution_y],"seconds":round(time.perf_counter()-started,2),
                 "staging":"cast isolated on review platform" if view.startswith("cast-") else "authored town composition"}
        renders.append(entry)
        write(receipt_path,{"schema":"riverbend-resident-renders.v2","sourceSha256":sha(SOURCE),"inputs":inputs,
              "engine":"Cycles","device":scene.cycles.device,"devices":devices,"samples":args.samples,
              "renders":renders,"requiredViews":brief["requiredViews"],
              "complete":set(brief["requiredViews"]) <= {r["view"] for r in renders}})
        print("RESIDENT_RENDER=" + json.dumps(entry), flush=True)
    print("RESIDENT_SOURCE=" + str(SOURCE), flush=True)


if __name__ == "__main__":
    main()
