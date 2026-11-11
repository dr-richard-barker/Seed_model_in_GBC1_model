// 3D neighbor crowding, foliar light competition (Beer–Lambert + pairwise crown shading),
// phototropic shoot deflection vectors, and compartment-level community morphometrics.
import { p, type Params } from "./params";
import { describe } from "./population";
import type { SeedTwin } from "./simulate";
import { COMPARTMENTS, seedLocalUmToChamberMm, type CompartmentId, type SownSeedSpec } from "./sowing";

export interface SeedCrownState {
  seedId: number;
  compartment: CompartmentId;
  crownXMm: number;
  crownYMm: number;
  crownZMm: number;
  shootHeightMm: number;
  rootLenMm: number;
  cotAreaMm2: number;
  crownRadiusMm: number;
  lightFactor: number;
  shadeLevel: number;
  leanTargetXRad: number;
  leanTargetZRad: number;
  leanTotalDeg: number;
  nearestNeighborDistMm: number;
}

export interface CompartmentMetrics {
  compartment: CompartmentId;
  species: "arabidopsis" | "brassica_rapa";
  seedCount: number;
  sowingDensityDm2: number;
  germinatedCount: number;
  germinationPct: number;
  t50H: number | null;
  u8416H: number | null;
  anchoredPct: number;
  cotOpenPct: number;
  meanHypocotylMm: number;
  sdHypocotylMm: number;
  meanRootLenMm: number;
  sdRootLenMm: number;
  totalLeafAreaMm2: number;
  lai: number;
  canopyCoverFrac: number;
  meanLightFactor: number;
  meanShadeLevel: number;
  meanLeanDeg: number;
  meanO2TipKpa: number;
  hypoxicSeedFrac: number;
  meanGblMms: number;
  meanAirSpeedMps: number;
}

export interface CrowdingSnapshot {
  crowns: SeedCrownState[];
  byCompartment: Record<CompartmentId, CompartmentMetrics>;
  laiByCompartment: Record<CompartmentId, number>;
  totalLeafAreaCm2: number;
  meanCanopyCoverFrac: number;
}

function meanAndSd(vals: number[]): [number, number] {
  if (vals.length === 0) return [0, 0];
  let sum = 0;
  for (const v of vals) sum += v;
  const mean = sum / vals.length;
  let sq = 0;
  for (const v of vals) sq += (v - mean) * (v - mean);
  return [mean, Math.sqrt(sq / vals.length)];
}

/**
 * Evaluate 3D crown positions, pairwise neighbor shading,Beer–Lambert light interception,
 * lateral phototropic lean targets, and compartment morphometrics for all seeds in GBC1.
 */
export function evaluateCommunityCrowding(
  params: Params,
  specs: SownSeedSpec[],
  twins: SeedTwin[],
): CrowdingSnapshot {
  const n = specs.length;
  const kExt = p(params, "crowd_beer_lambert_k");
  const fMin = p(params, "crowd_min_light_frac");
  const dCharBase = p(params, "crowd_shade_radius_mm");
  const nytexY = p(params, "gbc1_nytex_top_y_mm");

  const crowns: SeedCrownState[] = new Array(n);

  // Pass 1: extract 3D crown coordinates, shoot heights, root lengths, and cotyledon areas
  for (let i = 0; i < n; i++) {
    const sp = specs[i];
    const tw = twins[i];
    tw.updateLayout();
    const [nxUm, nyUm, nzUm] = tw.layout.node3D;
    const [cxMm, cyMm, czMm] = seedLocalUmToChamberMm(sp, nxUm, nyUm, nzUm);
    const lengths = tw.seedling.lengths(tw);
    const hypMm = lengths.hypocotyl * sp.seedScale * 1e-3;
    const rootMm = lengths.root * sp.seedScale * 1e-3;
    const shootHeightMm = Math.max(0.2, cyMm - nytexY);
    const cotAreaMm2 = tw.cotyledonAreaMm2();
    const crownRadiusMm = Math.max(0.35 * sp.seedScale, Math.sqrt(cotAreaMm2 / Math.PI) * 1.15);

    crowns[i] = {
      seedId: sp.id,
      compartment: sp.compartment,
      crownXMm: cxMm,
      crownYMm: cyMm,
      crownZMm: czMm,
      shootHeightMm: Math.max(hypMm * 0.65, shootHeightMm),
      rootLenMm: rootMm,
      cotAreaMm2,
      crownRadiusMm,
      lightFactor: 1.0,
      shadeLevel: 0.0,
      leanTargetXRad: 0,
      leanTargetZRad: 0,
      leanTotalDeg: 0,
      nearestNeighborDistMm: Infinity,
    };
  }

  // Pass 2: pairwise neighbor crown shading & lateral phototropic repulsion vectors
  for (let i = 0; i < n; i++) {
    const ci = crowns[i];
    const spi = specs[i];
    const dChar = dCharBase * (spi.species === "brassica_rapa" ? 1.55 : 1.0);
    let shadeIndex = 0;
    let repulseX = 0;
    let repulseZ = 0;
    let minDist = Infinity;

    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const cj = crowns[j];
      if (cj.compartment !== ci.compartment) continue;

      const dx = ci.crownXMm - cj.crownXMm;
      const dz = ci.crownZMm - cj.crownZMm;
      const dist = Math.hypot(dx, dz);
      if (dist < minDist) minDist = dist;

      if (cj.cotAreaMm2 <= 0.01 && twins[j].pose.cotOut <= 0.1) continue;

      // Height advantage weight: taller neighbors cast stronger overhead shade
      const dh = cj.crownYMm - ci.crownYMm;
      const heightWeight = 0.65 + 0.7 / (1 + Math.exp(-dh / 1.2));
      const sigma = Math.max(0.8, dChar + 0.5 * (ci.crownRadiusMm + cj.crownRadiusMm));
      const kernel = Math.exp(-(dist * dist) / (2 * sigma * sigma));
      const areaContrib = (cj.cotAreaMm2 + 0.35 * cj.crownRadiusMm * cj.crownRadiusMm) / (Math.PI * dChar * dChar);
      const pairShade = heightWeight * areaContrib * kernel;
      shadeIndex += pairShade;

      // Lateral light gradient points away from shading neighbor crowns
      if (dist > 1e-3) {
        const pushStrength = pairShade / Math.max(dist, 0.6);
        repulseX += (dx / dist) * pushStrength;
        repulseZ += (dz / dist) * pushStrength;
      }
    }

    ci.nearestNeighborDistMm = Number.isFinite(minDist) ? minDist : 0;
    const fLight = Math.max(fMin, Math.exp(-kExt * shadeIndex));
    ci.lightFactor = fLight;
    ci.shadeLevel = 1 - fLight;

    // Project repulsion vector into seed i's local azimuth frame and clamp to ±22 deg (0.384 rad)
    const ca = Math.cos(spi.azimuthRad);
    const sa = Math.sin(spi.azimuthRad);
    const localRepX = ca * repulseX + sa * repulseZ;
    const localRepZ = -sa * repulseX + ca * repulseZ;
    const maxLeanRad = (22 * Math.PI) / 180;
    ci.leanTargetXRad = Math.max(-maxLeanRad, Math.min(maxLeanRad, localRepX * 1.35));
    ci.leanTargetZRad = Math.max(-maxLeanRad, Math.min(maxLeanRad, localRepZ * 1.35));

    // Apply back to SeedTwin instance
    const tw = twins[i];
    tw.lightFactor = ci.lightFactor;
    tw.shadeLevel = ci.shadeLevel;
    tw.leanTargetX = ci.leanTargetXRad;
    tw.leanTargetZ = ci.leanTargetZRad;
    const curLx = tw.pose.leanX ?? 0;
    const curLz = tw.pose.leanZ ?? 0;
    ci.leanTotalDeg = (Math.hypot(curLx, curLz) * 180) / Math.PI;
  }

  // Pass 3: Compartment-level aggregation
  const byCompartment = {} as Record<CompartmentId, CompartmentMetrics>;
  const laiByCompartment = { 1: 0, 2: 0, 3: 0 } as Record<CompartmentId, number>;
  let totalLeafAreaMm2All = 0;

  for (const comp of COMPARTMENTS) {
    const cid = comp.id;
    const idxs: number[] = [];
    for (let i = 0; i < n; i++) if (specs[i].compartment === cid) idxs.push(i);

    const germTimes = idxs.map((i) => twins[i].milestones.endospermRupture);
    const desc = describe(germTimes);
    const germinatedCount = germTimes.filter((t) => t !== null).length;
    const anchoredCount = idxs.filter((i) => twins[i].milestones.anchored !== null).length;
    const cotOpenCount = idxs.filter((i) => twins[i].pose.cotOpen >= 0.5).length;

    const hypVals = idxs.map((i) => twins[i].seedling.lengths(twins[i]).hypocotyl * specs[i].seedScale * 1e-3);
    const rootVals = idxs.map((i) => crowns[i].rootLenMm);
    const [meanHyp, sdHyp] = meanAndSd(hypVals);
    const [meanRoot, sdRoot] = meanAndSd(rootVals);

    let compLeafAreaMm2 = 0;
    let sumLight = 0;
    let sumShade = 0;
    let sumLean = 0;
    let sumO2Tip = 0;
    let hypSeeds = 0;
    let sumGbl = 0;
    let sumU = 0;
    const hypThrKpa = p(params, "hypoxia_threshold_pa") / 1000;

    for (const i of idxs) {
      compLeafAreaMm2 += crowns[i].cotAreaMm2;
      sumLight += crowns[i].lightFactor;
      sumShade += crowns[i].shadeLevel;
      sumLean += crowns[i].leanTotalDeg;
      const o2TipKpa = twins[i].mean(twins[i].o2, twins[i].tipCells) / 1000;
      sumO2Tip += o2TipKpa;
      if (o2TipKpa < hypThrKpa) hypSeeds++;
      sumGbl += twins[i].localGblMms;
      sumU += twins[i].localAirSpeedMps ?? 0;
    }

    const count = Math.max(1, idxs.length);
    const compAreaMm2 = comp.areaCm2 * 100;
    const lai = compLeafAreaMm2 / compAreaMm2;
    const canopyCoverFrac = 1 - Math.exp(-kExt * lai);

    laiByCompartment[cid] = lai;
    totalLeafAreaMm2All += compLeafAreaMm2;

    byCompartment[cid] = {
      compartment: cid,
      species: comp.species,
      seedCount: idxs.length,
      sowingDensityDm2: (idxs.length / comp.areaCm2) * 10,
      germinatedCount,
      germinationPct: (germinatedCount / count) * 100,
      t50H: desc.t50,
      u8416H: desc.u8416,
      anchoredPct: (anchoredCount / count) * 100,
      cotOpenPct: (cotOpenCount / count) * 100,
      meanHypocotylMm: meanHyp,
      sdHypocotylMm: sdHyp,
      meanRootLenMm: meanRoot,
      sdRootLenMm: sdRoot,
      totalLeafAreaMm2: compLeafAreaMm2,
      lai,
      canopyCoverFrac,
      meanLightFactor: sumLight / count,
      meanShadeLevel: sumShade / count,
      meanLeanDeg: sumLean / count,
      meanO2TipKpa: sumO2Tip / count,
      hypoxicSeedFrac: hypSeeds / count,
      meanGblMms: sumGbl / count,
      meanAirSpeedMps: sumU / count,
    };
  }

  const totalAreaMm2 = COMPARTMENTS.reduce((acc, c) => acc + c.areaCm2 * 100, 0);
  const meanLai = totalLeafAreaMm2All / totalAreaMm2;

  return {
    crowns,
    byCompartment,
    laiByCompartment,
    totalLeafAreaCm2: totalLeafAreaMm2All / 100,
    meanCanopyCoverFrac: 1 - Math.exp(-kExt * meanLai),
  };
}
