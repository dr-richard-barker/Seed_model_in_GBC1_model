import { useEffect, useMemo, useRef, useState } from "react";
import { GBC1CommunityTwin } from "./model/community";
import { resolveEnv } from "./model/environment";
import { REGION_NAMES, TISSUE_NAMES } from "./model/geometry";
import { OVERLAY_CLASSES, clusterOf } from "./model/identity";
import { LEDGER, REFERENCES, defaultParams } from "./model/params";
import { PRESET_BY_ID } from "./model/presets";
import type { FlowMode } from "./model/gbc1Field";
import { Chart } from "./ui/Chart";
import {
  createChamberViewer,
  type CameraPreset,
  type ChamberLayerVisibility,
  type ChamberViewer,
} from "./view/chamberViewer";
import { MODES, paint, type ColorMode } from "./view/paint";
import { seedViewOf } from "./view/seedView";
import { createSeedViewer, type SeedViewer } from "./view/viewer";

interface MissionScenario {
  id: string;
  label: string;
  gravityG: number;
  flowMlMin: number;
  flowMode: FlowMode;
  waterFillPct: number;
  densityMultiplier: number;
  tempC: number;
  lightUmol: number;
}

const SCENARIOS: MissionScenario[] = [
  {
    id: "lunar_push_nominal",
    label: "Lunar 0.166 g · Push Nominal (1.0× = 164 seeds)",
    gravityG: 0.166,
    flowMlMin: 25,
    flowMode: "push",
    waterFillPct: 100,
    densityMultiplier: 1.0,
    tempC: 23.0,
    lightUmol: 150,
  },
  {
    id: "lunar_pull_nominal",
    label: "Lunar 0.166 g · Pull Mode (1.0× = 164 seeds)",
    gravityG: 0.166,
    flowMlMin: 25,
    flowMode: "pull",
    waterFillPct: 100,
    densityMultiplier: 1.0,
    tempC: 23.0,
    lightUmol: 150,
  },
  {
    id: "earth_1g_push",
    label: "Earth 1.0 g · Ground Control Push (1.0× = 164 seeds)",
    gravityG: 1.0,
    flowMlMin: 25,
    flowMode: "push",
    waterFillPct: 100,
    densityMultiplier: 1.0,
    tempC: 23.0,
    lightUmol: 150,
  },
  {
    id: "iss_0g_push",
    label: "Microgravity 0.0 g · Orbital Push (1.0× = 164 seeds)",
    gravityG: 0.0,
    flowMlMin: 25,
    flowMode: "push",
    waterFillPct: 100,
    densityMultiplier: 1.0,
    tempC: 23.0,
    lightUmol: 150,
  },
  {
    id: "lunar_sparse_05x",
    label: "Lunar 0.166 g · Sparse Sowing 0.5× (82 seeds: 16+50+16)",
    gravityG: 0.166,
    flowMlMin: 25,
    flowMode: "push",
    waterFillPct: 100,
    densityMultiplier: 0.5,
    tempC: 23.0,
    lightUmol: 150,
  },
  {
    id: "lunar_crowded_15x",
    label: "Lunar 0.166 g · Crowded Sowing 1.5× (246 seeds: 48+150+48)",
    gravityG: 0.166,
    flowMlMin: 25,
    flowMode: "push",
    waterFillPct: 100,
    densityMultiplier: 1.5,
    tempC: 23.0,
    lightUmol: 150,
  },
  {
    id: "stagnant_0g_fault",
    label: "Pump Off Fault (Q = 0 mL/min, 0.0 g Sealed)",
    gravityG: 0.0,
    flowMlMin: 0,
    flowMode: "push",
    waterFillPct: 100,
    densityMultiplier: 1.0,
    tempC: 23.0,
    lightUmol: 150,
  },
  {
    id: "moisture_deficit_40pct",
    label: "Incomplete Hydration Fault (40% Foam Fill, 0.166 g)",
    gravityG: 0.166,
    flowMlMin: 25,
    flowMode: "push",
    waterFillPct: 40,
    densityMultiplier: 1.0,
    tempC: 23.0,
    lightUmol: 150,
  },
];

export function App() {
  const baseParams = useMemo(() => defaultParams(), []);
  const leafPreset = useMemo(() => PRESET_BY_ID.get("leaf_gbc1")!, []);

  // Mission configuration state
  const [scenarioId, setScenarioId] = useState<string>("lunar_push_nominal");
  const [gravityG, setGravityG] = useState<number>(0.166);
  const [flowMlMin, setFlowMlMin] = useState<number>(25);
  const [flowMode, setFlowMode] = useState<FlowMode>("push");
  const [waterFillPct, setWaterFillPct] = useState<number>(100);
  const [densityMultiplier, setDensityMultiplier] = useState<number>(1.0);
  const [tempC, setTempC] = useState<number>(23.0);
  const [lightUmol, setLightUmol] = useState<number>(150);

  // Visualization state
  const [targetHour, setTargetHour] = useState<number>(72);
  const [playing, setPlaying] = useState<boolean>(false);
  const [colorMode, setColorMode] = useState<ColorMode>("tissue");
  const [decoderClass, setDecoderClass] = useState<string>("low_oxygen");
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("iso");
  const [selectedSeedId, setSelectedSeedId] = useState<number>(55); // Default to a central Ch 2 Arabidopsis seed
  const [selectedCellId, setSelectedCellId] = useState<number | null>(null);
  const [cutAway, setCutAway] = useState<boolean>(true);
  const [showLedger, setShowLedger] = useState<boolean>(false);
  const [showTour, setShowTour] = useState<boolean>(false);
  const [showManuscript, setShowManuscript] = useState<boolean>(false);
  const [showSupplementary, setShowSupplementary] = useState<boolean>(false);
  const [layers, setLayers] = useState<ChamberLayerVisibility>({
    housing: true,
    foam: true,
    nytex: true,
    streamlines: true,
    testa: true,
    crownHalos: true,
  });

  // Simulation instance & version counter
  const communityRef = useRef<GBC1CommunityTwin | null>(null);
  const [simTick, setSimTick] = useState<number>(0);

  // Build or advance the community simulation to `targetHour`
  const buildNewCommunity = (
    g: number,
    q: number,
    mode: FlowMode,
    fill: number,
    dens: number,
    tC: number,
    par: number,
  ): GBC1CommunityTwin => {
    const env = resolveEnv(leafPreset, {
      gravity_g: g,
      temp_c: tC,
      light_umol: par,
      seeds: Math.round(164 * dens),
    });
    return new GBC1CommunityTwin(baseParams, env, {
      densityMultiplier: dens,
      flowMlMin: q,
      flowMode: mode,
      waterFillPct: fill,
      dt: 0.25,
      sampleEvery: 1.0,
    });
  };

  // Rebuild simulation when boundary conditions change
  useEffect(() => {
    const comm = buildNewCommunity(
      gravityG,
      flowMlMin,
      flowMode,
      waterFillPct,
      densityMultiplier,
      tempC,
      lightUmol,
    );
    comm.runTo(targetHour);
    communityRef.current = comm;
    if (selectedSeedId >= comm.specs.length) {
      setSelectedSeedId(Math.floor(comm.specs.length / 2));
    }
    setSimTick((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gravityG, flowMlMin, flowMode, waterFillPct, densityMultiplier, tempC, lightUmol]);

  // Advance or rewind when targetHour changes
  useEffect(() => {
    const comm = communityRef.current;
    if (!comm) return;
    if (targetHour >= comm.t - 1e-6) {
      comm.runTo(targetHour);
      setSimTick((v) => v + 1);
    } else {
      const fresh = buildNewCommunity(
        gravityG,
        flowMlMin,
        flowMode,
        waterFillPct,
        densityMultiplier,
        tempC,
        lightUmol,
      );
      fresh.runTo(targetHour);
      communityRef.current = fresh;
      setSimTick((v) => v + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetHour]);

  // Play timer
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setTargetHour((h) => {
        if (h >= 120) {
          setPlaying(false);
          return 120;
        }
        return Math.min(120, +(h + 2).toFixed(1));
      });
    }, 140);
    return () => window.clearInterval(id);
  }, [playing]);

  // Mount 3D GBC1 Chamber Viewer & Single-Seed Cutaway Viewer
  const chamberContainerRef = useRef<HTMLDivElement | null>(null);
  const chamberViewerRef = useRef<ChamberViewer | null>(null);
  const singleSeedContainerRef = useRef<HTMLDivElement | null>(null);
  const singleSeedViewerRef = useRef<SeedViewer | null>(null);
  const singleSeedColorsRef = useRef<Float32Array>(new Float32Array(24000 * 3));

  useEffect(() => {
    if (!chamberContainerRef.current) return;
    const viewer = createChamberViewer(chamberContainerRef.current, (seedId, cellId) => {
      setSelectedSeedId(seedId);
      setSelectedCellId(cellId);
    });
    chamberViewerRef.current = viewer;
    return () => {
      viewer.dispose();
      chamberViewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!singleSeedContainerRef.current) return;
    const sv = createSeedViewer(
      singleSeedContainerRef.current,
      24000,
      (_s, cell) => setSelectedCellId(cell),
      { background: 0x0b1116 },
    );
    singleSeedViewerRef.current = sv;
    return () => {
      sv.dispose();
      singleSeedViewerRef.current = null;
    };
  }, []);

  // Sync 3D Viewers whenever simulation state, color mode, or selected seed updates
  useEffect(() => {
    const comm = communityRef.current;
    if (!comm) return;
    if (chamberViewerRef.current) {
      chamberViewerRef.current.update(comm, colorMode, decoderClass, selectedSeedId);
    }
    const selTwin = comm.twins[selectedSeedId] ?? comm.twins[0];
    if (selTwin && singleSeedViewerRef.current) {
      selTwin.updateLayout();
      paint(selTwin, colorMode, decoderClass, singleSeedColorsRef.current);
      const view = [seedViewOf(selTwin, singleSeedColorsRef.current)];
      singleSeedViewerRef.current.update(view);
      singleSeedViewerRef.current.frame(view);
      singleSeedViewerRef.current.setGravityArrow(comm.env.gravity_g);
    }
  }, [simTick, colorMode, decoderClass, selectedSeedId]);

  useEffect(() => {
    chamberViewerRef.current?.setLayers(layers);
  }, [layers]);

  useEffect(() => {
    singleSeedViewerRef.current?.setCut(cutAway);
  }, [cutAway]);

  const applyScenario = (id: string) => {
    setScenarioId(id);
    const sc = SCENARIOS.find((s) => s.id === id);
    if (!sc) return;
    setGravityG(sc.gravityG);
    setFlowMlMin(sc.flowMlMin);
    setFlowMode(sc.flowMode);
    setWaterFillPct(sc.waterFillPct);
    setDensityMultiplier(sc.densityMultiplier);
    setTempC(sc.tempC);
    setLightUmol(sc.lightUmol);
  };

  const comm = communityRef.current;
  const samples = comm?.samples ?? [];
  const latest = samples[samples.length - 1];
  const selSpec = comm?.specs[selectedSeedId] ?? comm?.specs[0];
  const selTwin = comm?.twins[selectedSeedId] ?? comm?.twins[0];
  const selCrown = comm?.crowding.crowns[selectedSeedId] ?? comm?.crowding.crowns[0];

  const tx = samples.map((s) => s.t);

  return (
    <div className="gbc1-shell">
      {/* TOP TELEMETRY & MISSION BAR */}
      <header className="topbar">
        <div className="topbar-title">
          <h1>LEAF GBC1 · 164-Seed Cellular Community Digital Twin</h1>
          <span className="subtitle">
            3-Compartment CAD + CFD + 35 µm Nytex Barrier + Multi-Seed Crowding &amp; Gas Coupling
          </span>
        </div>
        <div className="topbar-kpis">
          <div className="kpi-pill">
            <span>Time:</span>
            <strong>{ (comm?.t ?? 0).toFixed(1) } h</strong>
          </div>
          <div className="kpi-pill">
            <span>Seeds:</span>
            <strong>{ comm?.specs.length ?? 164 } ({ (comm?.sowing.overallDensityDm2 ?? 89.1).toFixed(0) }/dm²)</strong>
          </div>
          <div className="kpi-pill">
            <span>Germ:</span>
            <strong>{ (latest?.germination_pct_all ?? 0).toFixed(1) }%</strong>
          </div>
          <div className="kpi-pill">
            <span>O₂ / CO₂:</span>
            <strong>
              { (latest?.o2_hs_kpa ?? 21.2).toFixed(1) } kPa / { (latest?.co2_hs_ppm ?? 420).toFixed(0) } ppm
            </strong>
          </div>
          <div className="kpi-pill">
            <span>C₂H₄:</span>
            <strong>{ (latest?.eth_hs_ppb ?? 0).toFixed(1) } ppb</strong>
          </div>
          <div className="kpi-pill">
            <span>Nytex Exclusion:</span>
            <strong style={{ color: "#5ec962" }}>
              { (latest?.nytex_root_exclusion_pct ?? 100).toFixed(1) }% (ΔP { (latest?.rnalater_dp_kpa ?? 1.65).toFixed(2) } kPa)
            </strong>
          </div>
          <button className="btn active" onClick={() => setShowTour(true)} style={{ background: "#00d4ff", color: "#081018", fontWeight: 700 }}>
            📖 Flight Tour &amp; Intro
          </button>
          <button className="btn" onClick={() => setShowManuscript(true)} style={{ borderColor: "#a6d96a", color: "#a6d96a" }}>
            📄 Manuscript (PDF)
          </button>
          <button className="btn" onClick={() => setShowSupplementary(true)} style={{ borderColor: "#00d4ff", color: "#00d4ff" }}>
            📑 Supplementary Info (PDF)
          </button>
          <button className="btn" onClick={() => setShowLedger(true)}>
            Parameter Ledger ({ LEDGER.length })
          </button>
        </div>
      </header>

      <div className="workspace">
        {/* LEFT SIDEBAR: SCENARIOS, HARDWARE & SOWING CONTROLS */}
        <aside className="sidebar-left">
          <div className="card">
            <h2>Mission Scenario Preset</h2>
            <div className="control-row">
              <select value={scenarioId} onChange={(e) => applyScenario(e.target.value)}>
                {SCENARIOS.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="card">
            <h2>
              <span>4D Mission Sequencer (0–120 h)</span>
              <span style={{ color: "#00d4ff" }}>Day { ((comm?.t ?? 0) / 24).toFixed(1) }</span>
            </h2>
            <div className="control-row">
              <div className="control-label">
                <span>Time after imbibition</span>
                <span className="val">{ targetHour.toFixed(1) } h</span>
              </div>
              <input
                type="range"
                min={0}
                max={120}
                step={1}
                value={targetHour}
                onChange={(e) => {
                  setPlaying(false);
                  setTargetHour(Number(e.target.value));
                }}
              />
            </div>
            <div className="btn-group">
              <button className={`btn ${playing ? "active" : ""}`} onClick={() => setPlaying((p) => !p)}>
                {playing ? "Pause" : "Play 4D"}
              </button>
              {[0, 18, 36, 72, 96, 120].map((h) => (
                <button
                  key={h}
                  className={`btn ${Math.abs(targetHour - h) < 0.6 ? "active" : ""}`}
                  onClick={() => {
                    setPlaying(false);
                    setTargetHour(h);
                  }}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h2>Sowing Plan &amp; Hardware Boundary Conditions</h2>

            <div className="control-row">
              <div className="control-label">
                <span>Sowing Density Scale</span>
                <span className="val">
                  {densityMultiplier.toFixed(2)}× ({comm?.specs.length ?? 164} seeds)
                </span>
              </div>
              <div className="btn-group">
                {[0.5, 0.75, 1.0, 1.25, 1.5].map((dm) => (
                  <button
                    key={dm}
                    className={`btn ${Math.abs(densityMultiplier - dm) < 0.01 ? "active" : ""}`}
                    onClick={() => setDensityMultiplier(dm)}
                  >
                    {dm}×
                  </button>
                ))}
              </div>
            </div>

            <div className="control-row">
              <div className="control-label">
                <span>Manifold Airflow Mode</span>
                <span className="val">{flowMode.toUpperCase()}</span>
              </div>
              <div className="btn-group">
                <button
                  className={`btn ${flowMode === "push" ? "active" : ""}`}
                  onClick={() => setFlowMode("push")}
                >
                  Push (Ports 1,3 → Port 2)
                </button>
                <button
                  className={`btn ${flowMode === "pull" ? "active" : ""}`}
                  onClick={() => setFlowMode("pull")}
                >
                  Pull (Port 2 → Ports 1,3)
                </button>
              </div>
            </div>

            <div className="control-row">
              <div className="control-label">
                <span>Pump Flow Rate (Q)</span>
                <span className="val">{flowMlMin.toFixed(0)} mL/min</span>
              </div>
              <input
                type="range"
                min={0}
                max={60}
                step={5}
                value={flowMlMin}
                onChange={(e) => setFlowMlMin(Number(e.target.value))}
              />
            </div>

            <div className="control-row">
              <div className="control-label">
                <span>Gravity Level (g)</span>
                <span className="val">{gravityG.toFixed(3)} g</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={gravityG}
                onChange={(e) => setGravityG(Number(e.target.value))}
              />
              <div className="btn-group">
                <button className={`btn ${gravityG === 0 ? "active" : ""}`} onClick={() => setGravityG(0)}>
                  0 g (ISS)
                </button>
                <button
                  className={`btn ${Math.abs(gravityG - 0.166) < 0.01 ? "active" : ""}`}
                  onClick={() => setGravityG(0.166)}
                >
                  0.166 g (Moon)
                </button>
                <button
                  className={`btn ${Math.abs(gravityG - 0.38) < 0.01 ? "active" : ""}`}
                  onClick={() => setGravityG(0.38)}
                >
                  0.38 g (Mars)
                </button>
                <button className={`btn ${gravityG === 1 ? "active" : ""}`} onClick={() => setGravityG(1)}>
                  1.0 g (Earth)
                </button>
              </div>
            </div>

            <div className="control-row">
              <div className="control-label">
                <span>Foam Water Fill Activation</span>
                <span className="val">{waterFillPct}%</span>
              </div>
              <input
                type="range"
                min={25}
                max={100}
                step={5}
                value={waterFillPct}
                onChange={(e) => setWaterFillPct(Number(e.target.value))}
              />
            </div>

            <div className="control-row">
              <div className="control-label">
                <span>Chamber Temperature</span>
                <span className="val">{tempC.toFixed(1)} °C</span>
              </div>
              <input
                type="range"
                min={16}
                max={30}
                step={0.5}
                value={tempC}
                onChange={(e) => setTempC(Number(e.target.value))}
              />
            </div>

            <div className="control-row">
              <div className="control-label">
                <span>Incident LED PAR</span>
                <span className="val">{lightUmol} µmol m⁻² s⁻¹</span>
              </div>
              <input
                type="range"
                min={0}
                max={300}
                step={15}
                value={lightUmol}
                onChange={(e) => setLightUmol(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="card">
            <h2>Cellular Paint &amp; 3D Hardware Layers</h2>
            <div className="control-row">
              <div className="control-label">
                <span>Cell Colouring Mode</span>
              </div>
              <select value={colorMode} onChange={(e) => setColorMode(e.target.value as ColorMode)}>
                {MODES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} {m.unit ? `(${m.unit})` : ""}
                  </option>
                ))}
              </select>
            </div>
            {colorMode === "decoder" && (
              <div className="control-row">
                <div className="control-label">
                  <span>Stressor Contrast Class</span>
                </div>
                <select value={decoderClass} onChange={(e) => setDecoderClass(e.target.value)}>
                  {OVERLAY_CLASSES.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="layer-toggles" style={{ marginTop: 6 }}>
              {(
                [
                  ["housing", "GBC1 Housing & Baffles"],
                  ["foam", "4D Foam Hydration"],
                  ["nytex", "35 µm Nytex Screen"],
                  ["streamlines", "3D CFD Streamlines"],
                  ["testa", "Seed Coats (Testa)"],
                  ["crownHalos", "Crown Shade Halos"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={layers[key]}
                    onChange={(e) => setLayers((prev) => ({ ...prev, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* CENTER STAGE: 3D GBC1 CHAMBER VIEWPORT + BOTTOM COMPARTMENT & SINGLE-SEED INSPECTOR */}
        <main className="center-stage">
          <div className="chamber-canvas-wrap">
            <div ref={chamberContainerRef} className="chamber-canvas" />
            <div className="viewport-overlay-top">
              <div className="overlay-box">
                <div style={{ fontWeight: 700, marginBottom: 4, color: "#00d4ff" }}>
                  3D GBC1 Chamber View Presets (Click any seed to inspect)
                </div>
                <div className="btn-group">
                  {(
                    [
                      ["iso", "3D Isometric"],
                      ["top", "Top-Down Sowing Map"],
                      ["side", "Longitudinal Baffles"],
                      ["ch2", "Central Ch 2 (100× Ath)"],
                      ["nytex", "35 µm Nytex Root Bed"],
                    ] as const
                  ).map(([preset, label]) => (
                    <button
                      key={preset}
                      className={`btn ${cameraPreset === preset ? "active" : ""}`}
                      onClick={() => {
                        setCameraPreset(preset);
                        chamberViewerRef.current?.setCameraPreset(preset);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    className="btn"
                    onClick={() => {
                      if (comm) chamberViewerRef.current?.focusSeed(comm, selectedSeedId);
                    }}
                  >
                    Zoom Seed #{selectedSeedId}
                  </button>
                </div>
              </div>

              <div className="overlay-box" style={{ textAlign: "right" }}>
                <div>
                  <strong>Ch 1 &amp; 3:</strong> 2 × {comm?.sowing.countsByCompartment[1] ?? 32} <em>Brassica rapa</em> (
                  {(comm?.sowing.densitiesDm2ByCompartment[1] ?? 47.2).toFixed(1)} seeds/dm²)
                </div>
                <div>
                  <strong>Ch 2 (Central):</strong> {comm?.sowing.countsByCompartment[2] ?? 100}{" "}
                  <em>Arabidopsis thaliana</em> ({(comm?.sowing.densitiesDm2ByCompartment[2] ?? 206.2).toFixed(1)}{" "}
                  seeds/dm²)
                </div>
                <div style={{ color: "#8fa6bc", fontSize: 10, marginTop: 2 }}>
                  Dew Margin ΔT: {(latest?.dew_margin_c ?? 2.8).toFixed(2)} °C · RH: {(latest?.rh_pct ?? 78).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM INSPECTOR: SINGLE-SEED CUTAWAY + 3-COMPARTMENT TELEMETRY TABLE */}
          <section className="bottom-inspector">
            <div className="single-seed-wrap">
              <div ref={singleSeedContainerRef} className="single-seed-canvas" />
              <div className="single-seed-badge">
                <div>
                  <strong>Seed #{selectedSeedId}</strong> · Ch {selSpec?.compartment ?? 2} (
                  {selSpec?.species === "brassica_rapa" ? "B. rapa" : "A. thaliana"})
                </div>
                <div style={{ color: "#8fa6bc" }}>
                  Pos: ({(selSpec?.xMm ?? 0).toFixed(1)}, 14.8, {(selSpec?.zMm ?? 0).toFixed(1)}) mm · f_light:{" "}
                  {(selCrown?.lightFactor ?? 1).toFixed(2)}
                </div>
                <div style={{ marginTop: 3, pointerEvents: "auto" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input type="checkbox" checked={cutAway} onChange={(e) => setCutAway(e.target.checked)} />
                    Cut-away interior
                  </label>
                </div>
              </div>
            </div>

            <div className="comp-table-wrap">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: 11.5, color: "#00d4ff" }}>
                  Compartment Community Comparison at t = {(comm?.t ?? 0).toFixed(1)} h
                </strong>
                {selTwin && (
                  <span style={{ fontSize: 11, color: "#8fa6bc" }}>
                    Selected Seed #{selectedSeedId}: Shoot {(selCrown?.shootHeightMm ?? 0).toFixed(2)} mm · Root{" "}
                    {(selCrown?.rootLenMm ?? 0).toFixed(2)} mm · Lean {(selCrown?.leanTotalDeg ?? 0).toFixed(1)}° · g_bl{" "}
                    {(selTwin.localGblMms ?? 0).toFixed(1)} mm/s
                    {selectedCellId !== null && selTwin.cells.n > selectedCellId
                      ? ` · Cell #${selectedCellId} (${REGION_NAMES[selTwin.cells.region[selectedCellId]]} / ${TISSUE_NAMES[selTwin.cells.tissue[selectedCellId]]}, cluster ${clusterOf(selTwin.template, selectedCellId, selTwin.t) ?? "endo"})`
                      : ""}
                  </span>
                )}
              </div>

              <table className="comp-table">
                <thead>
                  <tr>
                    <th>Compartment (Species)</th>
                    <th>Seeds (Density)</th>
                    <th>Germ % (t₅₀)</th>
                    <th>Hypocotyl (mm)</th>
                    <th>Root on Nytex (mm)</th>
                    <th>LAI (Closure %)</th>
                    <th>Light f_light</th>
                    <th>Shoot Lean</th>
                    <th>Air u (g_bl)</th>
                    <th>Tip O₂ (kPa)</th>
                  </tr>
                </thead>
                <tbody>
                  {[latest?.ch1, latest?.ch2, latest?.ch3].map((ch, idx) => {
                    if (!ch) return null;
                    return (
                      <tr key={idx}>
                        <td>
                          <strong>Ch {ch.compartment}</strong> (
                          {ch.species === "brassica_rapa" ? "B. rapa" : "A. thaliana"})
                        </td>
                        <td>
                          {ch.seedCount} ({ch.sowingDensityDm2.toFixed(0)}/dm²)
                        </td>
                        <td>
                          {ch.germinationPct.toFixed(1)}% ({ch.t50H !== null ? `${ch.t50H.toFixed(1)}h` : "—"})
                        </td>
                        <td>
                          {ch.meanHypocotylMm.toFixed(2)} ± {ch.sdHypocotylMm.toFixed(2)}
                        </td>
                        <td>
                          {ch.meanRootLenMm.toFixed(2)} ± {ch.sdRootLenMm.toFixed(2)}
                        </td>
                        <td>
                          {ch.lai.toFixed(2)} ({(ch.canopyCoverFrac * 100).toFixed(0)}%)
                        </td>
                        <td>{ch.meanLightFactor.toFixed(2)}</td>
                        <td>{ch.meanLeanDeg.toFixed(1)}°</td>
                        <td>
                          {(ch.meanAirSpeedMps * 100).toFixed(2)} cm/s ({ch.meanGblMms.toFixed(1)} mm/s)
                        </td>
                        <td>{ch.meanO2TipKpa.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </main>

        {/* RIGHT SIDEBAR: MULTI-SERIES COMMUNITY & CHAMBER TELEMETRY CHARTS */}
        <aside className="sidebar-right">
          <div className="charts-grid">
            <Chart
              title="1. Compartment Germination Kinetics G(t)"
              yLabel="Germinated (%)"
              xMax={120}
              yMin={0}
              yMax={105}
              now={comm?.t}
              fg="#e8f0f7"
              muted="#8fa6bc"
              line="#1f2f3d"
              series={[
                { label: "Ch 2 Arabidopsis (206/dm²)", color: "#00d4ff", x: tx, y: samples.map((s) => s.ch2.germinationPct) },
                { label: "Ch 1 B. rapa (47/dm²)", color: "#5ec962", x: tx, y: samples.map((s) => s.ch1.germinationPct) },
                { label: "Ch 3 B. rapa (47/dm²)", color: "#f5a623", x: tx, y: samples.map((s) => s.ch3.germinationPct), dashed: true },
              ]}
            />

            <Chart
              title="2. Hypocotyl Height & Root Tangential Crawl on 35 µm Nytex"
              yLabel="Length (mm)"
              xMax={120}
              yMin={0}
              now={comm?.t}
              fg="#e8f0f7"
              muted="#8fa6bc"
              line="#1f2f3d"
              series={[
                { label: "Ch 1/3 B. rapa Hypocotyl", color: "#5ec962", x: tx, y: samples.map((s) => s.ch1.meanHypocotylMm) },
                { label: "Ch 2 Ath Hypocotyl", color: "#00d4ff", x: tx, y: samples.map((s) => s.ch2.meanHypocotylMm) },
                { label: "Ch 1/3 B. rapa Root (Nytex)", color: "#a6d96a", x: tx, y: samples.map((s) => s.ch1.meanRootLenMm), dashed: true },
                { label: "Ch 2 Ath Root (Nytex)", color: "#67a9cf", x: tx, y: samples.map((s) => s.ch2.meanRootLenMm), dashed: true },
              ]}
            />

            <Chart
              title="3. Canopy Crowding: Leaf Area Index (LAI) & Light Transmittance"
              yLabel="LAI / f_light"
              xMax={120}
              yMin={0}
              now={comm?.t}
              fg="#e8f0f7"
              muted="#8fa6bc"
              line="#1f2f3d"
              series={[
                { label: "Ch 1 B. rapa LAI", color: "#5ec962", x: tx, y: samples.map((s) => s.ch1.lai) },
                { label: "Ch 2 Ath LAI", color: "#00d4ff", x: tx, y: samples.map((s) => s.ch2.lai) },
                { label: "Ch 2 Mean Light f_light", color: "#fde725", x: tx, y: samples.map((s) => s.ch2.meanLightFactor), dashed: true },
                { label: "Ch 1 Mean Light f_light", color: "#f5a623", x: tx, y: samples.map((s) => s.ch1.meanLightFactor), dashed: true },
              ]}
            />

            <Chart
              title="4. Shared 54.05 mL Headspace & Radicle Tip O₂"
              yLabel="O₂ (kPa)"
              xMax={120}
              yMin={0}
              yMax={22}
              now={comm?.t}
              fg="#e8f0f7"
              muted="#8fa6bc"
              line="#1f2f3d"
              series={[
                { label: "Headspace O₂", color: "#e8f0f7", x: tx, y: samples.map((s) => s.o2_hs_kpa) },
                { label: "Ch 2 Ath Tip O₂", color: "#00d4ff", x: tx, y: samples.map((s) => s.ch2.meanO2TipKpa) },
                { label: "Ch 1 B. rapa Tip O₂", color: "#5ec962", x: tx, y: samples.map((s) => s.ch1.meanO2TipKpa) },
              ]}
            />

            <Chart
              title="5. Community CO₂ Drawdown/Evolution & Ethylene C₂H₄"
              yLabel="CO₂ ppm / C₂H₄ ppb"
              xMax={120}
              now={comm?.t}
              fg="#e8f0f7"
              muted="#8fa6bc"
              line="#1f2f3d"
              series={[
                { label: "Headspace CO₂ (ppm ÷ 10)", color: "#00d4ff", x: tx, y: samples.map((s) => s.co2_hs_ppm / 10) },
                { label: "Headspace C₂H₄ (ppb)", color: "#ff5c5c", x: tx, y: samples.map((s) => s.eth_hs_ppb) },
              ]}
            />

            <Chart
              title="6. Boundary-Layer g_bl & Lid Dew-Point Safety Margin"
              yLabel="mm/s or °C"
              xMax={120}
              now={comm?.t}
              fg="#e8f0f7"
              muted="#8fa6bc"
              line="#1f2f3d"
              series={[
                { label: "Ch 2 g_bl (mm/s)", color: "#00d4ff", x: tx, y: samples.map((s) => s.ch2.meanGblMms) },
                { label: "Ch 1/3 g_bl (mm/s)", color: "#5ec962", x: tx, y: samples.map((s) => s.ch1.meanGblMms) },
                { label: "Lid Dew Margin ΔT (°C)", color: "#f5a623", x: tx, y: samples.map((s) => s.dew_margin_c), dashed: true },
              ]}
            />
          </div>
        </aside>
      </div>

      {/* PARAMETER PROVENANCE LEDGER MODAL */}
      {showLedger && (
        <div className="modal-backdrop" onClick={() => setShowLedger(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <strong>
                Parameter Provenance Ledger ({LEDGER.length} parameters · {REFERENCES.length} primary sources)
              </strong>
              <button className="btn" onClick={() => setShowLedger(false)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <table className="comp-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Group</th>
                    <th>Value</th>
                    <th>Unit</th>
                    <th>Tier</th>
                    <th style={{ textAlign: "left" }}>Description &amp; Provenance</th>
                  </tr>
                </thead>
                <tbody>
                  {LEDGER.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <code>{entry.id}</code>
                      </td>
                      <td>{entry.group}</td>
                      <td>{entry.value}</td>
                      <td>{entry.unit}</td>
                      <td>{entry.tier}</td>
                      <td style={{ textAlign: "left" }}>
                        {entry.description}{" "}
                        {entry.source && (
                          <span style={{ color: "#00d4ff" }}>[{entry.source}]</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SCIENTIFIC INTRODUCTION & FLIGHT TOUR MODAL */}
      {showTour && (
        <div className="modal-backdrop" onClick={() => setShowTour(false)}>
          <div className="modal-dialog modal-dialog-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <strong style={{ fontSize: 16, color: "#00d4ff" }}>
                  LEAF GBC1 · Artemis III Lunar Plant Growth Chamber Digital Twin
                </strong>
                <div style={{ fontSize: 11, color: "#8fa6bc", marginTop: 2 }}>
                  NASA Artemis III Deployed Surface Payload · Multiscale 164-Seed Cellular &amp; CFD Digital Twin
                </div>
              </div>
              <button className="btn" onClick={() => setShowTour(false)}>
                Close Tour
              </button>
            </div>
            <div className="modal-body" style={{ lineHeight: 1.55, fontSize: 13, color: "#d2e1ee" }}>
              <section style={{ marginBottom: 20 }}>
                <h3 style={{ color: "#00d4ff", marginBottom: 6, fontSize: 14 }}>1. Scientific Mission &amp; Biological Challenge</h3>
                <p>
                  On the lunar surface, <strong>hypogravity (g = 0.166g)</strong> reduces natural buoyant thermal convection by <strong>83.4%</strong> compared to terrestrial 1g. Without buoyant airflow, warm humid air envelopes plant foliage, thickening the boundary layer, impeding transpirational cooling, and suppressing photosynthetic CO2 uptake while accumulating respiratory ethylene (C2H4) to toxic levels.
                </p>
                <p style={{ marginTop: 8 }}>
                  The <strong>Lunar Effects on Agricultural Flora (LEAF)</strong> instrument on Artemis III cultivates plants in sealed Growth Biologic Chambers (GBC) to study morphological, physiological, and molecular gene expression responses on the lunar surface. This digital twin simulates <strong>Growth Bed Chamber 1 (GBC1)</strong> across a 5-day (120 h) flight mission.
                </p>
              </section>

              <section style={{ marginBottom: 20 }}>
                <h3 style={{ color: "#00d4ff", marginBottom: 6, fontSize: 14 }}>2. 3D Cellular Seedling Phenotypic Plasticity (Figure 2 in Manuscript)</h3>
                <p>
                  Coupled cellular simulations from the <strong>Seed_Model</strong> (incorporating authentic 3D cellular cross-sections from <em>deepspace-seed-twin</em>) resolve morphological plasticity across spaceflight environmental, atmospheric, radiation, and hardware vectors:
                </p>
                <div style={{ textAlign: "center", margin: "10px 0" }}>
                  <img
                    src="fig2_seed_phenotypic_variation.png"
                    alt="Figure 2: 3D Seed Model Phenotypic Variation Atlas"
                    style={{ maxWidth: "100%", maxHeight: 360, borderRadius: 6, border: "1px solid #1f2f3d" }}
                  />
                  <div style={{ fontSize: 11, color: "#8fa6bc", marginTop: 4 }}>
                    Figure 2: Predicted 3D cellular seedling phenotypic variation across spaceflight environmental, atmospheric, radiation, and hardware vectors
                  </div>
                </div>
                <ul style={{ paddingLeft: 20, marginTop: 6, fontSize: 12 }}>
                  <li><strong>Hardware (35 µm Nytex Screen):</strong> 100% root exclusion above Y = 14.77 mm with 90&deg; tangential gliding preserving fixative perfusion safety (&Delta;P = 1.75 kPa &lt;&lt; 8.04 kPa).</li>
                  <li><strong>Gravity (1.0g vs 0.166g vs 0g):</strong> Amyloplast statolith sedimentation velocity &prop; g, driving vertical downward descent (1.0g) vs 18.4&deg; dispersion (0.166g Moon) vs autotropic/hydrotropic wandering (0g microgravity).</li>
                  <li><strong>Atmospheric Chemistry:</strong> Normoxia vs hypoxic stunting (&lt; 5 kPa O2) vs phytotoxic ethylene (&gt; 50 ppb C2H4) triggering the <em>triple response</em> (+85% radial hypocotyl swelling and apical hook tightening).</li>
                  <li><strong>Convective Airflow:</strong> Forced sweep (g_bl = 13.4 mm/s) vs stagnant fluid envelope (g_bl &lt; 3 mm/s) trapping respiratory heat and ethylene.</li>
                  <li><strong>Cosmic Radiation:</strong> High-LET heavy ions (⁵⁶Fe) inducing meristematic DNA double-strand breaks and G2/M cell-cycle checkpoint arrest.</li>
                  <li><strong>Light &amp; Crowding:</strong> Far-red depletion driving shade avoidance syndrome (SAS, +38% elongation) and 3D phototropic lean away from neighbors.</li>
                </ul>
              </section>

              <section style={{ marginBottom: 20 }}>
                <h3 style={{ color: "#5ec962", marginBottom: 6, fontSize: 14 }}>3. Three-Compartment Sowing Architecture &amp; Community Kinetics (Figure 3 in Manuscript)</h3>
                <p>
                  GBC1 houses <strong>164 individual seeds</strong> on top of a <strong>35 µm Nytex monofilament root barrier</strong> at elevation Y = 14.77 mm above three porous phenolic foam cassettes (Y in [7.62, 14.62] mm), partitioned by solid internal baffles at Z = &plusmn;8.5 mm:
                </p>
                <ul style={{ paddingLeft: 20, marginTop: 6 }}>
                  <li><strong>Chamber 1 (Z in [-30.5, -9.5] mm):</strong> 32 <em>Brassica rapa</em> crop seeds (8 &times; 4 lattice, 47.2 seeds/dm&sup2;).</li>
                  <li><strong>Chamber 2 Central (Z in [-7.5, +7.5] mm):</strong> 100 <em>Arabidopsis thaliana</em> genetic model seeds (10 &times; 10 dense lawn, 206.4 seeds/dm&sup2;).</li>
                  <li><strong>Chamber 3 (Z in [+9.5, +30.5] mm):</strong> 32 <em>Brassica rapa</em> crop seeds (8 &times; 4 lattice, 47.2 seeds/dm&sup2;).</li>
                </ul>
                <div style={{ textAlign: "center", margin: "10px 0" }}>
                  <img
                    src="fig2_community_germination_and_morphometrics.png"
                    alt="Figure 3: 3D Cellular Progression and Community Kinetics"
                    style={{ maxWidth: "100%", maxHeight: 340, borderRadius: 6, border: "1px solid #1f2f3d" }}
                  />
                  <div style={{ fontSize: 11, color: "#8fa6bc", marginTop: 4 }}>
                    Figure 3: 3D cellular developmental progression (deepspace-seed-twin midplane cellular anatomy) &amp; community kinetics
                  </div>
                </div>
              </section>

              <section style={{ marginBottom: 20 }}>
                <h3 style={{ color: "#f5a623", marginBottom: 6, fontSize: 14 }}>4. Multiscale Physical &amp; Biological Couplings</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                  <div style={{ background: "#0a131c", border: "1px solid #1f2f3d", borderRadius: 6, padding: 10 }}>
                    <strong style={{ color: "#00d4ff" }}>3D CFD Airflow &amp; Microclimate</strong>
                    <p style={{ fontSize: 12, marginTop: 4 }}>
                      Simulates active sweep-air pumping (Q = 25 mL/min) in Push mode (Ports 1 &amp; 3 &rarr; Port 2) or Pull mode (Port 2 &rarr; Ports 1 &amp; 3), capturing ``dip-and-converge'' flow through baffle windows, wind attenuation through foliage, and local boundary layer conductance g_bl.
                    </p>
                  </div>
                  <div style={{ background: "#0a131c", border: "1px solid #1f2f3d", borderRadius: 6, padding: 10 }}>
                    <strong style={{ color: "#5ec962" }}>Crowding &amp; Shade Avoidance (SAS)</strong>
                    <p style={{ fontSize: 12, marginTop: 4 }}>
                      Beer–Lambert foliar canopy light extinction (f_light) triggers shade avoidance syndrome (SAS) in dense stands, upregulating hypocotyl elongation and driving 3D lateral phototropic shoot lean (&le; 2.2&deg;) away from shading neighbors.
                    </p>
                  </div>
                  <div style={{ background: "#0a131c", border: "1px solid #1f2f3d", borderRadius: 6, padding: 10 }}>
                    <strong style={{ color: "#a6d96a" }}>35 µm Nytex Root-Barrier Exclusion</strong>
                    <p style={{ fontSize: 12, marginTop: 4 }}>
                      Radicles anchor on the 35 µm mesh and deflect tangentially (100% exclusion above Y = 14.77 mm), preventing foam clogging and keeping the end-of-mission RNAlater fixative pressure drop &Delta;P = 1.75 kPa &lt;&lt; 8.04 kPa bubble point.
                    </p>
                  </div>
                  <div style={{ background: "#0a131c", border: "1px solid #1f2f3d", borderRadius: 6, padding: 10 }}>
                    <strong style={{ color: "#ff5c5c" }}>54.05 mL Headspace Chemistry</strong>
                    <p style={{ fontSize: 12, marginTop: 4 }}>
                      Collective respiration and FvCB canopy photosynthesis balance O2 and CO2. Continuous sweep flushing prevents ethylene accumulation (&lt; 0.1 ppb vs. &gt; 130 ppb stagnant) and maintains lid dew margin &Delta;T &ge; +2.8&deg;C to prevent camera fogging.
                    </p>
                  </div>
                </div>
              </section>

              <section style={{ marginBottom: 20 }}>
                <h3 style={{ color: "#e7298a", marginBottom: 6, fontSize: 14 }}>5. 3D Chamber Digital Twin Visualizations: Gravity &amp; Airflow Lessons</h3>
                <p>
                  High-resolution 3D renders from <strong>Seed_model_in_GBC1_model</strong> illustrate how chamber boundaries, gravity scaling, and pump airflow alter seedling architecture (Figure 7 in manuscript):
                </p>
                <div style={{ textAlign: "center", margin: "10px 0" }}>
                  <img
                    src="fig7_chamber_gravity_flow_morphology.png"
                    alt="Figure 7: 3D Chamber Lessons on Gravity and Flow"
                    style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 6, border: "1px solid #1f2f3d" }}
                  />
                </div>
                <ul style={{ paddingLeft: 20, marginTop: 6, fontSize: 12 }}>
                  <li><strong>Lesson 1 (Gravity Level):</strong> On the Moon (0.166g), 83.4% reduction in buoyant driving force results in broader radicle descent spread (35&deg;) and extensive horizontal Nytex gliding (2.87 mm) compared to Earth 1.0g downward descent. Microgravity (0g) produces autotropic root waving and coiling.</li>
                  <li><strong>Lesson 2 (Pump Flow Rate):</strong> Active Push sweeping (Q = 25 mL/min) accelerates air into Chamber 2 (u = 80 mm/s, g_bl = 13.4 mm/s), purging ethylene below 0.1 ppb. Pump-off stagnant faults trap respiratory ethylene (136.5 ppb), triggering the severe triple response (+85% radial hypocotyl swelling, exaggerated hook, stunted radicle).</li>
                </ul>
              </section>

              <section style={{ marginBottom: 20 }}>
                <h3 style={{ color: "#a6d96a", marginBottom: 6, fontSize: 14 }}>6. Supplementary Information: 5 Full-Page Montages (Figures S1–S5)</h3>
                <p>
                  A complete companion <strong>Supplementary Information document</strong> explores the full hardware setting space across 5 page-sized montages:
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8, fontSize: 12 }}>
                  <div style={{ background: "#0a131c", border: "1px solid #1f2f3d", borderRadius: 6, padding: 8 }}>
                    <strong>Fig. S1: Gravitational Scaling</strong>
                    <div style={{ color: "#8fa6bc", fontSize: 11, marginTop: 2 }}>Earth (1.0g) &rarr; Mars (0.38g) &rarr; Moon (0.166g) &rarr; ISS (0.0g) statolith physics &amp; root turning.</div>
                  </div>
                  <div style={{ background: "#0a131c", border: "1px solid #1f2f3d", borderRadius: 6, padding: 8 }}>
                    <strong>Fig. S2: Ventilation &amp; Triple Response</strong>
                    <div style={{ color: "#8fa6bc", fontSize: 11, marginTop: 2 }}>Push vs. Pull vs. Stagnant CFD streamlines &amp; ethylene dose-response curves.</div>
                  </div>
                  <div style={{ background: "#0a131c", border: "1px solid #1f2f3d", borderRadius: 6, padding: 8 }}>
                    <strong>Fig. S3: Substrate Matric Potential</strong>
                    <div style={{ color: "#8fa6bc", fontSize: 11, marginTop: 2 }}>Capillary water retention, imbibition delay, and Nytex bubble-point safety (&Delta;P &lt;&lt; 8.04 kPa).</div>
                  </div>
                  <div style={{ background: "#0a131c", border: "1px solid #1f2f3d", borderRadius: 6, padding: 8 }}>
                    <strong>Fig. S4: Sowing Density Sweeps</strong>
                    <div style={{ color: "#8fa6bc", fontSize: 11, marginTop: 2 }}>0.25&times; to 2.0&times; crown closure, Beer–Lambert mutual shading, &amp; 3D phototropic lean.</div>
                  </div>
                  <div style={{ background: "#0a131c", border: "1px solid #1f2f3d", borderRadius: 6, padding: 8, gridColumn: "span 2" }}>
                    <strong>Fig. S5: Deep-Space Cosmic Radiation &amp; High-LET Heavy-Ion Matrix</strong>
                    <div style={{ color: "#8fa6bc", fontSize: 11, marginTop: 2 }}>GCR/SPE dosimetry, ⁵⁶Fe Bragg peak track structure, DNA double-strand breaks, G2/M arrest, and 8-scenario radar matrix.</div>
                  </div>
                </div>
              </section>

              <section style={{ borderTop: "1px solid #1f2f3d", paddingTop: 14 }}>
                <h3 style={{ color: "#e8f0f7", marginBottom: 6, fontSize: 14 }}>7. Quick-Start Guide for Interactive Exploration</h3>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                  <button className="btn" onClick={() => { setShowTour(false); chamberViewerRef.current?.setCameraPreset("iso"); }}>
                    🎥 3D Isometric View
                  </button>
                  <button className="btn" onClick={() => { setShowTour(false); chamberViewerRef.current?.setCameraPreset("top"); }}>
                    🗺️ Top-Down Sowing Map
                  </button>
                  <button className="btn" onClick={() => { setShowTour(false); chamberViewerRef.current?.setCameraPreset("ch2"); }}>
                    🌱 Zoom Chamber 2 (100 Ath)
                  </button>
                  <button className="btn" onClick={() => { setShowTour(false); setTargetHour(120); }}>
                    ⏱️ Jump to 120 h (Mature Canopy)
                  </button>
                  <button className="btn" onClick={() => { setShowTour(false); setShowManuscript(true); }} style={{ borderColor: "#a6d96a", color: "#a6d96a" }}>
                    📄 Read NPJ Manuscript
                  </button>
                  <button className="btn" onClick={() => { setShowTour(false); setShowSupplementary(true); }} style={{ borderColor: "#00d4ff", color: "#00d4ff" }}>
                    📑 View Supplementary Info (PDF)
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* NPJ MICROGRAVITY MANUSCRIPT PDF EMBED MODAL */}
      {showManuscript && (
        <div className="modal-backdrop" onClick={() => setShowManuscript(false)}>
          <div className="modal-dialog modal-dialog-xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <strong style={{ fontSize: 16, color: "#a6d96a" }}>
                  Manuscript · npj Microgravity Two-Column Format
                </strong>
                <div style={{ fontSize: 11, color: "#8fa6bc", marginTop: 2 }}>
                  Compiled with Springer Nature sn-jnl template (pdflatex + bibtex)
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <a
                  href="./leaf_gbc1_community_npj_microgravity.pdf"
                  download="leaf_gbc1_community_npj_microgravity.pdf"
                  className="btn"
                  style={{ background: "#a6d96a", color: "#081018", textDecoration: "none", fontWeight: 700 }}
                >
                  ⬇️ Download PDF (2.9 MB)
                </a>
                <a
                  href="./leaf_gbc1_community_npj_microgravity.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                  style={{ textDecoration: "none" }}
                >
                  Open in New Tab
                </a>
                <button className="btn" onClick={() => setShowManuscript(false)}>
                  Close
                </button>
              </div>
            </div>
            <div className="modal-body" style={{ padding: 0, height: "82vh", overflow: "hidden" }}>
              <iframe
                src="./leaf_gbc1_community_npj_microgravity.pdf#toolbar=1&navpanes=1&view=FitH"
                title="npj Microgravity Manuscript PDF"
                style={{ width: "100%", height: "100%", border: "none" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* SUPPLEMENTARY INFORMATION PDF EMBED MODAL */}
      {showSupplementary && (
        <div className="modal-backdrop" onClick={() => setShowSupplementary(false)}>
          <div className="modal-dialog modal-dialog-xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <strong style={{ fontSize: 16, color: "#00d4ff" }}>
                  Supplementary Information · Barker (2026) npj Microgravity
                </strong>
                <div style={{ fontSize: 11, color: "#8fa6bc", marginTop: 2 }}>
                  5 Full-Page Montages (Figures S1–S5) exploring the flight hardware parameter space
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <a
                  href="./supplementary_information.pdf"
                  download="supplementary_information.pdf"
                  className="btn"
                  style={{ background: "#00d4ff", color: "#081018", textDecoration: "none", fontWeight: 700 }}
                >
                  ⬇️ Download Supplementary PDF (2.0 MB)
                </a>
                <a
                  href="./supplementary_information.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                  style={{ textDecoration: "none" }}
                >
                  Open in New Tab
                </a>
                <button className="btn" onClick={() => setShowSupplementary(false)}>
                  Close
                </button>
              </div>
            </div>
            <div className="modal-body" style={{ padding: 0, height: "82vh", overflow: "hidden" }}>
              <iframe
                src="./supplementary_information.pdf#toolbar=1&navpanes=1&view=FitH"
                title="Supplementary Information PDF"
                style={{ width: "100%", height: "100%", border: "none" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
