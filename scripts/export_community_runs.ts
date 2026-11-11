// CLI exporter (`npm run export`) for the 164-seed GBC1 Community Digital Twin.
//
// Generates telemetry CSV tables in `results/tables/`:
//   1. `gbc1_community_scenario_summary.csv` — 120 h summary metrics across 8 mission scenarios
//   2. `gbc1_community_timeseries_<scenario>.csv` — hourly time series (0..120 h) for each scenario
//   3. `gbc1_seed_population_120h.csv` — per-seed morphometrics & microclimate for all 164 seeds
//      in the nominal Lunar 0.166 g Push run
//   4. `gbc1_sowing_density_sweep.csv` — community crowding & gas-exchange response across
//      sowing density multipliers 0.25× to 2.0× (41 to 328 total seeds)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GBC1CommunityTwin, type CommunitySample } from "../app/src/model/community";
import { resolveEnv } from "../app/src/model/environment";
import type { FlowMode } from "../app/src/model/gbc1Field";
import { defaultParams } from "../app/src/model/params";
import { PRESET_BY_ID } from "../app/src/model/presets";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "results", "tables");
fs.mkdirSync(OUT_DIR, { recursive: true });

interface ScenarioSpec {
  id: string;
  label: string;
  gravityG: number;
  flowMlMin: number;
  flowMode: FlowMode;
  waterFillPct: number;
  densityMultiplier: number;
  ventAchOverride?: number;
  scrubOverride?: number;
}

const SCENARIOS: ScenarioSpec[] = [
  {
    id: "lunar_push_nominal",
    label: "Lunar 0.166g Push Nominal (1.0x = 164 seeds)",
    gravityG: 0.166,
    flowMlMin: 25,
    flowMode: "push",
    waterFillPct: 100,
    densityMultiplier: 1.0,
  },
  {
    id: "lunar_pull_nominal",
    label: "Lunar 0.166g Pull Mode (1.0x = 164 seeds)",
    gravityG: 0.166,
    flowMlMin: 25,
    flowMode: "pull",
    waterFillPct: 100,
    densityMultiplier: 1.0,
  },
  {
    id: "earth_1g_push",
    label: "Earth 1.0g Ground Control Push (1.0x = 164 seeds)",
    gravityG: 1.0,
    flowMlMin: 25,
    flowMode: "push",
    waterFillPct: 100,
    densityMultiplier: 1.0,
  },
  {
    id: "iss_0g_push",
    label: "ISS 0.0g Microgravity Push (1.0x = 164 seeds)",
    gravityG: 0.0,
    flowMlMin: 25,
    flowMode: "push",
    waterFillPct: 100,
    densityMultiplier: 1.0,
  },
  {
    id: "lunar_sparse_05x",
    label: "Lunar 0.166g Sparse Sowing 0.5x (82 seeds)",
    gravityG: 0.166,
    flowMlMin: 25,
    flowMode: "push",
    waterFillPct: 100,
    densityMultiplier: 0.5,
  },
  {
    id: "lunar_crowded_15x",
    label: "Lunar 0.166g Crowded Sowing 1.5x (246 seeds)",
    gravityG: 0.166,
    flowMlMin: 25,
    flowMode: "push",
    waterFillPct: 100,
    densityMultiplier: 1.5,
  },
  {
    id: "stagnant_0g_fault",
    label: "Stagnant Pump-Off Fault (Q=0, 0.0g Sealed)",
    gravityG: 0.0,
    flowMlMin: 0,
    flowMode: "push",
    waterFillPct: 100,
    densityMultiplier: 1.0,
    ventAchOverride: 0.0,
    scrubOverride: 0.0,
  },
  {
    id: "moisture_deficit_40pct",
    label: "Incomplete Hydration Fault (40% Foam Fill, 0.166g)",
    gravityG: 0.166,
    flowMlMin: 25,
    flowMode: "push",
    waterFillPct: 40,
    densityMultiplier: 1.0,
  },
];

function flattenSample(s: CommunitySample): Record<string, string | number> {
  return {
    t_h: s.t,
    o2_hs_kpa: +s.o2_hs_kpa.toFixed(4),
    co2_hs_ppm: +s.co2_hs_ppm.toFixed(2),
    eth_hs_ppb: +s.eth_hs_ppb.toFixed(3),
    rh_pct: +s.rh_pct.toFixed(2),
    t_dew_c: +s.t_dew_c.toFixed(2),
    dew_margin_c: +s.dew_margin_c.toFixed(2),
    total_resp_umol_h: +s.total_resp_umol_h.toFixed(4),
    total_photo_umol_h: +s.total_photo_umol_h.toFixed(4),
    net_co2_flux_umol_h: +s.net_co2_flux_umol_h.toFixed(4),
    total_eth_prod_nl_h: +s.total_eth_prod_nl_h.toFixed(4),
    total_leaf_area_cm2: +s.total_leaf_area_cm2.toFixed(3),
    mean_canopy_cover_frac: +s.mean_canopy_cover_frac.toFixed(4),
    nytex_root_exclusion_pct: +s.nytex_root_exclusion_pct.toFixed(2),
    rnalater_dp_kpa: +s.rnalater_dp_kpa.toFixed(3),
    germination_pct_all: +s.germination_pct_all.toFixed(2),
    mean_light_factor_all: +s.mean_light_factor_all.toFixed(4),
    mean_gbl_mms_all: +s.mean_gbl_mms_all.toFixed(3),
    mean_air_speed_mps_all: +s.mean_air_speed_mps_all.toFixed(5),
    // Ch 1 (Brassica rapa)
    ch1_seeds: s.ch1.seedCount,
    ch1_density_dm2: +s.ch1.sowingDensityDm2.toFixed(1),
    ch1_germ_pct: +s.ch1.germinationPct.toFixed(2),
    ch1_t50_h: s.ch1.t50H !== null ? +s.ch1.t50H.toFixed(2) : "",
    ch1_hyp_mm: +s.ch1.meanHypocotylMm.toFixed(3),
    ch1_hyp_sd_mm: +s.ch1.sdHypocotylMm.toFixed(3),
    ch1_root_mm: +s.ch1.meanRootLenMm.toFixed(3),
    ch1_root_sd_mm: +s.ch1.sdRootLenMm.toFixed(3),
    ch1_lai: +s.ch1.lai.toFixed(4),
    ch1_canopy_cover: +s.ch1.canopyCoverFrac.toFixed(4),
    ch1_light_factor: +s.ch1.meanLightFactor.toFixed(4),
    ch1_lean_deg: +s.ch1.meanLeanDeg.toFixed(2),
    ch1_o2_tip_kpa: +s.ch1.meanO2TipKpa.toFixed(3),
    ch1_gbl_mms: +s.ch1.meanGblMms.toFixed(3),
    ch1_air_mps: +s.ch1.meanAirSpeedMps.toFixed(5),
    // Ch 2 (Arabidopsis thaliana, Central)
    ch2_seeds: s.ch2.seedCount,
    ch2_density_dm2: +s.ch2.sowingDensityDm2.toFixed(1),
    ch2_germ_pct: +s.ch2.germinationPct.toFixed(2),
    ch2_t50_h: s.ch2.t50H !== null ? +s.ch2.t50H.toFixed(2) : "",
    ch2_hyp_mm: +s.ch2.meanHypocotylMm.toFixed(3),
    ch2_hyp_sd_mm: +s.ch2.sdHypocotylMm.toFixed(3),
    ch2_root_mm: +s.ch2.meanRootLenMm.toFixed(3),
    ch2_root_sd_mm: +s.ch2.sdRootLenMm.toFixed(3),
    ch2_lai: +s.ch2.lai.toFixed(4),
    ch2_canopy_cover: +s.ch2.canopyCoverFrac.toFixed(4),
    ch2_light_factor: +s.ch2.meanLightFactor.toFixed(4),
    ch2_lean_deg: +s.ch2.meanLeanDeg.toFixed(2),
    ch2_o2_tip_kpa: +s.ch2.meanO2TipKpa.toFixed(3),
    ch2_gbl_mms: +s.ch2.meanGblMms.toFixed(3),
    ch2_air_mps: +s.ch2.meanAirSpeedMps.toFixed(5),
    // Ch 3 (Brassica rapa)
    ch3_seeds: s.ch3.seedCount,
    ch3_density_dm2: +s.ch3.sowingDensityDm2.toFixed(1),
    ch3_germ_pct: +s.ch3.germinationPct.toFixed(2),
    ch3_t50_h: s.ch3.t50H !== null ? +s.ch3.t50H.toFixed(2) : "",
    ch3_hyp_mm: +s.ch3.meanHypocotylMm.toFixed(3),
    ch3_hyp_sd_mm: +s.ch3.sdHypocotylMm.toFixed(3),
    ch3_root_mm: +s.ch3.meanRootLenMm.toFixed(3),
    ch3_root_sd_mm: +s.ch3.sdRootLenMm.toFixed(3),
    ch3_lai: +s.ch3.lai.toFixed(4),
    ch3_canopy_cover: +s.ch3.canopyCoverFrac.toFixed(4),
    ch3_light_factor: +s.ch3.meanLightFactor.toFixed(4),
    ch3_lean_deg: +s.ch3.meanLeanDeg.toFixed(2),
    ch3_o2_tip_kpa: +s.ch3.meanO2TipKpa.toFixed(3),
    ch3_gbl_mms: +s.ch3.meanGblMms.toFixed(3),
    ch3_air_mps: +s.ch3.meanAirSpeedMps.toFixed(5),
  };
}

function writeCsv(filePath: string, rows: Record<string, string | number>[]): void {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const lines = [cols.join(",")];
  for (const r of rows) {
    lines.push(
      cols
        .map((c) => {
          const v = r[c];
          if (typeof v === "string" && (v.includes(",") || v.includes('"'))) {
            return `"${v.replace(/"/g, '""')}"`;
          }
          return String(v ?? "");
        })
        .join(","),
    );
  }
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
}

const params = defaultParams();
const leafPreset = PRESET_BY_ID.get("leaf_gbc1")!;
const summaryRows: Record<string, string | number>[] = [];
const cachedDensityRuns = new Map<number, { totalSeeds: number; overallDensityDm2: number; finalSample: CommunitySample }>();

console.log("=== Exporting GBC1 164-Seed Community Scenarios ===");

for (const sc of SCENARIOS) {
  const env = resolveEnv(leafPreset, {
    gravity_g: sc.gravityG,
    seeds: Math.round(164 * sc.densityMultiplier),
    ...(sc.ventAchOverride !== undefined ? { vent_ach: sc.ventAchOverride } : {}),
    ...(sc.scrubOverride !== undefined ? { eth_scrub_per_h: sc.scrubOverride } : {}),
  });

  const comm = new GBC1CommunityTwin(params, env, {
    densityMultiplier: sc.densityMultiplier,
    flowMlMin: sc.flowMlMin,
    flowMode: sc.flowMode,
    waterFillPct: sc.waterFillPct,
    dt: 0.25,
    sampleEvery: 1.0,
  });
  comm.runTo(120);

  const tsRows = comm.samples.map(flattenSample);
  const tsPath = path.join(OUT_DIR, `gbc1_community_timeseries_${sc.id}.csv`);
  writeCsv(tsPath, tsRows);
  console.log(`  wrote ${path.relative(ROOT, tsPath)} (${tsRows.length} rows)`);

  const finalSample = comm.samples[comm.samples.length - 1];
  if (
    sc.gravityG === 0.166 &&
    sc.flowMlMin === 25 &&
    sc.flowMode === "push" &&
    sc.waterFillPct === 100
  ) {
    cachedDensityRuns.set(sc.densityMultiplier, {
      totalSeeds: comm.specs.length,
      overallDensityDm2: comm.sowing.overallDensityDm2,
      finalSample,
    });
  }
  summaryRows.push({
    scenario_id: sc.id,
    scenario_label: sc.label,
    gravity_g: sc.gravityG,
    flow_ml_min: sc.flowMlMin,
    flow_mode: sc.flowMode,
    water_fill_pct: sc.waterFillPct,
    density_multiplier: sc.densityMultiplier,
    total_seeds: comm.specs.length,
    ...flattenSample(finalSample),
  });

  // Export individual 164-seed population table for the nominal Lunar Push scenario
  if (sc.id === "lunar_push_nominal") {
    const popRows: Record<string, string | number>[] = [];
    for (let i = 0; i < comm.specs.length; i++) {
      const sp = comm.specs[i];
      const tw = comm.twins[i];
      const cr = comm.crowding.crowns[i];
      const mc = comm.microclimates[i];
      popRows.push({
        seed_id: sp.id,
        compartment: sp.compartment,
        species: sp.species,
        row: sp.row,
        col: sp.col,
        x_mm: +sp.xMm.toFixed(3),
        y_nytex_mm: +sp.yMm.toFixed(3),
        z_mm: +sp.zMm.toFixed(3),
        azimuth_deg: +((sp.azimuthRad * 180) / Math.PI).toFixed(2),
        psi_base_offset_mpa: +sp.psiBaseOffsetMpa.toFixed(4),
        sowing_density_dm2: +sp.sowingDensityDm2.toFixed(2),
        testa_rupture_h: tw.milestones.testaRupture !== null ? +tw.milestones.testaRupture.toFixed(2) : "",
        endosperm_rupture_h: tw.milestones.endospermRupture !== null ? +tw.milestones.endospermRupture.toFixed(2) : "",
        anchored_h: tw.milestones.anchored !== null ? +tw.milestones.anchored.toFixed(2) : "",
        cot_emerged_h: tw.milestones.cotEmerged !== null ? +tw.milestones.cotEmerged.toFixed(2) : "",
        cot_open_h: tw.milestones.cotOpen !== null ? +tw.milestones.cotOpen.toFixed(2) : "",
        hypocotyl_mm: +(tw.seedling.lengths(tw).hypocotyl * sp.seedScale * 1e-3).toFixed(3),
        root_nytex_mm: +cr.rootLenMm.toFixed(3),
        shoot_height_mm: +cr.shootHeightMm.toFixed(3),
        cot_area_mm2: +cr.cotAreaMm2.toFixed(3),
        crown_x_mm: +cr.crownXMm.toFixed(3),
        crown_y_mm: +cr.crownYMm.toFixed(3),
        crown_z_mm: +cr.crownZMm.toFixed(3),
        nearest_neighbor_mm: +cr.nearestNeighborDistMm.toFixed(3),
        light_factor: +cr.lightFactor.toFixed(4),
        shade_level: +cr.shadeLevel.toFixed(4),
        shoot_lean_deg: +cr.leanTotalDeg.toFixed(2),
        air_speed_mps: +mc.airSpeedMps.toFixed(5),
        gbl_mms: +mc.gblMms.toFixed(3),
        substrate_psi_mpa: +mc.substratePsiMpa.toFixed(4),
        foam_theta_w: +mc.foamThetaW.toFixed(4),
        o2_tip_kpa: +(tw.mean(tw.o2, tw.tipCells) / 1000).toFixed(3),
        aba_tip: +tw.mean(tw.h.aba, tw.tipCells).toFixed(4),
        ga_tip: +tw.mean(tw.h.ga, tw.tipCells).toFixed(4),
        cell_count: tw.cells.n,
      });
    }
    const popPath = path.join(OUT_DIR, "gbc1_seed_population_120h.csv");
    writeCsv(popPath, popRows);
    console.log(`  wrote ${path.relative(ROOT, popPath)} (${popRows.length} seeds)`);
  }
}

const sumPath = path.join(OUT_DIR, "gbc1_community_scenario_summary.csv");
writeCsv(sumPath, summaryRows);
console.log(`  wrote ${path.relative(ROOT, sumPath)} (${summaryRows.length} scenarios)`);

// Sowing density sweep (0.25x to 2.0x)
console.log("\n=== Running GBC1 Sowing Density Sweep (0.25x .. 2.0x) ===");
const sweepMultipliers = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const sweepRows: Record<string, string | number>[] = [];
for (const dm of sweepMultipliers) {
  const cached = cachedDensityRuns.get(dm);
  if (cached) {
    sweepRows.push({
      density_multiplier: dm,
      total_seeds: cached.totalSeeds,
      overall_density_dm2: +cached.overallDensityDm2.toFixed(2),
      ...flattenSample(cached.finalSample),
    });
    continue;
  }
  const env = resolveEnv(leafPreset, {
    gravity_g: 0.166,
    seeds: Math.round(164 * dm),
  });
  const comm = new GBC1CommunityTwin(params, env, {
    densityMultiplier: dm,
    flowMlMin: 25,
    flowMode: "push",
    waterFillPct: 100,
    dt: 0.25,
    sampleEvery: 6.0,
  });
  comm.runTo(120);
  const fin = comm.samples[comm.samples.length - 1];
  sweepRows.push({
    density_multiplier: dm,
    total_seeds: comm.specs.length,
    overall_density_dm2: +comm.sowing.overallDensityDm2.toFixed(2),
    ...flattenSample(fin),
  });
}
const sweepPath = path.join(OUT_DIR, "gbc1_sowing_density_sweep.csv");
writeCsv(sweepPath, sweepRows);
console.log(`  wrote ${path.relative(ROOT, sweepPath)} (${sweepRows.length} density levels)`);
