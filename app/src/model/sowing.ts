// LEAF GBC1 3-compartment sowing plan on top of the 35 µm Nytex root-barrier mesh.
//
// Coordinates match the LEAF_GBC2_pot_model CAD geometry (in mm):
//   • Outer housing: 48 × 33.67 × 68 mm, X ∈ [-24, +24], Y ∈ [0, 33.67], Z ∈ [-34, +34]
//   • Porous foam blocks: X ∈ [-11.0, +21.3] mm (32.3 mm wide), Y ∈ [7.62, 14.62] mm
//   • 35 µm Nytex root barrier: Y ∈ [14.62, 14.77] mm (top surface Y = 14.77 mm)
//   • Compartment 1 (Z ∈ [-30.5, -9.5] mm, area 6.783 cm²): 32 Brassica rapa seeds (47.2 seeds/dm²)
//   • Compartment 2 (Z ∈ [-7.5, +7.5] mm, area 4.845 cm²): 100 Arabidopsis thaliana seeds (206.2 seeds/dm²)
//   • Compartment 3 (Z ∈ [+9.5, +30.5] mm, area 6.783 cm²): 32 Brassica rapa seeds (47.2 seeds/dm²)
import { p, type Params } from "./params";
import { mulberry32, normal } from "./rng";
import type { SeedSpecies } from "./simulate";

export type CompartmentId = 1 | 2 | 3;

export interface SownSeedSpec {
  id: number;
  compartment: CompartmentId;
  species: SeedSpecies;
  /** Seed contact point on the 35 µm Nytex surface (mm, GBC1 CAD frame) */
  xMm: number;
  yMm: number;
  zMm: number;
  /** Initial seed horizontal orientation angle around +Y (rad) */
  azimuthRad: number;
  /** Hydrotime base water potential offset Δψ_b (MPa) */
  psiBaseOffsetMpa: number;
  /** Species geometric scale factor relative to Arabidopsis template */
  seedScale: number;
  /** Seed minor half-axis radius in mm (b * seedScale * 1e-3) */
  seedRadiusMm: number;
  /** Compartment sowing density (seeds / dm²) */
  sowingDensityDm2: number;
  /** Grid indices within the compartment lattice */
  row: number;
  col: number;
}

export interface CompartmentGeometry {
  id: CompartmentId;
  label: string;
  species: SeedSpecies;
  foamXMinMm: number;
  foamXMaxMm: number;
  foamZMinMm: number;
  foamZMaxMm: number;
  sowXMinMm: number;
  sowXMaxMm: number;
  sowZMinMm: number;
  sowZMaxMm: number;
  areaCm2: number;
  portZMm: number;
}

export const COMPARTMENTS: ReadonlyArray<CompartmentGeometry> = [
  {
    id: 1,
    label: "Chamber 1 (Brassica rapa, Port 1)",
    species: "brassica_rapa",
    foamXMinMm: -11.0,
    foamXMaxMm: 21.3,
    foamZMinMm: -30.5,
    foamZMaxMm: -9.5,
    sowXMinMm: -8.0,
    sowXMaxMm: 18.0,
    sowZMinMm: -28.5,
    sowZMaxMm: -12.0,
    areaCm2: 6.783,
    portZMm: -21.59,
  },
  {
    id: 2,
    label: "Chamber 2 (Arabidopsis thaliana, Central Port 2)",
    species: "arabidopsis",
    foamXMinMm: -11.0,
    foamXMaxMm: 21.3,
    foamZMinMm: -7.5,
    foamZMaxMm: 7.5,
    sowXMinMm: -8.0,
    sowXMaxMm: 18.0,
    sowZMinMm: -6.0,
    sowZMaxMm: 6.0,
    areaCm2: 4.845,
    portZMm: 0.0,
  },
  {
    id: 3,
    label: "Chamber 3 (Brassica rapa, Port 3)",
    species: "brassica_rapa",
    foamXMinMm: -11.0,
    foamXMaxMm: 21.3,
    foamZMinMm: 9.5,
    foamZMaxMm: 30.5,
    sowXMinMm: -8.0,
    sowXMaxMm: 18.0,
    sowZMinMm: 11.5,
    sowZMaxMm: 28.0,
    areaCm2: 6.783,
    portZMm: 21.59,
  },
];

export interface SowingPlan {
  seeds: SownSeedSpec[];
  densityMultiplier: number;
  countsByCompartment: Record<CompartmentId, number>;
  densitiesDm2ByCompartment: Record<CompartmentId, number>;
  totalAreaCm2: number;
  overallDensityDm2: number;
}

/**
 * Build the 3-compartment GBC1 sowing layout for a given density multiplier
 * (1.0 = nominal 164-seed flight plan: 32 + 100 + 32).
 */
export function buildSowingPlan(
  params: Params,
  densityMultiplier = 1.0,
  rngSeed = 20261111,
): SowingPlan {
  const rng = mulberry32(rngSeed);
  const nytexY = p(params, "gbc1_nytex_top_y_mm");
  const sdPsiB = p(params, "psi_base_sd_mpa");
  const brapaScale = p(params, "brapa_seed_scale");
  const baseHalfWidthMm = (p(params, "geo_seed_width_um") * 0.5) * 1e-3;

  const nCh1 = Math.max(1, Math.round(p(params, "gbc1_ch1_seeds_brapa") * densityMultiplier));
  const nCh2 = Math.max(1, Math.round(p(params, "gbc1_ch2_seeds_ath") * densityMultiplier));
  const nCh3 = Math.max(1, Math.round(p(params, "gbc1_ch3_seeds_brapa") * densityMultiplier));

  const counts: Record<CompartmentId, number> = { 1: nCh1, 2: nCh2, 3: nCh3 };
  const densitiesDm2: Record<CompartmentId, number> = {
    1: (nCh1 / COMPARTMENTS[0].areaCm2) * 10,
    2: (nCh2 / COMPARTMENTS[1].areaCm2) * 10,
    3: (nCh3 / COMPARTMENTS[2].areaCm2) * 10,
  };

  const seeds: SownSeedSpec[] = [];
  let nextId = 0;

  for (const comp of COMPARTMENTS) {
    const count = counts[comp.id];
    const spanX = comp.sowXMaxMm - comp.sowXMinMm;
    const spanZ = comp.sowZMaxMm - comp.sowZMinMm;
    // Choose near-rectangular lattice dimensions matching the compartment aspect ratio
    let nx: number;
    let nz: number;
    if (comp.id === 2 && count === 100) {
      nx = 10;
      nz = 10;
    } else if ((comp.id === 1 || comp.id === 3) && count === 32) {
      nx = 8;
      nz = 4;
    } else {
      const aspect = spanX / Math.max(spanZ, 1);
      nz = Math.max(1, Math.round(Math.sqrt(count / aspect)));
      nx = Math.max(1, Math.ceil(count / nz));
    }

    const dx = nx > 1 ? spanX / (nx - 1) : 0;
    const dz = nz > 1 ? spanZ / (nz - 1) : 0;
    const jitterMax = comp.species === "arabidopsis" ? 0.08 : 0.14;
    const scale = comp.species === "brassica_rapa" ? brapaScale : 1.0;
    const radiusMm = baseHalfWidthMm * scale;

    let placed = 0;
    for (let iz = 0; iz < nz && placed < count; iz++) {
      for (let ix = 0; ix < nx && placed < count; ix++) {
        const baseX = nx > 1 ? comp.sowXMinMm + ix * dx : (comp.sowXMinMm + comp.sowXMaxMm) * 0.5;
        const baseZ = nz > 1 ? comp.sowZMinMm + iz * dz : (comp.sowZMinMm + comp.sowZMaxMm) * 0.5;
        const jx = (rng() - 0.5) * 2 * jitterMax;
        const jz = (rng() - 0.5) * 2 * jitterMax;
        const xMm = Math.max(comp.foamXMinMm + 1.0, Math.min(comp.foamXMaxMm - 1.0, baseX + jx));
        const zMm = Math.max(comp.foamZMinMm + 1.0, Math.min(comp.foamZMaxMm - 1.0, baseZ + jz));
        // Point radicles predominantly along the seed tape axis with natural spread
        const azimuthRad = (rng() - 0.5) * 0.65;
        const psiBaseOffsetMpa = sdPsiB * normal(rng);

        seeds.push({
          id: nextId++,
          compartment: comp.id,
          species: comp.species,
          xMm,
          yMm: nytexY,
          zMm,
          azimuthRad,
          psiBaseOffsetMpa,
          seedScale: scale,
          seedRadiusMm: radiusMm,
          sowingDensityDm2: densitiesDm2[comp.id],
          row: iz,
          col: ix,
        });
        placed++;
      }
    }
  }

  const totalAreaCm2 = COMPARTMENTS.reduce((acc, c) => acc + c.areaCm2, 0);
  const overallDensityDm2 = (seeds.length / totalAreaCm2) * 10;

  return {
    seeds,
    densityMultiplier,
    countsByCompartment: counts,
    densitiesDm2ByCompartment: densitiesDm2,
    totalAreaCm2,
    overallDensityDm2,
  };
}

/**
 * Transform a local SeedTwin cell position (x_um, y_um, z_um) into 3D GBC1 chamber coordinates (mm).
 * In local SeedTwin coordinates:
 *   • y_um = -b is the Nytex surface (Y_mm = spec.yMm = 14.77 mm)
 *   • x_um, z_um are rotated by spec.azimuthRad in the X-Z plane around (spec.xMm, spec.zMm)
 */
export function seedLocalUmToChamberMm(
  spec: SownSeedSpec,
  xUm: number,
  yUm: number,
  zUm: number,
): [number, number, number] {
  const s = spec.seedScale * 1e-3; // µm → mm with species scaling
  const ca = Math.cos(spec.azimuthRad);
  const sa = Math.sin(spec.azimuthRad);
  const dxMm = xUm * s;
  const dyMm = yUm * s;
  const dzMm = zUm * s;
  const X = spec.xMm + ca * dxMm - sa * dzMm;
  const Y = Math.max(spec.yMm, spec.yMm + spec.seedRadiusMm + dyMm);
  const Z = spec.zMm + sa * dxMm + ca * dzMm;
  return [X, Y, Z];
}
