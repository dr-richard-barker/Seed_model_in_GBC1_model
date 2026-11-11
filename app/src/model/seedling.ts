// Seedling establishment after radicle protrusion (to ~120 h).
//
// Includes:
//   • Root meristem division and elongation zone (Beemster & Baskin 1998)
//   • 35 µm Nytex root-barrier deflection: once the radicle tip contacts the Nytex surface,
//     the root cannot penetrate the 35 µm pores and deflects tangentially along the wet
//     Nytex plane (at rate `nytex_deflection_rate_deg_h`)
//   • Hypocotyl acropetal elongation, apical hook, and negative gravitropism
//   • Community shade-avoidance syndrome (SAS): neighbor foliar shading (`sim.shadeLevel`)
//     boosts hypocotyl elongation (`crowd_sas_hyp_boost`) and induces 3D phototropic lean
//     (`crowd_phototropic_rate_deg_h`) toward open light gaps
//   • Cotyledon emergence, opening, expansion, and photosynthesis
import asymmetry from "../../../data/calibration/gravity_auxin_asymmetry.json";
import { buildSlice, copyCell, Region } from "./geometry";
import { p } from "./params";
import type { SeedTwin } from "./simulate";

export interface SeedlingState {
  photosynthesis: number; // reserve units per hour added by open green cotyledons
  hookDeg: number;
  rootTipAngleDeg: number;
  hypElongationStart: number | null;
  hypLen0: number;
  divisions: number;
  /** photomorphogenic (de-etiolation) state: 0 = etiolated, 1 = fully light-grown; irreversible */
  deetiolation: number;
  /** true once the radicle tip has reached and anchored onto the 35 µm Nytex mesh surface */
  nytexContact: boolean;
  lengths(sim: SeedTwin): { root: number; hypocotyl: number };
}

const DOWN = -Math.PI / 2;
const UP = Math.PI / 2;
const NYTEX_TANGENT = Math.PI; // horizontal along −x in the local seed azimuth plane

function wrap(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/** Relative auxin asymmetry at gravity g, normalised to 1 at 1 g. */
export function gravityResponse(g: number): number {
  const pts = (asymmetry as { points: { g: number; asymmetry_pct: number }[] }).points;
  const gg = Math.max(0, Math.min(2, g));
  let v = pts[pts.length - 1].asymmetry_pct;
  for (let i = 0; i + 1 < pts.length; i++) {
    if (gg <= pts[i + 1].g) {
      const f = (gg - pts[i].g) / (pts[i + 1].g - pts[i].g);
      v = pts[i].asymmetry_pct + f * (pts[i + 1].asymmetry_pct - pts[i].asymmetry_pct);
      break;
    }
  }
  const at1 = pts.find((q) => q.g === 1)?.asymmetry_pct ?? 1;
  return v / at1;
}

export function initSeedling(sim: SeedTwin): SeedlingState {
  const st: SeedlingState = {
    photosynthesis: 0,
    hookDeg: 0,
    rootTipAngleDeg: (sim.pose.rootAngle0 * 180) / Math.PI,
    hypElongationStart: null,
    hypLen0: 0,
    divisions: 0,
    deetiolation: 0,
    nytexContact: false,
    lengths(s: SeedTwin) {
      const t = s.template;
      const kColl = t.order.indexOf(t.colletSliceId);
      let root = 0;
      let hyp = 0;
      t.order.forEach((sid, k) => {
        const L = s.meanLenOf(sid);
        if (k < kColl) root += L;
        else hyp += L;
      });
      return { root, hypocotyl: hyp };
    },
  };
  st.hypLen0 = st.lengths(sim).hypocotyl;
  return st;
}

interface Drivers {
  light: number;
  ethResp: number;
  fT: number;
}

/** Split root slice `sid` into two slices of half length (the new one sits above it). */
function divideSlice(sim: SeedTwin, sid: number): void {
  const t = sim.template;
  const c = t.cells;
  const src = t.slices[sid];
  const newId = t.slices.length;
  const radius = src.radius0;
  const fresh = buildSlice(c, sim.params, newId, src.qcIndex, src.region, radius, 1);
  fresh.embryo = false;
  src.bend /= 2;
  fresh.bend = src.bend;
  for (let k = 0; k < src.cells.length && k < fresh.cells.length; k++) {
    const a = src.cells[k];
    const b = fresh.cells[k];
    copyCell(c, a, b);
    c.slice[b] = newId;
    c.len[a] /= 2;
    c.len[b] = c.len[a];
    c.len0[b] = c.len0[a];
    sim.h.aba[b] = sim.h.aba[a];
    sim.h.ga[b] = sim.h.ga[a];
    sim.h.integ[b] = sim.h.integ[a];
    sim.h.z[b] = sim.h.z[a];
    sim.h.acc[b] = sim.h.acc[a];
    sim.o2[b] = sim.o2[a];
    sim.energy[b] = sim.energy[a];
    sim.ros[b] = sim.ros[a];
    sim.radSens[b] = sim.radSens[a];
  }
  t.slices.push(fresh);
  const pos = t.order.indexOf(sid);
  t.order.splice(pos + 1, 0, newId);
}

export function stepSeedling(sim: SeedTwin, dt: number, d: Drivers): void {
  const P = sim.params;
  const t = sim.template;
  const c = t.cells;
  const st = sim.seedling;
  const tG = sim.milestones.endospermRupture ?? sim.t;
  const since = sim.t - tG;
  const eTip = sim.mean(sim.energy, sim.tipCells);
  const g = sim.env.gravity_g;
  const gResp = gravityResponse(g);

  // ---------------- root: division in the meristem, elongation in the EZ
  const delay = p(P, "root_meristem_delay_h");
  const zMer = p(P, "root_meristem_len_um");
  const zEz = p(P, "root_ez_len_um");
  const lDiv = p(P, "root_division_len_um");
  const lMat = p(P, "root_mature_len_um");
  const mu = (Math.LN2 / p(P, "root_cell_cycle_h")) * d.fT;
  const rEz = p(P, "root_ez_rate") * d.fT;
  const ethRoot = 1 / (1 + p(P, "eth_root_inhibition") * d.ethResp);
  const lMatEth = lMat * ethRoot;
  const radDiv = 1 / (1 + p(P, "ros_to_division_arrest") * sim.mean(sim.ros, sim.tipCells));
  const kColl = t.order.indexOf(t.colletSliceId);
  let rootLen = 0;
  for (let k = 0; k < kColl; k++) if (t.slices[t.order[k]].region !== Region.Cap) rootLen += sim.meanLenOf(t.order[k]);
  const fMer = p(P, "root_young_meristem_fraction");
  const zMerEff = Math.min(zMer, fMer * rootLen);
  const zEzEff = Math.min(zEz, (1 - fMer) * rootLen);
  let z = 0;
  let ezLen = 0;
  const ezSlices: number[] = [];
  const toDivide: number[] = [];
  for (let k = 0; k < kColl; k++) {
    const sid = t.order[k];
    const s = t.slices[sid];
    if (s.region === Region.Cap) continue;
    const L = sim.meanLenOf(sid);
    const zc = z + L / 2;
    z += L;
    if (since < delay) continue;
    let rate = 0;
    if (zc < zMerEff) {
      rate = mu * radDiv * eTip;
      if (L * Math.exp(rate * dt) >= 2 * lDiv) toDivide.push(sid);
    } else if (zc < zMerEff + zEzEff && L < lMatEth) {
      rate = rEz * ethRoot * eTip;
      ezSlices.push(sid);
      ezLen += L;
    }
    if (rate > 0) {
      const f = Math.exp(rate * dt);
      for (const i of s.cells) {
        c.len[i] = Math.min(c.len[i] * f, zc < zMerEff ? lMat : lMatEth);
        sim.growthRate[i] = rate;
      }
    } else for (const i of s.cells) sim.growthRate[i] = 0;
  }
  if (toDivide.length && c.n + toDivide.length * 64 < c.capacity) {
    for (const sid of toDivide) divideSlice(sim, sid);
    st.divisions += toDivide.length;
    if (!sim.externalHeadspace) sim.rebuildGraph();
    sim.refreshCellFields();
  }

  // Check 35 µm Nytex root-barrier contact
  const nytexY = sim.pose.nytexBarrierY;
  if (nytexY !== undefined && !st.nytexContact) {
    sim.updateLayout();
    const tipRadius = t.slices[t.order[0]]?.radius0 ?? 38;
    if (sim.layout.tip[1] <= nytexY + tipRadius * 1.35 || since >= p(P, "anchor_delay_h")) {
      st.nytexContact = true;
    }
  }

  // Gravitropism of the root tip + 35 µm Nytex mechanical deflection
  let theta = sim.pose.rootAngle0;
  {
    const kc = t.order.indexOf(t.colletSliceId);
    for (let k = kc - 1; k >= 0; k--) theta += t.slices[t.order[k]].bend;
  }
  if (ezLen > 0) {
    if (st.nytexContact && nytexY !== undefined) {
      // Root tip is pressing against the 35 µm Nytex barrier: deflect tangentially along NYTEX_TANGENT (π)
      // while gravity keeps a slight downward contact angle (~6 deg into the barrier)
      const contactEquilAngle = NYTEX_TANGENT + (g > 0 ? 0.1 * gResp : 0);
      const omegaDefl = p(P, "nytex_deflection_rate_deg_h") * (Math.PI / 180) * eTip;
      const dTheta = -omegaDefl * Math.sin(wrap(theta - contactEquilAngle)) * dt;
      for (const sid of ezSlices) t.slices[sid].bend += (dTheta * sim.meanLenOf(sid)) / ezLen;
      theta += dTheta;
    } else if (g > 0) {
      const omega = p(P, "root_gravitropic_rate_deg_h") * (Math.PI / 180) * gResp * eTip;
      const dTheta = -omega * Math.sin(wrap(theta - DOWN)) * dt;
      for (const sid of ezSlices) t.slices[sid].bend += (dTheta * sim.meanLenOf(sid)) / ezLen;
      theta += dTheta;
    }
  }
  st.rootTipAngleDeg = (theta * 180) / Math.PI;

  // ---------------- anchoring: root hairs fix the collet onto the Nytex mesh, hypocotyl lifts the shoot
  if (sim.milestones.anchored === null && since >= p(P, "anchor_delay_h")) {
    sim.updateLayout();
    sim.pose.colletAnchor = [sim.layout.collet[0], sim.layout.collet[1]];
    sim.milestones.anchored = sim.t;
  }

  // ---------------- hypocotyl: elongation without division, acropetal, light/ethylene/SAS-gated
  const effLight = d.light * sim.lightFactor;
  st.deetiolation = Math.min(1, st.deetiolation + p(P, "deetiolation_rate") * effLight * dt);
  const dark = 1 - st.deetiolation;
  // Shade-Avoidance Syndrome (SAS): when shaded by neighbor crowns in the light, boost hypocotyl elongation
  const sasBoost = 1 + p(P, "crowd_sas_hyp_boost") * sim.shadeLevel * st.deetiolation;
  const rHyp = (dark * p(P, "hyp_rate_dark") + st.deetiolation * p(P, "hyp_rate_light") * sasBoost) * d.fT;
  const lHypLightEff =
    p(P, "hyp_cell_max_light_um") +
    sim.shadeLevel * 0.45 * (p(P, "hyp_cell_max_dark_um") - p(P, "hyp_cell_max_light_um"));
  const lHypMax = dark * p(P, "hyp_cell_max_dark_um") + st.deetiolation * lHypLightEff;
  const ethHyp = 1 / (1 + dark * p(P, "eth_hyp_inhibition") * d.ethResp);
  const thick = dark * p(P, "eth_hyp_thickening") * d.ethResp;
  const wave = p(P, "hyp_acropetal_delay_h");
  const hypDelay = p(P, "hyp_elongation_delay_h");
  const hypSlices = t.order.slice(kColl);
  const nHook = Math.round(p(P, "hook_slices"));
  hypSlices.forEach((sid, j) => {
    const s = t.slices[sid];
    if (since < hypDelay + j * wave) return;
    const rate = rHyp * ethHyp * eTip;
    const f = Math.exp(rate * dt);
    const fr = Math.exp(thick * dt);
    for (const i of s.cells) {
      if (c.len[i] < lHypMax) c.len[i] = Math.min(c.len[i] * f, lHypMax);
      if (thick > 0 && c.dep[i] < (c.vol0[i] / (c.len0[i] * c.wid[i])) * p(P, "eth_hyp_thick_max")) {
        c.dep[i] *= fr;
        c.wid[i] *= fr;
      }
      sim.growthRate[i] = rate;
    }
  });

  // 3D lateral phototropic lean toward open canopy gaps when crowded by neighbors
  if (sim.milestones.anchored !== null && d.light > 0) {
    const photoRate = p(P, "crowd_phototropic_rate_deg_h") * (Math.PI / 180);
    const curLeanX = sim.pose.leanX ?? 0;
    const curLeanZ = sim.pose.leanZ ?? 0;
    const maxStep = photoRate * dt;
    const dx = Math.max(-maxStep, Math.min(maxStep, sim.leanTargetX - curLeanX));
    const dz = Math.max(-maxStep, Math.min(maxStep, sim.leanTargetZ - curLeanZ));
    sim.pose.leanX = curLeanX + dx;
    sim.pose.leanZ = curLeanZ + dz;
  }

  // apical hook: curvature in the top slices; closed in darkness (exaggerated by ethylene), opens in light
  const hookTarget = (p(P, "hook_angle_dark_deg") * (1 + p(P, "eth_hook_exaggeration") * d.ethResp) * dark * Math.PI) / 180;
  const top = hypSlices.slice(Math.max(0, hypSlices.length - nHook));
  const tau = p(P, "hook_tau_h");
  let hook = 0;
  if (since >= hypDelay && sim.milestones.anchored !== null) {
    for (const sid of top) {
      const s = t.slices[sid];
      const target = hookTarget / Math.max(top.length, 1);
      s.bend += ((target - s.bend) * dt) / tau;
      hook += s.bend;
    }
  }
  st.hookDeg = (hook * 180) / Math.PI;

  // hypocotyl negative gravitropism (below the hook)
  if (g > 0 && sim.milestones.anchored !== null) {
    let a = sim.pose.rootAngle0 + Math.PI;
    const body = hypSlices.slice(0, Math.max(0, hypSlices.length - nHook));
    let bodyLen = 0;
    for (const sid of body) {
      a += t.slices[sid].bend;
      bodyLen += sim.meanLenOf(sid);
    }
    const omega = p(P, "hyp_gravitropic_rate_deg_h") * (Math.PI / 180) * gResp;
    const dA = -omega * Math.sin(wrap(a - UP)) * dt;
    for (const sid of body) t.slices[sid].bend += (dA * sim.meanLenOf(sid)) / Math.max(bodyLen, 1);
  }

  // ---------------- cotyledons: out once the hypocotyl has lifted them, open in light
  const hypGrowth = st.lengths(sim).hypocotyl - st.hypLen0;
  if (sim.milestones.anchored !== null && sim.pose.cotOut < 1) {
    sim.pose.cotOut = Math.min(1, hypGrowth / Math.max(t.embryo.cotLen, 1));
    if (sim.pose.cotOut >= 1 && sim.milestones.cotEmerged === null) {
      sim.milestones.cotEmerged = sim.t;
      sim.pose.shed = true;
    }
  }
  if (sim.pose.cotOut >= 1 && effLight > 0 && st.deetiolation > 0.2) {
    sim.pose.cotOpen = Math.min(1, sim.pose.cotOpen + p(P, "cot_open_rate") * effLight * dt);
    if (sim.pose.cotOpen >= 0.95 && sim.milestones.cotOpen === null) sim.milestones.cotOpen = sim.t;
    const rc = p(P, "cot_expansion_rate") * d.fT * effLight;
    const maxF = p(P, "cot_expansion_max");
    const f = Math.exp(rc * dt);
    for (let i = 0; i < c.n; i++) {
      if (c.cot[i] < 0) continue;
      if (c.len[i] < c.len0[i] * maxF) {
        c.len[i] *= f;
        c.wid[i] *= f;
      }
    }
  }
  st.photosynthesis = sim.pose.cotOpen > 0.5 ? p(P, "cot_photosynthesis_rate") * effLight * sim.pose.cotOpen : 0;
}
