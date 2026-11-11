// Coupled 164-seed LEAF GBC1 Community Digital Twin.
//
// Integrates all 164 cellular `SeedTwin` instances across Chambers 1, 2, and 3 on the
// 35 µm Nytex root barrier (Y = 14.77 mm) with:
//   1. 3D GBC1 CFD microclimate (Push vs. Pull airflow, dip-and-converge channelling,
//      within-canopy wind attenuation, g_bl conductance, van Genuchten foam ψ)
//   2. 3D neighbor crowding & Beer–Lambert foliar light competition (SAS hypocotyl boost
//      + 3D phototropic shoot lean away from shading neighbor crowns)
//   3. Shared 54.05 mL GBC1 headspace gas & moisture balance (O2, CO2 with FvCB canopy
//      photosynthesis, ethylene C2H4, RH %, Magnus dew-point margin ΔT_margin, and
//      RNAlater root-zone hydraulic ΔP protection via the 35 µm Nytex barrier).
import { evaluateCommunityCrowding, type CompartmentMetrics, type CrowdingSnapshot } from "./crowding";
import { lightOn, type Env } from "./environment";
import { computeSeedMicroclimates, type FlowMode, type SeedMicroclimate } from "./gbc1Field";
import { R_GAS } from "./gas";
import { clusterOf, nesFor } from "./identity";
import { p, type Params } from "./params";
import { SeedTwin } from "./simulate";
import { buildSowingPlan, type CompartmentId, type SowingPlan, type SownSeedSpec } from "./sowing";

const PA_PER_KPA = 1000;

export interface CommunityOptions {
  /** Sowing density multiplier (0.5x = 82 seeds, 1.0x = 164 flight seeds, 1.5x = 246 seeds) */
  densityMultiplier?: number;
  /** Active pump flow rate Q (mL/min, default 25 mL/min from gbc1_pump_flow_ml_min) */
  flowMlMin?: number;
  /** Airflow manifold topology ("push" = Ports 1,3 -> Port 2; "pull" = Port 2 -> Ports 1,3) */
  flowMode?: FlowMode;
  /** Porous foam water activation fill percentage (20..100 %, default 100 %) */
  waterFillPct?: number;
  /** Integration timestep (h), default 0.2 h */
  dt?: number;
  /** Telemetry recording interval (h), default 1.0 h */
  sampleEvery?: number;
  /** Seeded PRNG seed for hydrotime ψ_b and lattice jitter */
  rngSeed?: number;
  /** Optional stressor class for radiation cell-type sensitivity */
  radClass?: string;
}

export interface CommunitySample {
  t: number;
  // Shared headspace & hardware telemetry
  o2_hs_kpa: number;
  co2_hs_ppm: number;
  eth_hs_ppb: number;
  rh_pct: number;
  t_dew_c: number;
  dew_margin_c: number;
  total_resp_umol_h: number;
  total_photo_umol_h: number;
  net_co2_flux_umol_h: number;
  total_eth_prod_nl_h: number;
  total_leaf_area_cm2: number;
  mean_canopy_cover_frac: number;
  nytex_root_exclusion_pct: number;
  rnalater_dp_kpa: number;
  // Whole-chamber seed averages
  germination_pct_all: number;
  mean_light_factor_all: number;
  mean_gbl_mms_all: number;
  mean_air_speed_mps_all: number;
  // Compartment-resolved telemetry (Ch 1: B. rapa, Ch 2: A. thaliana, Ch 3: B. rapa)
  ch1: CompartmentMetrics;
  ch2: CompartmentMetrics;
  ch3: CompartmentMetrics;
}

/** Saturation vapor pressure (kPa) via Magnus-Tetens formula */
export function satVaporPressureKpa(tempC: number): number {
  return 0.61078 * Math.exp((17.27 * tempC) / (tempC + 237.3));
}

/** Dew-point temperature (°C) from T (°C) and relative humidity (%) */
export function dewPointC(tempC: number, rhPct: number): number {
  const rh = Math.max(1.0, Math.min(100.0, rhPct)) / 100.0;
  const gamma = (17.27 * tempC) / (tempC + 237.3) + Math.log(rh);
  return (237.3 * gamma) / (17.27 - gamma);
}

export class GBC1CommunityTwin {
  readonly params: Params;
  readonly env: Env;
  readonly opts: Required<Omit<CommunityOptions, "radClass">> & { radClass?: string };
  readonly sowing: SowingPlan;
  readonly specs: SownSeedSpec[];
  readonly twins: SeedTwin[];

  t = 0;
  hs = { o2: 0, co2: 0, eth: 0 }; // Pa
  rhPct = 78.0;
  tDewC = 18.0;
  dewMarginC = 2.8;
  totalRespUmolH = 0;
  totalPhotoUmolH = 0;
  totalEthProdNlH = 0;
  rnalaterDpKpa = 1.65;

  microclimates: SeedMicroclimate[] = [];
  crowding: CrowdingSnapshot;
  samples: CommunitySample[] = [];
  private lastCrowdingUpdateH = -999;

  constructor(params: Params, env: Env, options: CommunityOptions = {}) {
    this.params = params;
    this.env = env;
    this.opts = {
      densityMultiplier: options.densityMultiplier ?? 1.0,
      flowMlMin: options.flowMlMin ?? p(params, "gbc1_pump_flow_ml_min"),
      flowMode: options.flowMode ?? "push",
      waterFillPct: options.waterFillPct ?? 100,
      dt: options.dt ?? 0.2,
      sampleEvery: options.sampleEvery ?? 1.0,
      rngSeed: options.rngSeed ?? 20261111,
      radClass: options.radClass,
    };

    this.sowing = buildSowingPlan(params, this.opts.densityMultiplier, this.opts.rngSeed);
    this.specs = this.sowing.seeds;

    const P = env.p_total_kpa * PA_PER_KPA;
    this.hs = {
      o2: env.o2_frac * P,
      co2: env.co2_ppm * 1e-6 * P,
      eth: env.eth_inlet_ppm * 1e-6 * P,
    };

    // Instantiate all cellular SeedTwin instances on the 35 µm Nytex surface
    this.twins = this.specs.map((sp) => {
      const seedParams: Params = {
        ...params,
        psi_base_seed_offset_mpa: sp.psiBaseOffsetMpa,
      };
      const radSensitivity = this.opts.radClass
        ? (s: SeedTwin) => {
            const out = new Float64Array(s.cells.n);
            for (let i = 0; i < s.cells.n; i++) {
              const v = nesFor(this.opts.radClass!, clusterOf(s.template, i, 24)) ?? 0;
              out[i] = Math.max(0.2, 1 + 0.5 * v);
            }
            return out;
          }
        : undefined;

      const sim = new SeedTwin(seedParams, env, {
        dt: this.opts.dt,
        sampleEvery: Math.max(1.0, this.opts.sampleEvery),
        species: sp.species,
        seedScale: sp.seedScale,
        externalHeadspace: true,
        nytexBarrier: true,
        radSensitivity,
      });
      sim.hs = { ...this.hs };
      return sim;
    });

    // Initial crowding + microclimate evaluation at t = 0
    this.crowding = evaluateCommunityCrowding(this.params, this.specs, this.twins);
    this.updateMicroclimateField();
    this.crowding = evaluateCommunityCrowding(this.params, this.specs, this.twins);
    this.record();
  }

  private updateMicroclimateField(): void {
    const heightsMm = new Float64Array(this.specs.length);
    for (let i = 0; i < this.specs.length; i++) {
      heightsMm[i] = this.crowding.crowns[i]?.shootHeightMm ?? 0.5;
    }
    this.microclimates = computeSeedMicroclimates(
      this.params,
      this.specs,
      heightsMm,
      this.crowding.laiByCompartment,
      this.opts.flowMlMin,
      this.opts.flowMode,
      this.env.gravity_g,
      this.opts.waterFillPct,
    );
    for (let i = 0; i < this.twins.length; i++) {
      const mc = this.microclimates[i];
      this.twins[i].localAirSpeedMps = mc.airSpeedMps;
      this.twins[i].localGblMms = mc.gblMms;
      this.twins[i].localSubstratePsiMpa = mc.substratePsiMpa + this.env.substrate_psi_mpa;
    }
  }

  /**
   * Compute Farquhar–von Caemmerer–Berry (FvCB) canopy photosynthetic O2 evolution / CO2 uptake
   * across all emerged green cotyledons in the chamber (mol/s).
   */
  private computeCanopyPhotosynthesisMolS(): number {
    const light = lightOn(this.env, this.t);
    if (light <= 0 || this.env.light_umol <= 0) return 0;

    const vcmax25 = p(this.params, "fvcb_vcmax25"); // µmol m⁻² s⁻¹
    const jmax25 = p(this.params, "fvcb_jmax25"); // µmol m⁻² s⁻¹
    const q10 = p(this.params, "q10");
    const fT = Math.pow(q10, (this.env.temp_c - 25.0) / 10.0);

    // Intercellular CO2 partial pressure adjustment
    const P = this.env.p_total_kpa * PA_PER_KPA;
    const co2Ppm = Math.max(50, (this.hs.co2 / P) * 1e6);
    const co2Factor = (co2Ppm - 45) / (co2Ppm + 260);

    let totalUmolS = 0;
    for (let i = 0; i < this.twins.length; i++) {
      const tw = this.twins[i];
      if (tw.pose.cotOpen <= 0.1 || tw.seedling.deetiolation <= 0.1) continue;
      const areaM2 = tw.cotyledonAreaMm2() * 1e-6;
      if (areaM2 <= 0) continue;

      const localPar = this.env.light_umol * tw.lightFactor;
      const j = (jmax25 * fT * localPar) / (localPar + 220);
      const aj = (j / 4.0) * co2Factor;
      const ac = vcmax25 * fT * co2Factor;
      const aGrossUmolM2S = Math.max(0, Math.min(ac, aj)) * tw.seedling.deetiolation;
      totalUmolS += aGrossUmolM2S * areaM2;
    }
    return totalUmolS * 1e-6; // mol/s
  }

  step(): void {
    const dt = this.opts.dt;
    // Refresh 3D crowding and CFD microclimate every 0.5 h of simulated time
    if (this.t - this.lastCrowdingUpdateH >= 0.5 - 1e-9) {
      this.crowding = evaluateCommunityCrowding(this.params, this.specs, this.twins);
      this.updateMicroclimateField();
      this.lastCrowdingUpdateH = this.t;
    }

    // Step all 164 cellular SeedTwin instances
    let totalRespMolS = 0;
    let totalEthMolS = 0;
    for (let i = 0; i < this.twins.length; i++) {
      const tw = this.twins[i];
      tw.hs.o2 = this.hs.o2;
      tw.hs.co2 = this.hs.co2;
      tw.hs.eth = this.hs.eth;
      tw.step();
      totalRespMolS += tw.respiration;
      totalEthMolS += tw.ethProduction;
    }

    // Canopy FvCB photosynthesis (mol/s)
    const photoMolS = this.computeCanopyPhotosynthesisMolS();

    // Shared 54.05 mL GBC1 headspace mass balance
    const V_m3 = p(this.params, "gbc1_headspace_ml") * 1e-6;
    const T_K = this.env.temp_c + 273.15;
    const P = this.env.p_total_kpa * PA_PER_KPA;
    // Active pump ventilation rate kv (1/s) from flowMlMin + passive seal leak
    const kvPumpPerH = (this.opts.flowMlMin * 60) / p(this.params, "gbc1_headspace_ml");
    const kv = (kvPumpPerH + this.env.vent_ach * 0.05) / 3600;
    const kScrub = this.env.eth_scrub_per_h / 3600;

    const relax = (pNow: number, srcPaPerS: number, pIn: number, kExtra: number) => {
      const k = kv + kExtra;
      if (k <= 0) return pNow + srcPaPerS * dt * 3600;
      const pEq = (srcPaPerS + kv * pIn) / k;
      return pEq + (pNow - pEq) * Math.exp(-k * dt * 3600);
    };

    const coef = (R_GAS * T_K) / V_m3; // Pa per mol
    const rq = p(this.params, "resp_quotient");
    const netO2MolS = photoMolS - totalRespMolS;
    const netCo2MolS = rq * totalRespMolS - photoMolS;

    this.hs.o2 = Math.max(0, relax(this.hs.o2, coef * netO2MolS, this.env.o2_frac * P, 0));
    this.hs.co2 = Math.max(20 * 1e-6 * P, relax(this.hs.co2, coef * netCo2MolS, this.env.co2_ppm * 1e-6 * P, 0));
    this.hs.eth = Math.max(0, relax(this.hs.eth, coef * totalEthMolS, this.env.eth_inlet_ppm * 1e-6 * P, kScrub));

    this.totalRespUmolH = totalRespMolS * 3600 * 1e6;
    this.totalPhotoUmolH = photoMolS * 3600 * 1e6;
    this.totalEthProdNlH = totalEthMolS * 3600 * 22.414e9;

    // Transpiration & headspace relative humidity / dew-point margin
    const leafAreaCm2 = this.crowding.totalLeafAreaCm2;
    const evapSourcePctPerH = (12.5 + 3.2 * leafAreaCm2) * (this.opts.waterFillPct / 100);
    const rhInlet = 68.0;
    const kVentRh = Math.max(0.25, kvPumpPerH * 0.18);
    const rhTarget = Math.min(98.5, rhInlet + evapSourcePctPerH / kVentRh);
    this.rhPct += (rhTarget - this.rhPct) * (1 - Math.exp(-kVentRh * dt));
    this.tDewC = dewPointC(this.env.temp_c, this.rhPct);
    const tLidC = this.env.temp_c - p(this.params, "gbc1_lid_cooling_delta_c");
    this.dewMarginC = tLidC - this.tDewC;

    // RNAlater hydraulic ΔP protection: because 100% of roots are deflected above the 35 µm Nytex
    // barrier, the foam pore network remains unobstructed (Kozeny-Carman ΔP stays near 1.65-1.85 kPa)
    const totalRootLenMm = this.crowding.crowns.reduce((acc, c) => acc + c.rootLenMm, 0);
    this.rnalaterDpKpa = p(this.params, "nytex_rnalater_dp_kpa") + Math.min(0.2, totalRootLenMm * 0.00012);

    this.t = +(this.t + dt).toFixed(4);

    if (
      Math.floor((this.t + 1e-9) / this.opts.sampleEvery) >
      Math.floor((this.t - dt + 1e-9) / this.opts.sampleEvery)
    ) {
      this.crowding = evaluateCommunityCrowding(this.params, this.specs, this.twins);
      this.updateMicroclimateField();
      this.record();
    }
  }

  runTo(tEnd: number): void {
    while (this.t < tEnd - 1e-9) {
      this.step();
    }
  }

  /**
   * Verify the percentage of root cells across all 164 seeds that remain above or on the
   * 35 µm Nytex root barrier (Y >= 14.77 mm in GBC1 chamber coordinates).
   */
  computeNytexRootExclusionPct(): number {
    let totalRootCells = 0;
    let aboveNytexCells = 0;
    for (let s = 0; s < this.twins.length; s++) {
      const tw = this.twins[s];
      const sp = this.specs[s];
      const c = tw.cells;
      const nytexLocalY = -(tw.template.seed.b + 1e-3);
      for (let i = 0; i < c.n; i++) {
        if (c.region[i] === 0 || c.region[i] === 3) {
          // Radicle (0) or Cap (3)
          totalRootCells++;
          const yUm = tw.layout.pos[3 * i + 1];
          if (yUm >= nytexLocalY - 1.0) aboveNytexCells++;
        }
      }
      void sp;
    }
    return totalRootCells > 0 ? (aboveNytexCells / totalRootCells) * 100 : 100;
  }

  record(): void {
    const P = this.env.p_total_kpa * PA_PER_KPA;
    const ch1 = this.crowding.byCompartment[1];
    const ch2 = this.crowding.byCompartment[2];
    const ch3 = this.crowding.byCompartment[3];
    const nAll = Math.max(1, this.specs.length);
    const germAll =
      ((ch1.germinatedCount + ch2.germinatedCount + ch3.germinatedCount) / nAll) * 100;
    const meanLightAll =
      (ch1.meanLightFactor * ch1.seedCount +
        ch2.meanLightFactor * ch2.seedCount +
        ch3.meanLightFactor * ch3.seedCount) /
      nAll;
    const meanGblAll =
      (ch1.meanGblMms * ch1.seedCount +
        ch2.meanGblMms * ch2.seedCount +
        ch3.meanGblMms * ch3.seedCount) /
      nAll;
    const meanUAll =
      (ch1.meanAirSpeedMps * ch1.seedCount +
        ch2.meanAirSpeedMps * ch2.seedCount +
        ch3.meanAirSpeedMps * ch3.seedCount) /
      nAll;

    this.samples.push({
      t: +this.t.toFixed(4),
      o2_hs_kpa: this.hs.o2 / 1000,
      co2_hs_ppm: (this.hs.co2 / P) * 1e6,
      eth_hs_ppb: (this.hs.eth / P) * 1e9,
      rh_pct: this.rhPct,
      t_dew_c: this.tDewC,
      dew_margin_c: this.dewMarginC,
      total_resp_umol_h: this.totalRespUmolH,
      total_photo_umol_h: this.totalPhotoUmolH,
      net_co2_flux_umol_h: this.totalRespUmolH * p(this.params, "resp_quotient") - this.totalPhotoUmolH,
      total_eth_prod_nl_h: this.totalEthProdNlH,
      total_leaf_area_cm2: this.crowding.totalLeafAreaCm2,
      mean_canopy_cover_frac: this.crowding.meanCanopyCoverFrac,
      nytex_root_exclusion_pct: this.computeNytexRootExclusionPct(),
      rnalater_dp_kpa: this.rnalaterDpKpa,
      germination_pct_all: germAll,
      mean_light_factor_all: meanLightAll,
      mean_gbl_mms_all: meanGblAll,
      mean_air_speed_mps_all: meanUAll,
      ch1: { ...ch1 },
      ch2: { ...ch2 },
      ch3: { ...ch3 },
    });
  }
}

export type CompartmentMap<T> = Record<CompartmentId, T>;
