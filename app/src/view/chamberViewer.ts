// Three.js 3D WebGL Digital Twin of the LEAF GBC1 chamber with 164 cellular SeedTwin instances.
//
// Renders in real 3D chamber coordinates (1 world unit = 1 mm):
//   • Outer GBC1 polycarbonate housing (48 × 33.67 × 68 mm), base plate, and Z = ±8.5 mm baffles
//   • Ports 1, 2, 3 and manifold tubes at X = -15.49 mm, Z = -21.59, 0.0, +21.59 mm
//   • 4D porous phenolic foam moisture voxels (Y = 7.62..14.62 mm)
//   • 35 µm Nytex root-barrier woven screen at Y = 14.77 mm across Chambers 1, 2, and 3
//   • All 164 (up to 260 at 1.5x density) cellular SeedTwin embryos/seedlings via InstancedMesh
//     plus their individual testa seed coats and mucilage halos
//   • 3D Push/Pull CFD airflow streamlines + animated flow tracer particles
//   • Click-to-probe raycasting that resolves the exact (seedIndex, cellIndex) clicked
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { GBC1CommunityTwin } from "../model/community";
import { buildFoamVoxels, computeStreamlines3D } from "../model/gbc1Field";
import { COMPARTMENTS } from "../model/sowing";
import { paint, type ColorMode } from "./paint";
import { shellOf } from "./seedView";

export interface ChamberLayerVisibility {
  housing: boolean;
  foam: boolean;
  nytex: boolean;
  streamlines: boolean;
  testa: boolean;
  crownHalos: boolean;
}

export type CameraPreset = "iso" | "top" | "side" | "ch2" | "nytex";

export interface ChamberViewer {
  update(
    community: GBC1CommunityTwin,
    colorMode: ColorMode,
    decoderClass: string,
    selectedSeedId: number,
  ): { min: number; max: number };
  setLayers(layers: Partial<ChamberLayerVisibility>): void;
  setCameraPreset(preset: CameraPreset): void;
  focusSeed(community: GBC1CommunityTwin, seedId: number): void;
  snapshot(): string;
  dispose(): void;
}

const MAX_TOTAL_CELLS = 420000;
const MAX_SEEDS = 280;
const CELL_GAP = 0.9;

function waterColor(sat: number): THREE.Color {
  // Dry amber-brown → moist teal → saturated deep cyan-blue
  const s = Math.max(0, Math.min(1, sat));
  const c = new THREE.Color();
  if (s < 0.5) {
    c.setRGB(0.55 - 0.35 * (s * 2), 0.38 + 0.25 * (s * 2), 0.24 + 0.5 * (s * 2));
  } else {
    const f = (s - 0.5) * 2;
    c.setRGB(0.2 - 0.12 * f, 0.63 + 0.12 * f, 0.74 + 0.22 * f);
  }
  return c;
}

function speedColor(uMps: number): THREE.Color {
  const t = Math.max(0, Math.min(1, uMps / 0.045));
  const c = new THREE.Color();
  c.setHSL(0.56 - 0.48 * t, 0.9, 0.52);
  return c;
}

export function createChamberViewer(
  container: HTMLElement,
  onPickSeed: (seedId: number, cellId: number | null) => void,
): ChamberViewer {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1014);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.2, 600);
  camera.position.set(58, 46, 54);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(3, 18.5, 0);

  // Lighting
  scene.add(new THREE.HemisphereLight(0xeef6ff, 0x1c252c, 1.1));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.35);
  dirLight.position.set(45, 85, 40);
  scene.add(dirLight);
  const backLight = new THREE.DirectionalLight(0x88bbff, 0.55);
  backLight.position.set(-55, 30, -45);
  scene.add(backLight);
  const growLedLight = new THREE.PointLight(0xff77cc, 0.45, 90);
  growLedLight.position.set(5, 31, 0);
  scene.add(growLedLight);

  const layers: ChamberLayerVisibility = {
    housing: true,
    foam: true,
    nytex: true,
    streamlines: true,
    testa: true,
    crownHalos: true,
  };

  // ==================== 1. GBC1 HARDWARE GROUP ====================
  const hardwareGroup = new THREE.Group();
  scene.add(hardwareGroup);

  // Outer transparent polycarbonate housing: 48 × 33.67 × 68 mm centered at [0, 16.835, 0]
  const outerGeo = new THREE.BoxGeometry(48, 33.67, 68);
  const outerMat = new THREE.MeshPhysicalMaterial({
    color: 0xaad4ff,
    transparent: true,
    opacity: 0.08,
    roughness: 0.15,
    metalness: 0.05,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const outerMesh = new THREE.Mesh(outerGeo, outerMat);
  outerMesh.position.set(0, 16.835, 0);
  hardwareGroup.add(outerMesh);

  const outerEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(outerGeo),
    new THREE.LineBasicMaterial({ color: 0x4b6b88, transparent: true, opacity: 0.55 }),
  );
  outerEdges.position.copy(outerMesh.position);
  hardwareGroup.add(outerEdges);

  // Base structure (Y ∈ [0, 7.62] mm)
  const baseGeo = new THREE.BoxGeometry(48, 7.62, 68);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x1a222b,
    roughness: 0.7,
    metalness: 0.2,
    transparent: true,
    opacity: 0.75,
  });
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.position.set(0, 3.81, 0);
  hardwareGroup.add(baseMesh);

  // Internal Compartment Baffles at Z = -8.5 mm and Z = +8.5 mm
  // Lower solid divider (Y ∈ [7.62, 18.5] mm) + side pillars leaving an upper headspace window
  const bafMat = new THREE.MeshStandardMaterial({
    color: 0x5c768d,
    roughness: 0.4,
    metalness: 0.15,
    transparent: true,
    opacity: 0.42,
  });
  for (const zBaf of [-8.5, 8.5]) {
    const lowBaf = new THREE.Mesh(new THREE.BoxGeometry(34.3, 10.5, 1.5), bafMat);
    lowBaf.position.set(5.15, 7.62 + 5.25, zBaf);
    hardwareGroup.add(lowBaf);

    const bafWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(34.3, 24.05, 1.5)),
      new THREE.LineBasicMaterial({ color: 0x6c92b4, transparent: true, opacity: 0.45 }),
    );
    bafWire.position.set(5.15, 7.62 + 12.025, zBaf);
    hardwareGroup.add(bafWire);
  }

  // Manifold block on -X side (X ∈ [-19.5, -11.0] mm) and Ports 1, 2, 3
  const manifoldGeo = new THREE.BoxGeometry(8.0, 22.0, 62.0);
  const manifoldMat = new THREE.MeshStandardMaterial({
    color: 0x22303c,
    roughness: 0.5,
    metalness: 0.3,
    transparent: true,
    opacity: 0.45,
  });
  const manifoldMesh = new THREE.Mesh(manifoldGeo, manifoldMat);
  manifoldMesh.position.set(-15.2, 18.6, 0);
  hardwareGroup.add(manifoldMesh);

  const portMeshes: THREE.Mesh[] = [];
  const portSpecs = [
    { z: -21.59, r: 0.875, label: "Port 1" },
    { z: 0.0, r: 1.25, label: "Port 2 (Central)" },
    { z: 21.59, r: 0.875, label: "Port 3" },
  ];
  for (const ps of portSpecs) {
    const pGeo = new THREE.CylinderGeometry(ps.r * 1.35, ps.r * 1.35, 9.5, 20);
    const pMat = new THREE.MeshStandardMaterial({
      color: 0x00d4ff,
      emissive: 0x004466,
      roughness: 0.25,
      metalness: 0.5,
    });
    const pm = new THREE.Mesh(pGeo, pMat);
    pm.rotation.z = Math.PI / 2;
    pm.position.set(-15.49, 22.8, ps.z);
    hardwareGroup.add(pm);
    portMeshes.push(pm);
  }

  // ==================== 2. 35 µm NYTEX ROOT BARRIER ====================
  const nytexGroup = new THREE.Group();
  scene.add(nytexGroup);

  const nytexMat = new THREE.MeshStandardMaterial({
    color: 0xd9e6f2,
    roughness: 0.65,
    metalness: 0.1,
    transparent: true,
    opacity: 0.52,
    side: THREE.DoubleSide,
  });

  for (const comp of COMPARTMENTS) {
    const wX = comp.foamXMaxMm - comp.foamXMinMm;
    const wZ = comp.foamZMaxMm - comp.foamZMinMm;
    const cx = 0.5 * (comp.foamXMinMm + comp.foamXMaxMm);
    const cz = 0.5 * (comp.foamZMinMm + comp.foamZMaxMm);

    const nPlane = new THREE.Mesh(new THREE.BoxGeometry(wX, 0.15, wZ), nytexMat);
    nPlane.position.set(cx, 14.695, cz);
    nytexGroup.add(nPlane);

    // Fine grid lines representing the 35 µm Nytex weave on top of each compartment
    const gridPts: THREE.Vector3[] = [];
    const stepX = 1.6;
    const stepZ = 1.5;
    for (let x = comp.foamXMinMm; x <= comp.foamXMaxMm + 1e-4; x += stepX) {
      gridPts.push(new THREE.Vector3(x, 14.775, comp.foamZMinMm));
      gridPts.push(new THREE.Vector3(x, 14.775, comp.foamZMaxMm));
    }
    for (let z = comp.foamZMinMm; z <= comp.foamZMaxMm + 1e-4; z += stepZ) {
      gridPts.push(new THREE.Vector3(comp.foamXMinMm, 14.775, z));
      gridPts.push(new THREE.Vector3(comp.foamXMaxMm, 14.775, z));
    }
    const gridGeo = new THREE.BufferGeometry().setFromPoints(gridPts);
    const gridLines = new THREE.LineSegments(
      gridGeo,
      new THREE.LineBasicMaterial({ color: 0x7fa6c9, transparent: true, opacity: 0.36 }),
    );
    nytexGroup.add(gridLines);
  }

  // ==================== 3. 4D FOAM HYDRATION VOXELS ====================
  const foamGroup = new THREE.Group();
  scene.add(foamGroup);
  const maxFoamVoxels = 512;
  const foamBoxGeo = new THREE.BoxGeometry(1, 1, 1);
  const foamMat = new THREE.MeshStandardMaterial({
    roughness: 0.65,
    metalness: 0.05,
    transparent: true,
    opacity: 0.58,
  });
  const foamInst = new THREE.InstancedMesh(foamBoxGeo, foamMat, maxFoamVoxels);
  foamInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  foamInst.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxFoamVoxels * 3), 3);
  foamInst.instanceColor.setUsage(THREE.DynamicDrawUsage);
  foamGroup.add(foamInst);

  // ==================== 4. 3D STREAMLINES & FLOW PARTICLES ====================
  const streamGroup = new THREE.Group();
  scene.add(streamGroup);

  interface ParticleTrack {
    pts: [number, number, number][];
    progress: number;
    speed: number;
  }
  let particleTracks: ParticleTrack[] = [];
  const particleGeo = new THREE.SphereGeometry(0.32, 8, 8);
  const particleMat = new THREE.MeshBasicMaterial({ color: 0x55eeff });
  const maxParticles = 48;
  const particleInst = new THREE.InstancedMesh(particleGeo, particleMat, maxParticles);
  particleInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  streamGroup.add(particleInst);

  // ==================== 5. 164 CELLULAR SEEDTWINS & TESTA SHELLS ====================
  // Use a clean 8-vertex box for chamber-scale cells so 250,000+ cells render at 60 FPS
  const cellGeo = new THREE.BoxGeometry(1, 1, 1);
  const cellMat = new THREE.MeshStandardMaterial({
    roughness: 0.5,
    metalness: 0.02,
  });
  const cellMesh = new THREE.InstancedMesh(cellGeo, cellMat, MAX_TOTAL_CELLS);
  cellMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cellMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_TOTAL_CELLS * 3), 3);
  cellMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  cellMesh.count = 0;
  cellMesh.frustumCulled = false;
  scene.add(cellMesh);

  // Lookup table from global cell instanceId -> (seedId, localCellId) for raycast picking
  const instanceToSeed = new Int16Array(MAX_TOTAL_CELLS);
  const instanceToCell = new Int32Array(MAX_TOTAL_CELLS);

  // Testa seed coats (InstancedMesh of ellipsoids)
  const testaGeo = new THREE.SphereGeometry(1, 16, 12);
  const testaMat = new THREE.MeshStandardMaterial({
    color: 0x8b5428,
    roughness: 0.78,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const testaInst = new THREE.InstancedMesh(testaGeo, testaMat, MAX_SEEDS);
  testaInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  testaInst.frustumCulled = false;
  scene.add(testaInst);

  // Crown shading / competition disks at each seedling's crown height
  const crownGeo = new THREE.RingGeometry(0.65, 1.0, 24);
  crownGeo.rotateX(-Math.PI / 2);
  const crownMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const crownInst = new THREE.InstancedMesh(crownGeo, crownMat, MAX_SEEDS);
  crownInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  crownInst.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SEEDS * 3), 3);
  crownInst.instanceColor.setUsage(THREE.DynamicDrawUsage);
  crownInst.frustumCulled = false;
  scene.add(crownInst);

  // Selected seed beacon ring on the Nytex surface
  const selRingGeo = new THREE.RingGeometry(0.9, 1.35, 32);
  selRingGeo.rotateX(-Math.PI / 2);
  const selRingMat = new THREE.MeshBasicMaterial({
    color: 0x00ffcc,
    side: THREE.DoubleSide,
  });
  const selRingMesh = new THREE.Mesh(selRingGeo, selRingMat);
  selRingMesh.position.set(0, 14.8, 0);
  scene.add(selRingMesh);

  // Reusable transform temporaries
  const m4 = new THREE.Matrix4();
  const vPos = new THREE.Vector3();
  const vScale = new THREE.Vector3();
  const qLocal = new THREE.Quaternion();
  const qAzimuth = new THREE.Quaternion();
  const qWorld = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const zAxis = new THREE.Vector3(0, 0, 1);
  const cTmp = new THREE.Color();
  const cellColorScratch = new Float32Array(24000 * 3);

  let lastStreamSignature = "";

  function rebuildStreamlines(community: GBC1CommunityTwin) {
    const sig = `${community.opts.flowMode}:${community.opts.flowMlMin.toFixed(1)}:${community.env.gravity_g.toFixed(2)}:${community.crowding.laiByCompartment[1].toFixed(1)}`;
    if (sig === lastStreamSignature) return;
    lastStreamSignature = sig;

    // Remove previous line children (keep particleInst at index 0)
    for (let i = streamGroup.children.length - 1; i >= 0; i--) {
      const ch = streamGroup.children[i];
      if (ch !== particleInst) {
        streamGroup.remove(ch);
      }
    }

    // Update port colors based on Push vs Pull mode
    const isPush = community.opts.flowMode === "push";
    portMeshes.forEach((pm, idx) => {
      const mat = pm.material as THREE.MeshStandardMaterial;
      const isInlet = isPush ? idx === 0 || idx === 2 : idx === 1;
      mat.color.setHex(isInlet ? 0x00e5ff : 0xff9933);
      mat.emissive.setHex(isInlet ? 0x004466 : 0x552200);
    });

    const brapaBlock = Math.min(1, 0.5 * (community.crowding.laiByCompartment[1] + community.crowding.laiByCompartment[3]) / 2.2);
    const lines = computeStreamlines3D(
      community.params,
      community.opts.flowMlMin,
      community.opts.flowMode,
      community.env.gravity_g,
      brapaBlock,
    );

    particleTracks = [];
    for (const ln of lines) {
      const positions = new Float32Array(ln.pointsMm.length * 3);
      const colors = new Float32Array(ln.pointsMm.length * 3);
      for (let k = 0; k < ln.pointsMm.length; k++) {
        positions[3 * k] = ln.pointsMm[k][0];
        positions[3 * k + 1] = ln.pointsMm[k][1];
        positions[3 * k + 2] = ln.pointsMm[k][2];
        const col = speedColor(ln.speedsMps[k]);
        colors[3 * k] = col.r;
        colors[3 * k + 1] = col.g;
        colors[3 * k + 2] = col.b;
      }
      const lGeo = new THREE.BufferGeometry();
      lGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      lGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const lMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.65,
      });
      streamGroup.add(new THREE.Line(lGeo, lMat));

      // Add 3 animated tracer particles per streamline
      const meanU = ln.speedsMps.reduce((a, b) => a + b, 0) / Math.max(1, ln.speedsMps.length);
      for (let pIdx = 0; pIdx < 3 && particleTracks.length < maxParticles; pIdx++) {
        particleTracks.push({
          pts: ln.pointsMm,
          progress: pIdx / 3,
          speed: 0.25 + meanU * 12.0,
        });
      }
    }
  }

  let lastFoamSignature = "";
  function rebuildFoam(community: GBC1CommunityTwin) {
    const sig = `${community.env.gravity_g.toFixed(2)}:${community.opts.waterFillPct.toFixed(0)}`;
    if (sig === lastFoamSignature) return;
    lastFoamSignature = sig;

    const voxels = buildFoamVoxels(community.params, community.env.gravity_g, community.opts.waterFillPct);
    const colArr = foamInst.instanceColor!.array as Float32Array;
    const ny = 3;
    const dy = (14.62 - 7.62) / ny;

    voxels.forEach((vx, idx) => {
      const comp = COMPARTMENTS[vx.compartment - 1];
      const nx = 8;
      const nz = vx.compartment === 2 ? 4 : 5;
      const dx = (comp.foamXMaxMm - comp.foamXMinMm) / nx;
      const dz = (comp.foamZMaxMm - comp.foamZMinMm) / nz;
      vPos.set(vx.xMm, vx.yMm, vx.zMm);
      qWorld.identity();
      vScale.set(dx * 0.92, dy * 0.9, dz * 0.92);
      m4.compose(vPos, qWorld, vScale);
      foamInst.setMatrixAt(idx, m4);

      const wc = waterColor(vx.saturationRatio);
      colArr[3 * idx] = wc.r;
      colArr[3 * idx + 1] = wc.g;
      colArr[3 * idx + 2] = wc.b;
    });
    foamInst.count = voxels.length;
    foamInst.instanceMatrix.needsUpdate = true;
    foamInst.instanceColor!.needsUpdate = true;
  }

  // Raycast picking on pointer click
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downPos: [number, number] | null = null;
  const onPointerDown = (e: PointerEvent) => {
    downPos = [e.clientX, e.clientY];
  };
  const onPointerUp = (e: PointerEvent) => {
    if (!downPos || Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObject(cellMesh, false);
    if (hits.length > 0 && hits[0].instanceId !== undefined) {
      const instId = hits[0].instanceId;
      if (instId < cellMesh.count) {
        onPickSeed(instanceToSeed[instId], instanceToCell[instId]);
        return;
      }
    }
    const shellHits = raycaster.intersectObject(testaInst, false);
    if (shellHits.length > 0 && shellHits[0].instanceId !== undefined) {
      onPickSeed(shellHits[0].instanceId, null);
    }
  };
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointerup", onPointerUp);

  // Animation loop
  let raf = 0;
  let lastFrameMs = performance.now();
  const animate = () => {
    raf = requestAnimationFrame(animate);
    const now = performance.now();
    const dtSec = Math.min(0.05, (now - lastFrameMs) / 1000);
    lastFrameMs = now;

    if (layers.streamlines && particleTracks.length > 0) {
      for (let i = 0; i < particleTracks.length; i++) {
        const tr = particleTracks[i];
        tr.progress = (tr.progress + dtSec * tr.speed) % 1;
        const fIdx = tr.progress * (tr.pts.length - 1);
        const i0 = Math.floor(fIdx);
        const i1 = Math.min(tr.pts.length - 1, i0 + 1);
        const f = fIdx - i0;
        const p0 = tr.pts[i0];
        const p1 = tr.pts[i1];
        vPos.set(
          p0[0] + (p1[0] - p0[0]) * f,
          p0[1] + (p1[1] - p0[1]) * f,
          p0[2] + (p1[2] - p0[2]) * f,
        );
        qWorld.identity();
        vScale.set(1, 1, 1);
        m4.compose(vPos, qWorld, vScale);
        particleInst.setMatrixAt(i, m4);
      }
      particleInst.count = particleTracks.length;
      particleInst.instanceMatrix.needsUpdate = true;
    } else {
      particleInst.count = 0;
    }

    controls.update();
    renderer.render(scene, camera);
  };
  animate();

  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  return {
    update(community, colorMode, decoderClass, selectedSeedId) {
      rebuildFoam(community);
      rebuildStreamlines(community);

      const cellColorArr = cellMesh.instanceColor!.array as Float32Array;
      const crownColorArr = crownInst.instanceColor!.array as Float32Array;
      let cursor = 0;
      let rangeMin = Infinity;
      let rangeMax = -Infinity;

      const specs = community.specs;
      const twins = community.twins;
      const crowns = community.crowding.crowns;

      for (let sIdx = 0; sIdx < twins.length; sIdx++) {
        const sp = specs[sIdx];
        const sim = twins[sIdx];
        sim.updateLayout();
        const L = sim.layout;

        const pr = paint(sim, colorMode, decoderClass, cellColorScratch);
        if (pr.min < rangeMin) rangeMin = pr.min;
        if (pr.max > rangeMax) rangeMax = pr.max;

        const scaleMmPerUm = sp.seedScale * 1e-3;
        const ca = Math.cos(sp.azimuthRad);
        const sa = Math.sin(sp.azimuthRad);
        qAzimuth.setFromAxisAngle(yAxis, -sp.azimuthRad);

        const isSelected = sp.id === selectedSeedId;
        const nCells = L.n;

        for (let i = 0; i < nCells && cursor < MAX_TOTAL_CELLS; i++) {
          if (!L.visible[i]) continue;

          const xUm = L.pos[3 * i];
          const yUm = L.pos[3 * i + 1];
          const zUm = L.pos[3 * i + 2];

          const dxMm = xUm * scaleMmPerUm;
          const dyMm = yUm * scaleMmPerUm;
          const dzMm = zUm * scaleMmPerUm;

          const worldX = sp.xMm + ca * dxMm - sa * dzMm;
          const worldY = Math.max(sp.yMm + 0.02, sp.yMm + sp.seedRadiusMm + dyMm);
          const worldZ = sp.zMm + sa * dxMm + ca * dzMm;

          vPos.set(worldX, worldY, worldZ);
          qLocal.set(L.quat[4 * i], L.quat[4 * i + 1], L.quat[4 * i + 2], L.quat[4 * i + 3]);
          qWorld.multiplyQuaternions(qAzimuth, qLocal);

          vScale.set(
            L.scale[3 * i] * scaleMmPerUm * CELL_GAP,
            L.scale[3 * i + 1] * scaleMmPerUm * CELL_GAP,
            L.scale[3 * i + 2] * scaleMmPerUm * CELL_GAP,
          );
          m4.compose(vPos, qWorld, vScale);
          cellMesh.setMatrixAt(cursor, m4);

          let r = cellColorScratch[3 * i];
          let g = cellColorScratch[3 * i + 1];
          let b = cellColorScratch[3 * i + 2];
          if (isSelected) {
            r = Math.min(1, r * 1.18 + 0.08);
            g = Math.min(1, g * 1.18 + 0.08);
            b = Math.min(1, b * 1.18 + 0.08);
          }
          cellColorArr[3 * cursor] = r;
          cellColorArr[3 * cursor + 1] = g;
          cellColorArr[3 * cursor + 2] = b;

          instanceToSeed[cursor] = sp.id;
          instanceToCell[cursor] = i;
          cursor++;
        }

        // Update seed testa shell instance
        const sh = shellOf(sim);
        if (sh.testaVisible && layers.testa) {
          const sxMm = sh.x * scaleMmPerUm;
          const syMm = sh.y * scaleMmPerUm;
          vPos.set(
            sp.xMm + ca * sxMm,
            Math.max(sp.yMm + sp.seedRadiusMm * 0.6, sp.yMm + sp.seedRadiusMm + syMm),
            sp.zMm + sa * sxMm,
          );
          qLocal.setFromAxisAngle(zAxis, sh.rot);
          qWorld.multiplyQuaternions(qAzimuth, qLocal);
          vScale.set(
            sh.a * scaleMmPerUm * (1 - 0.12 * sh.testaSplit),
            sh.b * scaleMmPerUm,
            sh.b * scaleMmPerUm,
          );
          m4.compose(vPos, qWorld, vScale);
        } else {
          m4.makeScale(0, 0, 0);
        }
        testaInst.setMatrixAt(sIdx, m4);

        // Update crown light-competition halo ring
        const cr = crowns[sIdx];
        if (cr && layers.crownHalos && sim.pose.cotOut > 0.15) {
          vPos.set(cr.crownXMm, cr.crownYMm + 0.1, cr.crownZMm);
          qWorld.identity();
          const rad = Math.max(0.45, cr.crownRadiusMm);
          vScale.set(rad, 1, rad);
          m4.compose(vPos, qWorld, vScale);
          // Color from golden-green (unshaded, f_light = 1) to deep magenta-purple (heavily shaded)
          cTmp.setHSL(0.32 * cr.lightFactor + 0.78 * (1 - cr.lightFactor), 0.85, 0.52);
          crownColorArr[3 * sIdx] = cTmp.r;
          crownColorArr[3 * sIdx + 1] = cTmp.g;
          crownColorArr[3 * sIdx + 2] = cTmp.b;
        } else {
          m4.makeScale(0, 0, 0);
        }
        crownInst.setMatrixAt(sIdx, m4);

        if (isSelected) {
          selRingMesh.position.set(sp.xMm, sp.yMm + 0.08, sp.zMm);
          const ringScale = sp.species === "brassica_rapa" ? 1.75 : 1.0;
          selRingMesh.scale.set(ringScale, 1, ringScale);
        }
      }

      cellMesh.count = cursor;
      cellMesh.instanceMatrix.needsUpdate = true;
      cellMesh.instanceColor!.needsUpdate = true;
      cellMesh.computeBoundingSphere();

      testaInst.count = twins.length;
      testaInst.instanceMatrix.needsUpdate = true;

      crownInst.count = twins.length;
      crownInst.instanceMatrix.needsUpdate = true;
      crownInst.instanceColor!.needsUpdate = true;

      return {
        min: Number.isFinite(rangeMin) ? rangeMin : 0,
        max: Number.isFinite(rangeMax) ? rangeMax : 1,
      };
    },

    setLayers(next) {
      Object.assign(layers, next);
      hardwareGroup.visible = layers.housing;
      foamGroup.visible = layers.foam;
      nytexGroup.visible = layers.nytex;
      streamGroup.visible = layers.streamlines;
      testaInst.visible = layers.testa;
      crownInst.visible = layers.crownHalos;
    },

    setCameraPreset(preset) {
      switch (preset) {
        case "iso":
          controls.target.set(3, 18, 0);
          camera.position.set(58, 46, 54);
          break;
        case "top":
          controls.target.set(4, 15, 0);
          camera.position.set(4, 88, 0.01);
          break;
        case "side":
          controls.target.set(4, 18.5, 0);
          camera.position.set(78, 20.5, 0);
          break;
        case "ch2":
          controls.target.set(4, 17.5, 0);
          camera.position.set(28, 29, 18);
          break;
        case "nytex":
          controls.target.set(4, 15.2, 0);
          camera.position.set(36, 16.2, 26);
          break;
      }
      camera.lookAt(controls.target);
      controls.update();
    },

    focusSeed(community, seedId) {
      const sp = community.specs[seedId];
      if (!sp) return;
      controls.target.set(sp.xMm, sp.yMm + 2.2, sp.zMm);
      camera.position.set(sp.xMm + 14, sp.yMm + 9.5, sp.zMm + 12);
      camera.lookAt(controls.target);
      controls.update();
    },

    snapshot() {
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL("image/png");
    },

    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      cellGeo.dispose();
      cellMat.dispose();
      testaGeo.dispose();
      testaMat.dispose();
      crownGeo.dispose();
      crownMat.dispose();
      foamBoxGeo.dispose();
      foamMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      controls.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
