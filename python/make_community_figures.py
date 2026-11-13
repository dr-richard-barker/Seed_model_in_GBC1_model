#!/usr/bin/env python3
"""Generate the 5 multi-panel publication figures for the 164-seed LEAF GBC1 Community Digital Twin."""
import csv
import pathlib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
TABLES = ROOT / "results" / "tables"
FIGS = ROOT / "figures"
FIGS.mkdir(parents=True, exist_ok=True)

plt.rcParams.update({
    "font.family": "sans-serif",
    "font.size": 9.5,
    "axes.titlesize": 10.5,
    "axes.titleweight": "bold",
    "axes.labelsize": 9.5,
    "xtick.labelsize": 8.5,
    "ytick.labelsize": 8.5,
    "legend.fontsize": 8.0,
    "figure.facecolor": "white",
    "axes.facecolor": "#fbfcfd",
    "axes.edgecolor": "#334455",
    "axes.grid": True,
    "grid.alpha": 0.28,
    "grid.color": "#99aabb",
})


def load_csv(name: str) -> list[dict[str, str]]:
    with (TABLES / name).open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def col_float(rows: list[dict[str, str]], key: str) -> np.ndarray:
    out = []
    for r in rows:
        v = r.get(key, "")
        out.append(float(v) if v != "" else np.nan)
    return np.array(out, dtype=float)


def save_fig(fig: plt.Figure, stem: str) -> None:
    png_path = FIGS / f"{stem}.png"
    svg_path = FIGS / f"{stem}.svg"
    fig.savefig(png_path, dpi=300, bbox_inches="tight")
    fig.savefig(svg_path, bbox_inches="tight")
    plt.close(fig)
    print(f"  wrote {png_path.relative_to(ROOT)} and {svg_path.relative_to(ROOT)}")


def fig1_sowing_and_microclimate() -> None:
    pop = load_csv("gbc1_seed_population_120h.csv")
    x = col_float(pop, "x_mm")
    z = col_float(pop, "z_mm")
    comp = col_float(pop, "compartment")
    f_light = col_float(pop, "light_factor")
    gbl = col_float(pop, "gbl_mms")
    hyp = col_float(pop, "hypocotyl_mm")
    root = col_float(pop, "root_nytex_mm")
    cot_area = col_float(pop, "cot_area_mm2")
    nnd = col_float(pop, "nearest_neighbor_mm")

    fig, axes = plt.subplots(2, 2, figsize=(12.5, 9.2))

    # Panel A: 2D Top-Down GBC1 Sowing Plan & Crown Shading Map
    ax = axes[0, 0]
    for z0, z1, lbl in [(-30.5, -9.5, "Ch 1: B. rapa (32 seeds)"), (-7.5, 7.5, "Ch 2: A. thaliana (100 seeds)"), (9.5, 30.5, "Ch 3: B. rapa (32 seeds)")]:
        rect = plt.Rectangle((-11.0, z0), 32.3, z1 - z0, facecolor="#eef5fa", edgecolor="#446688", lw=1.2, zorder=1)
        ax.add_patch(rect)
        ax.text(20.5, 0.5 * (z0 + z1), lbl, ha="right", va="center", fontsize=8, color="#223344", fontweight="bold")
    # Baffles at Z = ±8.5 mm
    ax.axhline(-8.5, color="#334455", lw=2.2, ls="--")
    ax.axhline(8.5, color="#334455", lw=2.2, ls="--")
    # Ports 1, 2, 3
    ax.scatter([-15.49, -15.49, -15.49], [-21.59, 0.0, 21.59], s=[70, 110, 70], c=["#00aacc", "#ff8800", "#00aacc"], marker="s", zorder=5, label="Ports 1,3 (In) / Port 2 (Out)")
    sizes = np.clip(cot_area * 4.2 + 18, 22, 160)
    sc = ax.scatter(x, z, c=f_light, s=sizes, cmap="viridis", vmin=0.25, vmax=1.0, edgecolors="#112233", linewidths=0.5, zorder=4)
    cb = fig.colorbar(sc, ax=ax, pad=0.02)
    cb.set_label("Canopy Light Fraction $f_{\\mathrm{light}}$")
    ax.set_xlim(-18.5, 23.5)
    ax.set_ylim(-33.5, 33.5)
    ax.set_xlabel("Chamber X (mm, Manifold at X = -15.5 mm)")
    ax.set_ylabel("Chamber Z (mm, Baffles at Z = ±8.5 mm)")
    ax.set_title("A. GBC1 164-Seed Sowing Layout & Crown Light Interception (120 h)")

    # Panel B: Spatial Profile of Boundary-Layer Conductance g_bl along Z
    ax = axes[0, 1]
    for cid, col, lbl in [(1, "#2ca02c", "Ch 1: B. rapa (47.2/dm²)"), (2, "#0088cc", "Ch 2: A. thaliana (206.4/dm²)"), (3, "#ff7f0e", "Ch 3: B. rapa (47.2/dm²)")]:
        m = comp == cid
        ax.scatter(z[m], gbl[m], c=col, s=28, alpha=0.82, label=lbl, edgecolors="none")
    ax.axvline(-8.5, color="#445566", ls="--", lw=1.0)
    ax.axvline(8.5, color="#445566", ls="--", lw=1.0)
    ax.set_xlabel("Longitudinal Position Z (mm)")
    ax.set_ylabel("Leaf Boundary-Layer Conductance $g_{bl}$ (mm/s)")
    ax.set_title("B. Push-Mode Dip-and-Converge CFD Conductance Profile")
    ax.legend(loc="upper right")

    # Panel C: Light Transmittance vs Nearest-Neighbor Crown Spacing
    ax = axes[1, 0]
    for cid, col, lbl in [(1, "#2ca02c", "Ch 1: B. rapa"), (2, "#0088cc", "Ch 2: A. thaliana (Central)"), (3, "#ff7f0e", "Ch 3: B. rapa")]:
        m = comp == cid
        ax.scatter(nnd[m], f_light[m], c=col, s=30, alpha=0.82, label=lbl)
    ax.set_xlabel("Nearest-Neighbor Crown Distance (mm)")
    ax.set_ylabel("Local Light Transmittance $f_{\\mathrm{light}}$")
    ax.set_title("C. Neighbor Spacing vs. Foliar Shading Intensity")
    ax.legend(loc="lower right")

    # Panel D: Longitudinal Z-Y Cross Section (Shoots above Nytex, Tangential Roots on Nytex)
    ax = axes[1, 1]
    ax.axhspan(7.62, 14.62, color="#cce6f4", alpha=0.65, label="Phenolic Foam (Y = 7.62–14.62 mm)")
    ax.axhline(14.77, color="#112233", lw=2.2, label="35 µm Nytex Root Barrier (Y = 14.77 mm)")
    ax.axhline(31.67, color="#aa3377", lw=1.4, ls=":", label="Chamber Ceiling / LED Array (Y = 31.67 mm)")
    for i in range(len(z)):
        col = "#0088cc" if comp[i] == 2 else "#2ca02c"
        # Shoot rising from Y = 14.77 mm
        ax.plot([z[i], z[i]], [14.77, 14.77 + hyp[i]], color=col, lw=1.1, alpha=0.65)
        # Tangential root deflected along the Nytex surface at Y = 14.77 mm
        r_vis = min(3.5, root[i] * 0.15)
        ax.plot([z[i] - r_vis, z[i]], [14.82, 14.82], color="#b87333", lw=1.0, alpha=0.55)
    ax.axvline(-8.5, color="#334455", lw=1.8, ls="--")
    ax.axvline(8.5, color="#334455", lw=1.8, ls="--")
    ax.set_xlim(-33, 33)
    ax.set_ylim(6.0, 33.5)
    ax.set_xlabel("Chamber Z Coordinate (mm)")
    ax.set_ylabel("Chamber Vertical Y Coordinate (mm)")
    ax.set_title("D. Longitudinal Z–Y Profile: 100% Root Exclusion Above 35 µm Nytex")
    ax.legend(loc="lower right", fontsize=7.5)

    fig.suptitle("LEAF GBC1 164-Seed Community Digital Twin: Spatial Architecture & Microclimate (Day 5 / 120 h)", fontsize=12.5, fontweight="bold", y=1.01)
    fig.tight_layout()
    save_fig(fig, "fig1_gbc1_sowing_and_microclimate")


def fig2_germination_and_morphometrics() -> None:
    ts_nom = load_csv("gbc1_community_timeseries_lunar_push_nominal.csv")
    ts_1g = load_csv("gbc1_community_timeseries_earth_1g_push.csv")
    ts_0g = load_csv("gbc1_community_timeseries_iss_0g_push.csv")
    ts_dry = load_csv("gbc1_community_timeseries_moisture_deficit_40pct.csv")
    ts_stag = load_csv("gbc1_community_timeseries_stagnant_0g_fault.csv")
    pop = load_csv("gbc1_seed_population_120h.csv")

    t = col_float(ts_nom, "t_h")
    fig, axes = plt.subplots(2, 2, figsize=(12.5, 8.8))

    # Panel A: Germination curves G(t)
    ax = axes[0, 0]
    ax.plot(t, col_float(ts_nom, "ch2_germ_pct"), color="#0088cc", lw=2.0, label="Ch 2 Arabidopsis (Lunar 0.166g, 100% Fill)")
    ax.plot(t, col_float(ts_nom, "ch1_germ_pct"), color="#2ca02c", lw=2.0, ls="--", label="Ch 1/3 B. rapa (Lunar 0.166g, 100% Fill)")
    ax.plot(t, col_float(ts_dry, "ch2_germ_pct"), color="#d95f02", lw=1.8, label="Ch 2 Arabidopsis (40% Foam Fill Deficit)")
    ax.plot(t, col_float(ts_stag, "ch2_germ_pct"), color="#7570b3", lw=1.6, ls=":", label="Ch 2 Arabidopsis (Stagnant Pump-Off 0g)")
    ax.set_xlim(0, 120)
    ax.set_ylim(0, 105)
    ax.set_xlabel("Time After Imbibition (h)")
    ax.set_ylabel("Cumulative Germination (%)")
    ax.set_title("A. Compartment Germination Kinetics G(t)")
    ax.legend(loc="lower right")

    # Panel B: Hydrotime ψ_b offset vs Endosperm Rupture Time
    ax = axes[0, 1]
    psi_off = col_float(pop, "psi_base_offset_mpa")
    t_rup = col_float(pop, "endosperm_rupture_h")
    comp = col_float(pop, "compartment")
    m_ath = (comp == 2) & ~np.isnan(t_rup)
    m_bra = (comp != 2) & ~np.isnan(t_rup)
    ax.scatter(psi_off[m_ath], t_rup[m_ath], c="#0088cc", s=28, alpha=0.85, label="Ch 2 A. thaliana (n=100)")
    ax.scatter(psi_off[m_bra], t_rup[m_bra], c="#2ca02c", s=34, marker="^", alpha=0.85, label="Ch 1 & 3 B. rapa (n=64)")
    ax.set_xlabel("Seed Hydrotime Base Water-Potential Offset $\\Delta\\psi_b$ (MPa)")
    ax.set_ylabel("Endosperm Rupture Time $t_{\\mathrm{rupture}}$ (h)")
    ax.set_title("B. Single-Seed Hydrotime Spread Across 164-Seed Cohort")
    ax.legend(loc="upper left")

    # Panel C: Hypocotyl Elongation Across Gravity & Species
    ax = axes[1, 0]
    ax.plot(t, col_float(ts_nom, "ch1_hyp_mm"), color="#2ca02c", lw=2.0, label="Ch 1/3 B. rapa (Lunar 0.166g)")
    ax.plot(t, col_float(ts_nom, "ch2_hyp_mm"), color="#0088cc", lw=2.0, label="Ch 2 A. thaliana (Lunar 0.166g)")
    ax.plot(t, col_float(ts_1g, "ch2_hyp_mm"), color="#004488", lw=1.6, ls="--", label="Ch 2 A. thaliana (Earth 1.0g)")
    ax.plot(t, col_float(ts_0g, "ch2_hyp_mm"), color="#e7298a", lw=1.6, ls=":", label="Ch 2 A. thaliana (ISS 0.0g)")
    ax.set_xlim(0, 120)
    ax.set_xlabel("Time After Imbibition (h)")
    ax.set_ylabel("Mean Hypocotyl Length (mm)")
    ax.set_title("C. Shoot Elongation Trajectories by Compartment & Gravity")
    ax.legend(loc="upper left")

    # Panel D: Tangential Root Crawl on 35 µm Nytex Screen
    ax = axes[1, 1]
    ax.plot(t, col_float(ts_nom, "ch1_root_mm"), color="#2ca02c", lw=2.0, label="Ch 1/3 B. rapa Root (Lunar 0.166g Push)")
    ax.plot(t, col_float(ts_nom, "ch2_root_mm"), color="#0088cc", lw=2.0, label="Ch 2 A. thaliana Root (Lunar 0.166g Push)")
    ax.plot(t, col_float(ts_stag, "ch2_root_mm"), color="#d95f02", lw=1.8, ls="--", label="Ch 2 A. thaliana Root (Stagnant Pump-Off)")
    ax.plot(t, col_float(ts_dry, "ch2_root_mm"), color="#7570b3", lw=1.8, ls=":", label="Ch 2 A. thaliana Root (40% Foam Fill)")
    ax.set_xlim(0, 120)
    ax.set_xlabel("Time After Imbibition (h)")
    ax.set_ylabel("Tangential Root Length on Nytex (mm)")
    ax.set_title("D. Root Growth Along 35 µm Nytex Surface (Zero Foam Penetration)")
    ax.legend(loc="upper left")

    fig.suptitle("LEAF GBC1 Community Digital Twin: Germination Kinetics & Organ Morphometrics", fontsize=12.5, fontweight="bold", y=1.01)
    fig.tight_layout()
    save_fig(fig, "fig2_community_germination_and_morphometrics")


def fig3_sowing_density_sweep() -> None:
    sw = load_csv("gbc1_sowing_density_sweep.csv")
    mult = col_float(sw, "density_multiplier")
    seeds = col_float(sw, "total_seeds")

    fig, axes = plt.subplots(2, 2, figsize=(12.2, 8.6))

    # Panel A: LAI & Canopy Closure vs Sowing Density
    ax = axes[0, 0]
    ax.plot(seeds, col_float(sw, "ch1_lai"), "o-", color="#2ca02c", lw=2.0, label="Ch 1/3 B. rapa LAI")
    ax.plot(seeds, col_float(sw, "ch2_lai"), "s-", color="#0088cc", lw=2.0, label="Ch 2 A. thaliana LAI")
    ax.plot(seeds, col_float(sw, "mean_canopy_cover_frac"), "^--", color="#ff7f0e", lw=1.8, label="Whole-Chamber Canopy Cover Frac")
    ax.axvline(164, color="#334455", ls=":", lw=1.4, label="Flight Plan (1.0× = 164 seeds)")
    ax.set_xlabel("Total Sown Seeds in GBC1 Chamber (0.25× to 2.0×)")
    ax.set_ylabel("Leaf Area Index (LAI) / Cover Fraction")
    ax.set_title("A. Canopy Closure & LAI vs. Sowing Density (120 h)")
    ax.legend(loc="upper left")

    # Panel B: Canopy Light Transmittance f_light vs Sowing Density
    ax = axes[0, 1]
    ax.plot(seeds, col_float(sw, "ch2_light_factor"), "s-", color="#0088cc", lw=2.0, label="Ch 2 A. thaliana Mean $f_{\\mathrm{light}}$")
    ax.plot(seeds, col_float(sw, "ch1_light_factor"), "o-", color="#2ca02c", lw=2.0, label="Ch 1/3 B. rapa Mean $f_{\\mathrm{light}}$")
    ax.axvline(164, color="#334455", ls=":", lw=1.4, label="Flight Plan (164 seeds)")
    ax.set_ylim(0.2, 1.05)
    ax.set_xlabel("Total Sown Seeds in GBC1 Chamber")
    ax.set_ylabel("Mean Canopy Light Fraction $f_{\\mathrm{light}}$")
    ax.set_title("B. Beer–Lambert Mutual Shading Across Sowing Densities")
    ax.legend(loc="lower left")

    # Panel C: Shade-Avoidance Hypocotyl Elongation & Lateral Lean Angle
    ax = axes[1, 0]
    ax2 = ax.twinx()
    l1 = ax.plot(seeds, col_float(sw, "ch2_hyp_mm"), "s-", color="#0088cc", lw=2.0, label="Ch 2 Ath Hypocotyl (mm)")
    l2 = ax2.plot(seeds, col_float(sw, "ch2_lean_deg"), "d--", color="#e7298a", lw=1.8, label="Ch 2 Phototropic Lean (°)")
    l3 = ax2.plot(seeds, col_float(sw, "ch1_lean_deg"), "^:", color="#2ca02c", lw=1.8, label="Ch 1/3 B. rapa Lean (°)")
    ax.axvline(164, color="#334455", ls=":", lw=1.4)
    ax.set_xlabel("Total Sown Seeds in GBC1 Chamber")
    ax.set_ylabel("Ch 2 Mean Hypocotyl Height (mm)", color="#0088cc")
    ax2.set_ylabel("Mean 3D Shoot Lean Angle (deg)", color="#e7298a")
    ax2.grid(False)
    lines = l1 + l2 + l3
    ax.legend(lines, [l.get_label() for l in lines], loc="upper left")
    ax.set_title("C. Shade-Avoidance Elongation & Phototropic Lean vs. Crowding")

    # Panel D: Headspace Ethylene & Within-Canopy g_bl vs Sowing Density
    ax = axes[1, 1]
    ax2 = ax.twinx()
    l1 = ax.plot(seeds, col_float(sw, "ch2_gbl_mms"), "s-", color="#0088cc", lw=2.0, label="Ch 2 $g_{bl}$ (mm/s)")
    l2 = ax.plot(seeds, col_float(sw, "ch1_gbl_mms"), "o-", color="#2ca02c", lw=2.0, label="Ch 1/3 $g_{bl}$ (mm/s)")
    l3 = ax2.plot(seeds, col_float(sw, "eth_hs_ppb"), "^--", color="#d95f02", lw=1.8, label="Headspace $\\mathrm{C_2H_4}$ (ppb)")
    ax.axvline(164, color="#334455", ls=":", lw=1.4)
    ax.set_xlabel("Total Sown Seeds in GBC1 Chamber")
    ax.set_ylabel("Boundary-Layer Conductance $g_{bl}$ (mm/s)")
    ax2.set_ylabel("Headspace Ethylene (ppb)", color="#d95f02")
    ax2.grid(False)
    lines = l1 + l2 + l3
    ax.legend(lines, [l.get_label() for l in lines], loc="center right")
    ax.set_title("D. Canopy Wind Attenuation ($g_{bl}$) & Ethylene vs. Density")
    _ = mult

    fig.suptitle("LEAF GBC1 Sowing Density Trade-Off Analysis (0.25× = 41 Seeds to 2.0× = 328 Seeds)", fontsize=12.5, fontweight="bold", y=1.01)
    fig.tight_layout()
    save_fig(fig, "fig3_sowing_density_crowding_sweep")


def fig4_headspace_and_cfd() -> None:
    ts_push = load_csv("gbc1_community_timeseries_lunar_push_nominal.csv")
    ts_pull = load_csv("gbc1_community_timeseries_lunar_pull_nominal.csv")
    ts_stag = load_csv("gbc1_community_timeseries_stagnant_0g_fault.csv")
    ts_15x = load_csv("gbc1_community_timeseries_lunar_crowded_15x.csv")

    t = col_float(ts_push, "t_h")
    fig, axes = plt.subplots(2, 2, figsize=(12.4, 8.8))

    # Panel A: Headspace & Radicle Tip O2
    ax = axes[0, 0]
    ax.plot(t, col_float(ts_push, "o2_hs_kpa"), color="#112233", lw=2.0, label="Headspace $\\mathrm{O_2}$ (25 mL/min Push)")
    ax.plot(t, col_float(ts_push, "ch2_o2_tip_kpa"), color="#0088cc", lw=2.0, label="Ch 2 Radicle Tip $\\mathrm{O_2}$ (25 mL/min Push)")
    ax.plot(t, col_float(ts_stag, "o2_hs_kpa"), color="#d95f02", lw=1.8, ls="--", label="Headspace $\\mathrm{O_2}$ (Stagnant Pump-Off)")
    ax.plot(t, col_float(ts_stag, "ch2_o2_tip_kpa"), color="#e7298a", lw=1.8, ls=":", label="Ch 2 Radicle Tip $\\mathrm{O_2}$ (Stagnant Pump-Off)")
    ax.set_xlim(0, 120)
    ax.set_xlabel("Time After Imbibition (h)")
    ax.set_ylabel("Oxygen Partial Pressure (kPa)")
    ax.set_title("A. Shared 54.05 mL Headspace & Cellular Tip $\\mathrm{O_2}$")
    ax.legend(loc="lower right")

    # Panel B: Headspace CO2 Dynamics
    ax = axes[0, 1]
    ax.plot(t, col_float(ts_push, "co2_hs_ppm"), color="#0088cc", lw=2.0, label="Lunar Push 1.0× (164 seeds)")
    ax.plot(t, col_float(ts_15x, "co2_hs_ppm"), color="#2ca02c", lw=1.8, ls="--", label="Lunar Push 1.5× (246 seeds)")
    ax.plot(t, np.clip(col_float(ts_stag, "co2_hs_ppm"), 0, 2500), color="#d95f02", lw=1.8, ls=":", label="Stagnant Pump-Off (clipped at 2500 ppm)")
    ax.set_xlim(0, 120)
    ax.set_xlabel("Time After Imbibition (h)")
    ax.set_ylabel("Headspace $\\mathrm{CO_2}$ (ppm)")
    ax.set_title("B. Respiratory $\\mathrm{CO_2}$ Release & Diurnal FvCB Assimilation")
    ax.legend(loc="lower right", bbox_to_anchor=(0.98, 0.08))

    # Panel C: Ethylene Accumulation (Active vs Stagnant)
    ax = axes[1, 0]
    ax.plot(t, col_float(ts_push, "eth_hs_ppb"), color="#0088cc", lw=2.0, label="Active 25 mL/min Push (1.0× = 164 seeds)")
    ax.plot(t, col_float(ts_15x, "eth_hs_ppb"), color="#2ca02c", lw=1.8, ls="--", label="Active 25 mL/min Push (1.5× = 246 seeds)")
    ax.plot(t, col_float(ts_stag, "eth_hs_ppb"), color="#d95f02", lw=2.0, label="Stagnant Sealed Fault ($Q=0$ mL/min)")
    ax.axhline(20.0, color="#aa2222", ls=":", lw=1.2, label="20 ppb Triple-Response Threshold")
    ax.set_yscale("log")
    ax.set_xlim(0, 120)
    ax.set_ylim(0.1, 500)
    ax.set_xlabel("Time After Imbibition (h)")
    ax.set_ylabel("Headspace Ethylene $\\mathrm{C_2H_4}$ (ppb, log scale)")
    ax.set_title("C. Headspace Ethylene Accumulation & Scrubber Control")
    ax.legend(loc="center right")

    # Panel D: Push vs Pull Conductance g_bl & Dew-Point Margin
    ax = axes[1, 1]
    ax.plot(t, col_float(ts_push, "ch2_gbl_mms"), color="#0088cc", lw=2.0, label="Ch 2 $g_{bl}$ — Push Mode (Dip-and-Converge)")
    ax.plot(t, col_float(ts_pull, "ch2_gbl_mms"), color="#7570b3", lw=2.0, ls="--", label="Ch 2 $g_{bl}$ — Pull Mode (Central Inlet)")
    ax.plot(t, col_float(ts_push, "dew_margin_c"), color="#ff7f0e", lw=1.8, ls=":", label="Lid Dew-Point Safety Margin $\\Delta T$ (°C)")
    ax.set_xlim(0, 120)
    ax.set_xlabel("Time After Imbibition (h)")
    ax.set_ylabel("$g_{bl}$ (mm/s) or Dew Margin $\\Delta T$ (°C)")
    ax.set_title("D. Push vs. Pull Manifold Channelling & Lid Condensation Margin")
    ax.legend(loc="center right")

    fig.suptitle("LEAF GBC1 Shared Headspace Mass Balance & Push/Pull CFD Coupling", fontsize=12.5, fontweight="bold", y=1.01)
    fig.tight_layout()
    save_fig(fig, "fig4_headspace_gas_and_push_pull_cfd")


def fig5_scenario_comparison_matrix() -> None:
    rows = load_csv("gbc1_community_scenario_summary.csv")
    labels = [r["scenario_label"].replace(" (1.0x = 164 seeds)", "") for r in rows]
    y_pos = np.arange(len(labels))

    germ = col_float(rows, "germination_pct_all")
    ch2_hyp = col_float(rows, "ch2_hyp_mm")
    ch1_hyp = col_float(rows, "ch1_hyp_mm")
    ch2_light = col_float(rows, "ch2_light_factor")
    ch2_gbl = col_float(rows, "ch2_gbl_mms")
    eth = col_float(rows, "eth_hs_ppb")

    fig, axes = plt.subplots(1, 3, figsize=(13.5, 5.2), sharey=True)

    # Panel A: Germination % & Canopy Light Factor
    ax = axes[0]
    ax.barh(y_pos - 0.18, germ, height=0.34, color="#0088cc", label="Total Germination (%)")
    ax.barh(y_pos + 0.18, ch2_light * 100, height=0.34, color="#5ec962", label="Ch 2 Light $f_{\\mathrm{light}}$ (%)")
    ax.set_yticks(y_pos)
    ax.set_yticklabels(labels)
    ax.invert_yaxis()
    ax.set_xlabel("Percentage (%)")
    ax.set_title("A. Germination & Light Access")
    ax.legend(loc="lower left")

    # Panel B: Mean Hypocotyl Height (Ch 2 Ath vs Ch 1/3 B. rapa)
    ax = axes[1]
    ax.barh(y_pos - 0.18, ch1_hyp, height=0.34, color="#2ca02c", label="Ch 1/3 B. rapa Shoot (mm)")
    ax.barh(y_pos + 0.18, ch2_hyp, height=0.34, color="#0088cc", label="Ch 2 A. thaliana Shoot (mm)")
    ax.set_xlabel("Mean Hypocotyl Length at 120 h (mm)")
    ax.set_title("B. Compartment Shoot Elongation")
    ax.legend(loc="lower right")

    # Panel C: Ch 2 Conductance g_bl & Headspace Ethylene
    ax = axes[2]
    ax.barh(y_pos - 0.18, ch2_gbl, height=0.34, color="#0088cc", label="Ch 2 $g_{bl}$ (mm/s)")
    ax.barh(y_pos + 0.18, np.minimum(eth, 25.0), height=0.34, color="#d95f02", label="Headspace $\\mathrm{C_2H_4}$ (ppb, cap 25)")
    ax.set_xlabel("$g_{bl}$ (mm/s) / Ethylene (ppb)")
    ax.set_title("C. Ventilation & Ethylene Control")
    ax.legend(loc="lower right")

    fig.suptitle("LEAF GBC1 164-Seed Community Digital Twin: 8-Scenario Performance Matrix at 120 h", fontsize=12.5, fontweight="bold", y=1.02)
    fig.tight_layout()
    save_fig(fig, "fig5_scenario_comparison_matrix")


if __name__ == "__main__":
    print("=== Generating GBC1 Community Publication Figures ===")
    fig1_sowing_and_microclimate()
    fig2_germination_and_morphometrics()
    fig3_sowing_density_sweep()
    fig4_headspace_and_cfd()
    fig5_scenario_comparison_matrix()
    print("=== All 5 Figures Generated ===")
