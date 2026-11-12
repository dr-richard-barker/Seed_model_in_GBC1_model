#!/usr/bin/env python3
"""Generate Figure 7: 3D Chamber Digital Twin Visualizations: Lessons on Gravity Level and Pump Flow Rate.

Illustrates how gravity level (1.0g Earth vs 0.166g Moon vs 0.0g microgravity)
and pump flow rate (Active Push 25 mL/min vs Pull vs Stagnant 0 mL/min)
alter plant morphology, root orientation, boundary layers, and the ethylene triple response.

Outputs:
  manuscript/fig7_chamber_gravity_flow_morphology.png (300 DPI)
  manuscript/fig7_chamber_gravity_flow_morphology.pdf
  app/public/fig7_chamber_gravity_flow_morphology.png
  figures/fig7_chamber_gravity_flow_morphology.png
  figures/fig7_chamber_gravity_flow_morphology.svg
"""
from __future__ import annotations
import math
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from mpl_toolkits.mplot3d import Axes3D
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT_MANUSCRIPT = ROOT / "manuscript"
OUT_APP = ROOT / "app" / "public"
OUT_FIGURES = ROOT / "figures"
OUT_FIGURES.mkdir(parents=True, exist_ok=True)

plt.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Helvetica", "Arial", "DejaVu Sans"],
    "font.size": 8,
    "axes.titlesize": 8.5,
    "axes.labelsize": 8,
    "xtick.labelsize": 7.2,
    "ytick.labelsize": 7.2,
    "legend.fontsize": 6.8,
    "figure.dpi": 300,
    "axes.spines.top": False,
    "axes.spines.right": False,
})

# Nature Partner Journals Color Palette
C_OK = "#2a7f62"      # Green
C_RAD = "#c23b3b"     # Crimson / Radiation
C_GRAV = "#3b6fb6"    # Deep Blue / Gravity
C_ETH = "#d9822b"     # Amber / Ethylene
C_HYP = "#b04a9b"     # Purple / Hypoxia
C_STEEL = "#4a6984"   # Steel blue
C_CH1 = "#2ca02c"
C_CH2 = "#0088cc"
C_CH3 = "#ff7f0e"

def draw_3d_chamber_perspective(ax):
    """Render a 3D isometric perspective of the LEAF GBC1 growth chamber and 164-seed community."""
    # Chamber bounds: X in [-18, 23] mm, Y in [0, 33] mm, Z in [-33, 33] mm
    # 1. Polycarbonate chamber wireframe
    edges = [
        # Base rectangle Y = 0
        [[-18, 0, -33], [23, 0, -33]], [[23, 0, -33], [23, 0, 33]],
        [[23, 0, 33], [-18, 0, 33]], [[-18, 0, 33], [-18, 0, -33]],
        # Ceiling rectangle Y = 33
        [[-18, 33, -33], [23, 33, -33]], [[23, 33, -33], [23, 33, 33]],
        [[23, 33, 33], [-18, 33, 33]], [[-18, 33, 33], [-18, 33, -33]],
        # Vertical pillars
        [[-18, 0, -33], [-18, 33, -33]], [[23, 0, -33], [23, 33, -33]],
        [[23, 0, 33], [23, 33, 33]], [[-18, 0, 33], [-18, 33, 33]],
    ]
    for e in edges:
        p1, p2 = np.array(e[0]), np.array(e[1])
        ax.plot([p1[0], p2[0]], [p1[2], p2[2]], [p1[1], p2[1]], color="#556677", lw=0.9, alpha=0.6)
        
    # 2. Phenolic Foam Block (Y = 7.62 to 14.62 mm)
    foam_corners = [
        [[-14, -30], [18, -30], [18, 30], [-14, 30]]
    ]
    # Draw foam slab
    verts = [
        [[-14, -30, 7.62], [18, -30, 7.62], [18, 30, 7.62], [-14, 30, 7.62]],
        [[-14, -30, 14.62], [18, -30, 14.62], [18, 30, 14.62], [-14, 30, 14.62]],
    ]
    # Poly3DCollection requires (X, Z, Y) in our coordinate system
    for layer_y in [7.62, 14.62]:
        poly = [[c[0], c[1], layer_y] for c in foam_corners[0]]
        ax.add_collection3d(Poly3DCollection([poly], facecolors="#99ccee", edgecolors="#6699bb", alpha=0.25, lw=0.6))
        
    # 3. 35 µm Nytex screen at Y = 14.77 mm
    nytex_poly = [[c[0], c[1], 14.77] for c in foam_corners[0]]
    ax.add_collection3d(Poly3DCollection([nytex_poly], facecolors="#2980b9", edgecolors="#1c5980", alpha=0.35, lw=1.2))
    
    # 4. Internal Baffles at Z = -8.5 mm and Z = +8.5 mm
    for bz in [-8.5, 8.5]:
        baffle_verts = [[-14, bz, 14.77], [18, bz, 14.77], [18, bz, 30.0], [-14, bz, 30.0]]
        ax.add_collection3d(Poly3DCollection([baffle_verts], facecolors="#334455", edgecolors="#112233", alpha=0.45, lw=1.0))
        
    # 5. Seedlings: Generate sample seedlings across Chambers 1, 2, 3
    # Chamber 1: Brassica rapa (Z = -28 to -12 mm)
    np.random.seed(42)
    # Ch 1 Brassica
    ch1_x = np.linspace(-10, 14, 8)
    ch1_z = np.linspace(-26, -14, 4)
    for x in ch1_x:
        for z in ch1_z:
            hyp_h = 4.5 + np.random.uniform(-0.6, 0.6)
            ax.plot([x, x], [z, z], [14.77, 14.77 + hyp_h], color=C_CH1, lw=1.2, zorder=6)
            ax.scatter(x, z, 14.77 + hyp_h, color="#4caf50", s=22, edgecolors="#225522", lw=0.5, zorder=7)
            # Tangential root on Nytex
            ax.plot([x, x + 2.0], [z, z], [14.8, 14.8], color="#c08552", lw=1.0, zorder=5)
            
    # Chamber 2: Arabidopsis thaliana lawn (10x10, Z = -6 to +6 mm)
    ch2_x = np.linspace(-9, 13, 10)
    ch2_z = np.linspace(-5.5, 5.5, 10)
    for x in ch2_x:
        for z in ch2_z:
            hyp_h = 2.4 + np.random.uniform(-0.4, 0.4)
            # Add phototropic lean
            lean_x = x + 0.3 * (x / 10.0)
            ax.plot([x, lean_x], [z, z], [14.77, 14.77 + hyp_h], color=C_CH2, lw=1.0, zorder=6)
            ax.scatter(lean_x, z, 14.77 + hyp_h, color="#2e7d32", s=14, edgecolors="#1b5e20", lw=0.4, zorder=7)
            # Tangential root on Nytex
            ax.plot([x, x - 1.2], [z, z], [14.8, 14.8], color="#c08552", lw=0.8, zorder=5)

    # Chamber 3: Brassica rapa (Z = +12 to +28 mm)
    ch3_x = np.linspace(-10, 14, 8)
    ch3_z = np.linspace(14, 26, 4)
    for x in ch3_x:
        for z in ch3_z:
            hyp_h = 4.5 + np.random.uniform(-0.6, 0.6)
            ax.plot([x, x], [z, z], [14.77, 14.77 + hyp_h], color=C_CH3, lw=1.2, zorder=6)
            ax.scatter(x, z, 14.77 + hyp_h, color="#4caf50", s=22, edgecolors="#225522", lw=0.5, zorder=7)
            # Tangential root on Nytex
            ax.plot([x, x + 2.0], [z, z], [14.8, 14.8], color="#c08552", lw=1.0, zorder=5)

    # Streamline indicator arrows (Push mode: Ports 1 & 3 In, Port 2 Out)
    # Inflow at Z = -21.6 mm
    ax.quiver(-15.5, -21.6, 22, 6, 8, -2, color="#00bcd4", lw=1.4, arrow_length_ratio=0.3)
    # Inflow at Z = +21.6 mm
    ax.quiver(-15.5, 21.6, 22, 6, -8, -2, color="#00bcd4", lw=1.4, arrow_length_ratio=0.3)
    # Outflow at Port 2 (Z = 0)
    ax.quiver(-8.0, 0.0, 24, -8, 0, 0, color="#ff9800", lw=1.5, arrow_length_ratio=0.3)
    
    # Labels
    ax.text(-12, -22, 34, "Chamber 1 (32 B. rapa)", color=C_CH1, fontsize=6.5, weight="bold")
    ax.text(-12, 0, 34, "Chamber 2 (100 Ath Lawn)", color=C_CH2, fontsize=6.5, weight="bold")
    ax.text(-12, 22, 34, "Chamber 3 (32 B. rapa)", color=C_CH3, fontsize=6.5, weight="bold")
    
    ax.set_xlim(-20, 25)
    ax.set_ylim(-35, 35)
    ax.set_zlim(0, 36)
    ax.set_xlabel("X (mm)", labelpad=-8, fontsize=7)
    ax.set_ylabel("Z (mm)", labelpad=-8, fontsize=7)
    ax.set_zlabel("Y (mm)", labelpad=-8, fontsize=7)
    ax.view_init(elev=22, azim=-55)
    ax.set_box_aspect([1.0, 1.6, 0.9])

def main():
    fig = plt.figure(figsize=(7.4, 7.4))
    gs = fig.add_gridspec(3, 2, height_ratios=[1.15, 0.95, 0.95], hspace=0.36, wspace=0.25)

    # -------------------------------------------------------------
    # Panel a: 3D Chamber CAD & 164-Seed Sowing Layout
    # -------------------------------------------------------------
    ax_a = fig.add_subplot(gs[0, :], projection="3d")
    ax_a.set_title("a  LEAF GBC1 3D Chamber Digital Twin: 164-Seed Community & Push CFD Streamlines", loc="left", weight="bold", pad=12)
    draw_3d_chamber_perspective(ax_a)

    # -------------------------------------------------------------
    # Panel b: Lesson 1 — Gravity Level Alterations (1g vs 0.166g vs 0g)
    # -------------------------------------------------------------
    ax_b = fig.add_subplot(gs[1, 0])
    ax_b.set_title("b  Lesson 1: Gravitational Regimes & Statolith Steering", loc="left", weight="bold")
    ax_b.set_xlim(-1.6, 1.6)
    ax_b.set_ylim(-1.5, 2.2)
    ax_b.set_aspect("equal")
    ax_b.axis("off")
    
    # Draw Nytex line
    ax_b.axhline(0, color="#2980b9", lw=1.2, ls="--")
    ax_b.text(1.5, 0.08, "35 µm Nytex", color="#2980b9", fontsize=5.5, ha="right", weight="bold")
    
    # 1. Earth 1.0g (left)
    # Straight downward root, sharp gravitropism
    ax_b.plot([-1.0, -1.0], [0.8, 1.8], color="#e6c86e", lw=3.0) # shoot
    ax_b.plot([-1.0, -1.0], [0.8, 0.0], color=C_OK, lw=2.5) # radicle down to Nytex
    ax_b.plot([-1.0, -0.6], [0.0, 0.0], color=C_OK, lw=2.5) # small turn along Nytex
    ax_b.scatter(-0.6, 0.0, color="#d98cb3", s=18, zorder=5) # QC
    ax_b.scatter([-1.15, -0.85], [1.9, 1.9], color="#4caf50", s=30, zorder=5) # cotyledons
    ax_b.text(-1.0, -0.5, "1.0g Earth\n• Rapid sedimentation\n• Uniaxial downward\n• High statolith flux", ha="center", fontsize=5.8, weight="bold")

    # 2. Moon 0.166g (middle)
    ax_b.plot([0.0, 0.05], [0.8, 2.0], color="#e6c86e", lw=3.0)
    ax_b.plot([0.0, 0.15], [0.8, 0.0], color=C_OK, lw=2.5) # angled radicle
    ax_b.plot([0.15, 0.65], [0.0, 0.0], color=C_OK, lw=2.5) # longer glide along Nytex
    ax_b.scatter(0.65, 0.0, color="#d98cb3", s=18, zorder=5)
    ax_b.scatter([-0.1, 0.2], [2.1, 2.1], color="#4caf50", s=30, zorder=5)
    ax_b.text(0.1, -0.5, "0.166g Moon\n• 83.4% lower buoyancy\n• Delayed turning (35°)\n• Broad Nytex contact", ha="center", fontsize=5.8, weight="bold")

    # 3. Microgravity 0g (right)
    ax_b.plot([1.0, 1.1], [0.8, 1.9], color="#e6c86e", lw=3.0)
    # Wandering, wavy root on Nytex
    rx_pts = [1.0, 1.1, 1.25, 1.45, 1.55]
    ry_pts = [0.8, 0.3, 0.05, 0.05, 0.15] # curling up off mesh!
    ax_b.plot(rx_pts, ry_pts, color=C_OK, lw=2.5)
    ax_b.scatter(rx_pts[-1], ry_pts[-1], color="#d98cb3", s=18, zorder=5)
    ax_b.scatter([0.9, 1.25], [2.0, 2.0], color="#4caf50", s=30, zorder=5)
    ax_b.text(1.1, -0.5, "0g Microgravity\n• No sedimentation\n• Autotropic waving\n• Stochastic curling", ha="center", fontsize=5.8, weight="bold")

    # -------------------------------------------------------------
    # Panel c: Lesson 2 — Pump Flow Rate & Ethylene Triple Response
    # -------------------------------------------------------------
    ax_c = fig.add_subplot(gs[1, 1])
    ax_c.set_title("c  Lesson 2: Airflow Rates & Ethylene Triple Response", loc="left", weight="bold")
    ax_c.set_xlim(-1.4, 1.4)
    ax_c.set_ylim(-1.5, 2.2)
    ax_c.set_aspect("equal")
    ax_c.axis("off")
    
    # 1. Active Push (Q = 25 mL/min) (left)
    ax_c.plot([-0.7, -0.7], [0.4, 1.8], color="#e6c86e", lw=3.0) # slender hypocotyl
    ax_c.plot([-0.7, -0.7], [0.4, -0.4], color=C_OK, lw=2.5) # healthy root
    ax_c.scatter([-0.85, -0.55], [1.9, 1.9], color="#4caf50", s=35, zorder=5) # open cotyledons
    # Thin boundary layer outline
    b_act = patches.Ellipse((-0.7, 0.9), 0.75, 1.7, angle=0, fill=False, edgecolor="#27ae60", lw=1.2, ls="--")
    ax_c.add_patch(b_act)
    ax_c.text(-0.7, 2.05, "Thin δ_bl (0.8 mm)", color="#27ae60", fontsize=5.5, ha="center", weight="bold")
    ax_c.text(-0.7, -0.75, "Active Push (25 mL/min)\n• C₂H₄ < 0.1 ppb (purged)\n• g_bl = 13.4 mm/s\n• Slender, expanded shoot", ha="center", fontsize=5.8, weight="bold")

    # 2. Stagnant Fault (Q = 0) (right)
    # Swollen hypocotyl, exaggerated hook, stunted root
    # Hook curve
    t_hook = np.linspace(0, np.pi * 0.8, 15)
    hook_x = 0.7 - 0.25 * (1 - np.cos(t_hook))
    hook_y = 1.0 + 0.3 * np.sin(t_hook)
    ax_c.plot([0.7, 0.7], [0.4, 1.0], color=C_ETH, lw=6.5) # 85% thicker stem!
    ax_c.plot(hook_x, hook_y, color=C_ETH, lw=6.0) # exaggerated hook
    ax_c.plot([0.7, 0.7], [0.4, 0.05], color=C_ETH, lw=3.5) # stunted root!
    ax_c.scatter(hook_x[-1], hook_y[-1], color="#a3b899", s=22, zorder=5) # closed, stunted cotyledons
    # Thick boundary layer envelope
    b_stag = patches.Ellipse((0.7, 0.8), 1.3, 2.1, angle=0, fill=True, facecolor="#e74c3c", alpha=0.15, edgecolor="#c0392b", lw=1.4, ls=":")
    ax_c.add_patch(b_stag)
    ax_c.text(0.7, 2.05, "Stagnant Gas Bag (Q = 0)", color="#c0392b", fontsize=5.5, ha="center", weight="bold")
    ax_c.text(0.7, -0.75, "Stagnant Fault (Pump Off)\n• C₂H₄ = 136.5 ppb (trapped)\n• g_bl < 3.0 mm/s\n• +85% Radial Swelling", ha="center", fontsize=5.8, weight="bold")

    # -------------------------------------------------------------
    # Panel d: Microclimate Profiles Across Compartments (Z = -33 to +33 mm)
    # -------------------------------------------------------------
    ax_d = fig.add_subplot(gs[2, 0])
    ax_d.set_title("d  Boundary-Layer Conductance & Airflow Channelling", loc="left", weight="bold")
    z_coords = np.linspace(-30, 30, 100)
    # Push mode dip-and-converge profile
    gbl_push = 10.5 + 3.0 * np.exp(-((z_coords) / 6.0)**2) - 1.2 * np.exp(-((abs(z_coords) - 8.5) / 2.0)**2)
    # Pull mode suction profile
    gbl_pull = 9.8 + 2.8 * (1.0 / (1.0 + np.exp(-((abs(z_coords) - 12.0) / 4.0))))
    # Stagnant profile
    gbl_stag = 2.4 + 0.3 * np.sin(z_coords * 0.1)
    
    ax_d.plot(z_coords, gbl_push, color="#0088cc", lw=1.8, label="Push Mode (25 mL/min, Gate 6)")
    ax_d.plot(z_coords, gbl_pull, color="#ff7f0e", lw=1.6, ls="--", label="Pull Mode (25 mL/min)")
    ax_d.plot(z_coords, gbl_stag, color="#c0392b", lw=1.5, ls=":", label="Stagnant Fault (Q = 0)")
    
    ax_d.axvline(-8.5, color="#556677", ls="--", lw=0.9)
    ax_d.axvline(8.5, color="#556677", ls="--", lw=0.9)
    ax_d.text(0.0, 13.8, "Ch 2 Jet Convergence\n(g_bl = 13.4 mm/s)", color="#0088cc", fontsize=5.8, ha="center", weight="bold")
    ax_d.text(-20, 6.0, "Ch 1 Baffle", color="#556677", fontsize=5.5, ha="center")
    ax_d.text(20, 6.0, "Ch 3 Baffle", color="#556677", fontsize=5.5, ha="center")
    
    ax_d.set_xlim(-33, 33)
    ax_d.set_ylim(0, 16)
    ax_d.set_xlabel("Chamber Longitudinal Position Z (mm)")
    ax_d.set_ylabel("Conductance g_bl (mm/s)")
    ax_d.legend(loc="lower left", frameon=False, fontsize=6.2)

    # -------------------------------------------------------------
    # Panel e: Morphological Biometrics Across Hardware Permutations (120 h)
    # -------------------------------------------------------------
    ax_e = fig.add_subplot(gs[2, 1])
    ax_e.set_title("e  Organ Morphometrics: Gravity × Ventilation Matrix", loc="left", weight="bold")
    
    scenarios = ["1.0g Push", "0.166g Push", "0g Push", "0.166g Pull", "0g Stagnant", "Deficit 40%"]
    hyp_len = [2.2, 2.4, 2.6, 2.3, 1.25, 1.4]
    stem_dia = [0.38, 0.40, 0.41, 0.39, 0.74, 0.38]
    root_nytex = [1.8, 2.87, 2.4, 2.7, 0.95, 1.1]
    
    x = np.arange(len(scenarios))
    w = 0.25
    
    ax_e.bar(x - w, hyp_len, w, label="Hypocotyl Length (mm)", color=C_GRAV)
    ax_e.bar(x, [d * 3.5 for d in stem_dia], w, label="Stem Diameter (×3.5 mm)", color=C_ETH)
    ax_e.bar(x + w, root_nytex, w, label="Nytex Root Crawl (mm)", color=C_OK)
    
    ax_e.text(4, 2.8, "+85% Radial\nSwelling", ha="center", fontsize=5.5, color=C_ETH, weight="bold")
    ax_e.text(1 + w, 3.0, "Max Nytex\nCrawl (2.87 mm)", ha="center", fontsize=5.5, color=C_OK, weight="bold")
    
    ax_e.set_xticks(x)
    ax_e.set_xticklabels(scenarios, fontsize=6.5, rotation=20, ha="right")
    ax_e.set_ylabel("Organ Metric (mm / Scaled)")
    ax_e.set_ylim(0, 3.8)
    ax_e.legend(loc="upper left", ncol=3, frameon=False, fontsize=6.0)

    fig.subplots_adjust(top=0.94, bottom=0.08, left=0.08, right=0.96, hspace=0.38, wspace=0.25)

    # Save outputs
    out_png = OUT_MANUSCRIPT / "fig7_chamber_gravity_flow_morphology.png"
    out_pdf = OUT_MANUSCRIPT / "fig7_chamber_gravity_flow_morphology.pdf"
    out_app = OUT_APP / "fig7_chamber_gravity_flow_morphology.png"
    out_fig_png = OUT_FIGURES / "fig7_chamber_gravity_flow_morphology.png"
    out_fig_svg = OUT_FIGURES / "fig7_chamber_gravity_flow_morphology.svg"
    
    fig.savefig(out_png, dpi=300)
    fig.savefig(out_pdf)
    fig.savefig(out_app, dpi=300)
    fig.savefig(out_fig_png, dpi=300)
    fig.savefig(out_fig_svg)
    plt.close(fig)
    print(f"Generated Figure 7 successfully:\n  {out_png}\n  {out_pdf}\n  {out_app}\n  {out_fig_png}")

if __name__ == "__main__":
    main()
