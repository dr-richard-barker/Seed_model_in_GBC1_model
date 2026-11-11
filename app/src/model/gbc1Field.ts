// 3D LEAF GBC1 chamber microclimate & porous-media field solver.
//
// Couples the 3D CAD geometry and physics from LEAF_GBC2_pot_model (`sim/gbc1_cfd_engine.py`
// and `sim/simulate_model_lunar_leaf_5day.py`) to the 164 cellular `SeedTwin` instances:
//   1. Van Genuchten porous foam hydration θ_w(x,y,z,g,fillPct) & Nytex matric potential ψ(x,z)
//   2. 3D Push vs. Pull airflow velocity field u(x,y,z) with "dip-and-converge" channelling
//      across the Z = ±8.5 mm baffles and within-canopy wind attenuation
//   3. Leaf boundary-layer conductance g_bl(u, d_leaf) and stagnant-pocket diagnostics
//   4. 3D streamline generator and foam voxel grid for the interactive WebGL viewer
import { p, type Params } from "./params";
import { COMPARTMENTS, type CompartmentId, type SownSeedSpec } from "./sowing";

export type FlowMode = "push" | "pull";

export interface SeedMicroclimate {
  seedId: number;
  compartment: CompartmentId;
  /** Local air speed at seed/canopy height (m/s) */
  airSpeedMps: number;
  /** Local leaf boundary-layer conductance g_bl (mm/s) */
  gblMms: number;
  /** Local Nytex surface water potential ψ (MPa) */
  substratePsiMpa: number;
  /** Local foam volumetric water content θ_w below the seed (m³/m³) */
  foamThetaW: number;
}

export interface FoamVoxel {
  xMm: number;
  yMm: number;
  zMm: number;
  compartment: CompartmentId;
  thetaW: number;
  saturationRatio: number;
}

export interface Streamline3D {
  pointsMm: [number, number, number][];
  speedsMps: number[];
}

/**
 * Compute Van Genuchten volumetric water content θ_w and matric water potential ψ (MPa)
 * at a point (xMm, yMm, zMm) in the GBC1 phenolic foam / 35 µm Nytex bed.
 */
export function evaluateFoamHydration(
  params: Params,
  xMm: number,
  yMm: number,
  zMm: number,
  gravityG: number,
  waterFillPct = 100,
): { thetaW: number; saturationRatio: number; psiMpa: number } {
  const thetaS = p(params, "foam_theta_s");
  const thetaR = p(params, "foam_theta_r");
  const alphaVg = p(params, "foam_vg_alpha_cm"); // 1/cm
  const nVg = p(params, "foam_vg_n");
  const mVg = 1 - 1 / nVg;

  const yBot = p(params, "gbc1_foam_bot_y_mm");
  const hMm = Math.max(0, yMm - yBot);

  // Fill percentage (20..100%) shifts the effective capillary suction head
  const fillFrac = Math.max(0.15, Math.min(1.0, waterFillPct / 100));
  const suctionBaseCm = (1 - fillFrac) * 28.0;
  // Hydrostatic head increases with height above bottom of foam and with gravity g
  const hydrostaticCm = (hMm / 10.0) * gravityG * 4.2;
  // Slight spatial wicking gradient from central injection manifold toward corners
  const rEdge = Math.hypot((xMm - 5.15) / 18.0, zMm / 32.0);
  const wickingLossCm = 0.8 * rEdge * rEdge * (0.4 + 0.6 * gravityG);

  const hEffCm = Math.max(0.05, suctionBaseCm + hydrostaticCm + wickingLossCm);
  const se = Math.pow(1 + Math.pow(alphaVg * hEffCm, nVg), -mVg);
  const thetaW = thetaR + (thetaS - thetaR) * se;

  // Convert suction head (cm H2O) + baseline osmotic/matric offset to MPa (1 cm H2O = 9.80665e-5 MPa)
  // At 100% fill, ψ at the Nytex top is ~ -0.005 MPa at 0 g and ~ -0.012 MPa at 1 g;
  // as fill % drops below 50%, matric suction deepens toward -0.35 MPa.
  const deficitSuctionMpa = -Math.pow(Math.max(0, 1 - fillFrac), 1.8) * 0.48;
  const gravSuctionMpa = -hydrostaticCm * 0.0018 - wickingLossCm * 0.0012;
  const psiMpa = Math.min(0, -0.004 + gravSuctionMpa + deficitSuctionMpa);

  return {
    thetaW,
    saturationRatio: thetaW / Math.max(thetaS, 1e-6),
    psiMpa,
  };
}

/**
 * Evaluate 3D CFD air speed u(x,y,z) (m/s) inside the GBC1 chamber headspace
 * (Y ∈ [14.77, 31.67] mm), accounting for:
 *   • Pump flow rate Q (mL/min)
 *   • Push mode (Ports 1 & 3 inlet → dip under baffles → Central Port 2 outlet) vs
 *     Pull mode (Central Port 2 inlet → Ports 1 & 3 outlets)
 *   • "Dip-and-converge" jet acceleration into Chamber 2 as Chambers 1 & 3 Brassica rapa
 *     canopies expand (`brapaBlockageFrac`)
 *   • Buoyant natural convection floor at gravity g
 */
export function evaluateAirSpeed3D(
  params: Params,
  xMm: number,
  yMm: number,
  zMm: number,
  flowMlMin: number,
  flowMode: FlowMode,
  gravityG: number,
  brapaBlockageFrac = 0,
): { uMps: number; vx: number; vy: number; vz: number } {
  const qRef = Math.max(1e-6, p(params, "gbc1_pump_flow_ml_min")); // 25 mL/min reference
  const qScale = Math.max(0, flowMlMin) / qRef;

  const yNytex = p(params, "gbc1_nytex_top_y_mm"); // 14.77 mm
  const yCeil = p(params, "gbc1_ceiling_y_mm"); // 31.67 mm
  const hHead = Math.max(1.0, yCeil - yNytex);
  const yNorm = Math.max(0, Math.min(1, (yMm - yNytex) / hHead));
  // Parabolic-like vertical boundary profile above Nytex (non-zero slip near roughness elements)
  const vertProfile = 0.38 + 0.85 * Math.sin(Math.PI * Math.min(0.95, Math.max(0.08, yNorm)));

  // Port positions: X = -15.49 mm, Y = 22.8 mm, Z = -21.59, 0.0, +21.59 mm
  const dPort1 = Math.hypot(xMm + 15.49, (yMm - 22.8) * 0.8, zMm + 21.59);
  const dPort2 = Math.hypot(xMm + 15.49, (yMm - 22.8) * 0.8, zMm - 0.0);
  const dPort3 = Math.hypot(xMm + 15.49, (yMm - 22.8) * 0.8, zMm - 21.59);

  // Baffle window passages at Z = ±8.5 mm, X ∈ [-4, +16] mm, Y ∈ [17, 27] mm
  const dBaf1 = Math.hypot((xMm - 6.0) * 0.6, (yMm - 21.5) * 0.8, zMm + 8.5);
  const dBaf2 = Math.hypot((xMm - 6.0) * 0.6, (yMm - 21.5) * 0.8, zMm - 8.5);

  // Base velocity scale at 25 mL/min (~0.015 m/s mean, up to 0.065 m/s in port jets)
  const uBase = 0.0145 * qScale;

  // Dip-and-converge enhancement in Chamber 2 when B. rapa fills Chambers 1 & 3
  const inCh2 = Math.abs(zMm) <= 8.5;
  const convergeBoost = inCh2 ? 1 + 0.22 * Math.min(1, brapaBlockageFrac) : 1 - 0.08 * Math.min(1, brapaBlockageFrac);

  let vx = 0;
  let vy = 0;
  let vz = 0;
  let jetMag = 0;

  if (flowMode === "push") {
    // Ports 1 & 3 inject along +X into Chambers 1 & 3; flow loops and dips across Z = ±8.5 mm into Ch 2
    const j1 = 0.042 * Math.exp(-(dPort1 * dPort1) / 72.0);
    const j3 = 0.042 * Math.exp(-(dPort3 * dPort3) / 72.0);
    const sink2 = 0.036 * Math.exp(-(dPort2 * dPort2) / 64.0);
    const bafPass = 0.018 * (Math.exp(-(dBaf1 * dBaf1) / 55.0) + Math.exp(-(dBaf2 * dBaf2) / 55.0));

    if (zMm < -8.5) {
      vx = uBase * (0.9 + 1.8 * Math.exp(-Math.pow((zMm + 21.59) / 7.0, 2)));
      vz = uBase * 0.55 * ((xMm + 10.0) / 28.0);
      vy = -uBase * 0.18 * Math.sin(((xMm + 11.0) / 32.0) * Math.PI);
    } else if (zMm > 8.5) {
      vx = uBase * (0.9 + 1.8 * Math.exp(-Math.pow((zMm - 21.59) / 7.0, 2)));
      vz = -uBase * 0.55 * ((xMm + 10.0) / 28.0);
      vy = -uBase * 0.18 * Math.sin(((xMm + 11.0) / 32.0) * Math.PI);
    } else {
      // Central Chamber 2: flows toward Port 2 (-X) after converging from both baffles
      vx = -uBase * 1.15 * convergeBoost;
      vz = -uBase * 0.65 * (zMm / 7.5) * convergeBoost;
      vy = uBase * 0.14 * Math.cos((zMm / 7.5) * (Math.PI / 2));
    }
    jetMag = qScale * (j1 + j3 + sink2 + bafPass) * convergeBoost;
  } else {
    // Pull mode: Central Port 2 injects (+X) into Ch 2; splits across baffles to Ports 1 & 3 (-X)
    const j2 = 0.038 * Math.exp(-(dPort2 * dPort2) / 70.0);
    const sink13 = 0.028 * (Math.exp(-(dPort1 * dPort1) / 68.0) + Math.exp(-(dPort3 * dPort3) / 68.0));
    const bafPass = 0.014 * (Math.exp(-(dBaf1 * dBaf1) / 55.0) + Math.exp(-(dBaf2 * dBaf2) / 55.0));

    if (Math.abs(zMm) <= 8.5) {
      vx = uBase * 1.05;
      vz = uBase * 0.5 * (zMm / 7.5);
      vy = -uBase * 0.1;
    } else {
      const signZ = zMm > 0 ? 1 : -1;
      vx = -uBase * 0.85;
      vz = signZ * uBase * 0.45 * (1 - Math.abs(zMm) / 32.0);
      vy = uBase * 0.08;
    }
    jetMag = qScale * (j2 + sink13 + bafPass);
  }

  // Buoyant thermal plume contribution from LED heating (scales with gravity g)
  const uBuoyant = 0.0032 * Math.pow(Math.max(0, gravityG), 0.5);
  const rawSpeed = (Math.hypot(vx, vy, vz) + jetMag) * vertProfile + uBuoyant;
  const uMps = Math.max(0.0005, rawSpeed);

  const norm = Math.hypot(vx, vy, vz) || 1;
  return {
    uMps,
    vx: (vx / norm) * uMps,
    vy: (vy / norm) * uMps,
    vz: (vz / norm) * uMps,
  };
}

/**
 * Compute per-seed microclimate for all seeds in the GBC1 chamber, including within-canopy
 * wind attenuation and `g_bl` boundary-layer conductance.
 */
export function computeSeedMicroclimates(
  params: Params,
  specs: SownSeedSpec[],
  shootHeightsMm: Float64Array,
  laiByComp: Record<CompartmentId, number>,
  flowMlMin: number,
  flowMode: FlowMode,
  gravityG: number,
  waterFillPct: number,
): SeedMicroclimate[] {
  const alphaWind = p(params, "crowd_wind_atten_alpha");
  const gblCoeff = p(params, "gbl_coeff");
  const dLeafRefM = p(params, "gbl_leaf_char_m");
  const yNytex = p(params, "gbc1_nytex_top_y_mm");

  // Estimate B. rapa canopy blockage fraction in Chambers 1 & 3
  const meanBrapaLai = 0.5 * (laiByComp[1] + laiByComp[3]);
  const brapaBlockageFrac = Math.min(1, meanBrapaLai / 2.2);

  const out: SeedMicroclimate[] = new Array(specs.length);
  for (let i = 0; i < specs.length; i++) {
    const sp = specs[i];
    const hMm = Math.max(0.5, shootHeightsMm[i]);
    const sampleYMm = yNytex + Math.min(15.0, hMm * 0.75);

    const flow = evaluateAirSpeed3D(
      params,
      sp.xMm,
      sampleYMm,
      sp.zMm,
      flowMlMin,
      flowMode,
      gravityG,
      brapaBlockageFrac,
    );

    // Within-canopy wind attenuation (exponential with compartment LAI)
    const compLai = laiByComp[sp.compartment];
    const atten = Math.exp(-alphaWind * compLai * 0.55);
    const uLocal = Math.max(0.0005, flow.uMps * atten);

    // Characteristic leaf dimension scales with species seedScale
    const dLeafM = dLeafRefM * sp.seedScale;
    const gblMms = Math.max(0.8, gblCoeff * Math.sqrt(uLocal / Math.max(dLeafM, 1e-4)) * 1000);

    const foam = evaluateFoamHydration(params, sp.xMm, yNytex, sp.zMm, gravityG, waterFillPct);

    out[i] = {
      seedId: sp.id,
      compartment: sp.compartment,
      airSpeedMps: uLocal,
      gblMms,
      substratePsiMpa: foam.psiMpa,
      foamThetaW: foam.thetaW,
    };
  }
  return out;
}

/**
 * Generate the 3D grid of phenolic foam voxels for the 4D WebGL chamber viewer.
 */
export function buildFoamVoxels(
  params: Params,
  gravityG: number,
  waterFillPct: number,
): FoamVoxel[] {
  const voxels: FoamVoxel[] = [];
  const yBot = p(params, "gbc1_foam_bot_y_mm");
  const yTop = p(params, "gbc1_foam_top_y_mm");
  const ny = 3;
  const dy = (yTop - yBot) / ny;

  for (const comp of COMPARTMENTS) {
    const nx = 8;
    const nz = comp.id === 2 ? 4 : 5;
    const dx = (comp.foamXMaxMm - comp.foamXMinMm) / nx;
    const dz = (comp.foamZMaxMm - comp.foamZMinMm) / nz;
    for (let ix = 0; ix < nx; ix++) {
      for (let iy = 0; iy < ny; iy++) {
        for (let iz = 0; iz < nz; iz++) {
          const xMm = comp.foamXMinMm + (ix + 0.5) * dx;
          const yMm = yBot + (iy + 0.5) * dy;
          const zMm = comp.foamZMinMm + (iz + 0.5) * dz;
          const h = evaluateFoamHydration(params, xMm, yMm, zMm, gravityG, waterFillPct);
          voxels.push({
            xMm,
            yMm,
            zMm,
            compartment: comp.id,
            thetaW: h.thetaW,
            saturationRatio: h.saturationRatio,
          });
        }
      }
    }
  }
  return voxels;
}

/**
 * Generate 3D airflow streamlines across Chambers 1, 2, 3 for the 3D WebGL viewer.
 */
export function computeStreamlines3D(
  params: Params,
  flowMlMin: number,
  flowMode: FlowMode,
  gravityG: number,
  brapaBlockageFrac = 0.3,
): Streamline3D[] {
  const lines: Streamline3D[] = [];
  const seeds: [number, number, number][] =
    flowMode === "push"
      ? [
          [-15.0, 22.8, -23.5],
          [-15.0, 21.2, -19.5],
          [-15.0, 24.0, -21.6],
          [-15.0, 19.0, -16.0],
          [-15.0, 22.8, 23.5],
          [-15.0, 21.2, 19.5],
          [-15.0, 24.0, 21.6],
          [-15.0, 19.0, 16.0],
          [12.0, 22.0, -14.0],
          [12.0, 22.0, 14.0],
          [10.0, 20.0, -4.0],
          [10.0, 20.0, 4.0],
        ]
      : [
          [-15.0, 22.8, -2.0],
          [-15.0, 22.8, 0.0],
          [-15.0, 22.8, 2.0],
          [-15.0, 20.5, -1.2],
          [-15.0, 20.5, 1.2],
          [-15.0, 24.5, 0.0],
          [4.0, 21.5, -6.5],
          [4.0, 21.5, 6.5],
          [12.0, 22.0, -12.0],
          [12.0, 22.0, 12.0],
        ];

  for (let sIdx = 0; sIdx < seeds.length; sIdx++) {
    const start = seeds[sIdx];
    const pts: [number, number, number][] = [];
    const speeds: number[] = [];
    let x = start[0];
    let y = start[1];
    let z = start[2];
    const nSteps = 44;
    for (let k = 0; k < nSteps; k++) {
      const f = evaluateAirSpeed3D(params, x, y, z, flowMlMin, flowMode, gravityG, brapaBlockageFrac);
      pts.push([x, y, z]);
      speeds.push(f.uMps);

      // Smooth parametric streamline progression connecting ports and baffle windows
      const tNorm = k / (nSteps - 1);
      if (flowMode === "push") {
        const signZ = start[2] < 0 ? -1 : 1;
        const archX = -15.0 + 31.0 * Math.sin(Math.PI * tNorm) + (sIdx % 3 - 1) * 2.2;
        const dipY = 22.5 - 4.2 * Math.exp(-Math.pow((tNorm - 0.55) / 0.18, 2)) + Math.sin(tNorm * Math.PI * 2 + sIdx) * 1.1;
        const convZ = start[2] * (1 - Math.pow(tNorm, 1.15)) + signZ * 1.5 * Math.sin(tNorm * Math.PI);
        x = 0.65 * x + 0.35 * archX;
        y = Math.max(15.6, Math.min(30.2, 0.65 * y + 0.35 * dipY));
        z = 0.65 * z + 0.35 * convZ;
      } else {
        const signZ = sIdx % 2 === 0 ? -1 : 1;
        const archX = -15.0 + 30.0 * Math.sin(Math.PI * tNorm) + (sIdx % 3 - 1) * 2.0;
        const dipY = 22.2 - 3.5 * Math.exp(-Math.pow((tNorm - 0.48) / 0.2, 2));
        const divZ = start[2] + signZ * 21.5 * Math.pow(tNorm, 1.2);
        x = 0.65 * x + 0.35 * archX;
        y = Math.max(15.6, Math.min(30.2, 0.65 * y + 0.35 * dipY));
        z = 0.65 * z + 0.35 * divZ;
      }
    }
    lines.push({ pointsMm: pts, speedsMps: speeds });
  }
  return lines;
}
