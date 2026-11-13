# Build app/src/data/precomputedScenarios.json from results/tables/
import json
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
TABLES_DIR = ROOT / 'results/tables'
OUT_FILE = ROOT / 'app/src/data/precomputedScenarios.json'
OUT_FILE.parent.mkdir(parents=True, exist_ok=True)

SCENARIOS = [
    'earth_1g_push',
    'lunar_push_nominal',
    'iss_0g_push',
    'stagnant_0g_fault',
    'lunar_pull_nominal',
    'moisture_deficit_40pct',
    'lunar_sparse_05x',
    'lunar_crowded_15x',
]

def build():
    data = {}
    for sc in SCENARIOS:
        csv_file = TABLES_DIR / f'gbc1_community_timeseries_{sc}.csv'
        if not csv_file.exists():
            raise FileNotFoundError(f'Missing {csv_file}')
        df = pd.read_csv(csv_file)
        samples = []
        for _, row in df.iterrows():
            sample = {
                't': float(row['t_h']),
                'o2_hs_kpa': float(row['o2_hs_kpa']),
                'co2_hs_ppm': float(row['co2_hs_ppm']),
                'eth_hs_ppb': float(row['eth_hs_ppb']),
                'rh_pct': float(row['rh_pct']),
                't_dew_c': float(row['t_dew_c']),
                'dew_margin_c': float(row['dew_margin_c']),
                'total_resp_umol_h': float(row['total_resp_umol_h']),
                'total_photo_umol_h': float(row['total_photo_umol_h']),
                'net_co2_flux_umol_h': float(row['net_co2_flux_umol_h']),
                'total_eth_prod_nl_h': float(row['total_eth_prod_nl_h']),
                'total_leaf_area_cm2': float(row['total_leaf_area_cm2']),
                'mean_canopy_cover_frac': float(row['mean_canopy_cover_frac']),
                'nytex_root_exclusion_pct': float(row['nytex_root_exclusion_pct']),
                'rnalater_dp_kpa': float(row['rnalater_dp_kpa']),
                'germination_pct_all': float(row['germination_pct_all']),
                'mean_light_factor_all': float(row['mean_light_factor_all']),
                'mean_gbl_mms_all': float(row['mean_gbl_mms_all']),
                'mean_air_speed_mps_all': float(row['mean_air_speed_mps_all']),
                'ch1': {
                    'seedCount': int(row['ch1_seeds']),
                    'sowingDensityDm2': float(row['ch1_density_dm2']),
                    'germinationPct': float(row['ch1_germ_pct']),
                    't50H': float(row['ch1_t50_h']) if pd.notna(row['ch1_t50_h']) and str(row['ch1_t50_h']).strip() != '' else None,
                    'meanHypocotylMm': float(row['ch1_hyp_mm']),
                    'sdHypocotylMm': float(row['ch1_hyp_sd_mm']),
                    'meanRootLenMm': float(row['ch1_root_mm']),
                    'sdRootLenMm': float(row['ch1_root_sd_mm']),
                    'lai': float(row['ch1_lai']),
                    'canopyCoverFrac': float(row['ch1_canopy_cover']),
                    'meanLightFactor': float(row['ch1_light_factor']),
                    'meanLeanDeg': float(row['ch1_lean_deg']),
                    'meanO2TipKpa': float(row['ch1_o2_tip_kpa']),
                    'meanGblMms': float(row['ch1_gbl_mms']),
                    'meanAirSpeedMps': float(row['ch1_air_mps']),
                },
                'ch2': {
                    'seedCount': int(row['ch2_seeds']),
                    'sowingDensityDm2': float(row['ch2_density_dm2']),
                    'germinationPct': float(row['ch2_germ_pct']),
                    't50H': float(row['ch2_t50_h']) if pd.notna(row['ch2_t50_h']) and str(row['ch2_t50_h']).strip() != '' else None,
                    'meanHypocotylMm': float(row['ch2_hyp_mm']),
                    'sdHypocotylMm': float(row['ch2_hyp_sd_mm']),
                    'meanRootLenMm': float(row['ch2_root_mm']),
                    'sdRootLenMm': float(row['ch2_root_sd_mm']),
                    'lai': float(row['ch2_lai']),
                    'canopyCoverFrac': float(row['ch2_canopy_cover']),
                    'meanLightFactor': float(row['ch2_light_factor']),
                    'meanLeanDeg': float(row['ch2_lean_deg']),
                    'meanO2TipKpa': float(row['ch2_o2_tip_kpa']),
                    'meanGblMms': float(row['ch2_gbl_mms']),
                    'meanAirSpeedMps': float(row['ch2_air_mps']),
                },
                'ch3': {
                    'seedCount': int(row['ch3_seeds']),
                    'sowingDensityDm2': float(row['ch3_density_dm2']),
                    'germinationPct': float(row['ch3_germ_pct']),
                    't50H': float(row['ch3_t50_h']) if pd.notna(row['ch3_t50_h']) and str(row['ch3_t50_h']).strip() != '' else None,
                    'meanHypocotylMm': float(row['ch3_hyp_mm']),
                    'sdHypocotylMm': float(row['ch3_hyp_sd_mm']),
                    'meanRootLenMm': float(row['ch3_root_mm']),
                    'sdRootLenMm': float(row['ch3_root_sd_mm']),
                    'lai': float(row['ch3_lai']),
                    'canopyCoverFrac': float(row['ch3_canopy_cover']),
                    'meanLightFactor': float(row['ch3_light_factor']),
                    'meanLeanDeg': float(row['ch3_lean_deg']),
                    'meanO2TipKpa': float(row['ch3_o2_tip_kpa']),
                    'meanGblMms': float(row['ch3_gbl_mms']),
                    'meanAirSpeedMps': float(row['ch3_air_mps']),
                },
            }
            samples.append(sample)
        seed_count = int(df['ch1_seeds'].iloc[0] + df['ch2_seeds'].iloc[0] + df['ch3_seeds'].iloc[0])
        data[sc] = {
            'seedCount': seed_count,
            'samples': samples
        }
    with open(OUT_FILE, 'w') as f:
        json.dump(data, f)
    print(f'Wrote {OUT_FILE.stat().st_size} bytes to {OUT_FILE}')

if __name__ == '__main__':
    build()
