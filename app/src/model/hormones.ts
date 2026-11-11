// Per-cell hormone network.
//
// CORE: the ABA–GA–Integrator model of Abley et al. 2021 (eLife 10:e59485), equations (1)–(4).
import type { Graph } from "./graph";
import { p, type Params } from "./params";

export interface HormoneState {
  aba: Float64Array;
  ga: Float64Array;
  integ: Float64Array; // Abley's Integrator (DELLA/ABI4/ABI5)
  z: Float64Array;
  acc: Float64Array;
  /** ACO flux of each cell in the last step (normalised units per hour) */
  aco: Float64Array;
}

export interface HormoneInputs {
  n: number;
  /** per-cell weight of the sowing-induced GA signal (1 at the radicle tip) */
  gaSource: Float64Array;
  /** per-cell GID1 receptor abundance (1 at the radicle tip; Bassel 2014 receptor gradient) */
  gid1: Float64Array;
  o2: Float64Array; // Pa
  ros: Float64Array;
  active: Uint8Array;
  hydration: number;
  activation: number;
  light: number;
  ethResponse: number;
  fT: number;
}

export function allocHormones(capacity: number): HormoneState {
  return {
    aba: new Float64Array(capacity),
    ga: new Float64Array(capacity),
    integ: new Float64Array(capacity),
    z: new Float64Array(capacity),
    acc: new Float64Array(capacity),
    aco: new Float64Array(capacity),
  };
}

interface Core {
  bA: number; bG: number; bGZ: number; bI: number;
  vA: number; vG: number; vI: number; vZ: number;
  thAI: number; thGI: number; thIA: number; thIG: number;
  cAI: number; cGI: number; cIA: number; cIG: number;
  h: number;
}

function core(params: Params): Core {
  return {
    bA: p(params, "abley_beta_aba"),
    bG: p(params, "abley_beta_ga"),
    bGZ: p(params, "abley_beta_ga_z"),
    bI: p(params, "abley_beta_i"),
    vA: p(params, "abley_v_aba"),
    vG: p(params, "abley_v_ga"),
    vI: p(params, "abley_v_i"),
    vZ: p(params, "abley_v_z"),
    thAI: p(params, "abley_theta_aba_i"),
    thGI: p(params, "abley_theta_ga_i"),
    thIA: p(params, "abley_theta_i_aba"),
    thIG: p(params, "abley_theta_i_ga"),
    cAI: p(params, "abley_c_aba_i"),
    cGI: p(params, "abley_c_ga_i"),
    cIA: p(params, "abley_c_i_aba"),
    cIG: p(params, "abley_c_i_ga"),
    h: p(params, "abley_h"),
  };
}

const powH = (y: number, h: number): number => {
  const x = Math.max(y, 0);
  if (h === 4) {
    const x2 = x * x;
    return x2 * x2;
  }
  return Math.pow(x, h);
};

const up = (C: number, th: number, h: number, y: number) => {
  const yh = powH(y, h);
  return (C * yh) / (powH(th, h) + yh);
};
const down = (C: number, th: number, h: number, y: number) => C / (1 + powH(y, h) / powH(th, h));

let cachedFpKey = "";
let cachedFpVal = { aba: 10, ga: 0, integ: 50 };

export function dormantFixedPoint(params: Params): { aba: number; ga: number; integ: number } {
  const k = core(params);
  const key = `${k.bA}:${k.bG}:${k.bI}:${k.vA}:${k.vG}:${k.vI}:${k.thAI}:${k.thGI}:${k.thIA}:${k.thIG}:${k.cAI}:${k.cGI}:${k.cIA}:${k.cIG}:${k.h}`;
  if (key === cachedFpKey) return cachedFpVal;
  let a = 10;
  let g = 0;
  let i = 50;
  for (let it = 0; it < 200000; it++) {
    const da = k.bA + up(k.cAI, k.thAI, k.h, i) - k.vA * a;
    const dg = k.bG + down(k.cGI, k.thGI, k.h, i) - k.vG * g;
    const di = k.bI + up(k.cIA, k.thIA, k.h, a) - (k.vI + up(k.cIG, k.thIG, k.h, g)) * i;
    a += 0.01 * da;
    g += 0.01 * dg;
    i += 0.01 * di;
    if (Math.abs(da) + Math.abs(dg) + Math.abs(di) < 1e-12) break;
  }
  cachedFpKey = key;
  cachedFpVal = { aba: a, ga: g, integ: i };
  return cachedFpVal;
}

export function initHormones(params: Params, h: HormoneState, n: number): void {
  const fp = dormantFixedPoint(params);
  for (let i = 0; i < n; i++) {
    h.aba[i] = fp.aba;
    h.ga[i] = fp.ga;
    h.integ[i] = fp.integ;
    h.z[i] = 0;
    h.acc[i] = 0;
    h.aco[i] = 0;
  }
}

export function growthResponse(params: Params, h: HormoneState, i: number): number {
  const K = p(params, "integrator_growth_k");
  const n = p(params, "integrator_growth_hill");
  return 1 / (1 + powH(h.integ[i] / K, n));
}

const scratch = { a: new Float64Array(0), g: new Float64Array(0) };

export function stepHormones(params: Params, graph: Graph, h: HormoneState, inp: HormoneInputs, dt: number): number {
  const n = inp.n;
  if (scratch.a.length < n) {
    scratch.a = new Float64Array(n * 2);
    scratch.g = new Float64Array(n * 2);
  }
  const k = core(params);
  const du = (dt / p(params, "hormone_time_unit_h")) * inp.activation * inp.fT;
  if (du <= 0) return 0;
  const bZ = p(params, "abley_beta_z");
  const dark = p(params, "ga_dark_fraction");
  const light = dark + (1 - dark) * inp.light;
  const omega = p(params, "hormone_transport_omega");
  const kE = p(params, "eth_integrator_degradation");
  const vAeff = k.vA * (1 + p(params, "aba_imbibition_catabolism") * inp.hydration);
  const rosAba = p(params, "ros_to_aba");
  const rosAcc = p(params, "ros_to_acc");
  const sC = p(params, "acc_synth") * inp.fT * inp.activation;
  const kC = p(params, "acc_decay") * inp.fT;
  const vAco = p(params, "aco_vmax") * inp.fT * inp.activation;
  const KaccAco = p(params, "aco_km_acc");
  const Ko2Aco = p(params, "aco_km_o2_pa");

  const lapA = scratch.a;
  const lapG = scratch.g;
  for (let i = 0; i < n; i++) {
    lapA[i] = 0;
    lapG[i] = 0;
    if (!inp.active[i]) continue;
    for (let e = graph.offsets[i]; e < graph.offsets[i + 1]; e++) {
      const j = graph.nbr[e];
      if (!inp.active[j]) continue;
      lapA[i] += h.aba[j] - h.aba[i];
      lapG[i] += h.ga[j] - h.ga[i];
    }
  }

  let ethProd = 0;
  const thAIh = powH(k.thAI, k.h);
  const thGIh = powH(k.thGI, k.h);
  const thIAh = powH(k.thIA, k.h);
  const thIGh = powH(k.thIG, k.h);
  for (let i = 0; i < n; i++) {
    h.aco[i] = 0;
    if (!inp.active[i]) continue;
    const a = h.aba[i];
    const g = h.ga[i];
    const I = h.integ[i];
    const z = h.z[i];
    const ros = inp.ros[i];
    const Ih = powH(I, k.h);
    const ah = powH(a, k.h);
    const gh = powH(g, k.h);
    const upAI = (k.cAI * Ih) / (thAIh + Ih);
    const downGI = k.cGI / (1 + Ih / thGIh);
    const upIA = (k.cIA * ah) / (thIAh + ah);
    const upIG = (k.cIG * gh) / (thIGh + gh);
    const dA = k.bA * (1 + rosAba * ros) + upAI - vAeff * a + omega * lapA[i];
    const dG = k.bG + k.bGZ * z + downGI - k.vG * g + omega * lapG[i];
    const dI = k.bI + upIA - (k.vI + inp.gid1[i] * upIG + kE * inp.ethResponse) * I;
    const dZ = bZ * inp.hydration * light * inp.gaSource[i] - k.vZ * z;
    h.aba[i] = Math.max(0, a + du * dA);
    h.ga[i] = Math.max(0, g + du * dG);
    h.integ[i] = Math.max(0, I + du * dI);
    h.z[i] = Math.max(0, z + du * dZ);
    const c = h.acc[i];
    const o2f = inp.o2[i] / (Ko2Aco + inp.o2[i]);
    const aco = vAco * (c / (KaccAco + c)) * o2f;
    h.acc[i] = Math.max(0, c + dt * (sC * (1 + rosAcc * ros) - kC * c - aco));
    h.aco[i] = aco;
    ethProd += aco;
  }
  return ethProd;
}

export function maxStableDu(params: Params, maxDegree: number): number {
  const k = core(params);
  const omega = p(params, "hormone_transport_omega");
  const vA = k.vA * (1 + p(params, "aba_imbibition_catabolism"));
  const fastest = Math.max(vA + omega * maxDegree, k.vG + omega * maxDegree, k.vI + k.cIG, k.vZ);
  return 1 / fastest;
}

/**
 * Fast post-germination hormone update for community runs: once the seed coat has ruptured,
 * Abley's ABA/GA/Integrator bistable switch is already in the germinated state and only ACC/ACO
 * ethylene synthesis continues actively driving post-germination seedling kinematics.
 */
export function stepPostGerminationHormones(params: Params, h: HormoneState, inp: HormoneInputs, dt: number): number {
  const n = inp.n;
  const rosAcc = p(params, "ros_to_acc");
  const sC = p(params, "acc_synth") * inp.fT * inp.activation;
  const kC = p(params, "acc_decay") * inp.fT;
  const vAco = p(params, "aco_vmax") * inp.fT * inp.activation;
  const KaccAco = p(params, "aco_km_acc");
  const Ko2Aco = p(params, "aco_km_o2_pa");
  let ethProd = 0;
  for (let i = 0; i < n; i++) {
    h.aco[i] = 0;
    if (!inp.active[i]) continue;
    const c = h.acc[i];
    const o2f = inp.o2[i] / (Ko2Aco + inp.o2[i]);
    const aco = vAco * (c / (KaccAco + c)) * o2f;
    h.acc[i] = Math.max(0, c + dt * (sC * (1 + rosAcc * inp.ros[i]) - kC * c - aco));
    h.aco[i] = aco;
    ethProd += aco;
  }
  return ethProd;
}
