import { useState } from "react";

export type PortalView = "overview" | "simulator" | "compare" | "paper" | "tutorial";

interface FigureItem {
  id: string;
  title: string;
  src: string;
  caption: string;
}

const MAIN_FIGURES: FigureItem[] = [
  {
    id: "fig1",
    title: "Fig. 1 | Flight Sowing Layout, Foam Water Content & 3D CFD Airflow",
    src: "./fig1_gbc1_sowing_and_microclimate.png",
    caption:
      "CAD geometry of the 3-compartment GBC1 chamber (48 × 33.67 × 68 mm) with 164 seeds (32 B. rapa + 100 A. thaliana + 32 B. rapa) on the 35 µm Nytex screen (Y = 14.77 mm), van Genuchten water content under 0.166g, and Push mode dip-and-converge CFD jet.",
  },
  {
    id: "fig2",
    title: "Fig. 2 | 3D Cellular Seedling Phenotypic Variation Atlas",
    src: "./fig2_seed_phenotypic_variation.png",
    caption:
      "Predicted 3D cellular seedling morphological plasticity across Nytex barrier deflection (ΔP = 1.75 kPa ≪ 8.04 kPa bubble point), gravity regimes (1.0g vs. 0.166g vs. 0g), atmospheric hypoxia/ethylene triple response, forced vs. stagnant airflow, cosmic radiation DSB checkpoint arrest, and shade-avoidance phototropic lean.",
  },
  {
    id: "fig3",
    title: "Fig. 3 | 3D Cellular Developmental Progression & Germination Kinetics",
    src: "./fig2_community_germination_and_morphometrics.png",
    caption:
      "Mid-plane 3D cellular progression (0 h dry seed to 120 h seedling), compartment germination curves (t50 = 20.2 h B. rapa vs. 32.5 h A. thaliana), 100% ψ_b hydrotime concordance (Gate 4), gravity-dependent hypocotyl trajectories, and tangential root crawling along Nytex (Gate 3).",
  },
  {
    id: "fig4",
    title: "Fig. 4 | Sowing Density Sweep (0.25× to 2.0×) & Shade Avoidance",
    src: "./fig3_sowing_density_crowding_sweep.png",
    caption:
      "Monotonic scaling of canopy Leaf Area Index (LAI), Beer–Lambert light extinction (f_light = 0.872 at 1.0×), SAS hypocotyl elongation boost (2.13 mm → 2.43 mm), and 3D lateral phototropic shoot lean away from neighbor crowns (Gate 5).",
  },
  {
    id: "fig5",
    title: "Fig. 5 | Headspace Gas Exchange, Psychrometrics & 3D Streamlines",
    src: "./fig4_headspace_gas_and_push_pull_cfd.png",
    caption:
      "Coupled 54.05 mL headspace O2/CO2 dynamics with FvCB canopy assimilation, trace ethylene scrubbing (< 0.1 ppb active vs. 136.5 ppb stagnant fault), optical lid dew-point safety margin (+2.8 °C), and Push vs. Pull CFD streamline topologies.",
  },
  {
    id: "fig6",
    title: "Fig. 6 | 8-Scenario Mission & Hardware Fault Comparison Matrix",
    src: "./fig5_scenario_comparison_matrix.png",
    caption:
      "Quantitative comparison heatmap normalized against terrestrial 1g control across nominal lunar flight, Pull mode, microgravity 0g, sparse/crowded sowing, stagnant pump-off fault, and 40% foam moisture deficit.",
  },
  {
    id: "fig7",
    title: "Fig. 7 | 3D Chamber Digital Twin: Gravity & Flow Rate Lessons",
    src: "./fig7_chamber_gravity_flow_morphology.png",
    caption:
      "Isometric 3D chamber visualization demonstrating how gravity level (1.0g vs. 0.166g vs. 0g) governs root search dispersion and how active Push sweep (Q = 25 mL/min) prevents boundary-layer ethylene intoxication.",
  },
];

const SUPP_FIGURES: FigureItem[] = [
  {
    id: "figS1",
    title: "Fig. S1 | Gravity Scaling & Statolith Sedimentation Morphometrics",
    src: "./figS1_gravity_scaling_statolith_phenotypes.png",
    caption: "Full-page montage comparing 1.0g terrestrial, 0.166g lunar, and 0.0g microgravity phenotypes.",
  },
  {
    id: "figS2",
    title: "Fig. S2 | Airflow CFD & Ethylene Triple Response Diagnostics",
    src: "./figS2_airflow_cfd_ethylene_triple_response.png",
    caption: "Push vs. Pull vs. Stagnant (Q = 0) pump-off fault boundary-layer and triple-response phenotypes.",
  },
  {
    id: "figS3",
    title: "Fig. S3 | Foam Capillary Hydration & Moisture Deficit",
    src: "./figS3_foam_capillary_hydration_deficit.png",
    caption: "Van Genuchten water retention curves and germination delay under 100% vs. 40% foam fill.",
  },
  {
    id: "figS4",
    title: "Fig. S4 | Sowing Density, Shade Avoidance & 3D Phototropic Lean",
    src: "./figS4_sowing_density_shade_avoidance_phototropism.png",
    caption: "Community crowding sweep from 0.5× (82 seeds) to 1.5× (246 seeds) in Chamber 2.",
  },
  {
    id: "figS5",
    title: "Fig. S5 | Deep-Space Radiation Stress Matrix (GCR & SPE)",
    src: "./figS5_deepspace_radiation_stress_matrix.png",
    caption: "Root apical meristem G2/M checkpoint arrest and organ dwarfism under high-LET heavy ions and SPE.",
  },
];

interface Props {
  onNavigate: (view: PortalView) => void;
}

export function OverviewPage({ onNavigate }: Props) {
  const [galleryTab, setGalleryTab] = useState<"main" | "supp">("main");
  const [lightbox, setLightbox] = useState<FigureItem | null>(null);

  const figures = galleryTab === "main" ? MAIN_FIGURES : SUPP_FIGURES;

  return (
    <div className="portal-page">
      {/* HERO SECTION */}
      <section className="portal-hero">
        <div className="hero-badge">NASA ARTEMIS III · LEAF GBC1 DIGITAL TWIN · NPJ MICROGRAVITY</div>
        <h1 className="hero-title">
          Multiscale 3D Cellular Digital Twin of a 164-Seed Plant Community in the Artemis III LEAF Growth Chamber
        </h1>
        <p className="hero-lead">
          An open-source, deterministic 4D biophysical simulation platform coupling 3D computational fluid dynamics
          (CFD), Richards–van Genuchten porous-foam hydraulics, and a 35 µm Nytex root-exclusion screen with
          intracellular hormone networks (ABA, GA, DELLA, ACC, ethylene) and Lockhart wall-stress expansion across
          64 <em>Brassica rapa</em> and 100 <em>Arabidopsis thaliana</em> seedlings.
        </p>
        <div className="hero-actions">
          <button className="cta-btn cta-primary" onClick={() => onNavigate("simulator")}>
            🧬 Launch 3D Digital Twin
          </button>
          <button className="cta-btn cta-secondary" onClick={() => onNavigate("compare")}>
            ⚖️ Run Dual Simulation &amp; PDF Report
          </button>
          <button className="cta-btn cta-outline" onClick={() => onNavigate("paper")}>
            📄 Read Paper &amp; Supplement (PDF)
          </button>
          <button className="cta-btn cta-outline" onClick={() => onNavigate("tutorial")}>
            🎓 Software Tutorial
          </button>
        </div>
      </section>

      {/* KEY VALIDATED FINDINGS GRID */}
      <section className="portal-section">
        <div className="section-head">
          <h2>Key Validated Findings (17/17 Automated Gates Passing)</h2>
          <span className="section-sub">Anchored to a 193-parameter Crossref-verified provenance ledger</span>
        </div>
        <div className="highlights-grid">
          <div className="highlight-card">
            <div className="hl-metric">164 Seeds</div>
            <div className="hl-title">3-Compartment Flight Sowing</div>
            <p>
              32 <em>B. rapa</em> in Ch 1 (47.2/dm²), 100 <em>A. thaliana</em> lawn in Ch 2 (206.4/dm²), and 32{" "}
              <em>B. rapa</em> in Ch 3 within a 48 × 33.67 × 68 mm polycarbonate footprint.
            </p>
          </div>
          <div className="highlight-card">
            <div className="hl-metric" style={{ color: "var(--accent-green)" }}>100.0% Exclusion</div>
            <div className="hl-title">35 µm Nytex &amp; RNAlater Safety</div>
            <p>
              Radicles deflect tangentially above Y = 14.77 mm without foam intrusion, keeping terminal RNAlater
              perfusion pressure drop at ΔP = 1.75 kPa ≪ 8.04 kPa bubble point (vs. 89.3 kPa clogged).
            </p>
          </div>
          <div className="highlight-card">
            <div className="hl-metric" style={{ color: "var(--accent)" }}>−83.4% Buoyancy</div>
            <div className="hl-title">Lunar 0.166g Convection &amp; Statoliths</div>
            <p>
              Grashof number scales linearly with gravity (Gr ∝ g), thinning natural convection by 83.4% and widening
              amyloplast statolith descent dispersion (35° spread).
            </p>
          </div>
          <div className="highlight-card">
            <div className="hl-metric">13.42 mm/s g_bl</div>
            <div className="hl-title">Push vs. Pull CFD Channelling</div>
            <p>
              Active Push mode (Q = 25 mL/min = 27.7 ACH) creates a dip-and-converge jet through Z = ±8.5 mm baffles,
              boosting Ch 2 conductance above Pull mode (12.67 mm/s) and keeping C₂H₄ at 0.08 ppb.
            </p>
          </div>
          <div className="highlight-card">
            <div className="hl-metric" style={{ color: "var(--accent-amber)" }}>136.5 ppb C₂H₄</div>
            <div className="hl-title">Stagnant Pump-Off Fault Diagnostic</div>
            <p>
              Pump failure (Q = 0) traps respiratory ethylene above the 50 ppb triple-response threshold, driving +85%
              radial hypocotyl swelling, tip O₂ drop to 11.2 kPa, and 42% root stunting.
            </p>
          </div>
          <div className="highlight-card">
            <div className="hl-metric">1.59° Lean</div>
            <div className="hl-title">Shade Avoidance &amp; Phototropic Lean</div>
            <p>
              Beer–Lambert foliar shading (f_light = 0.872) in the dense Ch 2 lawn triggers +38% SAS hypocotyl
              elongation and 3D lateral phototropic lean away from neighbor crowns.
            </p>
          </div>
        </div>
      </section>

      {/* PUBLICATION FIGURES GALLERY */}
      <section className="portal-section">
        <div className="section-head">
          <h2>Publication Figures &amp; Supplementary Montages</h2>
          <div className="btn-group">
            <button
              className={`btn ${galleryTab === "main" ? "active" : ""}`}
              onClick={() => setGalleryTab("main")}
            >
              Main Manuscript (Figs. 1–7)
            </button>
            <button
              className={`btn ${galleryTab === "supp" ? "active" : ""}`}
              onClick={() => setGalleryTab("supp")}
            >
              Supplementary Information (Figs. S1–S5)
            </button>
          </div>
        </div>

        <div className="figures-grid">
          {figures.map((fig) => (
            <article key={fig.id} className="fig-card" onClick={() => setLightbox(fig)}>
              <div className="fig-thumb-wrap">
                <img src={fig.src} alt={fig.title} loading="lazy" />
                <span className="fig-zoom-hint">Click to zoom</span>
              </div>
              <div className="fig-card-body">
                <h3>{fig.title}</h3>
                <p>{fig.caption}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* LIGHTBOX MODAL */}
      {lightbox && (
        <div className="modal-backdrop" onClick={() => setLightbox(null)}>
          <div className="modal-panel" style={{ maxWidth: 1100 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{lightbox.title}</h3>
              <button className="btn" onClick={() => setLightbox(null)}>
                Close ✕
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: "center" }}>
              <img
                src={lightbox.src}
                alt={lightbox.title}
                style={{ maxWidth: "100%", maxHeight: "72vh", borderRadius: 6, background: "#ffffff" }}
              />
              <p style={{ textAlign: "left", marginTop: 12, fontSize: 13, lineHeight: 1.55, color: "var(--muted)" }}>
                {lightbox.caption}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
