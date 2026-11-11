// Build the viewer's per-seed description (layout + colours + seed-coat shell) from a sim.
import type { SeedTwin } from "../model/simulate";
import type { SeedView, ShellState } from "./viewer";

export function shellOf(sim: SeedTwin): ShellState {
  const tr = sim.milestones.testaRupture;
  const lin = Math.cbrt(Math.min(sim.pose.swell, 1.25));
  const [x, y, rot] = sim.layout.shell;
  return {
    a: sim.template.seed.a * lin,
    b: sim.template.seed.b * lin,
    x,
    y,
    rot,
    testaVisible: sim.milestones.cotEmerged === null,
    testaSplit: tr === null ? 0 : Math.min(1, (sim.t - tr) / 4),
    mucilage: sim.template.seed.mucilage * sim.hydration,
  };
}

export function seedViewOf(sim: SeedTwin, colors: Float32Array, offsetX = 0): SeedView {
  return { layout: sim.layout, colors, shell: shellOf(sim), offsetX };
}

export function shellExtents(s: ShellState): [number, number, number, number] {
  const c = Math.abs(Math.cos(s.rot));
  const n = Math.abs(Math.sin(s.rot));
  const ex = s.a * c + s.b * n;
  const ey = s.a * n + s.b * c;
  return [s.x - ex, s.y - ey, s.x + ex, s.y + ey];
}
