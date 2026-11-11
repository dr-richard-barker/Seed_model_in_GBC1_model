// Automated physics, geometry, and provenance validation gates for the GBC1 164-seed
// community digital twin (`npm run gates`).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GBC1CommunityTwin } from "../app/src/model/community";
import { resolveEnv } from "../app/src/model/environment";
import { LEDGER, defaultParams, p } from "../app/src/model/params";
import { PRESET_BY_ID } from "../app/src/model/presets";
import { COMPARTMENTS, buildSowingPlan } from "../app/src/model/sowing";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    passed++;
    console.log(`  [PASS] ${name}${detail ? ` (${detail})` : ""}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${name}${detail ? ` (${detail})` : ""}`);
  }
}

console.log("=== GBC1 164-Seed Community Digital Twin: Validation Gates ===");

// Gate 1: Provenance & deterministic PRNG check
{
  console.log("\nGate 1: Parameter Ledger & Deterministic PRNG Integrity");
  check("Ledger has >= 180 parameters", LEDGER.length >= 180, `${LEDGER.length} entries`);
  const modelDir = path.join(ROOT, "app", "src", "model");
  const files = fs.readdirSync(modelDir).filter((f) => f.endsWith(".ts"));
  let mathRandomCount = 0;
  for (const f of files) {
    const src = fs.readFileSync(path.join(modelDir, f), "utf8");
    if (src.includes("Math.random")) mathRandomCount++;
  }
  check("Zero unseeded Math.random() calls in app/src/model/", mathRandomCount === 0);
}

// Gate 2: GBC1 3-compartment sowing layout bounds & density conservation
{
  console.log("\nGate 2: GBC1 3-Compartment Flight Sowing Layout (164 Seeds)");
  const params = defaultParams();
  const plan = buildSowingPlan(params, 1.0, 20261111);
  check("Total flight seed count is 164", plan.seeds.length === 164, `n=${plan.seeds.length}`);
  check(
    "Compartment counts are 32 + 100 + 32",
    plan.countsByCompartment[1] === 32 &&
      plan.countsByCompartment[2] === 100 &&
      plan.countsByCompartment[3] === 32,
    `${plan.countsByCompartment[1]}/${plan.countsByCompartment[2]}/${plan.countsByCompartment[3]}`,
  );
  check(
    "Ch 2 Arabidopsis density is ~206.4 seeds/dm² and Ch 1/3 B. rapa is ~47.2 seeds/dm²",
    Math.abs(plan.densitiesDm2ByCompartment[2] - 206.4) < 1.0 &&
      Math.abs(plan.densitiesDm2ByCompartment[1] - 47.2) < 1.0,
    `Ch2=${plan.densitiesDm2ByCompartment[2].toFixed(1)}/dm², Ch1=${plan.densitiesDm2ByCompartment[1].toFixed(1)}/dm²`,
  );

  const nytexY = p(params, "gbc1_nytex_top_y_mm");
  let allInside = true;
  for (const sp of plan.seeds) {
    const comp = COMPARTMENTS[sp.compartment - 1];
    if (
      sp.xMm < comp.foamXMinMm ||
      sp.xMm > comp.foamXMaxMm ||
      sp.zMm < comp.foamZMinMm ||
      sp.zMm > comp.foamZMaxMm ||
      Math.abs(sp.yMm - nytexY) > 1e-6
    ) {
      allInside = false;
      break;
    }
  }
  check("All 164 seeds lie strictly within their compartment Nytex boundaries at Y = 14.77 mm", allInside);
}

// Gate 3: 35 µm Nytex root-barrier exclusion & RNAlater ΔP protection over 120 h
const params = defaultParams();
const leafPreset = PRESET_BY_ID.get("leaf_gbc1")!;
const envLunar = resolveEnv(leafPreset, { gravity_g: 0.166 });
const commNominal = new GBC1CommunityTwin(params, envLunar, {
  densityMultiplier: 1.0,
  flowMlMin: 25,
  flowMode: "push",
  waterFillPct: 100,
  dt: 0.25,
  sampleEvery: 2.0,
});
commNominal.runTo(120);

{
  console.log("\nGate 3: 35 µm Nytex Root-Barrier Exclusion & RNAlater Perfusion Protection");
  const exclPct = commNominal.computeNytexRootExclusionPct();
  const last = commNominal.samples[commNominal.samples.length - 1];
  check(
    "100% of root cells across all 164 seedlings remain above the 35 µm Nytex screen (Y >= 14.77 mm)",
    exclPct >= 99.99,
    `${exclPct.toFixed(2)}%`,
  );
  check(
    "RNAlater hydraulic ΔP stays below 2.5 kPa (vs 89.3 kPa without Nytex)",
    last.rnalater_dp_kpa < 2.5,
    `ΔP = ${last.rnalater_dp_kpa.toFixed(2)} kPa`,
  );
  check(
    "Radicles elongate > 10× tangentially along the wet Nytex surface (> 2.5 mm Ath, > 6.5 mm B. rapa at 120 h)",
    last.ch2.meanRootLenMm > 2.5 && last.ch1.meanRootLenMm > 6.5,
    `Ch2 Ath root=${last.ch2.meanRootLenMm.toFixed(2)} mm, Ch1 B. rapa root=${last.ch1.meanRootLenMm.toFixed(2)} mm`,
  );
}

// Gate 4: Hydrotime base water-potential ordering across the seed cohort
{
  console.log("\nGate 4: Hydrotime Base Water-Potential (ψ_b) Germination Ordering");
  const ch2Peers = commNominal.specs
    .map((sp, idx) => ({
      psiOffset: sp.psiBaseOffsetMpa,
      tRupture: commNominal.twins[idx].milestones.endospermRupture,
      comp: sp.compartment,
    }))
    .filter((x) => x.comp === 2 && x.tRupture !== null)
    .sort((a, b) => a.psiOffset - b.psiOffset);

  let concordant = 0;
  let totalPairs = 0;
  for (let i = 0; i < ch2Peers.length; i++) {
    for (let j = i + 1; j < ch2Peers.length; j++) {
      if (ch2Peers[j].psiOffset - ch2Peers[i].psiOffset > 0.05) {
        totalPairs++;
        if (ch2Peers[i].tRupture! <= ch2Peers[j].tRupture! + 0.5) concordant++;
      }
    }
  }
  const frac = totalPairs > 0 ? concordant / totalPairs : 1;
  check(
    "More negative ψ_b germinates earlier than less negative ψ_b across Chamber 2 cohort",
    frac >= 0.95,
    `concordance = ${(frac * 100).toFixed(1)}% (${concordant}/${totalPairs} pairs)`,
  );
}

// Gate 5: Sowing density & community crowding / shade-avoidance monotonicity
{
  console.log("\nGate 5: Sowing Density & Community Crowding Monotonicity (0.5× vs 1.0× vs 1.5×)");
  const commSparse = new GBC1CommunityTwin(params, envLunar, {
    densityMultiplier: 0.5,
    flowMlMin: 25,
    flowMode: "push",
    dt: 0.25,
    sampleEvery: 6.0,
  });
  commSparse.runTo(120);

  const commCrowded = new GBC1CommunityTwin(params, envLunar, {
    densityMultiplier: 1.5,
    flowMlMin: 25,
    flowMode: "push",
    dt: 0.25,
    sampleEvery: 6.0,
  });
  commCrowded.runTo(120);

  const s05 = commSparse.samples[commSparse.samples.length - 1];
  const s10 = commNominal.samples[commNominal.samples.length - 1];
  const s15 = commCrowded.samples[commCrowded.samples.length - 1];

  check(
    "Canopy LAI increases monotonically with sowing density (0.5× < 1.0× < 1.5×)",
    s05.ch2.lai < s10.ch2.lai && s10.ch2.lai < s15.ch2.lai,
    `Ch2 LAI: ${s05.ch2.lai.toFixed(2)} -> ${s10.ch2.lai.toFixed(2)} -> ${s15.ch2.lai.toFixed(2)}`,
  );
  check(
    "Mean canopy light transmittance f_light decreases monotonically with sowing density",
    s05.ch2.meanLightFactor > s10.ch2.meanLightFactor &&
      s10.ch2.meanLightFactor > s15.ch2.meanLightFactor,
    `Ch2 f_light: ${s05.ch2.meanLightFactor.toFixed(3)} -> ${s10.ch2.meanLightFactor.toFixed(3)} -> ${s15.ch2.meanLightFactor.toFixed(3)}`,
  );
  check(
    "Shade-Avoidance Syndrome (SAS) elongates hypocotyls at higher sowing density",
    s15.ch2.meanHypocotylMm > s05.ch2.meanHypocotylMm,
    `Ch2 hyp: 0.5×=${s05.ch2.meanHypocotylMm.toFixed(2)} mm vs 1.5×=${s15.ch2.meanHypocotylMm.toFixed(2)} mm`,
  );
  check(
    "3D phototropic shoot lean angle increases with neighbor crowding",
    s15.ch2.meanLeanDeg > s05.ch2.meanLeanDeg,
    `Ch2 lean: 0.5×=${s05.ch2.meanLeanDeg.toFixed(2)}° vs 1.5×=${s15.ch2.meanLeanDeg.toFixed(2)}°`,
  );
}

// Gate 6: Push vs Pull CFD channelling & Stagnant Pump-Off Fault
{
  console.log("\nGate 6: Push vs. Pull CFD Channelling & Stagnant Pump-Off Fault");
  const commPull = new GBC1CommunityTwin(params, envLunar, {
    densityMultiplier: 1.0,
    flowMlMin: 25,
    flowMode: "pull",
    dt: 0.25,
    sampleEvery: 6.0,
  });
  commPull.runTo(120);

  const envStagnant = resolveEnv(leafPreset, { gravity_g: 0.0, vent_ach: 0.0, eth_scrub_per_h: 0.0 });
  const commStagnant = new GBC1CommunityTwin(params, envStagnant, {
    densityMultiplier: 1.0,
    flowMlMin: 0,
    flowMode: "push",
    dt: 0.25,
    sampleEvery: 6.0,
  });
  commStagnant.runTo(120);

  const sPush = commNominal.samples[commNominal.samples.length - 1];
  const sPull = commPull.samples[commPull.samples.length - 1];
  const sStag = commStagnant.samples[commStagnant.samples.length - 1];

  check(
    "Push mode dip-and-converge channelling yields higher Central Chamber 2 g_bl than Pull mode",
    sPush.ch2.meanGblMms > sPull.ch2.meanGblMms,
    `Push Ch2 g_bl=${sPush.ch2.meanGblMms.toFixed(2)} mm/s vs Pull=${sPull.ch2.meanGblMms.toFixed(2)} mm/s`,
  );
  check(
    "Active pump (25 mL/min) prevents ethylene build-up (< 10 ppb) vs Stagnant fault (> 80 ppb)",
    sPush.eth_hs_ppb < 10.0 && sStag.eth_hs_ppb > 80.0,
    `Active=${sPush.eth_hs_ppb.toFixed(2)} ppb vs Stagnant=${sStag.eth_hs_ppb.toFixed(1)} ppb`,
  );
  check(
    "Stagnant 0g fault lowers radicle tip O2 and reduces root growth relative to active ventilation",
    sStag.ch2.meanO2TipKpa < sPush.ch2.meanO2TipKpa && sStag.ch2.meanRootLenMm < sPush.ch2.meanRootLenMm,
    `Tip O2: Active=${sPush.ch2.meanO2TipKpa.toFixed(2)} kPa vs Stagnant=${sStag.ch2.meanO2TipKpa.toFixed(2)} kPa`,
  );
}

console.log(`\n=== Validation Summary: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
