import type { PortalView } from "./OverviewPage";

interface Props {
  onNavigate: (view: PortalView) => void;
}

export function TutorialPage({ onNavigate }: Props) {
  return (
    <div className="portal-page">
      <section className="portal-section" style={{ marginTop: 0 }}>
        <div className="section-head">
          <div>
            <h2>Interactive Software Tutorial &amp; Feature Guide</h2>
            <span className="section-sub">
              Step-by-step walkthrough of the LEAF GBC1 164-seed 4D cellular digital twin and comparison engine.
            </span>
          </div>
          <div className="btn-group">
            <button className="cta-btn cta-primary" onClick={() => onNavigate("simulator")}>
              🧬 Open 3D Simulator
            </button>
            <button className="cta-btn cta-secondary" onClick={() => onNavigate("compare")}>
              ⚖️ Open Dual Comparison
            </button>
          </div>
        </div>

        <div className="tutorial-grid">
          <div className="tutorial-card">
            <div className="tut-step">STEP 1 · HARDWARE &amp; SOWING ARCHITECTURE</div>
            <h3>Understanding the 3-Compartment GBC1 Layout</h3>
            <p>
              The LEAF Growth Biologic Chamber 1 (48 × 33.67 × 68 mm) houses <strong>164 individual cellular seedlings</strong>{" "}
              across three segregated compartments separated by solid internal baffles at <code>Z = ±8.5 mm</code>:
            </p>
            <ul>
              <li><strong>Chamber 1 &amp; Chamber 3</strong>: 32 <em>Brassica rapa</em> seeds each (8 × 4 lattice, 47.2 seeds/dm²).</li>
              <li><strong>Chamber 2</strong>: 100 <em>Arabidopsis thaliana</em> seeds (10 × 10 lawn, 206.4 seeds/dm²).</li>
              <li><strong>35 µm Nytex Screen (Y = 14.77 mm)</strong>: Prevents descending radicles from clogging the phenolic foam pores, keeping RNAlater ΔP = 1.75 kPa ≪ 8.04 kPa bubble point.</li>
            </ul>
          </div>

          <div className="tutorial-card">
            <div className="tut-step">STEP 2 · 3D CHAMBER &amp; CUTAWAY CONTROLS</div>
            <h3>Navigating the WebGL Viewers</h3>
            <p>
              In the <strong>3D Digital Twin</strong> tab, you can inspect both the full 164-seed community chamber (center)
              and an interactive single-seed cellular cutaway (right sidebar):
            </p>
            <ul>
              <li><strong>Orbit / Rotate</strong>: Left-click and drag anywhere in the 3D viewport.</li>
              <li><strong>Pan / Zoom</strong>: Right-click drag to pan; scroll wheel or trackpad pinch to zoom.</li>
              <li><strong>Camera Presets</strong>: Use <code>Iso</code>, <code>Top</code>, <code>Front</code>, and <code>Ch 2 Lawn</code> buttons above the viewport for instant alignment.</li>
              <li><strong>Inspect Any Seed</strong>: Click any of the 164 seedlings in the 3D chamber to load its live cellular cross-section, hormone levels, and microclimate in the right panel.</li>
            </ul>
          </div>

          <div className="tutorial-card">
            <div className="tut-step">STEP 3 · 4D SEQUENCER &amp; CELLULAR MODES</div>
            <h3>Time Travel (0–120 h) &amp; 14 Color Overlays</h3>
            <p>
              Scrub the <strong>4D Mission Sequencer</strong> slider from 0 h (dry dormant seed) through 32 h (endosperm
              rupture) to 120 h (expanded cotyledons and tangential Nytex root gliding), or click <strong>Play 4D</strong>.
            </p>
            <ul>
              <li><strong>Anatomy &amp; Tissues</strong>: <code>Tissue</code>, <code>Organ Region</code>, <code>Cell Cycle</code>, <code>Turgor</code>.</li>
              <li><strong>Hormone Networks</strong>: <code>GA / ABA Ratio</code>, <code>DELLA</code>, <code>Auxin</code>, <code>Ethylene</code>.</li>
              <li><strong>Stress &amp; Microclimate</strong>: <code>O₂ Partial Pressure</code>, <code>Stress Decoder</code> (hypoxia, osmotic, radiation, ethylene).</li>
            </ul>
          </div>

          <div className="tutorial-card">
            <div className="tut-step">STEP 4 · CUSTOM SCENARIOS &amp; FAULTS</div>
            <h3>Testing Spaceflight Boundary Conditions</h3>
            <p>
              Use the left sidebar in the <strong>3D Simulator</strong> to test off-nominal hardware states or select from 8
              validated mission presets:
            </p>
            <ul>
              <li><strong>Gravity Scaling</strong>: Slide <code>g</code> from <code>1.00g</code> (Earth) to <code>0.166g</code> (Moon) or <code>0.00g</code> (ISS microgravity).</li>
              <li><strong>Airflow Topology</strong>: Switch between <code>Push (Ports 1,3 → 2)</code> and <code>Pull (Port 2 → 1,3)</code> or drop pump flow <code>Q = 0 mL/min</code> to observe ethylene accumulation (&gt; 130 ppb).</li>
              <li><strong>Foam Hydration</strong>: Reduce foam fill from <code>100%</code> to <code>40%</code> to simulate capillary moisture deficit.</li>
            </ul>
          </div>

          <div className="tutorial-card">
            <div className="tut-step">STEP 5 · DUAL COMPARISON &amp; PDF EXPORT</div>
            <h3>Running Side-by-Side Experiments</h3>
            <p>
              Open the <strong>Dual Comparison</strong> tab to run two independent 164-seed community simulations
              simultaneously (e.g., <em>Earth 1.0g vs. Lunar 0.166g</em> or <em>Active Push vs. Stagnant Fault</em>):
            </p>
            <ul>
              <li>Choose one of 6 curated comparison presets or customize every environmental parameter for <strong>Sim A</strong> and <strong>Sim B</strong>.</li>
              <li>Review the synchronized SVG overlay charts, quantitative delta table (Δ and % change), and automated biophysical diagnostics.</li>
              <li>Click <strong>Export Report as PDF</strong> to generate a clean, print-ready vector PDF report, or <strong>Export CSV</strong> for raw numerical tables.</li>
            </ul>
          </div>

          <div className="tutorial-card">
            <div className="tut-step">STEP 6 · REPRODUCIBILITY &amp; VALIDATION</div>
            <h3>193-Parameter Ledger &amp; 17 Automated Gates</h3>
            <p>
              Every number in the digital twin is traced to primary literature in the <strong>Paper &amp; PDF → Parameter
              Provenance Ledger</strong> tab and verified by 17 deterministic validation checks (Gates 1–6) covering:
            </p>
            <ul>
              <li><strong>Gate 1–2</strong>: 193-parameter ledger integrity, zero unseeded PRNG, 164-seed compartment bounds.</li>
              <li><strong>Gate 3–4</strong>: 100% Nytex root exclusion, RNAlater ΔP &lt; 2.5 kPa, 100% ψ_b germination ordering.</li>
              <li><strong>Gate 5–6</strong>: Monotonic SAS density scaling and Push vs. Pull CFD channelling.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
