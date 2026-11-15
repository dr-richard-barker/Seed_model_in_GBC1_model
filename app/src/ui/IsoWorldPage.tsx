import { useEffect, useMemo, useRef, useState } from "react";
import type { PortalView } from "./OverviewPage";

interface IsoWorldPageProps {
  onNavigate: (view: PortalView) => void;
}

interface PaperFigureRef {
  id: string;
  label: string;
  title: string;
  src: string;
  caption: string;
  highlights: string[];
}

interface StationDef {
  id: string;
  index: number;
  shortTitle: string;
  title: string;
  subtitle: string;
  camCenterU: number;
  camCenterV: number;
  summary: string;
  metrics: { label: string; value: string; accent?: boolean }[];
  figures: PaperFigureRef[];
  actionLabel: string;
  actionView: PortalView;
}

const COS30 = Math.sqrt(3) / 2;
const SIN30 = 0.5;

function iso(u: number, v: number, w: number): [number, number] {
  return [(u - v) * COS30, (u + v) * SIN30 - w];
}

function pts(coords: [number, number][]): string {
  return coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

type ToneKey = "slate" | "silver" | "paper" | "accent" | "dark";

const TONES: Record<ToneKey, { top: string; left: string; right: string }> = {
  paper: { top: "#ffffff", left: "#dfe4e6", right: "#bfc0c0" },
  silver: { top: "#e4e8ea", left: "#bfc0c0", right: "#999ea3" },
  slate: { top: "#6e7c96", left: "#4f5d75", right: "#394459" },
  dark: { top: "#4f5d75", left: "#384154", right: "#2d3142" },
  accent: { top: "#f6a581", left: "#ef8354", right: "#c75e32" },
};

/**
 * Deterministic 60fps drop-in bounce from 40px above, staggered by 3 frames per piece.
 */
function dropState(frame: number, pieceIndex: number): { visible: boolean; dw: number; opacity: number } {
  const start = pieceIndex * 3;
  if (frame < start) {
    return { visible: false, dw: 40, opacity: 0 };
  }
  const elapsed = frame - start;
  const duration = 18;
  const opacity = Math.min(1, elapsed / 4);
  if (elapsed >= duration) {
    return { visible: true, dw: 0, opacity: 1 };
  }
  const t = elapsed / duration;
  let dw = 0;
  if (t < 0.6) {
    const p = t / 0.6;
    dw = 40 * (1 - p * p);
  } else if (t < 0.84) {
    const p = (t - 0.6) / 0.24;
    dw = Math.sin(p * Math.PI) * 5.5;
  } else {
    const p = (t - 0.84) / 0.16;
    dw = Math.sin(p * Math.PI) * 1.6;
  }
  return { visible: true, dw, opacity };
}

interface IsoBoxProps {
  u: number;
  v: number;
  w: number;
  du: number;
  dv: number;
  dw: number;
  tone: ToneKey;
  frame?: number;
  pieceIndex?: number;
  extraW?: number;
  strokeWidth?: number;
  opacityScale?: number;
}

function IsoBox({
  u,
  v,
  w,
  du,
  dv,
  dw,
  tone,
  frame = 999,
  pieceIndex = 0,
  extraW = 0,
  strokeWidth = 1.2,
  opacityScale = 1,
}: IsoBoxProps) {
  const drop = dropState(frame, pieceIndex);
  if (!drop.visible) return null;

  const wz = w + drop.dw + extraW;
  const colors = TONES[tone];

  // Top face (at wz + dw)
  const top = pts([
    iso(u, v, wz + dw),
    iso(u + du, v, wz + dw),
    iso(u + du, v + dv, wz + dw),
    iso(u, v + dv, wz + dw),
  ]);

  // Left face (+v visible side in standard iso: u to u+du at v+dv)
  const left = pts([
    iso(u, v + dv, wz),
    iso(u + du, v + dv, wz),
    iso(u + du, v + dv, wz + dw),
    iso(u, v + dv, wz + dw),
  ]);

  // Right face (+u visible side in standard iso: v to v+dv at u+du)
  const right = pts([
    iso(u + du, v, wz),
    iso(u + du, v + dv, wz),
    iso(u + du, v + dv, wz + dw),
    iso(u + du, v, wz + dw),
  ]);

  return (
    <g opacity={drop.opacity * opacityScale}>
      <polygon points={left} fill={colors.left} stroke="#2d3142" strokeWidth={strokeWidth} strokeLinejoin="round" />
      <polygon points={right} fill={colors.right} stroke="#2d3142" strokeWidth={strokeWidth} strokeLinejoin="round" />
      <polygon points={top} fill={colors.top} stroke="#2d3142" strokeWidth={strokeWidth} strokeLinejoin="round" />
    </g>
  );
}

interface LeaderLineProps {
  anchor: [number, number, number];
  elbowDx: number;
  elbowDy: number;
  endDx: number;
  label: string;
  sublabel?: string;
  accent?: boolean;
  align?: "left" | "right";
  visible?: boolean;
}

function LeaderLabel({
  anchor,
  elbowDx,
  elbowDy,
  endDx,
  label,
  sublabel,
  accent = false,
  align = "right",
  visible = true,
}: LeaderLineProps) {
  if (!visible) return null;
  const [ax, ay] = iso(anchor[0], anchor[1], anchor[2]);
  const ex = ax + elbowDx;
  const ey = ay + elbowDy;
  const tx = ex + endDx;
  const ty = ey;
  const stroke = accent ? "#ef8354" : "#2d3142";
  const textAnchor = align === "right" ? "start" : "end";
  const textX = align === "right" ? tx + 6 : tx - 6;

  return (
    <g>
      <polyline
        points={`${ax.toFixed(1)},${ay.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`}
        fill="none"
        stroke={stroke}
        strokeWidth={1.15}
      />
      <circle cx={ax} cy={ay} r={2.8} fill={accent ? "#ef8354" : "#eef2f3"} stroke={stroke} strokeWidth={1.2} />
      <text
        x={textX}
        y={ty - 3}
        textAnchor={textAnchor}
        fontSize="10.5"
        fontWeight="700"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fill="#2d3142"
      >
        {label}
      </text>
      {sublabel && (
        <text
          x={textX}
          y={ty + 10}
          textAnchor={textAnchor}
          fontSize="9.2"
          fontFamily="system-ui, -apple-system, sans-serif"
          fill={accent ? "#c75e32" : "#4f5d75"}
        >
          {sublabel}
        </text>
      )}
    </g>
  );
}

const STATIONS: StationDef[] = [
  {
    id: "habitat",
    index: 0,
    shortTitle: "01 · Habitat & 164 Seeds",
    title: "Station 1 · GBC1 3-Compartment Habitat & Flight Sowing Grid",
    subtitle: "48 × 33.67 × 68 mm flight hardware · 32 B. rapa + 100 A. thaliana + 32 B. rapa",
    camCenterU: 130,
    camCenterV: 10,
    summary:
      "The LEAF GBC1 cartridge houses three hydrologically coupled compartments above a polyurethane foam reservoir. Lifting the optical lid reveals the 164 flight-manifested seeds arranged on the 35 µm Nytex plane (Y = 14.77 mm).",
    metrics: [
      { label: "Total Flight Seeds", value: "164 (32+100+32)" },
      { label: "Ch 2 Arabidopsis Density", value: "206.4 seeds/dm²", accent: true },
      { label: "Ch 1 & 3 B. rapa Density", value: "47.2 seeds/dm²" },
      { label: "Headspace Volume", value: "54.05 mL" },
    ],
    figures: [
      {
        id: "fig1",
        label: "Fig. 1",
        title: "Flight Sowing Layout, Foam Water Content & 3D CFD Airflow",
        src: "./fig1_gbc1_sowing_and_microclimate.png",
        caption:
          "CAD geometry of the 3-compartment GBC1 chamber (48 × 33.67 × 68 mm) with 164 seeds (32 B. rapa + 100 A. thaliana + 32 B. rapa) on the 35 µm Nytex screen (Y = 14.77 mm), van Genuchten water content under 0.166g, and Push mode dip-and-converge CFD jet.",
        highlights: [
          "Exact 3-compartment sowing geometry verified against Gate 2",
          "van Genuchten matric suction retains uniform moisture at 0.166g",
          "Optical lid sits 19.23 mm above the Nytex sowing plane",
        ],
      },
    ],
    actionLabel: "Inspect 3D Hardware in Twin",
    actionView: "simulator",
  },
  {
    id: "nytex",
    index: 1,
    shortTitle: "02 · 35 µm Nytex & RNAlater",
    title: "Station 2 · 35 µm Nytex Root Barrier & RNAlater Perfusion Protection",
    subtitle: "100% root-tip exclusion above Y = 14.77 mm · ΔP = 1.75 kPa vs. 89.3 kPa clogged",
    camCenterU: 350,
    camCenterV: 10,
    summary:
      "Radicles emerge into the hydrated zone and deflect tangentially along the woven 35 µm Nytex screen rather than penetrating into the underlying foam. This keeps the RNAlater fixation path unobstructed at ΔP = 1.75 kPa.",
    metrics: [
      { label: "Root Exclusion Rate", value: "100.0%", accent: true },
      { label: "RNAlater Fixation ΔP", value: "1.75 kPa (≪ 8.04 kPa)" },
      { label: "Without Nytex ΔP", value: "89.3 kPa (clogged)" },
      { label: "ψ_b Germination Concordance", value: "100.0% (4314/4314)" },
    ],
    figures: [
      {
        id: "fig2",
        label: "Fig. 2",
        title: "3D Cellular Seedling Phenotypic Variation Atlas",
        src: "./fig2_seed_phenotypic_variation.png",
        caption:
          "Predicted 3D cellular seedling morphological plasticity across Nytex barrier deflection (ΔP = 1.75 kPa ≪ 8.04 kPa bubble point), gravity regimes, atmospheric hypoxia/ethylene triple response, forced vs. stagnant airflow, cosmic radiation, and phototropic lean.",
        highlights: [
          "35 µm pore aperture mechanically blocks root-cap penetration",
          "Tangential root crawling preserves sub-screen hydraulic conductivity",
          "Hydrotime ψ_b variation drives realistic asynchronous germination",
        ],
      },
      {
        id: "fig3",
        label: "Fig. 3",
        title: "3D Cellular Developmental Progression & Germination Kinetics",
        src: "./fig2_community_germination_and_morphometrics.png",
        caption:
          "Mid-plane 3D cellular progression (0 h dry seed to 120 h seedling), compartment germination curves (t50 = 20.2 h B. rapa vs. 32.5 h A. thaliana), 100% ψ_b hydrotime concordance (Gate 4), gravity-dependent hypocotyl trajectories, and tangential root crawling along Nytex (Gate 3).",
        highlights: [
          "B. rapa reaches t50 at 20.2 h; A. thaliana reaches t50 at 32.5 h",
          "At 120 h, Ch 2 A. thaliana roots crawl 2.87 mm; Ch 1 B. rapa 7.76 mm",
        ],
      },
    ],
    actionLabel: "Compare Nominal vs. Fault in Dual Sim",
    actionView: "compare",
  },
  {
    id: "crowding",
    index: 2,
    shortTitle: "03 · Crowding & SAS",
    title: "Station 3 · Canopy Crowding & Shade-Avoidance Syndrome (SAS)",
    subtitle: "0.5× (82 seeds) → 1.0× (164 seeds) → 1.5× (246 seeds) · Beer–Lambert attenuation",
    camCenterU: 570,
    camCenterV: 10,
    summary:
      "At 206.4 seeds/dm² in Central Chamber 2, expanding cotyledons overlap and attenuate PAR (f_light drops from 0.943 to 0.815). Neighbors trigger phytochrome-B shade avoidance, elongating hypocotyls and bending outer shoots laterally.",
    metrics: [
      { label: "Canopy LAI (0.5× → 1.5×)", value: "0.04 → 0.11" },
      { label: "Light Transmittance (1.0×)", value: "f_light = 0.872" },
      { label: "Hypocotyl Length (0.5× → 1.5×)", value: "2.13 → 2.43 mm", accent: true },
      { label: "3D Phototropic Lean", value: "0.48° → 1.59°" },
    ],
    figures: [
      {
        id: "fig4",
        label: "Fig. 4",
        title: "Sowing Density Sweep (0.25× to 2.0×) & Shade Avoidance",
        src: "./fig3_sowing_density_crowding_sweep.png",
        caption:
          "Monotonic scaling of canopy Leaf Area Index (LAI), Beer–Lambert light extinction (f_light = 0.872 at 1.0×), SAS hypocotyl elongation boost (2.13 mm → 2.43 mm), and 3D lateral phototropic shoot lean away from neighbor crowns (Gate 5).",
        highlights: [
          "Monotonic LAI and shading increase across 0.25× to 2.0× sweep",
          "Outer Chamber 2 seedlings lean away from central crown competition",
        ],
      },
    ],
    actionLabel: "Run Crowding Sweep in Dual Sim",
    actionView: "compare",
  },
  {
    id: "cfd",
    index: 3,
    shortTitle: "04 · Push/Pull CFD & Gas",
    title: "Station 4 · Push vs. Pull CFD Channelling & Ethylene Scrubbing",
    subtitle: "Active 25 mL/min loop vs. Stagnant 0 mL/min fault · Optical lid dew-point safety",
    camCenterU: 790,
    camCenterV: 10,
    summary:
      "In Push mode, the inlet manifold drives a dip-and-converge jet across Chamber 2 (g_bl = 13.42 mm/s vs. 12.67 mm/s in Pull), scrubbing ethylene to 0.08 ppb. Turning the pump off spikes C2H4 to 136.5 ppb and induces radicle hypoxia.",
    metrics: [
      { label: "Push Ch 2 g_bl", value: "13.42 mm/s", accent: true },
      { label: "Pull Ch 2 g_bl", value: "12.67 mm/s" },
      { label: "Active vs. Stagnant C₂H₄", value: "0.08 vs. 136.5 ppb", accent: true },
      { label: "Radicle Tip O₂ (Act / Stag)", value: "16.08 / 11.20 kPa" },
    ],
    figures: [
      {
        id: "fig5",
        label: "Fig. 5",
        title: "Headspace Gas Exchange, Psychrometrics & 3D Streamlines",
        src: "./fig4_headspace_gas_and_push_pull_cfd.png",
        caption:
          "Coupled 54.05 mL headspace O2/CO2 dynamics with FvCB canopy assimilation, trace ethylene scrubbing (< 0.1 ppb active vs. 136.5 ppb stagnant fault), optical lid dew-point safety margin (+2.8 °C), and Push vs. Pull CFD streamline topologies.",
        highlights: [
          "Push jet dips directly into the dense Chamber 2 Arabidopsis canopy",
          "Optical lid maintains +2.8 °C margin above dew point to prevent fogging",
        ],
      },
    ],
    actionLabel: "Test Push vs. Pull in Dual Sim",
    actionView: "compare",
  },
  {
    id: "gravity",
    index: 4,
    shortTitle: "05 · Gravity & 8 Scenarios",
    title: "Station 5 · Gravity Scaling (1.0g vs. 0.166g vs. 0g) & Mission Matrix",
    subtitle: "Earth control vs. Artemis III Lunar vs. ISS microgravity · 8-scenario synthesis",
    camCenterU: 1010,
    camCenterV: 10,
    summary:
      "Reducing gravity from 1.0g to 0.166g and 0g weakens statolith-driven gravitropism, increasing root-search dispersion across the Nytex mesh and altering shoot uprightness. Active Push ventilation decouples gaseous stress from lunar gravity.",
    metrics: [
      { label: "Lunar Gravity", value: "0.166 g (1.62 m/s²)", accent: true },
      { label: "Earth Control", value: "1.000 g (9.81 m/s²)" },
      { label: "Orbital Microgravity", value: "0.000 g" },
      { label: "Validation Gates Passed", value: "17 / 17", accent: true },
    ],
    figures: [
      {
        id: "fig6",
        label: "Fig. 6",
        title: "8-Scenario Mission & Hardware Fault Comparison Matrix",
        src: "./fig5_scenario_comparison_matrix.png",
        caption:
          "Quantitative comparison heatmap normalized against terrestrial 1g control across nominal lunar flight, Pull mode, microgravity 0g, sparse/crowded sowing, stagnant pump-off fault, and 40% foam moisture deficit.",
        highlights: [
          "Stagnant 0g pump-off and 40% foam deficit produce the largest biological penalties",
          "Nominal 0.166g Push preserves > 95% of 1.0g germination and biomass",
        ],
      },
      {
        id: "fig7",
        label: "Fig. 7",
        title: "3D Chamber Digital Twin: Gravity & Flow Rate Lessons",
        src: "./fig7_chamber_gravity_flow_morphology.png",
        caption:
          "Isometric 3D chamber visualization demonstrating how gravity level (1.0g vs. 0.166g vs. 0g) governs root search dispersion and how active Push sweep (Q = 25 mL/min) prevents boundary-layer ethylene intoxication.",
        highlights: [
          "1.0g roots anchor tightly; 0g roots exhibit wide random-walk dispersion",
          "Active 25 mL/min Push flow eliminates boundary-layer ethylene accumulation",
        ],
      },
    ],
    actionLabel: "Run 1g vs. Lunar Dual Report",
    actionView: "compare",
  },
];

export function IsoWorldPage({ onNavigate }: IsoWorldPageProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [roofOpen, setRoofOpen] = useState(true);
  const [frame, setFrame] = useState(0);
  const [camPos, setCamPos] = useState<[number, number]>(() => iso(STATIONS[0].camCenterU, STATIONS[0].camCenterV, 35));
  const [zoomedFig, setZoomedFig] = useState<PaperFigureRef | null>(null);
  const [activeFigTab, setActiveFigTab] = useState(0);

  const station = STATIONS[activeIdx];
  const targetCam = useMemo(() => iso(station.camCenterU, station.camCenterV, 35), [station]);

  // Smooth orthographic camera slide (no perspective rotation) + 60fps drop-in / process clock
  const targetRef = useRef(targetCam);
  targetRef.current = targetCam;
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(48, now - lastTs);
      lastTs = now;

      setCamPos(([cx, cy]) => {
        const [tx, ty] = targetRef.current;
        const dx = tx - cx;
        const dy = ty - cy;
        if (Math.abs(dx) < 0.25 && Math.abs(dy) < 0.25) {
          return [tx, ty];
        }
        const alpha = 1 - Math.exp(-dt * 0.0085);
        return [cx + dx * alpha, cy + dy * alpha];
      });

      if (playingRef.current) {
        setFrame((f) => f + dt / 16.6667);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const selectStation = (idx: number) => {
    setActiveIdx(idx);
    setActiveFigTab(0);
    setFrame(0);
    setRoofOpen(true);
    setPlaying(true);
  };

  const replayStation = () => {
    setFrame(0);
    setPlaying(true);
  };

  // Smooth roof lift height (waits slightly until base walls drop in, or responds to toggle)
  const roofProgress = roofOpen ? Math.min(1, Math.max(0, (frame - 24) / 22)) : 0;
  const roofLiftW = roofProgress * 46;
  const processPulse = 0.5 + 0.5 * Math.sin(frame * 0.08);
  const viewBoxW = 760;
  const viewBoxH = 440;
  const viewBoxX = camPos[0] - viewBoxW / 2;
  const viewBoxY = camPos[1] - viewBoxH / 2;

  const currentFigure = station.figures[Math.min(activeFigTab, station.figures.length - 1)];

  return (
    <div className="portal-page isoworld-page">
      {/* HEADER + STORYBOARD CONTROLS */}
      <section className="iso-header-bar">
        <div>
          <span className="eyebrow">Orthographic Isometric Diorama · True Isometric 30° Projection</span>
          <h2>LEAF GBC1 Miniature World Overview</h2>
          <p className="iso-lead">
            Follow the 5-station isometric cutaway tour of the 164-seed digital twin—from flight sowing and the 35 µm Nytex
            root barrier to canopy crowding, Push/Pull CFD, and lunar gravity scaling—paired directly with the paper’s figures.
          </p>
        </div>
        <div className="iso-controls">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? "Pause Motion" : "Play Motion"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setRoofOpen((r) => !r)}
          >
            {roofOpen ? "Lower Roof" : "Lift Roof"}
          </button>
          <button type="button" className="btn-secondary" onClick={replayStation}>
            Replay Drop-In
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => selectStation((activeIdx + 1) % STATIONS.length)}
          >
            Next Station →
          </button>
        </div>
      </section>

      {/* STATION STEPPER PILLS */}
      <div className="iso-stepper" role="tablist" aria-label="Isometric story stations">
        {STATIONS.map((s, idx) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={idx === activeIdx}
            className={`iso-step-pill ${idx === activeIdx ? "active" : ""}`}
            onClick={() => selectStation(idx)}
          >
            {s.shortTitle}
          </button>
        ))}
      </div>

      {/* MAIN ORTHOGRAPHIC ISOMETRIC STAGE */}
      <section className="iso-stage-card">
        <div className="iso-stage-badge-row">
          <span className="iso-badge">
            CAMERA: ORTHOGRAPHIC ISO (30°/30°) · SLIDE ONLY · NO PERSPECTIVE ROTATION
          </span>
          <span className="iso-badge accent">
            STATION {activeIdx + 1} / {STATIONS.length} · ROOF {roofOpen ? "LIFTED" : "CLOSED"}
          </span>
        </div>

        <svg
          className="iso-svg-stage"
          viewBox={`${viewBoxX.toFixed(1)} ${viewBoxY.toFixed(1)} ${viewBoxW} ${viewBoxH}`}
          role="img"
          aria-label={`Isometric miniature world showing ${station.title}`}
        >
          {/* Background */}
          <rect x={viewBoxX - 400} y={viewBoxY - 400} width={viewBoxW + 800} height={viewBoxH + 800} fill="#eef2f3" />

          {/* Subtle orthographic isometric grid lines */}
          <g opacity={0.28}>
            {Array.from({ length: 24 }, (_, i) => {
              const u = -80 + i * 60;
              const [x1, y1] = iso(u, -130, 0);
              const [x2, y2] = iso(u, 150, 0);
              return <line key={`gu-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#bfc0c0" strokeWidth={0.8} />;
            })}
            {Array.from({ length: 8 }, (_, j) => {
              const v = -120 + j * 40;
              const [x1, y1] = iso(-80, v, 0);
              const [x2, y2] = iso(1280, v, 0);
              return <line key={`gv-${j}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#bfc0c0" strokeWidth={0.8} />;
            })}
          </g>

          {/* Continuous campus baseplate connecting all 5 stations */}
          <IsoBox u={10} v={-78} w={-12} du={1140} dv={176} dw={12} tone="silver" />
          {/* Connecting walkway strip */}
          <IsoBox u={20} v={-12} w={0} du={1120} dv={24} dw={3} tone="slate" />

          {/* ============================================================
              STATION 1: GBC1 3-COMPARTMENT HABITAT & 164-SEED GRID (u=60..200)
              ============================================================ */}
          <g opacity={activeIdx === 0 ? 1 : 0.48}>
            {/* Foundation plinth */}
            <IsoBox u={65} v={-58} w={0} du={130} dv={136} dw={10} tone="slate" frame={activeIdx === 0 ? frame : 999} pieceIndex={0} />
            {/* Polyurethane foam hydration slab */}
            <IsoBox u={75} v={-48} w={10} du={110} dv={116} dw={16} tone="silver" frame={activeIdx === 0 ? frame : 999} pieceIndex={1} />
            {/* 3 Compartment outer walls */}
            <IsoBox u={75} v={-48} w={26} du={32} dv={116} dw={24} tone="paper" frame={activeIdx === 0 ? frame : 999} pieceIndex={2} />
            <IsoBox u={112} v={-48} w={26} du={36} dv={116} dw={24} tone="paper" frame={activeIdx === 0 ? frame : 999} pieceIndex={3} />
            <IsoBox u={153} v={-48} w={26} du={32} dv={116} dw={24} tone="paper" frame={activeIdx === 0 ? frame : 999} pieceIndex={4} />

            {/* Staggered seed rows dropping into the 3 compartments */}
            {[0, 1, 2, 3].map((r) => (
              <IsoBox
                key={`s1-br1-${r}`}
                u={83 + r * 5}
                v={-36 + r * 22}
                w={50}
                du={6}
                dv={6}
                dw={5}
                tone="accent"
                frame={activeIdx === 0 ? frame : 999}
                pieceIndex={5 + r}
              />
            ))}
            {[0, 1, 2, 3, 4].map((r) => (
              <IsoBox
                key={`s1-at-${r}`}
                u={120 + (r % 2) * 10}
                v={-38 + r * 18}
                w={50}
                du={5}
                dv={5}
                dw={4}
                tone="slate"
                frame={activeIdx === 0 ? frame : 999}
                pieceIndex={9 + r}
              />
            ))}
            {[0, 1, 2, 3].map((r) => (
              <IsoBox
                key={`s1-br2-${r}`}
                u={162 + r * 4}
                v={-34 + r * 22}
                w={50}
                du={6}
                dv={6}
                dw={5}
                tone="accent"
                frame={activeIdx === 0 ? frame : 999}
                pieceIndex={14 + r}
              />
            ))}

            {/* Lifted optical lid / roof */}
            {activeIdx === 0 && roofLiftW > 4 && (
              <g opacity={0.5} stroke="#4f5d75" strokeWidth={0.9} strokeDasharray="3 3">
                {[
                  [75, -48],
                  [185, -48],
                  [185, 68],
                  [75, 68],
                ].map(([cu, cv], k) => {
                  const [x1, y1] = iso(cu, cv, 50);
                  const [x2, y2] = iso(cu, cv, 50 + roofLiftW);
                  return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} />;
                })}
              </g>
            )}
            <IsoBox
              u={73}
              v={-50}
              w={51}
              du={114}
              dv={120}
              dw={8}
              tone="slate"
              frame={activeIdx === 0 ? frame : 999}
              pieceIndex={18}
              extraW={activeIdx === 0 ? roofLiftW : 0}
              opacityScale={activeIdx === 0 && roofLiftW > 6 ? 0.92 : 1}
            />

            {/* Thin leader lines */}
            <LeaderLabel
              visible={activeIdx === 0 && frame > 28}
              anchor={[130, -48, 55 + roofLiftW]}
              elbowDx={24}
              elbowDy={-26}
              endDx={42}
              label="OPTICAL LID (LIFTED)"
              sublabel="54.05 mL headspace"
            />
            <LeaderLabel
              visible={activeIdx === 0 && frame > 32}
              anchor={[130, 10, 52]}
              elbowDx={-30}
              elbowDy={-48}
              endDx={-44}
              align="left"
              accent
              label="CH 2: 100 A. THALIANA"
              sublabel="206.4 seeds/dm²"
            />
            <LeaderLabel
              visible={activeIdx === 0 && frame > 36}
              anchor={[185, 52, 18]}
              elbowDx={28}
              elbowDy={12}
              endDx={36}
              label="FOAM RESERVOIR"
              sublabel="van Genuchten θ(ψ)"
            />
          </g>

          {/* ============================================================
              STATION 2: 35 µm NYTEX BARRIER & RNAlater PERFUSION (u=280..420)
              ============================================================ */}
          <g opacity={activeIdx === 1 ? 1 : 0.48}>
            <IsoBox u={285} v={-58} w={0} du={130} dv={136} dw={10} tone="slate" frame={activeIdx === 1 ? frame : 999} pieceIndex={0} />
            {/* Sub-screen RNAlater fluid chamber */}
            <IsoBox u={295} v={-48} w={10} du={110} dv={116} dw={18} tone="dark" frame={activeIdx === 1 ? frame : 999} pieceIndex={1} />
            {/* Animated RNAlater pulse wave */}
            <IsoBox
              u={302 + processPulse * 14}
              v={-36}
              w={14}
              du={22}
              dv={92}
              dw={8}
              tone="slate"
              frame={activeIdx === 1 ? frame : 999}
              pieceIndex={2}
            />
            {/* 35 µm Nytex Woven Screen (Accent #ef8354) */}
            <IsoBox u={293} v={-50} w={28} du={114} dv={120} dw={5} tone="accent" frame={activeIdx === 1 ? frame : 999} pieceIndex={3} />

            {/* Tangential crawling roots ON TOP of Nytex (never penetrating below w=33) */}
            {[0, 1, 2].map((r) => (
              <g key={`root-${r}`}>
                <IsoBox
                  u={312 + r * 28}
                  v={-10 + (r % 2) * 20}
                  w={33}
                  du={6}
                  dv={6}
                  dw={18}
                  tone="paper"
                  frame={activeIdx === 1 ? frame : 999}
                  pieceIndex={4 + r}
                />
                {/* Tangential horizontal root crawl segment */}
                <IsoBox
                  u={312 + r * 28}
                  v={-10 + (r % 2) * 20}
                  w={33}
                  du={18 + processPulse * 6}
                  dv={4}
                  dw={3}
                  tone="silver"
                  frame={activeIdx === 1 ? frame : 999}
                  pieceIndex={7 + r}
                />
              </g>
            ))}

            {/* Lifted upper housing */}
            {activeIdx === 1 && roofLiftW > 4 && (
              <g opacity={0.5} stroke="#4f5d75" strokeWidth={0.9} strokeDasharray="3 3">
                {[
                  [295, -48],
                  [405, -48],
                  [405, 68],
                  [295, 68],
                ].map(([cu, cv], k) => {
                  const [x1, y1] = iso(cu, cv, 52);
                  const [x2, y2] = iso(cu, cv, 52 + roofLiftW);
                  return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} />;
                })}
              </g>
            )}
            <IsoBox
              u={293}
              v={-50}
              w={52}
              du={114}
              dv={120}
              dw={9}
              tone="paper"
              frame={activeIdx === 1 ? frame : 999}
              pieceIndex={10}
              extraW={activeIdx === 1 ? roofLiftW : 0}
            />

            <LeaderLabel
              visible={activeIdx === 1 && frame > 26}
              anchor={[350, -50, 31]}
              elbowDx={-34}
              elbowDy={-38}
              endDx={-44}
              align="left"
              accent
              label="35 µm NYTEX SCREEN"
              sublabel="100% root exclusion"
            />
            <LeaderLabel
              visible={activeIdx === 1 && frame > 30}
              anchor={[368, 22, 36]}
              elbowDx={34}
              elbowDy={-26}
              endDx={40}
              label="TANGENTIAL ROOT CRAWL"
              sublabel="7.76 mm B. rapa · 2.87 mm Ath"
            />
            <LeaderLabel
              visible={activeIdx === 1 && frame > 34}
              anchor={[405, 40, 18]}
              elbowDx={28}
              elbowDy={18}
              endDx={34}
              label="RNAlater PERFUSION"
              sublabel="ΔP = 1.75 kPa (vs 89.3 kPa)"
            />
          </g>

          {/* ============================================================
              STATION 3: CANOPY CROWDING & SHADE AVOIDANCE (u=500..640)
              ============================================================ */}
          <g opacity={activeIdx === 2 ? 1 : 0.48}>
            <IsoBox u={505} v={-58} w={0} du={130} dv={136} dw={10} tone="slate" frame={activeIdx === 2 ? frame : 999} pieceIndex={0} />
            <IsoBox u={515} v={-48} w={10} du={110} dv={116} dw={16} tone="silver" frame={activeIdx === 2 ? frame : 999} pieceIndex={1} />
            <IsoBox u={515} v={-48} w={26} du={110} dv={116} dw={12} tone="paper" frame={activeIdx === 2 ? frame : 999} pieceIndex={2} />

            {/* Dense Ch 2 canopy blocks showing SAS height boost & outward lean */}
            {[0, 1, 2, 3, 4].map((c) => {
              const centerBias = 2 - Math.abs(c - 2);
              const stemH = 16 + centerBias * 5 + processPulse * 3;
              const leanU = (c - 2) * 3.5;
              return (
                <g key={`sas-${c}`}>
                  <IsoBox
                    u={535 + c * 15 + leanU * 0.4}
                    v={-18 + (c % 2) * 28}
                    w={38}
                    du={6}
                    dv={6}
                    dw={stemH}
                    tone="slate"
                    frame={activeIdx === 2 ? frame : 999}
                    pieceIndex={3 + c}
                  />
                  <IsoBox
                    u={531 + c * 15 + leanU}
                    v={-22 + (c % 2) * 28}
                    w={38 + stemH}
                    du={14}
                    dv={14}
                    dw={5}
                    tone={c === 2 ? "accent" : "paper"}
                    frame={activeIdx === 2 ? frame : 999}
                    pieceIndex={8 + c}
                  />
                </g>
              );
            })}

            {/* LED roof lifted to show Beer-Lambert light array */}
            {activeIdx === 2 && roofLiftW > 4 && (
              <g opacity={0.5} stroke="#4f5d75" strokeWidth={0.9} strokeDasharray="3 3">
                {[
                  [515, -48],
                  [625, -48],
                  [625, 68],
                  [515, 68],
                ].map(([cu, cv], k) => {
                  const [x1, y1] = iso(cu, cv, 54);
                  const [x2, y2] = iso(cu, cv, 54 + roofLiftW);
                  return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} />;
                })}
              </g>
            )}
            <IsoBox
              u={513}
              v={-50}
              w={54}
              du={114}
              dv={120}
              dw={9}
              tone="dark"
              frame={activeIdx === 2 ? frame : 999}
              pieceIndex={13}
              extraW={activeIdx === 2 ? roofLiftW : 0}
            />

            <LeaderLabel
              visible={activeIdx === 2 && frame > 26}
              anchor={[570, -50, 58 + roofLiftW]}
              elbowDx={24}
              elbowDy={-24}
              endDx={38}
              label="PAR LED CANOPY (150 µmol)"
              sublabel="f_light = 0.872 at 1.0×"
            />
            <LeaderLabel
              visible={activeIdx === 2 && frame > 30}
              anchor={[568, -4, 62]}
              elbowDx={-34}
              elbowDy={-44}
              endDx={-42}
              align="left"
              accent
              label="SAS HYPOCOTYL BOOST"
              sublabel="2.13 → 2.43 mm (0.5× → 1.5×)"
            />
            <LeaderLabel
              visible={activeIdx === 2 && frame > 34}
              anchor={[608, 12, 54]}
              elbowDx={30}
              elbowDy={10}
              endDx={36}
              label="PHOTOTROPIC LEAN"
              sublabel="0.48° → 1.59° outward"
            />
          </g>

          {/* ============================================================
              STATION 4: PUSH VS. PULL CFD & ETHYLENE SCRUBBING (u=720..860)
              ============================================================ */}
          <g opacity={activeIdx === 3 ? 1 : 0.48}>
            <IsoBox u={725} v={-58} w={0} du={130} dv={136} dw={10} tone="slate" frame={activeIdx === 3 ? frame : 999} pieceIndex={0} />
            <IsoBox u={735} v={-48} w={10} du={110} dv={116} dw={18} tone="paper" frame={activeIdx === 3 ? frame : 999} pieceIndex={1} />
            {/* Inlet & Outlet Manifolds */}
            <IsoBox u={728} v={-12} w={28} du={16} dv={40} dw={26} tone="slate" frame={activeIdx === 3 ? frame : 999} pieceIndex={2} />
            <IsoBox u={836} v={-12} w={28} du={16} dv={40} dw={26} tone="slate" frame={activeIdx === 3 ? frame : 999} pieceIndex={3} />

            {/* Animated Push dip-and-converge air parcels sweeping through Ch 2 */}
            {[0, 1, 2, 3].map((p) => {
              const phase = ((frame * 0.02 + p * 0.25) % 1);
              const parcelU = 746 + phase * 82;
              const dipW = 46 - Math.sin(phase * Math.PI) * 14;
              return (
                <IsoBox
                  key={`jet-${p}`}
                  u={parcelU}
                  v={2}
                  w={dipW}
                  du={10}
                  dv={12}
                  dw={6}
                  tone="accent"
                  frame={activeIdx === 3 ? frame : 999}
                  pieceIndex={4 + p}
                />
              );
            })}

            {/* Lifted roof */}
            {activeIdx === 3 && roofLiftW > 4 && (
              <g opacity={0.5} stroke="#4f5d75" strokeWidth={0.9} strokeDasharray="3 3">
                {[
                  [735, -48],
                  [845, -48],
                  [845, 68],
                  [735, 68],
                ].map(([cu, cv], k) => {
                  const [x1, y1] = iso(cu, cv, 56);
                  const [x2, y2] = iso(cu, cv, 56 + roofLiftW);
                  return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} />;
                })}
              </g>
            )}
            <IsoBox
              u={733}
              v={-50}
              w={56}
              du={114}
              dv={120}
              dw={8}
              tone="silver"
              frame={activeIdx === 3 ? frame : 999}
              pieceIndex={8}
              extraW={activeIdx === 3 ? roofLiftW : 0}
            />

            <LeaderLabel
              visible={activeIdx === 3 && frame > 26}
              anchor={[736, 8, 50]}
              elbowDx={-30}
              elbowDy={-38}
              endDx={-42}
              align="left"
              label="PUSH INLET (25 mL/min)"
              sublabel="g_bl = 13.42 mm/s"
            />
            <LeaderLabel
              visible={activeIdx === 3 && frame > 30}
              anchor={[790, 8, 36]}
              elbowDx={24}
              elbowDy={-48}
              endDx={40}
              accent
              label="DIP-AND-CONVERGE JET"
              sublabel="C₂H₄ = 0.08 ppb (vs 136.5 ppb)"
            />
            <LeaderLabel
              visible={activeIdx === 3 && frame > 34}
              anchor={[844, 18, 56 + roofLiftW]}
              elbowDx={26}
              elbowDy={-18}
              endDx={34}
              label="DEW-POINT MARGIN"
              sublabel="+2.8 °C optical safety"
            />
          </g>

          {/* ============================================================
              STATION 5: GRAVITY SCALING (1.0g vs 0.166g vs 0g) (u=940..1080)
              ============================================================ */}
          <g opacity={activeIdx === 4 ? 1 : 0.48}>
            <IsoBox u={945} v={-58} w={0} du={130} dv={136} dw={10} tone="slate" frame={activeIdx === 4 ? frame : 999} pieceIndex={0} />

            {/* Three gravity comparison bays: 1.0g Earth, 0.166g Lunar, 0.0g ISS */}
            {[
              { label: "1g", u: 952, tone: "paper" as ToneKey, stem: 24, spread: 4 },
              { label: "0.166g", u: 993, tone: "accent" as ToneKey, stem: 22, spread: 10 },
              { label: "0g", u: 1034, tone: "silver" as ToneKey, stem: 18, spread: 16 },
            ].map((bay, bIdx) => (
              <g key={bay.label}>
                <IsoBox
                  u={bay.u}
                  v={-44}
                  w={10}
                  du={34}
                  dv={106}
                  dw={16}
                  tone={bay.tone}
                  frame={activeIdx === 4 ? frame : 999}
                  pieceIndex={1 + bIdx}
                />
                {/* Seedling tower inside each gravity bay */}
                <IsoBox
                  u={bay.u + 13}
                  v={4}
                  w={26}
                  du={7}
                  dv={7}
                  dw={bay.stem + processPulse * 3}
                  tone="slate"
                  frame={activeIdx === 4 ? frame : 999}
                  pieceIndex={4 + bIdx}
                />
                {/* Root dispersion footprint */}
                <IsoBox
                  u={bay.u + 10 - bay.spread * 0.3}
                  v={-2}
                  w={26}
                  du={12 + bay.spread * 0.6}
                  dv={16}
                  dw={3}
                  tone="dark"
                  frame={activeIdx === 4 ? frame : 999}
                  pieceIndex={7 + bIdx}
                />
              </g>
            ))}

            {/* Lifted roof */}
            {activeIdx === 4 && roofLiftW > 4 && (
              <g opacity={0.5} stroke="#4f5d75" strokeWidth={0.9} strokeDasharray="3 3">
                {[
                  [952, -44],
                  [1068, -44],
                  [1068, 62],
                  [952, 62],
                ].map(([cu, cv], k) => {
                  const [x1, y1] = iso(cu, cv, 54);
                  const [x2, y2] = iso(cu, cv, 54 + roofLiftW);
                  return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} />;
                })}
              </g>
            )}
            <IsoBox
              u={950}
              v={-48}
              w={54}
              du={120}
              dv={114}
              dw={8}
              tone="slate"
              frame={activeIdx === 4 ? frame : 999}
              pieceIndex={10}
              extraW={activeIdx === 4 ? roofLiftW : 0}
            />

            <LeaderLabel
              visible={activeIdx === 4 && frame > 26}
              anchor={[969, -44, 28]}
              elbowDx={-32}
              elbowDy={-40}
              endDx={-40}
              align="left"
              label="1.0 g EARTH CONTROL"
              sublabel="Tight gravitropic anchor"
            />
            <LeaderLabel
              visible={activeIdx === 4 && frame > 30}
              anchor={[1010, 6, 48]}
              elbowDx={18}
              elbowDy={-54}
              endDx={38}
              accent
              label="0.166 g LUNAR FLIGHT"
              sublabel="> 95% nominal retention"
            />
            <LeaderLabel
              visible={activeIdx === 4 && frame > 34}
              anchor={[1052, 24, 28]}
              elbowDx={30}
              elbowDy={14}
              endDx={36}
              label="0.0 g MICROGRAVITY"
              sublabel="Wide root-search dispersion"
            />
          </g>
        </svg>
      </section>

      {/* STATION EXPLANATION + METRICS + PAPER FIGURES DEEP DIVE */}
      <section className="iso-deep-dive">
        <div className="iso-narrative-card">
          <div className="iso-narrative-head">
            <div>
              <h3>{station.title}</h3>
              <p className="iso-subtitle">{station.subtitle}</p>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => onNavigate(station.actionView)}
            >
              {station.actionLabel}
            </button>
          </div>
          <p className="iso-summary">{station.summary}</p>
          <div className="iso-kpi-strip">
            {station.metrics.map((m) => (
              <div key={m.label} className={`iso-kpi-box ${m.accent ? "accent" : ""}`}>
                <span>{m.label}</span>
                <strong>{m.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="iso-figures-card">
          <div className="iso-figures-header">
            <div>
              <span className="eyebrow">Manuscript Evidence · Deep Dive</span>
              <h4>
                {currentFigure.label} — {currentFigure.title}
              </h4>
            </div>
            {station.figures.length > 1 && (
              <div className="iso-fig-tabs">
                {station.figures.map((fig, fIdx) => (
                  <button
                    key={fig.id}
                    type="button"
                    className={`nav-pill ${fIdx === activeFigTab ? "active" : ""}`}
                    onClick={() => setActiveFigTab(fIdx)}
                  >
                    {fig.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="iso-figure-grid">
            <div className="iso-figure-img-wrap">
              <img
                src={currentFigure.src}
                alt={`${currentFigure.label}: ${currentFigure.title}`}
                onClick={() => setZoomedFig(currentFigure)}
              />
              <button
                type="button"
                className="btn-secondary iso-zoom-btn"
                onClick={() => setZoomedFig(currentFigure)}
              >
                Zoom High-Res Figure
              </button>
            </div>
            <div className="iso-figure-notes">
              <p>{currentFigure.caption}</p>
              <ul>
                {currentFigure.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
              <div className="iso-cross-links">
                <button type="button" className="btn-secondary" onClick={() => onNavigate("paper")}>
                  Read Full Paper & PDF
                </button>
                <button type="button" className="btn-secondary" onClick={() => onNavigate("overview")}>
                  All 12 Figures Gallery
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {zoomedFig && (
        <div
          className="figure-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setZoomedFig(null)}
        >
          <div className="figure-modal-body" onClick={(e) => e.stopPropagation()}>
            <div className="figure-modal-header">
              <strong>
                {zoomedFig.label} | {zoomedFig.title}
              </strong>
              <button type="button" className="btn-secondary" onClick={() => setZoomedFig(null)}>
                Close
              </button>
            </div>
            <img src={zoomedFig.src} alt={zoomedFig.title} />
            <p className="figure-caption">{zoomedFig.caption}</p>
          </div>
        </div>
      )}
    </div>
  );
}
