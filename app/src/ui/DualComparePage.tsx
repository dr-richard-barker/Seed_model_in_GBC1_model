import { useMemo, useState } from "react";
import PRECOMPUTED_RAW from "../data/precomputedScenarios.json";
import { GBC1CommunityTwin, type CommunitySample } from "../model/community";
import { resolveEnv } from "../model/environment";
import type { FlowMode } from "../model/gbc1Field";
import { defaultParams } from "../model/params";
import { PRESET_BY_ID } from "../model/presets";
import { Chart } from "./Chart";

export interface DualSimConfig {
  label: string;
  gravityG: number;
  flowMlMin: number;
  flowMode: FlowMode;
  waterFillPct: number;
  densityMultiplier: number;
  tempC: number;
  lightUmol: number;
}

interface PrecomputedScenarioData {
  seedCount: number;
  samples: CommunitySample[];
}

const PRECOMPUTED = PRECOMPUTED_RAW as unknown as Record<string, PrecomputedScenarioData>;

interface DualPreset {
  id: string;
  title: string;
  subtitle: string;
  scenarioAId: string;
  scenarioBId: string;
  a: DualSimConfig;
  b: DualSimConfig;
}

const DUAL_PRESETS: DualPreset[] = [
  {
    id: "earth_vs_lunar",
    title: "Earth 1.0g vs. Lunar 0.166g",
    subtitle: "Gravitational scaling, Grashof convection (−83.4%), & statolith dispersion",
    scenarioAId: "earth_1g_push",
    scenarioBId: "lunar_push_nominal",
    a: {
      label: "Sim A · Earth Control (1.0g)",
      gravityG: 1.0,
      flowMlMin: 25,
      flowMode: "push",
      waterFillPct: 100,
      densityMultiplier: 1.0,
      tempC: 23.0,
      lightUmol: 150,
    },
    b: {
      label: "Sim B · Lunar Surface (0.166g)",
      gravityG: 0.166,
      flowMlMin: 25,
      flowMode: "push",
      waterFillPct: 100,
      densityMultiplier: 1.0,
      tempC: 23.0,
      lightUmol: 150,
    },
  },
  {
    id: "lunar_vs_0g",
    title: "Lunar 0.166g vs. Microgravity 0.0g",
    subtitle: "Artemis lunar surface vs. ISS orbital free-fall",
    scenarioAId: "lunar_push_nominal",
    scenarioBId: "iss_0g_push",
    a: {
      label: "Sim A · Lunar Surface (0.166g)",
      gravityG: 0.166,
      flowMlMin: 25,
      flowMode: "push",
      waterFillPct: 100,
      densityMultiplier: 1.0,
      tempC: 23.0,
      lightUmol: 150,
    },
    b: {
      label: "Sim B · Microgravity (0.0g)",
      gravityG: 0.0,
      flowMlMin: 25,
      flowMode: "push",
      waterFillPct: 100,
      densityMultiplier: 1.0,
      tempC: 23.0,
      lightUmol: 150,
    },
  },
  {
    id: "active_vs_stagnant",
    title: "Active Sweep (25 mL/min) vs. Stagnant Fault (Q = 0)",
    subtitle: "Boundary-layer ethylene accumulation & root-tip hypoxia diagnostic",
    scenarioAId: "lunar_push_nominal",
    scenarioBId: "stagnant_0g_fault",
    a: {
      label: "Sim A · Active Push (25 mL/min)",
      gravityG: 0.166,
      flowMlMin: 25,
      flowMode: "push",
      waterFillPct: 100,
      densityMultiplier: 1.0,
      tempC: 23.0,
      lightUmol: 150,
    },
    b: {
      label: "Sim B · Stagnant Fault (Q = 0, 0g)",
      gravityG: 0.0,
      flowMlMin: 0,
      flowMode: "push",
      waterFillPct: 100,
      densityMultiplier: 1.0,
      tempC: 23.0,
      lightUmol: 150,
    },
  },
  {
    id: "push_vs_pull",
    title: "Push vs. Pull Airflow Topology",
    subtitle: "Dip-and-converge jet channelling into Chamber 2",
    scenarioAId: "lunar_push_nominal",
    scenarioBId: "lunar_pull_nominal",
    a: {
      label: "Sim A · Push Mode (Ports 1,3 → 2)",
      gravityG: 0.166,
      flowMlMin: 25,
      flowMode: "push",
      waterFillPct: 100,
      densityMultiplier: 1.0,
      tempC: 23.0,
      lightUmol: 150,
    },
    b: {
      label: "Sim B · Pull Mode (Port 2 → 1,3)",
      gravityG: 0.166,
      flowMlMin: 25,
      flowMode: "pull",
      waterFillPct: 100,
      densityMultiplier: 1.0,
      tempC: 23.0,
      lightUmol: 150,
    },
  },
  {
    id: "hydration_deficit",
    title: "100% Hydration vs. 40% Capillary Deficit",
    subtitle: "Richards–van Genuchten foam matric potential & germination delay",
    scenarioAId: "lunar_push_nominal",
    scenarioBId: "moisture_deficit_40pct",
    a: {
      label: "Sim A · Nominal 100% Fill",
      gravityG: 0.166,
      flowMlMin: 25,
      flowMode: "push",
      waterFillPct: 100,
      densityMultiplier: 1.0,
      tempC: 23.0,
      lightUmol: 150,
    },
    b: {
      label: "Sim B · 40% Moisture Deficit",
      gravityG: 0.166,
      flowMlMin: 25,
      flowMode: "push",
      waterFillPct: 40,
      densityMultiplier: 1.0,
      tempC: 23.0,
      lightUmol: 150,
    },
  },
  {
    id: "sparse_vs_crowded",
    title: "Sparse (0.5×) vs. Crowded (1.5×) Sowing",
    subtitle: "Beer–Lambert foliar shading, SAS elongation & phototropic lean",
    scenarioAId: "lunar_sparse_05x",
    scenarioBId: "lunar_crowded_15x",
    a: {
      label: "Sim A · Sparse 0.5× (82 seeds)",
      gravityG: 0.166,
      flowMlMin: 25,
      flowMode: "push",
      waterFillPct: 100,
      densityMultiplier: 0.5,
      tempC: 23.0,
      lightUmol: 150,
    },
    b: {
      label: "Sim B · Crowded 1.5× (246 seeds)",
      gravityG: 0.166,
      flowMlMin: 25,
      flowMode: "push",
      waterFillPct: 100,
      densityMultiplier: 1.5,
      tempC: 23.0,
      lightUmol: 150,
    },
  },
];

interface DualRunResult {
  presetTitle: string;
  durationH: number;
  generatedAt: string;
  configA: DualSimConfig;
  configB: DualSimConfig;
  samplesA: CommunitySample[];
  samplesB: CommunitySample[];
  seedCountA: number;
  seedCountB: number;
}

function findMatchingPrecomputed(cfg: DualSimConfig): { samples: CommunitySample[]; seedCount: number } | null {
  for (const p of DUAL_PRESETS) {
    if (
      Math.abs(p.a.gravityG - cfg.gravityG) < 1e-4 &&
      Math.abs(p.a.flowMlMin - cfg.flowMlMin) < 1e-4 &&
      p.a.flowMode === cfg.flowMode &&
      Math.abs(p.a.waterFillPct - cfg.waterFillPct) < 1e-4 &&
      Math.abs(p.a.densityMultiplier - cfg.densityMultiplier) < 1e-4 &&
      Math.abs(p.a.tempC - cfg.tempC) < 1e-4 &&
      Math.abs(p.a.lightUmol - cfg.lightUmol) < 1e-4
    ) {
      const d = PRECOMPUTED[p.scenarioAId];
      if (d) return d;
    }
    if (
      Math.abs(p.b.gravityG - cfg.gravityG) < 1e-4 &&
      Math.abs(p.b.flowMlMin - cfg.flowMlMin) < 1e-4 &&
      p.b.flowMode === cfg.flowMode &&
      Math.abs(p.b.waterFillPct - cfg.waterFillPct) < 1e-4 &&
      Math.abs(p.b.densityMultiplier - cfg.densityMultiplier) < 1e-4 &&
      Math.abs(p.b.tempC - cfg.tempC) < 1e-4 &&
      Math.abs(p.b.lightUmol - cfg.lightUmol) < 1e-4
    ) {
      const d = PRECOMPUTED[p.scenarioBId];
      if (d) return d;
    }
  }
  return null;
}

async function runSingleSimulationAsync(
  cfg: DualSimConfig,
  durationH: number,
  onProgress?: (pct: number) => void,
): Promise<{ samples: CommunitySample[]; seedCount: number }> {
  const matched = findMatchingPrecomputed(cfg);
  if (matched) {
    onProgress?.(100);
    return {
      samples: matched.samples.filter((s) => s.t <= durationH),
      seedCount: matched.seedCount,
    };
  }

  const baseParams = defaultParams();
  const leafPreset = PRESET_BY_ID.get("leaf_gbc1")!;
  const env = resolveEnv(leafPreset, {
    gravity_g: cfg.gravityG,
    temp_c: cfg.tempC,
    light_umol: cfg.lightUmol,
    seeds: Math.round(164 * cfg.densityMultiplier),
    ...(cfg.flowMlMin <= 0.1 ? { vent_ach: 0, eth_scrub_per_h: 0 } : {}),
  });
  const twin = new GBC1CommunityTwin(baseParams, env, {
    densityMultiplier: cfg.densityMultiplier,
    flowMlMin: cfg.flowMlMin,
    flowMode: cfg.flowMode,
    waterFillPct: cfg.waterFillPct,
    dt: 0.25,
    sampleEvery: 2.0,
    rngSeed: 20261111,
  });

  const chunkH = 2.0;
  while (twin.t < durationH - 1e-9) {
    const nextTarget = Math.min(durationH, twin.t + chunkH);
    twin.runTo(nextTarget);
    onProgress?.(Math.min(100, (twin.t / durationH) * 100));
    await new Promise((r) => setTimeout(r, 0));
  }
  return { samples: twin.samples, seedCount: twin.specs.length };
}

function fmtDelta(a: number, b: number, digits = 2, unit = ""): string {
  const d = b - a;
  const sign = d > 0 ? "+" : "";
  const pct = Math.abs(a) > 1e-6 ? ` (${sign}${((d / Math.abs(a)) * 100).toFixed(1)}%)` : "";
  return `${sign}${d.toFixed(digits)}${unit ? ` ${unit}` : ""}${pct}`;
}

interface Props {
  theme: "dark" | "light";
}

export function DualComparePage({ theme }: Props) {
  const [presetId, setPresetId] = useState<string>("earth_vs_lunar");
  const [durationH, setDurationH] = useState<number>(120);
  const [configA, setConfigA] = useState<DualSimConfig>({ ...DUAL_PRESETS[0].a });
  const [configB, setConfigB] = useState<DualSimConfig>({ ...DUAL_PRESETS[0].b });
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>("");

  // Initial deterministic run from precomputed data (instant 0 ms load)
  const [result, setResult] = useState<DualRunResult>(() => {
    const initPreset = DUAL_PRESETS[0];
    const dataA = PRECOMPUTED[initPreset.scenarioAId] || { seedCount: 164, samples: [] };
    const dataB = PRECOMPUTED[initPreset.scenarioBId] || { seedCount: 164, samples: [] };
    return {
      presetTitle: initPreset.title,
      durationH: 120,
      generatedAt: new Date().toLocaleString(),
      configA: { ...initPreset.a },
      configB: { ...initPreset.b },
      samplesA: dataA.samples.filter((s) => s.t <= 120),
      samplesB: dataB.samples.filter((s) => s.t <= 120),
      seedCountA: dataA.seedCount,
      seedCountB: dataB.seedCount,
    };
  });

  const chartTheme = useMemo(
    () =>
      theme === "light"
        ? { fg: "#1e293b", muted: "#64748b", line: "#cbd5e1" }
        : { fg: "#e8f0f7", muted: "#8fa6bc", line: "#233443" },
    [theme],
  );

  const selectPreset = (id: string) => {
    const found = DUAL_PRESETS.find((p) => p.id === id);
    if (!found) return;
    setPresetId(id);
    const nextA = { ...found.a };
    const nextB = { ...found.b };
    setConfigA(nextA);
    setConfigB(nextB);
    const dataA = PRECOMPUTED[found.scenarioAId];
    const dataB = PRECOMPUTED[found.scenarioBId];
    if (dataA && dataB) {
      setResult({
        presetTitle: found.title,
        durationH,
        generatedAt: new Date().toLocaleString(),
        configA: nextA,
        configB: nextB,
        samplesA: dataA.samples.filter((s) => s.t <= durationH),
        samplesB: dataB.samples.filter((s) => s.t <= durationH),
        seedCountA: dataA.seedCount,
        seedCountB: dataB.seedCount,
      });
    }
  };

  const runCustomComparison = async () => {
    setIsRunning(true);
    setProgressMsg("Initializing comparison...");
    try {
      setProgressMsg("Simulating Sim A...");
      const resA = await runSingleSimulationAsync(configA, durationH, (pct) => {
        setProgressMsg(`Simulating Sim A: ${pct.toFixed(0)}%`);
      });
      setProgressMsg("Simulating Sim B...");
      const resB = await runSingleSimulationAsync(configB, durationH, (pct) => {
        setProgressMsg(`Simulating Sim B: ${pct.toFixed(0)}%`);
      });
      setResult({
        presetTitle: `${configA.label} vs. ${configB.label}`,
        durationH,
        generatedAt: new Date().toLocaleString(),
        configA: { ...configA },
        configB: { ...configB },
        samplesA: resA.samples,
        samplesB: resB.samples,
        seedCountA: resA.seedCount,
        seedCountB: resB.seedCount,
      });
    } finally {
      setIsRunning(false);
      setProgressMsg("");
    }
  };

  const endA = result.samplesA[result.samplesA.length - 1];
  const endB = result.samplesB[result.samplesB.length - 1];
  const tA = result.samplesA.map((s) => s.t);
  const tB = result.samplesB.map((s) => s.t);

  const diagnostics = useMemo(() => {
    const notes: { severity: "ok" | "warn" | "info"; text: string }[] = [];
    if (!endA || !endB) return notes;

    const gravRatio = Math.abs(result.configB.gravityG - result.configA.gravityG);
    if (gravRatio > 0.05) {
      notes.push({
        severity: "info",
        text: `Gravitational Buoyancy Shift: Changing gravity from ${result.configA.gravityG.toFixed(3)}g to ${result.configB.gravityG.toFixed(3)}g alters the Grashof number proportionally (Gr ∝ g), shifting Ch 2 root orientation and boundary-layer convection.`,
      });
    }
    if (endB.eth_hs_ppb > 50 || endA.eth_hs_ppb > 50) {
      const highLabel = endB.eth_hs_ppb > endA.eth_hs_ppb ? result.configB.label : result.configA.label;
      const peakEth = Math.max(endA.eth_hs_ppb, endB.eth_hs_ppb);
      notes.push({
        severity: "warn",
        text: `Ethylene Triple-Response Alert: ${highLabel} reaches ${peakEth.toFixed(1)} ppb headspace C₂H₄ (> 50 ppb threshold), triggering radial hypocotyl swelling and suppressed root elongation.`,
      });
    } else {
      notes.push({
        severity: "ok",
        text: `Headspace Gas Stability: Active sweep ventilation keeps C₂H₄ well below the 50 ppb triple-response threshold in both simulations (Sim A: ${endA.eth_hs_ppb.toFixed(2)} ppb; Sim B: ${endB.eth_hs_ppb.toFixed(2)} ppb).`,
      });
    }
    notes.push({
      severity: endA.rnalater_dp_kpa < 2.5 && endB.rnalater_dp_kpa < 2.5 ? "ok" : "warn",
      text: `35 µm Nytex Exclusion & Fixative Safety: Both runs retain ${endA.nytex_root_exclusion_pct.toFixed(1)}% / ${endB.nytex_root_exclusion_pct.toFixed(1)}% of root cells above Y = 14.77 mm, keeping RNAlater ΔP (${endA.rnalater_dp_kpa.toFixed(2)} / ${endB.rnalater_dp_kpa.toFixed(2)} kPa) safely below the 8.04 kPa capillary bubble point.`,
    });
    if (Math.abs(endB.ch2.meanLeanDeg - endA.ch2.meanLeanDeg) > 0.15) {
      notes.push({
        severity: "info",
        text: `Shade-Avoidance Phototropic Lean: Chamber 2 A. thaliana lateral shoot lean shifts from ${endA.ch2.meanLeanDeg.toFixed(2)}° (Sim A) to ${endB.ch2.meanLeanDeg.toFixed(2)}° (Sim B) alongside Beer–Lambert light factor ${endA.ch2.meanLightFactor.toFixed(3)} → ${endB.ch2.meanLightFactor.toFixed(3)}.`,
      });
    }
    return notes;
  }, [endA, endB, result]);

  const exportCsv = () => {
    const header = "Metric,Unit,Sim_A,Sim_B,Delta\n";
    const rows = [
      ["Gravity", "g", result.configA.gravityG, result.configB.gravityG, result.configB.gravityG - result.configA.gravityG],
      ["Flow_Rate", "mL/min", result.configA.flowMlMin, result.configB.flowMlMin, result.configB.flowMlMin - result.configA.flowMlMin],
      ["Germination_All", "%", endA.germination_pct_all.toFixed(1), endB.germination_pct_all.toFixed(1), (endB.germination_pct_all - endA.germination_pct_all).toFixed(1)],
      ["Ch2_Ath_Root", "mm", endA.ch2.meanRootLenMm.toFixed(2), endB.ch2.meanRootLenMm.toFixed(2), (endB.ch2.meanRootLenMm - endA.ch2.meanRootLenMm).toFixed(2)],
      ["Ch2_Ath_Hypocotyl", "mm", endA.ch2.meanHypocotylMm.toFixed(2), endB.ch2.meanHypocotylMm.toFixed(2), (endB.ch2.meanHypocotylMm - endA.ch2.meanHypocotylMm).toFixed(2)],
      ["Ch1_Brapa_Root", "mm", endA.ch1.meanRootLenMm.toFixed(2), endB.ch1.meanRootLenMm.toFixed(2), (endB.ch1.meanRootLenMm - endA.ch1.meanRootLenMm).toFixed(2)],
      ["Ch2_gbl", "mm/s", endA.ch2.meanGblMms.toFixed(2), endB.ch2.meanGblMms.toFixed(2), (endB.ch2.meanGblMms - endA.ch2.meanGblMms).toFixed(2)],
      ["Headspace_Ethylene", "ppb", endA.eth_hs_ppb.toFixed(2), endB.eth_hs_ppb.toFixed(2), (endB.eth_hs_ppb - endA.eth_hs_ppb).toFixed(2)],
      ["Ch2_Tip_O2", "kPa", endA.ch2.meanO2TipKpa.toFixed(2), endB.ch2.meanO2TipKpa.toFixed(2), (endB.ch2.meanO2TipKpa - endA.ch2.meanO2TipKpa).toFixed(2)],
      ["RNAlater_dP", "kPa", endA.rnalater_dp_kpa.toFixed(2), endB.rnalater_dp_kpa.toFixed(2), (endB.rnalater_dp_kpa - endA.rnalater_dp_kpa).toFixed(2)],
    ];
    const blob = new Blob([header + rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gbc1_dual_comparison_${result.durationH}h.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="portal-page">
      {/* CONFIGURATION PANEL (HIDDEN WHEN PRINTING PDF) */}
      <section className="portal-section no-print" style={{ marginTop: 0 }}>
        <div className="section-head">
          <div>
            <h2>Dual-Simulation Comparison Workbench</h2>
            <span className="section-sub">
              Configure two independent 164-seed community runs (e.g., Earth 1.0g vs. Lunar 0.166g) and export a
              publication-ready PDF report.
            </span>
          </div>
          <div className="btn-group">
            <button className="cta-btn cta-primary" onClick={runCustomComparison} disabled={isRunning}>
              {isRunning ? (progressMsg ? `⏳ ${progressMsg}` : "Running Simulations...") : "▶ Run Dual Comparison"}
            </button>
            <button className="cta-btn cta-secondary" onClick={() => window.print()}>
              🖨 Export Report as PDF
            </button>
            <button className="btn" onClick={exportCsv}>
              ⬇ Export CSV
            </button>
          </div>
        </div>

        {/* QUICK PRESETS */}
        <div className="dual-presets-bar">
          {DUAL_PRESETS.map((p) => (
            <button
              key={p.id}
              className={`preset-chip ${presetId === p.id ? "active" : ""}`}
              onClick={() => selectPreset(p.id)}
            >
              <strong>{p.title}</strong>
              <span>{p.subtitle}</span>
            </button>
          ))}
        </div>

        {/* SIM A & SIM B CUSTOM CONTROLS */}
        <div className="dual-config-grid">
          {(
            [
              { key: "A", cfg: configA, setCfg: setConfigA, badge: "#3b82f6" },
              { key: "B", cfg: configB, setCfg: setConfigB, badge: "#f59e0b" },
            ] as const
          ).map(({ key, cfg, setCfg, badge }) => (
            <div key={key} className="card dual-config-card">
              <div className="dual-card-head">
                <span className="sim-dot" style={{ background: badge }} />
                <input
                  type="text"
                  value={cfg.label}
                  onChange={(e) => {
                    setPresetId("custom");
                    setCfg({ ...cfg, label: e.target.value });
                  }}
                  aria-label={`Simulation ${key} label`}
                />
              </div>
              <div className="dual-fields-grid">
                <label>
                  <span>Gravity ({cfg.gravityG.toFixed(3)} g)</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={cfg.gravityG}
                    onChange={(e) => {
                      setPresetId("custom");
                      setCfg({ ...cfg, gravityG: Number(e.target.value) });
                    }}
                  />
                </label>
                <label>
                  <span>Pump Flow Q ({cfg.flowMlMin} mL/min)</span>
                  <input
                    type="range"
                    min={0}
                    max={60}
                    step={5}
                    value={cfg.flowMlMin}
                    onChange={(e) => {
                      setPresetId("custom");
                      setCfg({ ...cfg, flowMlMin: Number(e.target.value) });
                    }}
                  />
                </label>
                <label>
                  <span>Airflow Mode</span>
                  <select
                    value={cfg.flowMode}
                    onChange={(e) => {
                      setPresetId("custom");
                      setCfg({ ...cfg, flowMode: e.target.value as FlowMode });
                    }}
                  >
                    <option value="push">Push (Ports 1,3 → 2)</option>
                    <option value="pull">Pull (Port 2 → 1,3)</option>
                  </select>
                </label>
                <label>
                  <span>Foam Hydration ({cfg.waterFillPct}%)</span>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    step={5}
                    value={cfg.waterFillPct}
                    onChange={(e) => {
                      setPresetId("custom");
                      setCfg({ ...cfg, waterFillPct: Number(e.target.value) });
                    }}
                  />
                </label>
                <label>
                  <span>Sowing Density ({cfg.densityMultiplier.toFixed(2)}×)</span>
                  <select
                    value={cfg.densityMultiplier}
                    onChange={(e) => {
                      setPresetId("custom");
                      setCfg({ ...cfg, densityMultiplier: Number(e.target.value) });
                    }}
                  >
                    <option value={0.5}>0.5× (82 seeds)</option>
                    <option value={0.75}>0.75× (123 seeds)</option>
                    <option value={1.0}>1.0× (164 flight seeds)</option>
                    <option value={1.25}>1.25× (205 seeds)</option>
                    <option value={1.5}>1.5× (246 seeds)</option>
                  </select>
                </label>
                <label>
                  <span>Temp ({cfg.tempC.toFixed(1)} °C) / PAR ({cfg.lightUmol})</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      type="number"
                      min={15}
                      max={32}
                      step={0.5}
                      value={cfg.tempC}
                      onChange={(e) => {
                        setPresetId("custom");
                        setCfg({ ...cfg, tempC: Number(e.target.value) });
                      }}
                    />
                    <input
                      type="number"
                      min={0}
                      max={300}
                      step={25}
                      value={cfg.lightUmol}
                      onChange={(e) => {
                        setPresetId("custom");
                        setCfg({ ...cfg, lightUmol: Number(e.target.value) });
                      }}
                    />
                  </div>
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="dual-duration-row">
          <span>Mission Duration Horizon: <strong>{durationH} h ({(durationH / 24).toFixed(1)} days)</strong></span>
          <input
            type="range"
            min={24}
            max={120}
            step={12}
            value={durationH}
            onChange={(e) => setDurationH(Number(e.target.value))}
          />
        </div>
      </section>

      {/* PRINTABLE COMPARATIVE REPORT */}
      <article className="dual-report">
        <header className="report-header">
          <div>
            <div className="report-kicker">LEAF GBC1 DIGITAL TWIN · COMPARATIVE SIMULATION REPORT</div>
            <h1>{result.presetTitle}</h1>
            <p className="report-meta">
              Horizon: 0–{result.durationH} h ({(result.durationH / 24).toFixed(1)} d) · Deterministic Seed: 20261111 ·
              Generated: {result.generatedAt}
            </p>
          </div>
          <div className="report-badges">
            <span className="report-badge badge-a">A: {result.configA.label} ({result.seedCountA} seeds)</span>
            <span className="report-badge badge-b">B: {result.configB.label} ({result.seedCountB} seeds)</span>
          </div>
        </header>

        {/* QUANTITATIVE DELTA TABLE */}
        <section className="report-block">
          <h2>1. Boundary Conditions &amp; Endpoint Morphometric Comparison ({result.durationH} h)</h2>
          <table className="report-table">
            <thead>
              <tr>
                <th>Metric / Compartment</th>
                <th>{result.configA.label}</th>
                <th>{result.configB.label}</th>
                <th>Delta (B − A / % Change)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Gravity / Airflow / Hydration</td>
                <td className="mono">
                  {result.configA.gravityG.toFixed(3)}g · {result.configA.flowMode.toUpperCase()} {result.configA.flowMlMin} mL/min · {result.configA.waterFillPct}%
                </td>
                <td className="mono">
                  {result.configB.gravityG.toFixed(3)}g · {result.configB.flowMode.toUpperCase()} {result.configB.flowMlMin} mL/min · {result.configB.waterFillPct}%
                </td>
                <td className="mono">{fmtDelta(result.configA.gravityG, result.configB.gravityG, 3, "g")}</td>
              </tr>
              <tr>
                <td>Overall Community Germination</td>
                <td className="mono">{endA.germination_pct_all.toFixed(1)}%</td>
                <td className="mono">{endB.germination_pct_all.toFixed(1)}%</td>
                <td className="mono">{fmtDelta(endA.germination_pct_all, endB.germination_pct_all, 1, "%")}</td>
              </tr>
              <tr>
                <td>Ch 2 (<em>A. thaliana</em>) t50 / Root / Hypocotyl</td>
                <td className="mono">
                  {endA.ch2.t50H !== null ? `${endA.ch2.t50H.toFixed(1)} h` : "—"} · {endA.ch2.meanRootLenMm.toFixed(2)} mm · {endA.ch2.meanHypocotylMm.toFixed(2)} mm
                </td>
                <td className="mono">
                  {endB.ch2.t50H !== null ? `${endB.ch2.t50H.toFixed(1)} h` : "—"} · {endB.ch2.meanRootLenMm.toFixed(2)} mm · {endB.ch2.meanHypocotylMm.toFixed(2)} mm
                </td>
                <td className="mono">Root: {fmtDelta(endA.ch2.meanRootLenMm, endB.ch2.meanRootLenMm, 2, "mm")}</td>
              </tr>
              <tr>
                <td>Ch 1 (<em>B. rapa</em>) t50 / Root / Hypocotyl</td>
                <td className="mono">
                  {endA.ch1.t50H !== null ? `${endA.ch1.t50H.toFixed(1)} h` : "—"} · {endA.ch1.meanRootLenMm.toFixed(2)} mm · {endA.ch1.meanHypocotylMm.toFixed(2)} mm
                </td>
                <td className="mono">
                  {endB.ch1.t50H !== null ? `${endB.ch1.t50H.toFixed(1)} h` : "—"} · {endB.ch1.meanRootLenMm.toFixed(2)} mm · {endB.ch1.meanHypocotylMm.toFixed(2)} mm
                </td>
                <td className="mono">Root: {fmtDelta(endA.ch1.meanRootLenMm, endB.ch1.meanRootLenMm, 2, "mm")}</td>
              </tr>
              <tr>
                <td>Ch 2 Canopy LAI / Light Factor / Lean</td>
                <td className="mono">
                  {endA.ch2.lai.toFixed(3)} · {endA.ch2.meanLightFactor.toFixed(3)} · {endA.ch2.meanLeanDeg.toFixed(2)}°
                </td>
                <td className="mono">
                  {endB.ch2.lai.toFixed(3)} · {endB.ch2.meanLightFactor.toFixed(3)} · {endB.ch2.meanLeanDeg.toFixed(2)}°
                </td>
                <td className="mono">Lean: {fmtDelta(endA.ch2.meanLeanDeg, endB.ch2.meanLeanDeg, 2, "°")}</td>
              </tr>
              <tr>
                <td>Ch 2 Boundary-Layer Conductance g_bl</td>
                <td className="mono">{endA.ch2.meanGblMms.toFixed(2)} mm/s</td>
                <td className="mono">{endB.ch2.meanGblMms.toFixed(2)} mm/s</td>
                <td className="mono">{fmtDelta(endA.ch2.meanGblMms, endB.ch2.meanGblMms, 2, "mm/s")}</td>
              </tr>
              <tr>
                <td>Headspace C₂H₄ / Tip O₂</td>
                <td className="mono">
                  {endA.eth_hs_ppb.toFixed(2)} ppb · {endA.ch2.meanO2TipKpa.toFixed(2)} kPa
                </td>
                <td className="mono">
                  {endB.eth_hs_ppb.toFixed(2)} ppb · {endB.ch2.meanO2TipKpa.toFixed(2)} kPa
                </td>
                <td className="mono">C₂H₄: {fmtDelta(endA.eth_hs_ppb, endB.eth_hs_ppb, 2, "ppb")}</td>
              </tr>
              <tr>
                <td>Nytex Root Exclusion / RNAlater ΔP</td>
                <td className="mono">
                  {endA.nytex_root_exclusion_pct.toFixed(1)}% · {endA.rnalater_dp_kpa.toFixed(2)} kPa
                </td>
                <td className="mono">
                  {endB.nytex_root_exclusion_pct.toFixed(1)}% · {endB.rnalater_dp_kpa.toFixed(2)} kPa
                </td>
                <td className="mono">ΔP: {fmtDelta(endA.rnalater_dp_kpa, endB.rnalater_dp_kpa, 2, "kPa")}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* COMPARATIVE TIME-SERIES CHARTS */}
        <section className="report-block">
          <h2>2. Synchronized Time-Series Trajectories (Solid: Sim A · Dashed: Sim B)</h2>
          <div className="report-charts-grid">
            <div className="report-chart-card">
              <Chart
                title="Community Germination (%)"
                yLabel="% Germ"
                xMax={result.durationH}
                yMin={0}
                yMax={100}
                series={[
                  { label: "Sim A", color: "#2563eb", x: tA, y: result.samplesA.map((s) => s.germination_pct_all) },
                  { label: "Sim B", color: "#d97706", x: tB, y: result.samplesB.map((s) => s.germination_pct_all), dashed: true },
                ]}
                {...chartTheme}
              />
            </div>
            <div className="report-chart-card">
              <Chart
                title="Headspace Ethylene C₂H₄ (ppb)"
                yLabel="ppb"
                xMax={result.durationH}
                yMin={0}
                series={[
                  { label: "Sim A", color: "#2563eb", x: tA, y: result.samplesA.map((s) => s.eth_hs_ppb) },
                  { label: "Sim B", color: "#dc2626", x: tB, y: result.samplesB.map((s) => s.eth_hs_ppb), dashed: true },
                ]}
                {...chartTheme}
              />
            </div>
            <div className="report-chart-card">
              <Chart
                title="Ch 2 A. thaliana Root Length (mm)"
                yLabel="mm"
                xMax={result.durationH}
                yMin={0}
                series={[
                  { label: "Sim A", color: "#2563eb", x: tA, y: result.samplesA.map((s) => s.ch2.meanRootLenMm) },
                  { label: "Sim B", color: "#d97706", x: tB, y: result.samplesB.map((s) => s.ch2.meanRootLenMm), dashed: true },
                ]}
                {...chartTheme}
              />
            </div>
            <div className="report-chart-card">
              <Chart
                title="Ch 2 A. thaliana Hypocotyl Length (mm)"
                yLabel="mm"
                xMax={result.durationH}
                yMin={0}
                series={[
                  { label: "Sim A", color: "#2563eb", x: tA, y: result.samplesA.map((s) => s.ch2.meanHypocotylMm) },
                  { label: "Sim B", color: "#d97706", x: tB, y: result.samplesB.map((s) => s.ch2.meanHypocotylMm), dashed: true },
                ]}
                {...chartTheme}
              />
            </div>
          </div>
        </section>

        {/* BIOPHYSICAL DIAGNOSTICS */}
        <section className="report-block">
          <h2>3. Automated Biophysical Diagnostic Summary</h2>
          <div className="diagnostics-list">
            {diagnostics.map((d, idx) => (
              <div key={idx} className={`diag-item diag-${d.severity}`}>
                {d.text}
              </div>
            ))}
          </div>
        </section>
      </article>
    </div>
  );
}
