# Modular kit + deco. Each piece: 1x1 tile footprint, origin at tile centre on the floor surface (z=0).
results = []


def mats():
    return dict(C=mat("concrete", "concrete"), CD=mat("concrete_dark", (0x4c, 0x4f, 0x4b)), CT=mat("concrete_top", (0x8e, 0x90, 0x88)),
                R=mat("rust", "rust", rough=0.8, metal=0.3), RD=mat("rust_dark", "rustd", metal=0.2),
                T=mat("teal", "teal", metal=0.4), TL=mat("teal_light", (0x4a, 0x6e, 0x72), metal=0.3),
                S=mat("steel", "steel", rough=0.5, metal=0.7), MO=mat("moss", "moss"), MD=mat("moss_dark", (0x3e, 0x55, 0x28)),
                HZ=mat("hazard", "hazard", rough=0.6), BK=mat("black", "black"), W=mat("bark", "bark"), LF=mat("leaf", "leaf"),
                LAMP=mat("lamp_emit", "lamp", emit=4.0), SCR=mat("screen_emit", "cyan", emit=2.5),
                MUSH=mat("mushroom_emit", (0x6a, 0xff, 0xd8), emit=2.5), MC=mat("mushroom_cap", (0xc8, 0xb8, 0x96)))


def piece(name, build):
    reset()
    M = mats()
    root = empty(name)
    build(root, M)
    results.append(export(name))


def floor_base(root, M, top="C"):
    box("slab", (1, 1, 0.12), (0, 0, -0.06), M[top], root, bevel=0.02)


def k_floor(root, M):
    floor_base(root, M)
    box("crack", (0.5, 0.02, 0.005), (0.1, 0.15, 0.001), M["CD"], root, rot=(0, 0, 0.5))


def k_grate(root, M):
    box("frame", (1, 1, 0.1), (0, 0, -0.07), M["RD"], root)
    for i in range(6):
        box(f"bar{i}", (0.9, 0.05, 0.04), (0, -0.375 + i * 0.15, -0.02), M["S"], root)


def k_moss(root, M):
    floor_base(root, M)
    for i, (x, y, s) in enumerate(((-0.2, 0.15, 0.3), (0.22, -0.18, 0.22), (0.05, -0.3, 0.15))):
        cyl(f"moss{i}", s, 0.03, (x, y, 0.01), M["MO" if i else "MD"], root, verts=7)


def k_hazard(root, M):
    floor_base(root, M, "CD")
    for i in range(4):
        box(f"stripe{i}", (0.12, 0.96, 0.012), (-0.36 + i * 0.24, 0, 0.004), M["HZ"], root)


def wall_body(root, M, hole=False):
    if not hole:
        box("wall", (1, 1, 1.9), (0, 0, 0.95), M["C"], root)
    else:
        box("wall_low", (1, 1, 0.55), (0, 0, 0.275), M["C"], root)
        box("wall_high", (1, 1, 0.8), (0, 0, 1.5), M["C"], root)
        box("wall_sideA", (0.25, 1, 0.55), (0.375, 0, 0.825), M["C"], root)
        box("wall_sideB", (0.25, 1, 0.55), (-0.375, 0, 0.825), M["C"], root)
        for s in (-1, 1):
            box(f"vent_frame{s}", (0.56, 0.04, 0.06), (0, s * 0.5, 0.57), M["S"], root)
            box(f"vent_frame_t{s}", (0.56, 0.04, 0.06), (0, s * 0.5, 1.08), M["S"], root)
        box("vent_dark", (0.5, 0.9, 0.02), (0, 0, 0.56), M["BK"], root)
    box("cap", (1.04, 1.04, 0.1), (0, 0, 1.95), M["CT"], root, bevel=0.02)
    box("skirt", (1.02, 1.02, 0.22), (0, 0, 0.11), M["RD"], root)
    box("band", (1.01, 1.01, 0.06), (0, 0, 1.45 if not hole else 1.7), M["R"], root)


def k_wall(root, M): wall_body(root, M)
def k_wall_vent(root, M): wall_body(root, M, True)


def k_block(root, M):
    box("block", (1, 1, 0.92), (0, 0, 0.46), M["T"], root)
    box("block_top", (1.02, 1.02, 0.08), (0, 0, 0.96), M["TL"], root, bevel=0.015)
    for s in (-1, 1):
        box(f"rib{s}", (0.06, 1.01, 0.7), (s * 0.3, 0, 0.45), M["S"], root)


def k_pillar(root, M):
    box("pillar", (0.4, 0.4, 2.2), (0, 0, 1.1), M["CD"], root, bevel=0.02)
    box("base", (0.5, 0.5, 0.2), (0, 0, 0.1), M["RD"], root)
    box("head", (0.5, 0.5, 0.15), (0, 0, 2.15), M["R"], root)


def k_pipe(root, M):
    cyl("pipe", 0.08, 1.0, (0, 0, 1.6), M["R"], root, rot=(0, math.pi / 2, 0), verts=8)
    for x in (-0.42, 0.42):
        cyl(f"flange{x}", 0.11, 0.05, (x, 0, 1.6), M["S"], root, rot=(0, math.pi / 2, 0), verts=8)


def d_lamp(root, M):
    cyl("post", 0.035, 1.5, (0, 0, 0.75), M["S"], root, verts=6)
    cyl("foot", 0.14, 0.06, (0, 0, 0.03), M["RD"], root, verts=8)
    box("arm", (0.04, 0.3, 0.04), (0, -0.13, 1.48), M["S"], root)
    cyl("shade", 0.13, 0.12, (0, -0.26, 1.42), M["RD"], root, verts=8, r2=0.06)
    sphere("bulb_emit", 0.06, (0, -0.26, 1.35), M["LAMP"], root)


def d_barrel(root, M):
    cyl("barrel", 0.24, 0.62, (0, 0, 0.31), M["R"], root, verts=10)
    for z in (0.12, 0.5):
        cyl(f"hoop{z}", 0.25, 0.04, (0, 0, z), M["RD"], root, verts=10)
    cyl("lid", 0.2, 0.02, (0, 0, 0.62), M["S"], root, verts=10)


def d_tree(root, M):
    cyl("trunk", 0.16, 2.6, (0, 0, 1.3), M["W"], root, verts=7, r2=0.08)
    box("branch", (0.06, 0.06, 0.7), (0.25, 0, 1.9), M["W"], root, rot=(0, 0.8, 0))
    box("branch2", (0.05, 0.05, 0.6), (-0.2, 0.1, 2.2), M["W"], root, rot=(0.3, -0.7, 0))
    for i, (x, y, z, r) in enumerate(((0, 0, 2.7, 0.55), (0.45, 0.1, 2.25, 0.38), (-0.4, 0.2, 2.45, 0.4), (0.1, -0.35, 2.4, 0.35))):
        sphere(f"leaves{i}", r, (x, y, z), M["LF"] if i % 2 == 0 else M["MO"], root, sub=1)
    for i in range(4):
        a = i * 1.6
        box(f"root{i}", (0.08, 0.4, 0.06), (math.cos(a) * 0.2, math.sin(a) * 0.2, 0.03), M["W"], root, rot=(0, 0, a + 1.57))


def d_ivy(root, M):
    # flat curtain hanging on the -Y face of a wall tile (place it on the wall's tile)
    for i in range(9):
        x = -0.4 + (i % 5) * 0.2
        z = 1.9 - (i // 5) * 0.5 - (i % 3) * 0.15
        h = 0.5 + (i % 4) * 0.25
        box(f"vine{i}", (0.12, 0.03, h), (x, -0.52, z - h / 2), M["MO"] if i % 2 else M["LF"], root)


def d_moss(root, M):
    for i, (x, y, s) in enumerate(((0, 0, 0.32), (0.25, 0.2, 0.18), (-0.25, 0.22, 0.2))):
        sphere(f"clump{i}", s, (x, y, 0), M["MO"] if i else M["MD"], root, scale=(1, 1, 0.3))


def d_mush(root, M):
    for i, (x, y, h, r) in enumerate(((0, 0, 0.22, 0.09), (0.14, 0.08, 0.14, 0.06), (-0.1, 0.12, 0.17, 0.07), (0.05, -0.15, 0.1, 0.05))):
        cyl(f"stem{i}", r * 0.3, h, (x, y, h / 2), M["MC"], root, verts=6)
        sphere(f"cap{i}_emit", r, (x, y, h), M["MUSH"], root, scale=(1, 1, 0.45))


def d_terminal(root, M):
    box("cabinet", (0.6, 0.4, 0.9), (0, 0, 0.45), M["RD"], root, bevel=0.02)
    box("desk", (0.66, 0.3, 0.06), (0, -0.25, 0.75), M["S"], root, rot=(0.3, 0, 0))
    box("screen_emit", (0.44, 0.02, 0.26), (0, -0.205, 1.05), M["SCR"], root)
    box("hood", (0.56, 0.3, 0.34), (0, 0, 1.06), M["R"], root, bevel=0.02)


def d_robot_arm(root, M):
    cyl("base", 0.3, 0.2, (0, 0, 0.1), M["S"], root, verts=10)
    box("seg1", (0.18, 0.18, 0.9), (0.15, 0, 0.6), M["HZ"], root, rot=(0, 0.35, 0), bevel=0.02)
    box("seg2", (0.14, 0.14, 0.7), (0.5, 0, 0.75), M["HZ"], root, rot=(0, 2.3, 0), bevel=0.02)
    box("claw", (0.2, 0.12, 0.12), (0.78, 0, 0.42), M["S"], root)
    cyl("cable", 0.03, 0.8, (-0.1, 0.12, 0.45), M["BK"], root, rot=(0.2, 0.4, 0), verts=5)


for n, f in (("kit_floor", k_floor), ("kit_floor_grate", k_grate), ("kit_floor_moss", k_moss), ("kit_floor_hazard", k_hazard),
             ("kit_wall", k_wall), ("kit_wall_vent", k_wall_vent), ("kit_block", k_block), ("kit_pillar", k_pillar),
             ("kit_pipe", k_pipe), ("deco_lamp", d_lamp), ("deco_barrel", d_barrel), ("deco_tree", d_tree),
             ("deco_ivy", d_ivy), ("deco_moss", d_moss), ("deco_mushrooms", d_mush), ("deco_terminal", d_terminal),
             ("deco_robot_arm", d_robot_arm)):
    piece(n, f)
result = [(os.path.basename(r["file"]), r["tris"], r["bytes"]) for r in results]
