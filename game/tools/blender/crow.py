# crow.glb: stylised crow ~0.35 tall. Front = -Y.
reset()
F = mat("feather", (0x1c, 0x1d, 0x24), rough=0.45, metal=0.1)
F2 = mat("feather_sheen", (0x26, 0x2c, 0x3a), rough=0.35, metal=0.2)
B = mat("beak", "beak", rough=0.4)
E = mat("eye_emit", (0xff, 0xe0, 0x9a), emit=1.5)
L = mat("legs", (0x2e, 0x2a, 0x28))

root = empty("crow")
body = pivot("body", (0, 0, 0.15), root)
sphere("torso", 0.1, (0, 0, 0.0), F, body, scale=(0.85, 1.45, 0.85))
sphere("chest", 0.08, (0, -0.08, -0.01), F2, body, scale=(0.9, 1.0, 0.95))
box("tail", (0.09, 0.16, 0.02), (0, 0.2, 0.01), F, body, rot=(0.25, 0, 0))
head = pivot("head", (0, -0.12, 0.08), body)
sphere("skull", 0.068, (0, 0, 0.02), F, head, scale=(0.9, 1.1, 0.95))
beak_top = cyl("beak_top", 0.026, 0.1, (0, -0.1, 0.02), B, head, rot=(math.pi / 2, 0, 0), verts=6, r2=0.003)
jaw = pivot("jaw", (0, -0.05, 0.005), head)
cyl("beak_low", 0.018, 0.08, (0, -0.04, -0.004), B, jaw, rot=(math.pi / 2, 0, 0), verts=6, r2=0.002)
for s in (1, -1):
    sphere(f"eye_{'L' if s > 0 else 'R'}", 0.012, (s * 0.05, -0.035, 0.04), E, head)
empty("beak_socket", (0, -0.13, 0.0), head)
wings = []
for side, s in (("L", 1), ("R", -1)):
    w = pivot(f"wing_{side}", (s * 0.065, -0.01, 0.04), body)
    box(f"wing_{side}_in", (0.14, 0.17, 0.02), (s * 0.07, 0.02, 0), F, w)
    box(f"wing_{side}_tip", (0.14, 0.12, 0.015), (s * 0.19, 0.05, 0), F2, w, rot=(0, 0, s * -0.25))
    wings.append(w)
    for k in range(2):
        cyl(f"leg_{side}", 0.009, 0.09, (s * 0.035, 0.01, 0.045), L, root, verts=4)
wL, wR = wings
# folded resting pose = wings rotated down along the body
FOLD_L, FOLD_R = (0, -1.25, 0.15), (0, 1.25, -0.15)
anim("idle", (1, 72), [(head, "rotation_euler", [(1, (0, 0, 0)), (18, (0, 0.35, 0.2)), (30, (0, 0.35, 0.2)), (44, (0, -0.3, -0.25)), (58, (0, -0.3, -0.25)), (72, (0, 0, 0))]),
                       (wL, "rotation_euler", [(1, FOLD_L), (72, FOLD_L)]), (wR, "rotation_euler", [(1, FOLD_R), (72, FOLD_R)]),
                       (body, "location", [(1, (0, 0, 0.15)), (36, (0, 0, 0.145)), (72, (0, 0, 0.15))])])
UP, DN = 0.9, -0.7
anim("fly", (1, 12), [(wL, "rotation_euler", [(1, (0, -UP, 0)), (7, (0, -DN, 0)), (12, (0, -UP, 0))]),
                      (wR, "rotation_euler", [(1, (0, UP, 0)), (7, (0, DN, 0)), (12, (0, UP, 0))]),
                      (body, "location", [(1, (0, 0, 0.14)), (7, (0, 0, 0.17)), (12, (0, 0, 0.14))]),
                      (body, "rotation_euler", [(1, (0.15, 0, 0)), (12, (0.15, 0, 0))])])
anim("glide", (1, 48), [(wL, "rotation_euler", [(1, (0, -0.12, 0)), (24, (0, -0.2, 0)), (48, (0, -0.12, 0))]),
                        (wR, "rotation_euler", [(1, (0, 0.12, 0)), (24, (0, 0.2, 0)), (48, (0, 0.12, 0))]),
                        (body, "rotation_euler", [(1, (0.1, 0.08, 0)), (24, (0.1, -0.08, 0)), (48, (0.1, 0.08, 0))])])
anim("carry", (1, 10), [(wL, "rotation_euler", [(1, (0, -1.0, 0)), (6, (0, 0.6, 0)), (10, (0, -1.0, 0))]),
                        (wR, "rotation_euler", [(1, (0, 1.0, 0)), (6, (0, -0.6, 0)), (10, (0, 1.0, 0))]),
                        (head, "rotation_euler", [(1, (0.3, 0, 0)), (10, (0.3, 0, 0))]),
                        (body, "location", [(1, (0, 0, 0.13)), (6, (0, 0, 0.16)), (10, (0, 0, 0.13))])])
anim("land", (1, 16), [(wL, "rotation_euler", [(1, (0, -1.0, 0)), (6, (0, 0.3, 0)), (16, FOLD_L)]),
                       (wR, "rotation_euler", [(1, (0, 1.0, 0)), (6, (0, -0.3, 0)), (16, FOLD_R)]),
                       (body, "rotation_euler", [(1, (-0.4, 0, 0)), (10, (0.15, 0, 0)), (16, (0, 0, 0))])])
anim("caw", (1, 24), [(head, "rotation_euler", [(1, (0, 0, 0)), (6, (-0.5, 0, 0)), (16, (-0.45, 0, 0)), (24, (0, 0, 0))]),
                      (jaw, "rotation_euler", [(1, (0, 0, 0)), (6, (0.5, 0, 0)), (14, (0.45, 0, 0)), (18, (0, 0, 0)), (24, (0, 0, 0))]),
                      (wL, "rotation_euler", [(1, FOLD_L), (8, (0, -0.6, 0)), (24, FOLD_L)]),
                      (wR, "rotation_euler", [(1, FOLD_R), (8, (0, 0.6, 0)), (24, FOLD_R)])])
anim("death", (1, 20), [(body, "scale", [(1, (1, 1, 1)), (5, (1.4, 1.4, 1.4)), (20, (0.01, 0.01, 0.01))]),
                        (body, "rotation_euler", [(1, (0, 0, 0)), (20, (0, 0, 6.0))])])
result = export("crow")
