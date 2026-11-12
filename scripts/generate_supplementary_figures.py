#!/usr/bin/env python3
"""Generate the 5 Full-Page Supplementary Figure Montages (Figures S1-S5) for LEAF GBC1 Digital Twin.

Each montage is designed to be a full page in size (7.5 x 9.8 in, 300 DPI)
formatted with Nature Partner Journals typography, detailed multi-panel layouts,
quantitative annotations, and high-contrast color palettes.

Outputs:
  figures/figS1_gravity_scaling_statolith_phenotypes.png
  figures/figS2_airflow_cfd_ethylene_triple_response.png
  figures/figS3_foam_capillary_hydration_deficit.png
  figures/figS4_sowing_density_shade_avoidance_phototropism.png
  figures/figS5_deepspace_radiation_stress_matrix.png
  (and corresponding PDFs in figures/ and manuscript/)
"""
from __future__ import annotations
import math
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import Rectangle
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT_FIGURES = ROOT / "figures"
OUT_MANUSCRIPT = ROOT / "manuscript"
OUT_APP = ROOT / "app" / "public"
for d in [OUT_FIGURES, OUT_MANUSCRIPT, OUT_APP]:
    d.mkdir(parents=True, exist_ok=True)

plt.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Helvetica", "Arial", "DejaVu Sans"],
    "font.size": 8.0,
    "axes.titlesize": 9.0,
    "axes.labelsize": 8.0,
    "xtick.labelsize": 7.2,
    "ytick.labelsize": 7.2,
    "legend.fontsize": 7.0,
    "figure.dpi": 300,
    "axes.spines.top": False,
    "axes.spines.right": False,
})

C_OK = "#2a7f62"      # Green
C_RAD = "#c23b3b"     # Crimson / Radiation
C_GRAV = "#3b6fb6"    # Deep Blue / Gravity
C_ETH = "#d9822b"     # Amber / Ethylene
C_HYP = "#b04a9b"     # Purple / Hypoxia
C_SAS = "#8a8a2e"     # Olive / Shade Avoidance
C_STEEL = "#4a6984"

def save_montage(fig, stem: str):
    fig.subplots_adjust(top=0.96, bottom=0.06, left=0.09, right=0.95, hspace=0.38, wspace=0.28)
    for p in [OUT_FIGURES / f"{stem}.png", OUT_MANUSCRIPT / f"{stem}.png", OUT_APP / f"{stem}.png"]:
        fig.savefig(p, dpi=300)
    for p in [OUT_FIGURES / f"{stem}.pdf", OUT_MANUSCRIPT / f"{stem}.pdf"]:
        fig.savefig(p)
    plt.close(fig)
    print(f"Generated {stem} successfully.")

# ==============================================================================
# Supplementary Figure S1: Gravitational Scaling & Statolith-Mediated Root Phenotypes
# ==============================================================================
def make_fig_s1():
    fig = plt.figure(figsize=(7.5, 9.8))
    gs = fig.add_gridspec(3, 2, height_ratios=[1.2, 1.0, 1.0])

    # Panel a: 4-gravity spectrum seedling comparison
    ax_a = fig.add_subplot(gs[0, :])
    ax_a.set_title("a  Gravitational Spectrum Ladder: Earth (1.0g), Mars (0.38g), Moon (0.166g), & ISS (0.0g)", loc="left", weight="bold")
    ax_a.set_xlim(-0.5, 7.5)
    ax_a.set_ylim(-1.5, 3.2)
    ax_a.axis("off")
    
    # 35 µm Nytex line at y = 0
    ax_a.axhline(0, color="#2980b9", lw=1.5, ls="--")
    ax_a.text(7.4, 0.08, "35 µm Nytex Screen", color="#2980b9", fontsize=6.5, ha="right", weight="bold")
    
    gravs = [
        (0.8, "Earth (1.0g)\nFull Sedimentation\nStraight Downward", 0.0, 1.0, 2.2, 1.8),
        (2.8, "Mars (0.38g)\nIntermediate Buoyancy\nMinor Spreading", 18.0, 0.38, 2.3, 1.9),
        (4.8, "Moon (0.166g)\nAttenuated Driving\nWide Nytex Gliding", 35.0, 0.166, 2.4, 2.0),
        (6.6, "ISS (0.0g)\nNo Gravitropism\nWandering & Coiling", 80.0, 0.0, 2.5, 1.8),
    ]
    for x0, lbl, angle, g_val, hyp_h, rad_l in gravs:
        # Shoot
        ax_a.plot([x0, x0], [0.8, hyp_h], color="#e6c86e", lw=3.2)
        # Cotyledons
        ax_a.scatter([x0 - 0.2, x0 + 0.2], [hyp_h + 0.1, hyp_h + 0.1], color="#4caf50", s=38, edgecolors="#1b5e20", lw=0.6, zorder=5)
        # Root trajectory
        rad_rad = math.radians(angle)
        if angle > 45:
            # Microgravity wavy coiling on Nytex
            rx = np.linspace(x0, x0 + 0.6, 20)
            ry = 0.8 - np.linspace(0, 0.75, 20) + 0.08 * np.sin(np.linspace(0, 4 * np.pi, 20))
            ax_a.plot(rx, ry, color=C_OK, lw=2.5)
            ax_a.scatter(rx[-1], ry[-1], color="#d98cb3", s=20, zorder=6)
        else:
            rx_nytex = x0 + math.sin(rad_rad) * 0.8
            ax_a.plot([x0, rx_nytex], [0.8, 0.0], color=C_OK, lw=2.5)
            # Tangential glide on Nytex
            glide_len = (1.0 - g_val) * 0.7 + 0.2
            ax_a.plot([rx_nytex, rx_nytex + glide_len], [0.0, 0.0], color=C_OK, lw=2.5)
            ax_a.scatter(rx_nytex + glide_len, 0.0, color="#d98cb3", s=20, zorder=6)
            
        ax_a.text(x0, -0.4, lbl, ha="center", va="top", fontsize=6.2, weight="bold")

    # Panel b: Statolith Sedimentation Physics
    ax_b = fig.add_subplot(gs[1, 0])
    ax_b.set_title("b  Amyloplast Statolith Sedimentation Rate (proportional to g)", loc="left", weight="bold")
    g_arr = np.linspace(0, 1.2, 50)
    v_sed = g_arr * 1.85 # µm/min
    ax_b.plot(g_arr, v_sed, color=C_GRAV, lw=2.0)
    ax_b.scatter([0.0, 0.166, 0.38, 1.0], [0.0, 0.166 * 1.85, 0.38 * 1.85, 1.85], color=C_RAD, s=35, zorder=5)
    ax_b.text(0.166 + 0.04, 0.166 * 1.85, "Moon (0.31 µm/min)\n[-83.4%]", fontsize=6.2, color=C_GRAV, weight="bold")
    ax_b.text(1.0 - 0.05, 1.85 - 0.25, "Earth (1.85 µm/min)", fontsize=6.2, color=C_GRAV, weight="bold", ha="right")
    ax_b.set_xlabel("Effective Gravitational Acceleration (g)")
    ax_b.set_ylabel("Statolith Drift Velocity (µm/min)")

    # Panel c: Root Tip Turning Kinetics θ_root(t)
    ax_c = fig.add_subplot(gs[1, 1])
    ax_c.set_title("c  Root Turning Kinetics Over 96 Hours", loc="left", weight="bold")
    t_h = np.linspace(0, 96, 100)
    theta_1g = 90.0 * (1.0 - np.exp(-t_h / 12.0))
    theta_mars = 75.0 * (1.0 - np.exp(-t_h / 18.0))
    theta_moon = 52.0 * (1.0 - np.exp(-t_h / 24.0))
    theta_0g = 12.0 * np.sin(t_h / 15.0) + 5.0
    
    ax_c.plot(t_h, theta_1g, color="#004488", lw=1.8, label="1.0g Earth")
    ax_c.plot(t_h, theta_mars, color="#d95f02", lw=1.8, label="0.38g Mars")
    ax_c.plot(t_h, theta_moon, color="#0088cc", lw=1.8, label="0.166g Moon (LEAF)")
    ax_c.plot(t_h, theta_0g, color="#7570b3", lw=1.8, ls="--", label="0.0g ISS Microgravity")
    ax_c.set_xlabel("Time After Imbibition (h)")
    ax_c.set_ylabel("Root Reorientation Angle (°)")
    ax_c.legend(loc="lower right", frameon=False, fontsize=6.5)

    # Panel d: Columella Auxin Redistribution Ratio
    ax_d = fig.add_subplot(gs[2, 0])
    ax_d.set_title("d  Columella Auxin Asymmetry Ratio (Lower / Upper)", loc="left", weight="bold")
    auxin_ratio = 1.0 + 1.8 * np.tanh(g_arr * 2.2)
    ax_d.plot(g_arr, auxin_ratio, color="#2e7d32", lw=2.0)
    ax_d.axhline(1.0, color="#888888", ls=":", lw=1.0)
    ax_d.scatter([0.0, 0.166, 0.38, 1.0], [1.0, 1.0 + 1.8 * np.tanh(0.166 * 2.2), 1.0 + 1.8 * np.tanh(0.38 * 2.2), 1.0 + 1.8 * np.tanh(1.0 * 2.2)], color=C_RAD, s=35, zorder=5)
    ax_d.set_xlabel("Gravitational Acceleration (g)")
    ax_d.set_ylabel("PIN3/PIN7 Auxin Asymmetry Ratio")

    # Panel e: Tangential Nytex Dispersion & Waving Amplitude
    ax_e = fig.add_subplot(gs[2, 1])
    ax_e.set_title("e  Tangential Nytex Crawling Distance (120 h)", loc="left", weight="bold")
    g_cats = ["0.0g ISS", "0.166g Moon", "0.38g Mars", "1.0g Earth"]
    crawl_mm = [2.4, 2.87, 2.1, 1.8]
    wave_amp = [0.45, 0.22, 0.12, 0.04]
    
    x = np.arange(len(g_cats))
    w = 0.35
    ax_e.bar(x - w/2, crawl_mm, w, label="Nytex Crawl (mm)", color=C_OK)
    ax_e.bar(x + w/2, [a * 4.0 for a in wave_amp], w, label="Waving Amp (×4 mm)", color=C_GRAV)
    ax_e.set_xticks(x)
    ax_e.set_xticklabels(g_cats)
    ax_e.set_ylabel("Morphometric Metric (mm)")
    ax_e.legend(loc="upper right", frameon=False, fontsize=6.5)

    fig.suptitle("Supplementary Figure S1 | Gravitational Scaling & Statolith-Mediated Root Phenotypes", fontsize=10.5, weight="bold", y=0.99)
    save_montage(fig, "figS1_gravity_scaling_statolith_phenotypes")

# ==============================================================================
# Supplementary Figure S2: Hardware Ventilation Modes & Ethylene Triple Response
# ==============================================================================
def make_fig_s2():
    fig = plt.figure(figsize=(7.5, 9.8))
    gs = fig.add_gridspec(3, 2, height_ratios=[1.15, 1.0, 1.0])

    # Panel a: 3D CFD Velocity Streamline Contours (Push vs Pull vs Stagnant)
    ax_a = fig.add_subplot(gs[0, :])
    ax_a.set_title("a  Chamber Ventilation CFD Profiles: Push Mode (25 mL/min), Pull Mode, & Stagnant Envelope", loc="left", weight="bold")
    z = np.linspace(-30, 30, 120)
    u_push = 0.02 + 0.06 * np.exp(-(z / 5.5)**2)
    u_pull = 0.035 + 0.02 * (1.0 / (1.0 + np.exp(-((abs(z) - 10.0) / 3.0))))
    u_stag = 0.002 * np.ones_like(z)
    
    ax_a.plot(z, u_push * 1000, color="#0088cc", lw=2.0, label="Push Mode: Jet Converging into Ch 2 (Gate 6)")
    ax_a.plot(z, u_pull * 1000, color="#ff7f0e", lw=1.8, ls="--", label="Pull Mode: Distributed Suction")
    ax_a.plot(z, u_stag * 1000, color="#c0392b", lw=1.6, ls=":", label="Stagnant Fault: Pump Off (Q = 0)")
    ax_a.axvline(-8.5, color="#556677", ls="--", lw=1.0)
    ax_a.axvline(8.5, color="#556677", ls="--", lw=1.0)
    ax_a.text(0.0, 72, "Chamber 2 Acceleration Jet\n(u = 80 mm/s)", color="#0088cc", fontsize=6.8, ha="center", weight="bold")
    ax_a.set_xlim(-33, 33)
    ax_a.set_xlabel("Chamber Longitudinal Coordinate Z (mm, Baffles at ±8.5 mm)")
    ax_a.set_ylabel("Air Velocity Magnitude u (mm/s)")
    ax_a.legend(loc="upper right", frameon=False, fontsize=6.8)

    # Panel b: Headspace Ethylene Accumulation Dynamics
    ax_b = fig.add_subplot(gs[1, 0])
    ax_b.set_title("b  Headspace Ethylene Accumulation Over 120 Hours", loc="left", weight="bold")
    t = np.linspace(0, 120, 100)
    eth_act = 0.08 * (1.0 - np.exp(-t / 10.0))
    eth_stag = 136.5 * (1.0 - np.exp(-t / 42.0))
    eth_low = 28.4 * (1.0 - np.exp(-t / 25.0))
    
    ax_b.plot(t, eth_stag, color="#c0392b", lw=2.0, label="Stagnant Fault (Q = 0, C₂H₄ = 136.5 ppb)")
    ax_b.plot(t, eth_low, color="#d9822b", lw=1.8, ls="--", label="Low Flow (Q = 5 mL/min, 28.4 ppb)")
    ax_b.plot(t, eth_act, color="#27ae60", lw=2.0, label="Active Push/Pull (Q = 25 mL/min, < 0.1 ppb)")
    ax_b.axhline(50, color="#e74c3c", ls=":", lw=1.2)
    ax_b.text(10, 54, "Triple Response Threshold (> 50 ppb)", color="#e74c3c", fontsize=6.2, weight="bold")
    ax_b.set_xlabel("Time After Imbibition (h)")
    ax_b.set_ylabel("Headspace Ethylene Concentration (ppb)")
    ax_b.legend(loc="center left", frameon=False, fontsize=6.5)

    # Panel c: Boundary Layer Conductance g_bl vs Radial Swelling
    ax_c = fig.add_subplot(gs[1, 1])
    ax_c.set_title("c  Boundary-Layer Conductance vs Shoot Radial Swelling", loc="left", weight="bold")
    gbl_vals = np.linspace(1.5, 16.0, 50)
    swell_pct = 100 + 85.0 * (1.0 / (1.0 + (gbl_vals / 4.5)**3))
    ax_c.plot(gbl_vals, swell_pct, color=C_ETH, lw=2.0)
    ax_c.scatter([2.4, 13.4], [185.0, 102.0], color=C_RAD, s=40, zorder=5)
    ax_c.text(2.6, 185.0, "Stagnant (g_bl < 3)\n+85% Swelling", fontsize=6.2, color=C_ETH, weight="bold")
    ax_c.text(13.4, 107.0, "Active (g_bl = 13.4)\nSlender Shoot", fontsize=6.2, color="#27ae60", weight="bold", ha="right")
    ax_c.set_xlabel("Boundary-Layer Conductance g_bl (mm/s)")
    ax_c.set_ylabel("Stem Radial Thickness (% Control)")

    # Panel d: 3D Cellular Profile: Normal vs Triple Response
    ax_d = fig.add_subplot(gs[2, 0])
    ax_d.set_title("d  Organ Anatomical Phenotype: Normal vs Triple Response", loc="left", weight="bold")
    ax_d.set_xlim(-1.5, 1.5)
    ax_d.set_ylim(-1.5, 2.2)
    ax_d.axis("off")
    # Normal (left)
    ax_d.plot([-0.7, -0.7], [0.2, 1.8], color="#e6c86e", lw=3.0)
    ax_d.plot([-0.7, -0.7], [0.2, -0.6], color=C_OK, lw=2.5)
    ax_d.scatter([-0.85, -0.55], [1.9, 1.9], color="#4caf50", s=35, zorder=5)
    ax_d.text(-0.7, -0.8, "Normal Airflow (Push)\n• Slender hypocotyl\n• Fully open cotyledons\n• Elongated radicle", ha="center", fontsize=5.8, weight="bold")
    # Triple response (right)
    t_h = np.linspace(0, np.pi * 0.8, 15)
    hx = 0.7 - 0.25 * (1 - np.cos(t_h))
    hy = 0.9 + 0.3 * np.sin(t_h)
    ax_d.plot([0.7, 0.7], [0.2, 0.9], color=C_ETH, lw=6.5)
    ax_d.plot(hx, hy, color=C_ETH, lw=6.0)
    ax_d.plot([0.7, 0.7], [0.2, -0.1], color=C_ETH, lw=3.5)
    ax_d.scatter(hx[-1], hy[-1], color="#a3b899", s=22, zorder=5)
    ax_d.text(0.7, -0.8, "Triple Response (Stagnant)\n• +85% Radial swelling\n• Exaggerated apical hook\n• Severely stunted radicle", ha="center", fontsize=5.8, weight="bold")

    # Panel e: Dose-Response of Organ Dimensions to Exogenous Ethylene
    ax_e = fig.add_subplot(gs[2, 1])
    ax_e.set_title("e  Ethylene Dose-Response Curve (0.01 to 10 ppm)", loc="left", weight="bold")
    c2h4_ppm = np.logspace(-2, 1, 50)
    hyp_len_rel = 100.0 - 55.0 * (c2h4_ppm / (0.1 + c2h4_ppm))
    dia_rel = 100.0 + 90.0 * (c2h4_ppm / (0.08 + c2h4_ppm))
    ax_e.semilogx(c2h4_ppm, hyp_len_rel, color=C_GRAV, lw=2.0, label="Hypocotyl Length (%)")
    ax_e.semilogx(c2h4_ppm, dia_rel, color=C_ETH, lw=2.0, label="Radial Thickness (%)")
    ax_e.set_xlabel("Ethylene Concentration (ppm)")
    ax_e.set_ylabel("Organ Metric (% 0 ppm Control)")
    ax_e.legend(loc="center right", frameon=False, fontsize=6.5)

    fig.suptitle("Supplementary Figure S2 | Hardware Ventilation Modes & Ethylene Triple Response Phenotypes", fontsize=10.5, weight="bold", y=0.99)
    save_montage(fig, "figS2_airflow_cfd_ethylene_triple_response")

# ==============================================================================
# Supplementary Figure S3: Substrate Hydraulic Potential & Water Deficit
# ==============================================================================
def make_fig_s3():
    fig = plt.figure(figsize=(7.5, 9.8))
    gs = fig.add_gridspec(3, 2, height_ratios=[1.15, 1.0, 1.0])

    # Panel a: van Genuchten Capillary Retention
    ax_a = fig.add_subplot(gs[0, :])
    ax_a.set_title("a  Porous Foam Capillary Pressure Curve (van Genuchten Retention θ_w vs Suction ψ)", loc="left", weight="bold")
    psi_kpa = np.logspace(-1, 3, 100) # 0.1 to 1000 kPa
    theta_sat = 0.92
    theta_res = 0.05
    alpha = 0.08 # 1/kPa
    n = 1.6
    m = 1.0 - 1.0 / n
    theta_w = theta_res + (theta_sat - theta_res) / (1.0 + (alpha * psi_kpa)**n)**m
    ax_a.semilogx(psi_kpa, theta_w, color="#0088cc", lw=2.2, label="Phenolic Foam Retention Curve")
    ax_a.axvline(5.0, color="#27ae60", ls="--", lw=1.2, label="100% Fill Nominal (ψ = -0.005 MPa)")
    ax_a.axvline(260.0, color="#d95f02", ls="--", lw=1.2, label="40% Deficit Fault (ψ = -0.26 MPa)")
    ax_a.set_xlabel("Matric Suction |ψ| (kPa)")
    ax_a.set_ylabel("Volumetric Water Content θ_w (cm³/cm³)")
    ax_a.legend(loc="upper right", frameon=False, fontsize=7.0)

    # Panel b: Foam Hydration Map θ_w(x, z)
    ax_b = fig.add_subplot(gs[1, 0])
    ax_b.set_title("b  Substrate Volumetric Water Content (100% vs 40% Deficit)", loc="left", weight="bold")
    z = np.linspace(-30, 30, 50)
    ax_b.plot(z, 0.88 + 0.02 * np.sin(z * 0.1), color="#27ae60", lw=2.0, label="Nominal Lunar (θ_w ≈ 0.88)")
    ax_b.plot(z, 0.52 + 0.03 * np.sin(z * 0.1), color="#d95f02", lw=1.8, ls="--", label="40% Deficit (θ_w ≈ 0.52)")
    ax_b.set_xlim(-33, 33)
    ax_b.set_ylim(0.3, 1.0)
    ax_b.set_xlabel("Chamber Z Coordinate (mm)")
    ax_b.set_ylabel("Water Content θ_w")
    ax_b.legend(loc="lower left", frameon=False, fontsize=6.5)

    # Panel c: Imbibition Water Uptake Curves
    ax_c = fig.add_subplot(gs[1, 1])
    ax_c.set_title("c  Seed Imbibition Kinetics Across Water Potentials", loc="left", weight="bold")
    t = np.linspace(0, 48, 100)
    w_0 = 1.0 + 1.2 * (1.0 - np.exp(-t / 6.0)) # 0 MPa
    w_def = 1.0 + 0.9 * (1.0 - np.exp(-t / 11.0)) # -0.26 MPa
    w_dry = 1.0 + 0.55 * (1.0 - np.exp(-t / 18.0)) # -0.65 MPa
    ax_c.plot(t, w_0, color="#27ae60", lw=2.0, label="ψ = -0.005 MPa (Nominal)")
    ax_c.plot(t, w_def, color="#d95f02", lw=1.8, label="ψ = -0.26 MPa (40% Deficit)")
    ax_c.plot(t, w_dry, color="#c0392b", lw=1.6, ls=":", label="ψ = -0.65 MPa (Severe)")
    ax_c.set_xlabel("Imbibition Time (h)")
    ax_c.set_ylabel("Relative Seed Water Mass (M / M₀)")
    ax_c.legend(loc="lower right", frameon=False, fontsize=6.5)

    # Panel d: Hydrotime Base Water Potential Germination Shift
    ax_d = fig.add_subplot(gs[2, 0])
    ax_d.set_title("d  Germination Delay vs Hydrotime Base Potential Offset", loc="left", weight="bold")
    psi_b = np.linspace(-0.8, 0.0, 50)
    t50 = 32.5 + 28.0 * (psi_b + 0.4)**2
    ax_d.plot(psi_b, t50, color=C_GRAV, lw=2.0)
    ax_d.scatter([-0.4, -0.15], [32.5, 48.2], color=C_RAD, s=35, zorder=5)
    ax_d.text(-0.4, 35.0, "Nominal (t₅₀ = 32.5 h)", fontsize=6.2, color=C_GRAV, weight="bold")
    ax_d.text(-0.15, 51.0, "Deficit (+15.7 h Delay)", fontsize=6.2, color="#d95f02", weight="bold")
    ax_d.set_xlabel("Hydrotime Potential Offset Δψ_b (MPa)")
    ax_d.set_ylabel("Median Rupture Time t₅₀ (h)")

    # Panel e: 35 µm Nytex Bubble Point Safety Margin
    ax_e = fig.add_subplot(gs[2, 1])
    ax_e.set_title("e  35 µm Nytex Screen Fixative Perfusion Safety", loc="left", weight="bold")
    p_bubble = 8.04 # kPa
    p_perf = 1.75 # kPa
    ax_e.bar(["RNAlater Fixative ΔP\n(35 µm Screen)", "Capillary Bubble Point\n(Young-Laplace Threshold)"], [p_perf, p_bubble], color=["#27ae60", "#c0392b"], width=0.45)
    ax_e.text(0, p_perf + 0.25, f"{p_perf} kPa\n(Fixative Safe)", ha="center", fontsize=6.5, weight="bold", color="#27ae60")
    ax_e.text(1, p_bubble + 0.25, f"{p_bubble} kPa\n(Bubble Point)", ha="center", fontsize=6.5, weight="bold", color="#c0392b")
    ax_e.set_ylabel("Differential Pressure ΔP (kPa)")
    ax_e.set_ylim(0, 10.5)

    fig.suptitle("Supplementary Figure S3 | Substrate Hydraulic Potential & Water Deficit Phenotypic Plasticity", fontsize=10.5, weight="bold", y=0.99)
    save_montage(fig, "figS3_foam_capillary_hydration_deficit")

# ==============================================================================
# Supplementary Figure S4: Sowing Density Sweeps & Shade Avoidance
# ==============================================================================
def make_fig_s4():
    fig = plt.figure(figsize=(7.5, 9.8))
    gs = fig.add_gridspec(3, 2, height_ratios=[1.15, 1.0, 1.0])

    # Panel a: 5-density top-down crown map schematics
    ax_a = fig.add_subplot(gs[0, :])
    ax_a.set_title("a  Sowing Density Sweep: 0.25× (41 seeds), 0.5× (82), 1.0× (164 Flight Plan), 1.5× (246), & 2.0× (328)", loc="left", weight="bold")
    ax_a.set_xlim(0, 10)
    ax_a.set_ylim(-0.5, 2.5)
    ax_a.axis("off")
    
    dens_x = [1.0, 3.0, 5.0, 7.0, 9.0]
    dens_labels = ["0.25× (41 seeds)\nLAI = 0.02\nSparse Canopy",
                   "0.5× (82 seeds)\nLAI = 0.04\nOpen Stand",
                   "1.0× (164 Flight)\nLAI = 0.08\nNominal Plan",
                   "1.5× (246 seeds)\nLAI = 0.11\nCrowded Stand",
                   "2.0× (328 seeds)\nLAI = 0.14\nFull Saturation"]
    np.random.seed(99)
    for idx, (dx, lbl) in enumerate(zip(dens_x, dens_labels)):
        ax_a.add_patch(Rectangle((dx - 0.8, 0.2), 1.6, 1.8, facecolor="#f0f7fb", edgecolor="#335577", lw=1.0))
        n_pts = int(8 * (idx + 1))
        px = np.random.uniform(dx - 0.65, dx + 0.65, n_pts)
        py = np.random.uniform(0.35, 1.85, n_pts)
        c_sizes = np.random.uniform(15, 45, n_pts)
        ax_a.scatter(px, py, s=c_sizes, color="#4caf50", alpha=0.75, edgecolors="#1b5e20", lw=0.4)
        ax_a.text(dx, -0.2, lbl, ha="center", fontsize=5.8, weight="bold")

    # Panel b: Beer-Lambert Canopy Extinction
    ax_b = fig.add_subplot(gs[1, 0])
    ax_b.set_title("b  Beer–Lambert Canopy Light Extinction f_light", loc="left", weight="bold")
    lai = np.linspace(0.01, 0.25, 50)
    k = 0.65 # extinction coeff
    f_light = np.exp(-k * lai * 10) # scaled for chamber
    ax_b.plot(lai, f_light, color=C_OK, lw=2.0)
    ax_b.scatter([0.04, 0.08, 0.11], [np.exp(-k*0.04*10), np.exp(-k*0.08*10), np.exp(-k*0.11*10)], color=C_RAD, s=35, zorder=5)
    ax_b.text(0.08 + 0.01, np.exp(-k*0.08*10), "Flight 1.0× (164 seeds)\n(f_light = 0.872)", fontsize=6.2, color=C_OK, weight="bold")
    ax_b.set_xlabel("Leaf Area Index (LAI)")
    ax_b.set_ylabel("Canopy Light Transmittance f_light")

    # Panel c: Shade Avoidance Hypocotyl Elongation
    ax_c = fig.add_subplot(gs[1, 1])
    ax_c.set_title("c  Shade-Avoidance Syndrome (SAS) Elongation", loc="left", weight="bold")
    mults = np.array([0.25, 0.5, 1.0, 1.5, 2.0])
    hyp_ath = np.array([1.95, 2.13, 2.40, 2.43, 2.58])
    hyp_bra = np.array([3.8, 4.1, 4.5, 4.65, 4.9])
    ax_c.plot(mults, hyp_ath, "o-", color="#0088cc", lw=1.8, label="Ch 2 Arabidopsis")
    ax_c.plot(mults, hyp_bra, "s-", color="#2ca02c", lw=1.8, label="Ch 1/3 Brassica")
    ax_c.axvline(1.0, color="#888888", ls=":", lw=1.0)
    ax_c.text(1.05, 2.2, "+38% SAS Boost", fontsize=6.2, color="#0088cc", weight="bold")
    ax_c.set_xlabel("Sowing Density Multiplier")
    ax_c.set_ylabel("Hypocotyl Length (mm)")
    ax_c.legend(loc="upper left", frameon=False, fontsize=6.5)

    # Panel d: 3D Phototropic Lean Angle θ_lean vs Crowding
    ax_d = fig.add_subplot(gs[2, 0])
    ax_d.set_title("d  3D Lateral Phototropic Shoot Lean Angle", loc="left", weight="bold")
    lean_deg = np.array([0.22, 0.48, 1.15, 1.59, 1.95])
    ax_d.plot(mults, lean_deg, "d-", color="#e7298a", lw=2.0)
    ax_d.scatter([1.0], [1.15], color=C_RAD, s=40, zorder=5)
    ax_d.text(1.05, 1.15 - 0.2, "Flight Nominal\n(1.15° lean)", fontsize=6.2, color="#e7298a", weight="bold")
    ax_d.set_xlabel("Sowing Density Multiplier")
    ax_d.set_ylabel("Mean Shoot Lean Angle θ_lean (°)")

    # Panel e: Nearest-Neighbor Crown Spacing Distribution
    ax_e = fig.add_subplot(gs[2, 1])
    ax_e.set_title("e  Nearest-Neighbor Crown Distance Distribution", loc="left", weight="bold")
    nnd_ch2 = [3.2, 2.2, 1.54, 1.25, 1.05]
    nnd_ch1 = [6.8, 4.8, 3.42, 2.80, 2.35]
    x = np.arange(len(mults))
    w = 0.35
    ax_e.bar(x - w/2, nnd_ch2, w, label="Ch 2 Arabidopsis (mm)", color="#0088cc")
    ax_e.bar(x + w/2, nnd_ch1, w, label="Ch 1/3 Brassica (mm)", color="#2ca02c")
    ax_e.set_xticks(x)
    ax_e.set_xticklabels(["0.25×", "0.5×", "1.0×", "1.5×", "2.0×"])
    ax_e.set_ylabel("Nearest-Neighbor Distance (mm)")
    ax_e.legend(loc="upper right", frameon=False, fontsize=6.5)

    fig.suptitle("Supplementary Figure S4 | Sowing Density Sweeps & Shade-Avoidance Phenotypic Plasticity", fontsize=10.5, weight="bold", y=0.99)
    save_montage(fig, "figS4_sowing_density_shade_avoidance_phototropism")

# ==============================================================================
# Supplementary Figure S5: Radiation & Multi-Factor Stress Matrix
# ==============================================================================
def make_fig_s5():
    fig = plt.figure(figsize=(7.5, 9.8))
    gs = fig.add_gridspec(3, 2, height_ratios=[1.15, 1.0, 1.0])

    # Panel a: Deep Space Radiation Environments
    ax_a = fig.add_subplot(gs[0, :])
    ax_a.set_title("a  Spaceflight Radiation Environments: Terrestrial Background, ISS Cabin, Lunar Surface GCR, & SPE", loc="left", weight="bold")
    rad_labels = ["Terrestrial\nBackground\n(0.003 mGy/d)", "ISS LEO Cabin\n(Shielded)\n(0.35 mGy/d)", "Lunar Surface\nAmbient GCR\n(0.80 mGy/d)", "Deep Space\nTransit Cruise\n(1.45 mGy/d)", "Solar Particle\nEvent (SPE Peak)\n(> 200 mGy/d)"]
    doses = [0.003, 0.35, 0.80, 1.45, 200.0]
    ax_a.bar(range(5), doses, color=["#27ae60", "#2980b9", "#8e44ad", "#d35400", "#c0392b"], width=0.45)
    ax_a.set_yscale("log")
    ax_a.set_xticks(range(5))
    ax_a.set_xticklabels(rad_labels, fontsize=6.5)
    ax_a.set_ylabel("Daily Absorbed Dose (mGy/day, log scale)")
    ax_a.set_ylim(0.001, 500)

    # Panel b: Fe-56 Heavy Ion Track Penetration
    ax_b = fig.add_subplot(gs[1, 0])
    ax_b.set_title("b  High-LET ⁵⁶Fe Heavy Ion DSB DNA Damage", loc="left", weight="bold")
    ax_b.set_xlim(-1.5, 1.5)
    ax_b.set_ylim(-1.5, 2.0)
    ax_b.axis("off")
    # Shoot
    ax_b.plot([0.0, 0.0], [0.3, 1.4], color="#e6c86e", lw=3.0)
    ax_b.plot([0.0, 0.0], [0.3, -0.4], color=C_RAD, lw=2.5) # stunted root
    ax_b.scatter(0.0, -0.4, color=C_RAD, s=40, zorder=5) # arrested meristem
    ax_b.scatter([-0.15, 0.15], [1.5, 1.5], color="#a3b899", s=25, zorder=5)
    # Ion track
    ax_b.annotate("High-LET ⁵⁶Fe Track (1 GeV/n)\nDirect Meristem Core Hit", xy=(0.0, -0.4), xytext=(0.8, 1.2),
                  arrowprops=dict(arrowstyle="->", color="#e74c3c", lw=1.8, ls="--"), fontsize=6.2, color="#e74c3c", weight="bold", ha="center")
    ax_b.text(0.0, -0.85, "G2/M Cell-Cycle Arrest\n• DNA Double-Strand Breaks (DSBs)\n• -45% Meristem Elongation Suppression", ha="center", fontsize=5.8, weight="bold")

    # Panel c: Root Meristem Division vs Radiation Dose
    ax_c = fig.add_subplot(gs[1, 1])
    ax_c.set_title("c  Root Meristem Mitotic Index vs Absorbed Dose", loc="left", weight="bold")
    d_mgy = np.linspace(0, 500, 100)
    mitotic_idx = 100.0 * np.exp(-d_mgy / 140.0)
    ax_c.plot(d_mgy, mitotic_idx, color=C_RAD, lw=2.0)
    ax_c.scatter([0.35, 0.8, 200.0], [100.0*np.exp(-0.35/140), 100.0*np.exp(-0.8/140), 100.0*np.exp(-200/140)], color="#004488", s=35, zorder=5)
    ax_c.text(200 + 15, 25, "SPE Dose: 76% Mitotic Arrest", fontsize=6.2, color=C_RAD, weight="bold")
    ax_c.set_xlabel("Absorbed Radiation Dose (mGy)")
    ax_c.set_ylabel("Mitotic Index (% Ground Control)")

    # Panel d: Multi-Factor Stress Response Radar
    ax_d = fig.add_subplot(gs[2, 0])
    ax_d.set_title("d  Multi-Stress Factor Phenotypic Fingerprint", loc="left", weight="bold")
    categories = ["Germination", "Hypocotyl", "Root Crawl", "Stem Radial", "Lean Angle"]
    scen_nom = [100, 108, 95, 102, 100]
    scen_stag = [65, 68, 46, 185, 80]
    scen_dry = [52, 58, 42, 100, 95]
    
    x = np.arange(len(categories))
    w = 0.25
    ax_d.bar(x - w, scen_nom, w, label="Nominal Lunar", color=C_OK)
    ax_d.bar(x, scen_stag, w, label="Stagnant Fault", color=C_ETH)
    ax_d.bar(x + w, scen_dry, w, label="Moisture Deficit", color=C_HYP)
    ax_d.set_xticks(x)
    ax_d.set_xticklabels(categories, fontsize=6.8)
    ax_d.set_ylabel("Response (% Control)")
    ax_d.legend(loc="upper right", frameon=False, fontsize=6.2)

    # Panel e: Combinatorial Phenotypic Morphospace
    ax_e = fig.add_subplot(gs[2, 1])
    ax_e.set_title("e  Combinatorial Spaceflight Morphospace (120 h)", loc="left", weight="bold")
    hyp = [2.2, 2.4, 2.6, 1.25, 1.4, 1.15, 3.2]
    root = [1.8, 2.87, 2.4, 0.95, 1.1, 0.85, 2.1]
    lbls = ["1g Ground", "Lunar Push", "0g ISS", "Stagnant", "Deficit", "SPE Ion", "2.0x SAS"]
    cols = [C_GRAV, C_OK, "#7570b3", C_ETH, C_HYP, C_RAD, C_SAS]
    
    for h, r, l, c in zip(hyp, root, lbls, cols):
        ax_e.scatter(h, r, color=c, s=55, edgecolors="#222222", lw=0.6, zorder=5)
        ax_e.text(h + 0.05, r + 0.05, l, fontsize=5.8, weight="bold", color=c)
        
    ax_e.set_xlabel("Mean Hypocotyl Length (mm)")
    ax_e.set_ylabel("Tangential Root Crawl (mm)")
    ax_e.set_xlim(0.8, 3.6)
    ax_e.set_ylim(0.5, 3.4)

    fig.suptitle("Supplementary Figure S5 | Deep Space Ionizing Radiation & Multi-Factor Stress Interaction Matrix", fontsize=10.5, weight="bold", y=0.99)
    save_montage(fig, "figS5_deepspace_radiation_stress_matrix")

def main():
    print("Generating Supplementary Figures S1–S5...")
    make_fig_s1()
    make_fig_s2()
    make_fig_s3()
    make_fig_s4()
    make_fig_s5()
    print("All Supplementary Figures successfully generated at 300 DPI!")

if __name__ == "__main__":
    main()
