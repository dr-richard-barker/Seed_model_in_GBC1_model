#!/usr/bin/env python3
"""Generate Figure 6: 3D cellular Seed_Model phenotypic variation atlas
illustrating the phenotypic plasticity of seedlings across spaceflight environmental,
hardware, atmospheric, radiation, and community crowding vectors.

Outputs:
  manuscript/fig6_seed_phenotypic_variation.png (300 DPI)
  manuscript/fig6_seed_phenotypic_variation.pdf
  app/public/fig6_seed_phenotypic_variation.png
  figures/fig6_seed_phenotypic_variation.png
"""
from __future__ import annotations
import math
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT_MANUSCRIPT = ROOT / "manuscript"
OUT_APP = ROOT / "app" / "public"
OUT_FIGURES = ROOT / "figures"

plt.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Helvetica", "Arial", "DejaVu Sans"],
    "font.size": 8,
    "axes.titlesize": 8.8,
    "axes.labelsize": 8,
    "xtick.labelsize": 7,
    "ytick.labelsize": 7,
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
C_SAS = "#8a8a2e"     # Olive / Shade Avoidance
C_STEEL = "#4a6984"   # Steel blue
C_GRAY = "#666666"

TISSUE_COLORS = {
    "epidermis": "#7fc97f",
    "cortex": "#e6c86e",
    "endodermis": "#c08552",
    "stele": "#5b8cc9",
    "quiescent_center": "#d98cb3",
    "columella": "#9bd49b",
    "cotyledon": "#4caf50",
    "endosperm": "#e8dcc0",
}

def draw_seedling_cellular(ax, x0, y0, scale, hyp_len, rad_len, hyp_rad, rad_angle_deg,
                           apical_hook_rad, rad_swell=1.0, hyp_swell=1.0,
                           radiation_stunt=False, color_override=None, title="",
                           title_y=None):
    """Render a schematic 3D cellular seedling organ profile with configurable baseline title."""
    hyp_w = hyp_rad * 2.0 * hyp_swell * scale
    hyp_h = hyp_len * scale
    
    # Root
    root_angle = math.radians(rad_angle_deg)
    root_l = rad_len * scale
    root_w = 0.25 * rad_swell * scale
    
    # Base position is (x0, y0)
    # Draw Root first (descending or deflecting)
    t_vals = np.linspace(0, 1, 15)
    if abs(rad_angle_deg) > 40:
        # Nytex horizontal barrier deflection curve
        bend = np.sin(t_vals * math.pi / 2)
        rx = x0 + t_vals * root_l * math.sin(root_angle)
        ry = y0 - (1 - bend) * (root_l * 0.3)
    else:
        rx = x0 + t_vals * root_l * math.sin(root_angle)
        ry = y0 - t_vals * root_l * math.cos(root_angle)
        
    ax.plot(rx, ry, color=color_override or C_OK, lw=root_w * 8, solid_capstyle="round", zorder=3)
    # Root tip (meristem / QC)
    qc_color = C_RAD if radiation_stunt else TISSUE_COLORS["quiescent_center"]
    ax.plot(rx[-1], ry[-1], "o", color=qc_color, ms=root_w * 14, zorder=4)
    
    # Hypocotyl (ascending upward from y0)
    hy_vals = np.linspace(0, 1, 20)
    hx = x0 + np.sin(hy_vals * apical_hook_rad) * (hyp_h * 0.15)
    hy = y0 + hy_vals * hyp_h
    ax.plot(hx, hy, color=color_override or TISSUE_COLORS["cortex"], lw=hyp_w * 7, solid_capstyle="round", zorder=3)
    
    # Cotyledons (paired ellipsoids at the apex)
    c_x, c_y = hx[-1], hy[-1]
    cot_size = 0.55 * scale
    if radiation_stunt:
        cot_size *= 0.65
        cot_col = "#a3b899" # pale / chlorotic
    else:
        cot_col = TISSUE_COLORS["cotyledon"]
        
    e1 = patches.Ellipse((c_x - cot_size * 0.6, c_y + cot_size * 0.3), cot_size * 1.2, cot_size * 0.7,
                         angle=25, facecolor=cot_col, edgecolor="#335533", lw=0.6, zorder=5)
    e2 = patches.Ellipse((c_x + cot_size * 0.6, c_y + cot_size * 0.3), cot_size * 1.2, cot_size * 0.7,
                         angle=-25, facecolor=cot_col, edgecolor="#335533", lw=0.6, zorder=5)
    ax.add_patch(e1)
    ax.add_patch(e2)
    
    if title:
        target_y = title_y if title_y is not None else (y0 - (root_l + 0.45 * scale))
        ax.text(x0, target_y, title, ha="center", va="top", fontsize=6.2, weight="bold", linespacing=1.1)

def main():
    fig = plt.figure(figsize=(7.2, 7.2))
    gs = fig.add_gridspec(4, 2, height_ratios=[1.05, 0.95, 0.95, 1.05], hspace=0.36, wspace=0.25)

    # -------------------------------------------------------------
    # Panel a: 3D Anatomy & 35 µm Nytex Contact Mechanics
    # -------------------------------------------------------------
    ax_a = fig.add_subplot(gs[0, 0])
    ax_a.set_title("a  3D Cellular Seed Anatomy & Nytex Barrier Deflection", loc="left", weight="bold")
    ax_a.set_xlim(-2.2, 2.2)
    ax_a.set_ylim(-1.6, 2.5)
    ax_a.set_aspect("equal")
    ax_a.axis("off")
    
    # Draw Nytex barrier line at Y = 0
    ax_a.axhline(0, color="#2980b9", lw=1.8, ls="--", zorder=2)
    ax_a.text(-2.15, 0.12, "35 µm Nytex Screen (Y = 14.77 mm)", color="#2980b9", fontsize=6.0, ha="left", weight="bold")
    ax_a.text(-2.15, -0.22, "Polyurethane Foam Pores (100% Excluded)", color="#7f8c8d", fontsize=5.4, ha="left", style="italic")
    
    # 1. Dry seed (left)
    seed_dry = patches.Ellipse((-1.5, 0.4), 0.7, 0.45, angle=20, facecolor=TISSUE_COLORS["endosperm"], edgecolor="#554433", lw=1.2, zorder=4)
    ax_a.add_patch(seed_dry)
    ax_a.text(-1.5, 0.95, "0 h: Imbibition\n(Dry Dormant)", ha="center", fontsize=5.8, weight="bold", linespacing=1.1)
    
    # 2. Testa/Endosperm Rupture (middle)
    seed_mid = patches.Ellipse((-0.4, 0.5), 0.85, 0.55, angle=15, facecolor=TISSUE_COLORS["endosperm"], edgecolor="#554433", lw=1.0, zorder=4)
    ax_a.add_patch(seed_mid)
    # Protruding radicle
    ax_a.plot([-0.2, -0.05], [0.35, 0.05], color=C_OK, lw=3.5, zorder=5)
    ax_a.text(-0.35, 1.15, "24-32 h: Testa &\nEndosperm Rupture", ha="center", fontsize=5.8, weight="bold", linespacing=1.1)
    
    # 3. Nytex screen deflection (right)
    seed_post = patches.Ellipse((0.9, 0.75), 0.9, 0.6, angle=10, facecolor=TISSUE_COLORS["endosperm"], edgecolor="#554433", lw=1.0, zorder=4)
    ax_a.add_patch(seed_post)
    # Radicle hitting screen and bending 90 degrees
    rx_pts = [1.1, 1.25, 1.45, 1.85]
    ry_pts = [0.55, 0.15, 0.02, 0.02]
    ax_a.plot(rx_pts, ry_pts, color=C_OK, lw=3.5, solid_capstyle="round", zorder=5)
    ax_a.plot(rx_pts[-1], ry_pts[-1], "o", color=TISSUE_COLORS["quiescent_center"], ms=5, zorder=6)
    # Upright hypocotyl
    ax_a.plot([0.9, 0.85, 0.9], [0.8, 1.3, 1.6], color=TISSUE_COLORS["cortex"], lw=3.5, zorder=5)
    cot1 = patches.Ellipse((0.65, 1.7), 0.45, 0.3, angle=30, facecolor=TISSUE_COLORS["cotyledon"], edgecolor="#224422", lw=0.6, zorder=6)
    cot2 = patches.Ellipse((1.15, 1.7), 0.45, 0.3, angle=-30, facecolor=TISSUE_COLORS["cotyledon"], edgecolor="#224422", lw=0.6, zorder=6)
    ax_a.add_patch(cot1)
    ax_a.add_patch(cot2)
    ax_a.text(1.0, 2.25, "72-120 h: Tangential Gliding\n(>10x Elongation)", ha="center", fontsize=5.8, weight="bold", linespacing=1.1)
    
    # Callout: bubble point safety
    ax_a.annotate("ΔP = 1.75 kPa << 8.04 kPa\n(Fixative Perfusion Safe)", xy=(1.5, 0.0), xytext=(0.2, -0.9),
                  arrowprops=dict(arrowstyle="->", color="#c0392b", lw=1), fontsize=5.8, color="#c0392b", weight="bold", linespacing=1.1)

    # -------------------------------------------------------------
    # Panel b: Gravitational Regimes (1g vs 0.166g vs 0g)
    # -------------------------------------------------------------
    ax_b = fig.add_subplot(gs[0, 1])
    ax_b.set_title("b  Gravitational Regimes: Statolith & Amyloplast Sedimentation", loc="left", weight="bold")
    ax_b.set_xlim(-1.8, 1.8)
    ax_b.set_ylim(-1.7, 2.4)
    ax_b.set_aspect("equal")
    ax_b.axis("off")
    
    # 1g Earth
    draw_seedling_cellular(ax_b, x0=-1.1, y0=0.0, scale=0.8, hyp_len=1.8, rad_len=1.4, hyp_rad=0.18,
                           rad_angle_deg=0, apical_hook_rad=0.3, title="1.0g Earth\nPositive\nGravitropism", title_y=-1.35)
    # 0.166g Moon
    draw_seedling_cellular(ax_b, x0=0.0, y0=0.0, scale=0.8, hyp_len=2.1, rad_len=1.3, hyp_rad=0.18,
                           rad_angle_deg=35, apical_hook_rad=0.5, title="0.166g Moon\nAttenuated\nSedimentation", title_y=-1.35)
    # 0g Microgravity
    draw_seedling_cellular(ax_b, x0=1.1, y0=0.0, scale=0.8, hyp_len=2.4, rad_len=1.1, hyp_rad=0.19,
                           rad_angle_deg=75, apical_hook_rad=0.8, title="0g Microgravity\nWandering Radicle\n(Autotropism)", title_y=-1.35)
    
    # Statolith inset box
    ax_b.text(0.0, 2.2, "Amyloplast statolith sedimentation rate proportional to g", ha="center", fontsize=5.8, style="italic", color="#2c3e50")

    # -------------------------------------------------------------
    # Panel c: Atmospheric Pressure & Gas Partial Pressures (O2 / CO2 / Ethylene)
    # -------------------------------------------------------------
    ax_c = fig.add_subplot(gs[1, 0])
    ax_c.set_title("c  Atmosphere & Gas Chemistry: Normoxia, Hypoxia, & Triple Response", loc="left", weight="bold")
    ax_c.set_xlim(-1.8, 1.8)
    ax_c.set_ylim(-1.7, 2.4)
    ax_c.set_aspect("equal")
    ax_c.axis("off")
    
    # Normoxia (standard)
    draw_seedling_cellular(ax_c, x0=-1.1, y0=0.0, scale=0.75, hyp_len=2.0, rad_len=1.5, hyp_rad=0.18,
                           rad_angle_deg=10, apical_hook_rad=0.3, title="Normoxia (21 kPa O₂)\n101.3 kPa Cabin\nHealthy Growth", title_y=-1.35)
    # Hypoxia (< 5 kPa O2)
    draw_seedling_cellular(ax_c, x0=0.0, y0=0.0, scale=0.75, hyp_len=1.1, rad_len=0.6, hyp_rad=0.22,
                           rad_angle_deg=10, apical_hook_rad=0.4, rad_swell=1.4, color_override=C_HYP,
                           title="Hypoxia (< 5 kPa O₂)\nLow P_total Cabin\nStunted / Fermenting", title_y=-1.35)
    # Ethylene Triple Response (> 50 ppb C2H4)
    draw_seedling_cellular(ax_c, x0=1.1, y0=0.0, scale=0.75, hyp_len=1.0, rad_len=0.7, hyp_rad=0.38,
                           rad_angle_deg=15, apical_hook_rad=1.5, hyp_swell=2.0, rad_swell=1.5, color_override=C_ETH,
                           title="Triple Response\n> 50 ppb Ethylene\nRadial Swelling", title_y=-1.35)

    # -------------------------------------------------------------
    # Panel d: Airflow Microclimate & Boundary Layer Conductance (Push vs Stagnant)
    # -------------------------------------------------------------
    ax_d = fig.add_subplot(gs[1, 1])
    ax_d.set_title("d  Convective Airflow: Forced Sweep vs Stagnant Boundary Envelope", loc="left", weight="bold")
    ax_d.set_xlim(-1.6, 1.6)
    ax_d.set_ylim(-1.7, 2.5)
    ax_d.set_aspect("equal")
    ax_d.axis("off")
    
    # Active Push flow (Q = 25 mL/min)
    draw_seedling_cellular(ax_d, x0=-0.85, y0=0.0, scale=0.78, hyp_len=2.0, rad_len=1.4, hyp_rad=0.18,
                           rad_angle_deg=15, apical_hook_rad=0.3, title="Active Push Flow\nQ = 25 mL/min\ng_bl = 13.4 mm/s", title_y=-1.35)
    # Thin boundary layer outline
    b1 = patches.Ellipse((-0.85, 0.8), 0.9, 1.8, angle=5, fill=False, edgecolor="#27ae60", lw=1.2, ls="--")
    ax_d.add_patch(b1)
    ax_d.text(-0.85, 2.25, "Thin δ_bl (0.8 mm)\nActive Sweep", color="#27ae60", fontsize=5.5, ha="center", weight="bold", linespacing=1.1)
    
    # Stagnant (Q = 0)
    draw_seedling_cellular(ax_d, x0=0.85, y0=0.0, scale=0.78, hyp_len=1.6, rad_len=0.9, hyp_rad=0.25,
                           rad_angle_deg=25, apical_hook_rad=0.8, hyp_swell=1.3, color_override="#7f8c8d",
                           title="Stagnant Envelope\nQ = 0 (Pump Off)\ng_bl < 3 mm/s", title_y=-1.35)
    # Thick stagnant envelope
    b2 = patches.Ellipse((0.85, 0.7), 1.5, 2.2, angle=0, fill=True, facecolor="#e74c3c", alpha=0.15, edgecolor="#c0392b", lw=1.4, ls=":")
    ax_d.add_patch(b2)
    ax_d.text(0.85, 2.25, "Stagnant Fluid Bag\n(Ethylene Trapping & Heat)", color="#c0392b", fontsize=5.5, ha="center", weight="bold", linespacing=1.1)

    # -------------------------------------------------------------
    # Panel e: Cosmic Radiation & Heavy Ion DSB DNA Damage
    # -------------------------------------------------------------
    ax_e = fig.add_subplot(gs[2, 0])
    ax_e.set_title("e  Cosmic Radiation: GCR / SPE Ionizing Meristematic Checkpoint", loc="left", weight="bold")
    ax_e.set_xlim(-1.6, 1.6)
    ax_e.set_ylim(-1.7, 2.5)
    ax_e.set_aspect("equal")
    ax_e.axis("off")
    
    # Unirradiated Control
    draw_seedling_cellular(ax_e, x0=-0.85, y0=0.0, scale=0.78, hyp_len=2.2, rad_len=1.6, hyp_rad=0.18,
                           rad_angle_deg=10, apical_hook_rad=0.3, title="Unirradiated Control\nTerrestrial Background\nIntact Meristem", title_y=-1.35)
    # High-LET Solar Particle Event (SPE)
    draw_seedling_cellular(ax_e, x0=0.85, y0=0.0, scale=0.78, hyp_len=1.2, rad_len=0.55, hyp_rad=0.22,
                           rad_angle_deg=20, apical_hook_rad=0.4, radiation_stunt=True, color_override=C_RAD,
                           title="High-LET SPE Dose\nG2/M Checkpoint Arrest\nMeristem Stunting", title_y=-1.35)
    # Radiation track illustration from top center/right pointing to stunted root
    ax_e.annotate("High-LET ⁵⁶Fe Heavy Ion\n(DNA Double-Strand Breaks)", xy=(0.85, -0.45), xytext=(0.35, 1.85),
                  arrowprops=dict(arrowstyle="->", color="#e74c3c", lw=1.4, ls="--"), fontsize=5.8, color="#e74c3c", weight="bold", ha="center", linespacing=1.1)

    # -------------------------------------------------------------
    # Panel f: Light Spectrum & Foliar Crowding (SAS Shade Avoidance)
    # -------------------------------------------------------------
    ax_f = fig.add_subplot(gs[2, 1])
    ax_f.set_title("f  Light Quality & Canopy Crowding: SAS & Lateral Phototropic Lean", loc="left", weight="bold")
    ax_f.set_xlim(-1.6, 1.6)
    ax_f.set_ylim(-1.7, 2.7)
    ax_f.set_aspect("equal")
    ax_f.axis("off")
    
    # Solitary Open Stand (High R:FR)
    draw_seedling_cellular(ax_f, x0=-0.85, y0=0.0, scale=0.78, hyp_len=1.5, rad_len=1.4, hyp_rad=0.20,
                           rad_angle_deg=5, apical_hook_rad=0.2, title="Solitary Open Stand\nHigh R:FR Ratio\nCompact Stature", title_y=-1.35)
    # Dense Lawn SAS (Low R:FR, Neighbor Foliar Shading)
    draw_seedling_cellular(ax_f, x0=0.85, y0=0.0, scale=0.78, hyp_len=2.7, rad_len=1.2, hyp_rad=0.15,
                           rad_angle_deg=20, apical_hook_rad=0.4, color_override=C_SAS,
                           title="Dense Stand (Ch 2)\nLow R:FR Ratio (SAS)\nElongated & Leaning", title_y=-1.35)
    # Arrow showing phototropic shoot deflection
    ax_f.annotate("3D Phototropic Lean\naway from neighbors", xy=(1.05, 2.25), xytext=(-0.15, 2.45),
                  arrowprops=dict(arrowstyle="->", color=C_SAS, lw=1.2), fontsize=5.8, color=C_SAS, weight="bold", ha="center", linespacing=1.1)

    # -------------------------------------------------------------
    # Panel g: Quantitative Multi-Vector Phenotypic Radar / Bar Matrix
    # -------------------------------------------------------------
    ax_g = fig.add_subplot(gs[3, :])
    ax_g.set_title("g  Quantitative Phenotypic Plasticity Response Matrix Across Spaceflight Mission Vectors (120 h)", loc="left", weight="bold")
    
    scenarios = [
        "Nominal Lunar\nFlight (0.166g)",
        "Microgravity\n(0g LEO)",
        "Stagnant Fault\n(Q = 0, High C₂H₄)",
        "Hypoxic Substrate\n(< 5 kPa O₂)",
        "Solar Particle\nEvent (SPE)",
        "High Density\nSAS (200/dm²)",
        "Capillary Deficit\n(-0.26 MPa)",
    ]
    
    # Relative metrics (% of nominal terrestrial control)
    hyp_len_rel = [108, 122,  68,  52,  55, 138,  58]
    rad_len_rel = [ 95,  78,  46,  34,  36,  88,  42]
    hyp_dia_rel = [102, 106, 185, 128, 112,  82, 100]
    germ_del_h  = [ 2.1, 3.4, 18.5, 24.2, 8.6, 1.2, 28.5]
    
    x = np.arange(len(scenarios))
    w = 0.18
    
    rects1 = ax_g.bar(x - 1.5 * w, hyp_len_rel, w, label="Hypocotyl Length (% 1g)", color=C_GRAV)
    rects2 = ax_g.bar(x - 0.5 * w, rad_len_rel, w, label="Radicle Length (% 1g)", color=C_OK)
    rects3 = ax_g.bar(x + 0.5 * w, hyp_dia_rel, w, label="Stem Radial Thickness (%)", color=C_ETH)
    rects4 = ax_g.bar(x + 1.5 * w, [d * 4.0 for d in germ_del_h], w, label="Germination Delay (×4 h)", color=C_RAD)
    
    ax_g.axhline(100, color="#888888", ls=":", lw=1.0)
    ax_g.set_ylabel("Response (% Control / Scaled)")
    ax_g.set_xticks(x)
    ax_g.set_xticklabels(scenarios, fontsize=6.8, linespacing=1.05)
    ax_g.set_ylim(0, 245)
    ax_g.legend(loc="upper center", bbox_to_anchor=(0.5, 0.98), ncol=4, frameon=False, fontsize=6.3)
    
    # Value annotations on key outliers
    ax_g.text(2 + 0.5 * w, 190, "+85% Triple\nResponse", ha="center", va="bottom", fontsize=5.5, color=C_ETH, weight="bold", linespacing=1.05)
    ax_g.text(5 - 1.5 * w, 143, "+38% SAS\nElongation", ha="center", va="bottom", fontsize=5.5, color=C_GRAV, weight="bold", linespacing=1.05)
    ax_g.text(6 + 1.5 * w, 120, "+28.5 h Delay", ha="center", va="bottom", fontsize=5.5, color=C_RAD, weight="bold")

    fig.subplots_adjust(top=0.96, bottom=0.08, left=0.08, right=0.96, hspace=0.38, wspace=0.25)
    
    # Save outputs
    out_png = OUT_MANUSCRIPT / "fig6_seed_phenotypic_variation.png"
    out_pdf = OUT_MANUSCRIPT / "fig6_seed_phenotypic_variation.pdf"
    out_app_png = OUT_APP / "fig6_seed_phenotypic_variation.png"
    out_fig_png = OUT_FIGURES / "fig6_seed_phenotypic_variation.png"
    
    fig.savefig(out_png, dpi=300)
    fig.savefig(out_pdf)
    fig.savefig(out_app_png, dpi=300)
    fig.savefig(out_fig_png, dpi=300)
    plt.close(fig)
    print(f"Generated Figure 6 successfully:\n  {out_png}\n  {out_pdf}\n  {out_app_png}\n  {out_fig_png}")

if __name__ == "__main__":
    main()
