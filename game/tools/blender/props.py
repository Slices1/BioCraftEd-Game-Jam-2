# Puzzle props. Origin at tile centre on the floor (z=0), front = -Y.
results = []


def M_():
    return dict(R=mat("rust", "rust", rough=0.8, metal=0.3), RD=mat("rust_dark", "rustd", metal=0.2), S=mat("steel", "steel", rough=0.5, metal=0.7),
                T=mat("teal", "teal", metal=0.4), HZ=mat("hazard", "hazard", rough=0.6), W=mat("wood", "wood"), BK=mat("black", "black"),
                CY=mat("light_emit", "cyan", emit=3.0), RED=mat("red_emit", "red", emit=4.0), GO=mat("gold_emit", "gold", emit=2.2, metal=0.8, rough=0.3),
                GD=mat("gold", (0xc8, 0x90, 0x2a), metal=0.9, rough=0.35), CT=mat("concrete_top", (0x8e, 0x90, 0x88)))


def prop(name, build):
    reset()
    M = M_()
    root = empty(name)
    build(root, M)
    results.append(export(name))


def p_plate(root, M):
    box("plate_base", (0.86, 0.86, 0.06), (0, 0, 0.03), M["S"], root, bevel=0.01)
    box("plate_ring_emit", (0.8, 0.8, 0.02), (0, 0, 0.055), M["CY"], root)
    top = pivot("plate_top", (0, 0, 0.08), root)
    box("plate_pad", (0.7, 0.7, 0.06), (0, 0, 0), M["HZ"], top, bevel=0.012)
    box("plate_mark", (0.3, 0.3, 0.01), (0, 0, 0.032), M["RD"], top)
    anim("press", (1, 8), [(top, "location", [(1, (0, 0, 0.08)), (8, (0, 0, 0.035))])])


def p_door(root, M):
    # door in the XZ plane (1 wide, 2 tall), thickness along Y. Two halves slide apart along X.
    for s in (-1, 1):
        box(f"jamb{s}", (0.12, 0.4, 2.0), (s * 0.5, 0, 1.0), M["RD"], root)
    box("lintel", (1.12, 0.4, 0.16), (0, 0, 1.94), M["RD"], root)
    box("door_light_emit", (0.3, 0.05, 0.06), (0, -0.21, 1.94), M["CY"], root)
    halves = []
    for s in (-1, 1):
        h = pivot(f"door_half{s}", (0, 0, 0), root)
        box(f"panel{s}", (0.44, 0.14, 1.84), (s * 0.22, 0, 0.92), M["R"], h, bevel=0.015)
        box(f"stripe{s}", (0.44, 0.15, 0.14), (s * 0.22, 0, 1.0), M["HZ"], h)
        halves.append((h, s))
    anim("open", (1, 18), [(h, "location", [(1, (0, 0, 0)), (18, (s * 0.46, 0, 0))]) for h, s in halves])


def p_cog(root, M):
    # big cog standing in the XZ plane, with a visible slot for the stick at the front
    box("cog_mount", (0.9, 0.5, 0.2), (0, 0.1, 0.1), M["RD"], root)
    box("cog_post", (0.2, 0.3, 1.0), (0, 0.15, 0.6), M["S"], root)
    cp = pivot("cog_pivot", (0, -0.05, 1.05), root)
    gear("cog", 0.38, 12, 0.12, M["R"], cp, (0, 0, 0), (math.pi / 2, 0, 0), hole=0.1)
    box("cog_slot_emit", (0.08, 0.04, 0.22), (0.18, -0.08, 0.18), M["RED"], cp)
    anim("spin", (1, 48), [(cp, "rotation_euler", [(1, (0, 0, 0)), (48, (0, math.pi / 6, 0))])])
    anim("jam_stutter", (1, 24), [(cp, "rotation_euler", [(1, (0, 0, 0)), (3, (0, 0.06, 0)), (5, (0, -0.02, 0)), (8, (0, 0.05, 0)), (10, (0, -0.01, 0)), (14, (0, 0.03, 0)), (24, (0, 0.0, 0))])])


def p_stick(root, M):
    cyl("stick", 0.025, 0.55, (0, 0, 0.03), M["W"], root, rot=(0, math.pi / 2, 0.12), verts=5)
    cyl("twig", 0.012, 0.16, (0.08, -0.05, 0.05), M["W"], root, rot=(0, 1.0, 0.9), verts=4)


def p_crate(root, M):
    box("crate", (0.86, 0.86, 0.86), (0, 0, 0.43), M["T"], root, bevel=0.02)
    for s in (-1, 1):
        box(f"strapX{s}", (0.9, 0.06, 0.9), (0, s * 0.3, 0.43), M["S"], root)
        box(f"strapY{s}", (0.06, 0.9, 0.9), (s * 0.3, 0, 0.43), M["S"], root)
    box("crate_label", (0.3, 0.02, 0.16), (0, -0.44, 0.55), M["HZ"], root)


def p_console(root, M):
    box("console", (0.7, 0.55, 0.95), (0, 0.05, 0.475), M["RD"], root, bevel=0.02)
    box("console_top", (0.76, 0.5, 0.08), (0, -0.05, 1.0), M["R"], root, rot=(-0.35, 0, 0))
    box("screen_emit", (0.5, 0.02, 0.24), (0, -0.24, 0.9), M["CY"], root, rot=(-0.35, 0, 0))
    cyl("jack_port", 0.08, 0.08, (0, -0.24, 0.45), M["S"], root, rot=(math.pi / 2, 0, 0), verts=8)
    cyl("jack_port_emit", 0.045, 0.09, (0, -0.25, 0.45), M["CY"], root, rot=(math.pi / 2, 0, 0), verts=8)
    for s in (-1, 1):
        cyl(f"cable{s}", 0.03, 0.8, (s * 0.25, 0.3, 0.4), M["BK"], root, verts=5)


def p_laser(root, M):
    box("laser_base", (0.5, 0.5, 0.12), (0, 0, 0.06), M["S"], root)
    box("laser_post", (0.28, 0.28, 0.75), (0, 0, 0.45), M["RD"], root, bevel=0.02)
    cyl("laser_lens_emit", 0.07, 0.06, (0, -0.15, 0.6), M["RED"], root, rot=(math.pi / 2, 0, 0), verts=8)
    box("laser_hazard", (0.29, 0.29, 0.08), (0, 0, 0.2), M["HZ"], root)


def p_piston(root, M):
    for s in (-1, 1):
        box(f"frame{s}", (0.1, 0.9, 2.0), (s * 0.45, 0, 1.0), M["RD"], root)
    box("housing", (1.0, 0.9, 0.3), (0, 0, 1.85), M["R"], root, bevel=0.02)
    head = pivot("piston_head", (0, 0, 1.7), root)
    cyl("rod", 0.08, 1.0, (0, 0, 0.0), M["S"], head, verts=8)
    box("ram", (0.82, 0.8, 0.22), (0, 0, -0.5), M["S"], head, bevel=0.02)
    box("ram_hazard", (0.84, 0.82, 0.06), (0, 0, -0.42), M["HZ"], head)
    box("warn_emit", (0.2, 0.05, 0.08), (0, -0.46, 1.85), M["RED"], root)
    anim("slam", (1, 12), [(head, "location", [(1, (0, 0, 1.7)), (3, (0, 0, 0.82)), (9, (0, 0, 0.82)), (12, (0, 0, 1.7))])])


def p_shiny(root, M):
    box("shiny_pedestal", (0.5, 0.5, 0.4), (0, 0, 0.2), M["RD"], root, bevel=0.02)
    g1 = pivot("gear_big", (0, 0, 0.85), root)
    gear("shiny_gear_a", 0.3, 10, 0.08, M["GO"], g1, (0, 0, 0), (math.pi / 2, 0, 0), hole=0.08)
    g2 = pivot("gear_small", (0.38, -0.02, 0.62), root)
    gear("shiny_gear_b", 0.15, 7, 0.07, M["GD"], g2, (0, 0, 0), (math.pi / 2, 0, 0), hole=0.05)
    g3 = pivot("gear_top", (-0.25, 0.02, 1.18), root)
    gear("shiny_gear_c", 0.13, 6, 0.06, M["GD"], g3, (0, 0, 0), (math.pi / 2, 0, 0), hole=0.04)
    sphere("shiny_core_emit", 0.07, (0, -0.06, 0.85), M["GO"], root)
    anim("spin", (1, 96), [(g1, "rotation_euler", [(1, (0, 0, 0)), (96, (0, 2 * math.pi / 10 * 3, 0))]),
                           (g2, "rotation_euler", [(1, (0, 0, 0)), (96, (0, -2 * math.pi / 7 * 3, 0))]),
                           (g3, "rotation_euler", [(1, (0, 0, 0)), (96, (0, -2 * math.pi / 6 * 3, 0))])])


for n, f in (("plate", p_plate), ("door", p_door), ("cog_door", p_cog), ("stick", p_stick), ("crate", p_crate),
             ("crane_console", p_console), ("laser_emitter", p_laser), ("piston", p_piston), ("great_shiny", p_shiny)):
    prop(n, f)
result = [(os.path.basename(r["file"]), r["tris"], r["bytes"]) for r in results]
