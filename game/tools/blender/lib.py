# Shared helpers for building CORVID GLBs in Blender (run via exec in the Blender MCP).
# Conventions: Blender Z-up, model front faces -Y (exports to glTF +Z), origin at feet centre, 1 unit = 1 tile.
import bpy, math, os

OUT = r"C:\C-general-folder\Coding\biocrafted_game_jam_2\BioCraftEd-Game-Jam-2\game\assets\models"
PAL = dict(rust=(0x8a, 0x4b, 0x32), rustd=(0x4a, 0x2a, 0x20), moss=(0x5d, 0x7a, 0x3a), teal=(0x2f, 0x4c, 0x52),
           concrete=(0x6b, 0x6e, 0x68), lamp=(0xff, 0xb3, 0x5a), cyan=(0x3f, 0xf0, 0xff), gold=(0xff, 0xcc, 0x44),
           black=(0x16, 0x14, 0x16), steel=(0x55, 0x5c, 0x60), wood=(0x6e, 0x4a, 0x2c), red=(0xff, 0x40, 0x30),
           bark=(0x4b, 0x36, 0x24), leaf=(0x4e, 0x6e, 0x30), beak=(0x2a, 0x26, 0x22), hazard=(0xd8, 0xa0, 0x20))


def srgb(c):
    def f(v):
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), 1.0)


def reset():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.actions, bpy.data.materials):
        for d in list(coll):
            if d.users == 0:
                coll.remove(d)


def mat(name, col, emit=0.0, rough=0.85, metal=0.0):
    """Material named `name`; emit>0 -> emissive (name should end in _emit)."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    c = srgb(PAL[col] if isinstance(col, str) else col)
    b.inputs["Base Color"].default_value = c
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = c
        b.inputs["Emission Strength"].default_value = emit
    return m


def _finish(o, m, parent, bevel):
    if m:
        o.data.materials.append(m)
    if parent:
        o.parent = parent
    if bevel:
        mod = o.modifiers.new("bev", "BEVEL")
        mod.width = bevel
        mod.segments = 1
        mod.limit_method = "ANGLE"
    for p in o.data.polygons:
        p.use_smooth = False
    return o


def box(name, size, loc=(0, 0, 0), m=None, parent=None, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(o, m, parent, bevel)


def cyl(name, r, h, loc=(0, 0, 0), m=None, parent=None, rot=(0, 0, 0), verts=8, bevel=0.0, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=h, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    return _finish(o, m, parent, bevel)


def sphere(name, r, loc=(0, 0, 0), m=None, parent=None, scale=(1, 1, 1), sub=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(o, m, parent, 0)


def empty(name, loc=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.empty_display_size = 0.08
    if parent:
        o.parent = parent
    return o


def pivot(name, loc, parent=None):
    """Empty used as an animation pivot (children move with it)."""
    return empty(name, loc, parent)


def anim(name, frames, objs_keys, fps=24):
    """Create NLA track `name` on every object.
    objs_keys: list of (obj, prop, [(frame, value), ...]) where prop is 'location'/'rotation_euler'/'scale'
    and value is a 3-tuple. All tracks with the same name export as ONE glTF animation."""
    bpy.context.scene.render.fps = fps
    by_obj = {}
    for o, prop, keys in objs_keys:
        by_obj.setdefault(o, []).append((prop, keys))
    for o, lst in by_obj.items():
        o.animation_data_create()
        rest = {p: tuple(getattr(o, p)) for p, _ in lst}
        for prop, keys in lst:
            for f, v in keys:
                setattr(o, prop, v)
                o.keyframe_insert(prop, frame=f)
        act = o.animation_data.action
        act.name = f"{name}_{o.name}"
        tr = o.animation_data.nla_tracks.new()
        tr.name = name
        st = tr.strips.new(name, int(frames[0]), act)
        st.name = name
        o.animation_data.action = None
        for p, v in rest.items():
            setattr(o, p, v)


def join(objs, name=None):
    """Merge meshes into objs[0] (keeps its parent/transform)."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        for m in o.modifiers:
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=m.name)
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    if name:
        o.name = name
    return o


def gear(name, r, teeth, thick, m, parent=None, loc=(0, 0, 0), rot=(math.pi / 2, 0, 0), hole=0.0):
    """Gear lying in the plane perpendicular to its local Z (default rot stands it in the XZ plane)."""
    parts = [cyl(name, r, thick, (0, 0, 0), m, verts=max(12, teeth * 2))]
    for i in range(teeth):
        a = 2 * math.pi * i / teeth
        parts.append(box(f"{name}_t{i}", (r * 0.32, r * 0.28, thick), (math.cos(a) * r, math.sin(a) * r, 0), m, rot=(0, 0, a)))
    if hole:
        parts.append(cyl(f"{name}_hub", hole, thick * 1.6, (0, 0, 0), m, verts=8))
    g = join(parts, name)
    g.location = loc
    g.rotation_euler = rot
    if parent:
        g.parent = parent
    return g


def export(name):
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    path = os.path.join(OUT, name + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=False, export_yup=True,
                              export_apply=True, export_animations=True, export_animation_mode="NLA_TRACKS",
                              export_force_sampling=True, export_materials="EXPORT")
    tris = 0
    dg = bpy.context.evaluated_depsgraph_get()
    for o in bpy.data.objects:
        if o.type == "MESH":
            e = o.evaluated_get(dg)
            me = e.to_mesh()
            me.calc_loop_triangles()
            tris += len(me.loop_triangles)
            e.to_mesh_clear()
    return {"file": path, "bytes": os.path.getsize(path), "tris": tris}
