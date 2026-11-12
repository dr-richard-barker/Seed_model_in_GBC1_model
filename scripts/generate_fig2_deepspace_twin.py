#!/usr/bin/env python3
"""Generate Figure 2: Community Germination Kinetics, 3D Cellular Digital Twin Progression, and Organ Morphometrics.

Incorporates authentic 3D cellular developmental models from `deepspace-seed-twin`
(0 h dry seed, 24 h testa rupture, 32 h endosperm rupture, 72 h Nytex contact, 120 h mature seedling)
alongside human-readable, de-cluttered community kinetics curves.

Outputs:
  manuscript/fig2_community_germination_and_morphometrics.png (300 DPI)
  manuscript/fig2_community_germination_and_morphometrics.pdf
  app/public/fig2_community_germination_and_morphometrics.png
  figures/fig2_community_germination_and_morphometrics.png
  figures/fig2_community_germination_and_morphometrics.svg
"""
from __future__ import annotations
import csv
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import Rectangle
from matplotlib.transforms import Affine2D
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
TABLES = ROOT / "results" / "tables"
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

TISSUE_HEX = [
    "#7fc97f",  # 0: epidermis (soft green)
    "#e6c86e",  # 1: cortex (golden yellow)
    "#c08552",  # 2: endodermis (warm ochre)
    "#5b8cc9",  # 3: stele (steel blue)
    "#d98cb3",  # 4: quiescent center / columella (pink)
    "#4caf50",  # 5: mesophyll / cotyledon (deep leaf green)
    "#9bd49b",  # 6: cotyledon epidermis (pale leaf green)
    "#e8dcc0",  # 7: endosperm (cream)
]
TISSUE_NAMES = [
    "Epidermis", "Cortex", "Endodermis", "Stele",
    "QC / Columella", "Cot. Mesophyll", "Cot. Epidermis", "Endosperm"
]

def load_csv(name: str) -> list[dict[str, str]]:
    with (TABLES / name).open(encoding="utf-8") as f:
        return list(csv.DictReader(f))

def col_float(rows: list[dict[str, str]], key: str) -> np.ndarray:
    out = []
    for r in rows:
        v = r.get(key, "")
        out.append(float(v) if v != "" and v is not None else np.nan)
    return np.array(out, dtype=float)

def f_val(x: str | None) -> float:
    return float(x) if x not in ("", None) else np.nan

def draw_cellular_midplane(ax, cells: list[dict[str, str]], mode: str = "tissue", show_nytex: bool = False, title: str = ""):
    """Render 3D cellular midplane cross-section directly from deepspace-seed-twin cell coordinates."""
    cmap = matplotlib.colormaps["viridis"]
    sel = [r for r in cells if abs(f_val(r["z"])) <= max(f_val(r["wid"]), 8) * 0.6]
    
    xs, ys = [], []
    for r in sel:
        x, y = f_val(r["x"]), f_val(r["y"])
        L, D = f_val(r["len"]) * 0.88, f_val(r["dep"]) * 0.88
        a = f_val(r["angle_rad"])
        xs.append(x)
        ys.append(y)
        
        if mode == "tissue":
            col = TISSUE_HEX[int(r["tissue"])]
        else:
            col = TISSUE_HEX[7] if r.get("region") == "4" else cmap(min(1.0, max(0.0, f_val(r.get("log2_expansion", "0")) / 0.4)))
            
        rect = Rectangle((-L / 2, -D / 2), L, D, facecolor=col, edgecolor="none", zorder=3)
        rect.set_transform(Affine2D().rotate(a).translate(x, y) + ax.transData)
        ax.add_patch(rect)
        
    pad = 40
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    
    ax.set_xlim(min_x - pad, max_x + pad)
    ax.set_ylim(min_y - pad, max_y + pad)
    ax.set_aspect("equal")
    ax.axis("off")
    
    # Scale bar
    span = max_x - min_x
    bar = 100 if span < 1200 else 1000
    x0 = min_x
    y0 = min_y - pad * 0.5
    ax.plot([x0, x0 + bar], [y0, y0], color="#222222", lw=1.5, zorder=5)
    ax.text(x0 + bar * 0.5, y0 - pad * 0.25, f"{bar} µm" if bar < 1000 else "1 mm",
            fontsize=5.5, va="top", ha="center", weight="bold")
    
    if show_nytex:
        # Draw Nytex barrier line at the bottom
        ax.axhline(min_y + 10, color="#2980b9", lw=1.5, ls="--", zorder=2)
        ax.text(max_x, min_y + 15, "35 µm Nytex", color="#2980b9", fontsize=5.0, ha="right", weight="bold")
        
    if title:
        ax.set_title(title, fontsize=7.2, weight="bold", pad=4)

def main():
    fig = plt.figure(figsize=(7.4, 7.2))
    
    # GridSpec:
    # Row 0: 5 panels (a, b, c, d, e) for cellular digital twin stages + tissue color key
    # Row 1 & 2: 2x2 grid (f, g, h, i) for kinetics and biometrics
    gs = fig.add_gridspec(3, 4, height_ratios=[1.1, 1.0, 1.0], hspace=0.38, wspace=0.30)
    
    # -------------------------------------------------------------
    # TOP TIER: 3D Cellular Digital Twin Developmental Progression (from deepspace-seed-twin)
    # -------------------------------------------------------------
    # 5 sub-grids in top row: 4 columns split into 5 slots
    gs_top = gs[0, :].subgridspec(1, 5, wspace=0.15)
    
    stages = [
        ("layout_ground_light_0h.csv", "a  0 h: Imbibition\n(Dry Seed)", "expansion", False),
        ("layout_ground_light_24h.csv", "b  24 h: Testa\nRupture", "expansion", False),
        ("layout_ground_light_32h.csv", "c  32 h: Endosperm\nRupture", "expansion", False),
        ("layout_ground_light_72h.csv", "d  72 h: Nytex\nTangential Turn", "tissue", True),
        ("layout_ground_light_120h.csv", "e  120 h: Mature\nSeedling Canopy", "tissue", True),
    ]
    
    for idx, (csv_name, title, mode, show_nytex) in enumerate(stages):
        ax_cell = fig.add_subplot(gs_top[0, idx])
        if (TABLES / csv_name).exists():
            cells = load_csv(csv_name)
            draw_cellular_midplane(ax_cell, cells, mode=mode, show_nytex=show_nytex, title=title)
        else:
            ax_cell.text(0.5, 0.5, f"Missing\n{csv_name}", ha="center", va="center", fontsize=7)
            ax_cell.axis("off")
            
    # Add tissue colorbar / legend banner across top row
    fig.text(0.5, 0.985, "3D Cellular Digital Twin Developmental Progression (deepspace-seed-twin mid-plane cellular anatomy)",
             ha="center", va="top", fontsize=8.2, weight="bold", color="#112233")
    fig.text(0.5, 0.965, "Panels a–c: Lockhart volume expansion (viridis 0–0.4); Panels d–e: Cellular tissue fate map. Radicle deflecting along 35 µm Nytex.",
             ha="center", va="top", fontsize=6.2, style="italic", color="#556677")

    # -------------------------------------------------------------
    # BOTTOM TIER: Quantitative Community Kinetics & Biometric Trajectories
    # -------------------------------------------------------------
    ts_nom = load_csv("gbc1_community_timeseries_lunar_push_nominal.csv")
    ts_1g = load_csv("gbc1_community_timeseries_earth_1g_push.csv")
    ts_0g = load_csv("gbc1_community_timeseries_iss_0g_push.csv")
    ts_dry = load_csv("gbc1_community_timeseries_moisture_deficit_40pct.csv")
    ts_stag = load_csv("gbc1_community_timeseries_stagnant_0g_fault.csv")
    pop = load_csv("gbc1_seed_population_120h.csv")
    t = col_float(ts_nom, "t_h")

    # Panel f: Germination curves G(t)
    ax_f = fig.add_subplot(gs[1, :2])
    ax_f.set_title("f  Compartment Germination Kinetics G(t)", loc="left", weight="bold")
    ax_f.plot(t, col_float(ts_nom, "ch1_germ_pct"), color="#2ca02c", lw=1.8, label="Ch 1/3 B. rapa (Lunar 0.166g)")
    ax_f.plot(t, col_float(ts_nom, "ch2_germ_pct"), color="#0088cc", lw=1.8, label="Ch 2 A. thaliana (Lunar 0.166g)")
    ax_f.plot(t, col_float(ts_dry, "ch2_germ_pct"), color="#d95f02", lw=1.5, ls="--", label="Ch 2 Ath (40% Foam Deficit)")
    ax_f.plot(t, col_float(ts_stag, "ch2_germ_pct"), color="#7570b3", lw=1.4, ls=":", label="Ch 2 Ath (Stagnant Pump-Off)")
    
    # Milestone callouts
    ax_f.axvline(20.2, color="#2ca02c", ls=":", lw=0.8, alpha=0.7)
    ax_f.text(21.0, 52, "B. rapa\nt₅₀ = 20.2 h", fontsize=5.8, color="#2ca02c", weight="bold")
    ax_f.axvline(32.5, color="#0088cc", ls=":", lw=0.8, alpha=0.7)
    ax_f.text(33.5, 25, "A. thaliana\nt₅₀ = 32.5 h", fontsize=5.8, color="#0088cc", weight="bold")
    
    ax_f.set_xlim(0, 120)
    ax_f.set_ylim(0, 105)
    ax_f.set_xlabel("Time After Imbibition (h)")
    ax_f.set_ylabel("Cumulative Germination (%)")
    ax_f.legend(loc="lower right", frameon=False, fontsize=6.2)

    # Panel g: Hydrotime base water-potential offset vs rupture time
    ax_g = fig.add_subplot(gs[1, 2:])
    ax_g.set_title("g  Hydrotime ψ_b Spread & Rupture Concordance", loc="left", weight="bold")
    psi_off = col_float(pop, "psi_base_offset_mpa")
    t_rup = col_float(pop, "endosperm_rupture_h")
    comp = col_float(pop, "compartment")
    
    m_ath = (comp == 2) & ~np.isnan(t_rup)
    m_bra = (comp != 2) & ~np.isnan(t_rup)
    
    ax_g.scatter(psi_off[m_ath], t_rup[m_ath], c="#0088cc", s=22, alpha=0.8, edgecolors="none", label="Ch 2 A. thaliana (n=100)")
    ax_g.scatter(psi_off[m_bra], t_rup[m_bra], c="#2ca02c", s=28, marker="^", alpha=0.8, edgecolors="none", label="Ch 1/3 B. rapa (n=64)")
    
    # Concordance annotation
    ax_g.text(0.05, 0.92, "Concordance = 100.0% (4314/4314 pairs)\nLinear hydrotime ordering (Gate 4)",
              transform=ax_g.transAxes, fontsize=5.8, va="top",
              bbox=dict(boxstyle="round,pad=0.3", fc="#f0f7fb", ec="#cce0f0", lw=0.8))
    
    ax_g.set_xlabel("Base Water-Potential Offset Δψ_b (MPa)")
    ax_g.set_ylabel("Endosperm Rupture Time (h)")
    ax_g.legend(loc="lower right", frameon=False, fontsize=6.2)

    # Panel h: Hypocotyl Elongation Trajectories
    ax_h = fig.add_subplot(gs[2, :2])
    ax_h.set_title("h  Hypocotyl Axial Elongation Across Gravity", loc="left", weight="bold")
    ax_h.plot(t, col_float(ts_nom, "ch1_hyp_mm"), color="#2ca02c", lw=1.8, label="Ch 1/3 B. rapa (Lunar 0.166g)")
    ax_h.plot(t, col_float(ts_nom, "ch2_hyp_mm"), color="#0088cc", lw=1.8, label="Ch 2 A. thaliana (Lunar 0.166g)")
    ax_h.plot(t, col_float(ts_1g, "ch2_hyp_mm"), color="#004488", lw=1.5, ls="--", label="Ch 2 A. thaliana (Earth 1.0g)")
    ax_h.plot(t, col_float(ts_0g, "ch2_hyp_mm"), color="#e7298a", lw=1.5, ls=":", label="Ch 2 A. thaliana (ISS 0.0g)")
    
    ax_h.set_xlim(0, 120)
    ax_h.set_xlabel("Time After Imbibition (h)")
    ax_h.set_ylabel("Mean Hypocotyl Length (mm)")
    ax_h.legend(loc="upper left", frameon=False, fontsize=6.2)

    # Panel i: Tangential Root Crawling on 35 µm Nytex
    ax_i = fig.add_subplot(gs[2, 2:])
    ax_i.set_title("i  Tangential Root Crawling on 35 µm Nytex Screen", loc="left", weight="bold")
    ax_i.plot(t, col_float(ts_nom, "ch1_root_mm"), color="#2ca02c", lw=1.8, label="Ch 1/3 B. rapa (Lunar 0.166g Push)")
    ax_i.plot(t, col_float(ts_nom, "ch2_root_mm"), color="#0088cc", lw=1.8, label="Ch 2 A. thaliana (Lunar 0.166g Push)")
    ax_i.plot(t, col_float(ts_stag, "ch2_root_mm"), color="#d95f02", lw=1.5, ls="--", label="Ch 2 Ath (Stagnant Pump-Off)")
    ax_i.plot(t, col_float(ts_dry, "ch2_root_mm"), color="#7570b3", lw=1.5, ls=":", label="Ch 2 Ath (40% Foam Fill)")
    
    # 100% root exclusion annotation
    ax_i.text(0.05, 0.92, "100% Root Exclusion (Y >= 14.77 mm)\nFixative ΔP = 1.75 kPa << 8.04 kPa",
              transform=ax_i.transAxes, fontsize=5.8, va="top",
              bbox=dict(boxstyle="round,pad=0.3", fc="#eef9f2", ec="#bfe6cc", lw=0.8))
    
    ax_i.set_xlim(0, 120)
    ax_i.set_xlabel("Time After Imbibition (h)")
    ax_i.set_ylabel("Tangential Root Length on Nytex (mm)")
    ax_i.legend(loc="center left", bbox_to_anchor=(0.02, 0.55), frameon=False, fontsize=6.2)

    fig.subplots_adjust(top=0.92, bottom=0.07, left=0.08, right=0.96, hspace=0.38, wspace=0.28)

    # Save outputs
    out_png = OUT_MANUSCRIPT / "fig2_community_germination_and_morphometrics.png"
    out_pdf = OUT_MANUSCRIPT / "fig2_community_germination_and_morphometrics.pdf"
    out_app = OUT_APP / "fig2_community_germination_and_morphometrics.png"
    out_fig_png = OUT_FIGURES / "fig2_community_germination_and_morphometrics.png"
    out_fig_svg = OUT_FIGURES / "fig2_community_germination_and_morphometrics.svg"
    
    fig.savefig(out_png, dpi=300)
    fig.savefig(out_pdf)
    fig.savefig(out_app, dpi=300)
    fig.savefig(out_fig_png, dpi=300)
    fig.savefig(out_fig_svg)
    plt.close(fig)
    print(f"Generated Figure 2 successfully:\n  {out_png}\n  {out_pdf}\n  {out_app}\n  {out_fig_png}")

if __name__ == "__main__":
    main()
