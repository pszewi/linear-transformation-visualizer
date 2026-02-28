import GUI from 'lil-gui';
import {
  det2, det3, rank2, rank3,
  eigenvalues2, eigenvalues3,
  fmtNum, fmtEigen,
} from './math.js';
import { Visualizer2D } from './visualizer2d.js';
import { Visualizer3D } from './visualizer3d.js';

// ─── DOM refs ────────────────────────────────────────────────────────────────
const viewport = document.getElementById('viewport')!;
const guiContainer = document.getElementById('gui-container')!;
const elDet  = document.getElementById('d-det')!;
const elRank = document.getElementById('d-rank')!;
const elInv  = document.getElementById('d-inv')!;
const elEig  = document.getElementById('d-eig')!;

// ─── State ───────────────────────────────────────────────────────────────────
type Mode = '2D' | '3D';

let mode: Mode = '2D';

// 2D matrix (row-major: m[row][col])
const mat2: number[][] = [[1, 0], [0, 1]];
// 3D matrix
const mat3: number[][] = [[1,0,0],[0,1,0],[0,0,1]];

// lil-gui model objects
const gui2dModel = {
  a: 1, b: 0,
  c: 0, d: 1,
  vx: 0, vy: 0,
};
const gui3dModel = {
  a: 1, b: 0, c: 0,
  d: 0, e: 1, f: 0,
  g: 0, h: 0, i: 1,
  vx: 0, vy: 0, vz: 0,
};

// ─── Visualizer instances ────────────────────────────────────────────────────
let viz2d: Visualizer2D | null = null;
let viz3d: Visualizer3D | null = null;

// ─── Derived quantities panel ─────────────────────────────────────────────────
function updateDerived() {
  if (mode === '2D') {
    const m = mat2;
    const det = det2(m);
    const rank = rank2(m);
    const evs  = eigenvalues2(m);
    elDet.textContent  = fmtNum(det, 4);
    elRank.textContent = String(rank);
    elInv.textContent  = Math.abs(det) > 1e-10 ? 'Yes' : 'No';
    elInv.className    = 'derived-value ' + (Math.abs(det) > 1e-10 ? 'invertible' : 'singular');
    elEig.textContent  = fmtEigen(evs);
  } else {
    const m = mat3;
    const det = det3(m);
    const rank = rank3(m);
    const evs  = eigenvalues3(m);
    elDet.textContent  = fmtNum(det, 4);
    elRank.textContent = String(rank);
    elInv.textContent  = Math.abs(det) > 1e-10 ? 'Yes' : 'No';
    elInv.className    = 'derived-value ' + (Math.abs(det) > 1e-10 ? 'invertible' : 'singular');
    elEig.textContent  = fmtEigen(evs);
  }
}

// ─── GUI management ──────────────────────────────────────────────────────────
let gui: GUI | null = null;

function buildSlider(
  folder: GUI,
  obj: Record<string, number>,
  key: string,
  label: string,
  onLive: () => void,
  onFinish: () => void
) {
  const ctrl = folder.add(obj, key, -5, 5, 0.01).name(label);
  ctrl.onChange(onLive);
  ctrl.onFinishChange(onFinish);
}

function build2dGui() {
  if (gui) { gui.destroy(); }
  gui = new GUI({ container: guiContainer, title: 'Matrix (2×2)' });

  const read = (animate: boolean) => {
    mat2[0][0] = gui2dModel.a; mat2[0][1] = gui2dModel.b;
    mat2[1][0] = gui2dModel.c; mat2[1][1] = gui2dModel.d;
    viz2d?.update(mat2, animate);
    updateDerived();
  };

  const live   = () => read(false);
  const finish = () => read(true);

  const row0 = gui.addFolder('Row 1');
  buildSlider(row0, gui2dModel, 'a', 'a (col 1)', live, finish);
  buildSlider(row0, gui2dModel, 'b', 'b (col 2)', live, finish);
  row0.open();

  const row1 = gui.addFolder('Row 2');
  buildSlider(row1, gui2dModel, 'c', 'c (col 1)', live, finish);
  buildSlider(row1, gui2dModel, 'd', 'd (col 2)', live, finish);
  row1.open();

  const presets = gui.addFolder('Presets');
  const applyPreset = (m: number[][]) => {
    gui2dModel.a = m[0][0]; gui2dModel.b = m[0][1];
    gui2dModel.c = m[1][0]; gui2dModel.d = m[1][1];
    gui!.controllersRecursive().forEach(c => c.updateDisplay());
    finish();
  };
  const presetObj = {
    Identity:  () => applyPreset([[1,0],[0,1]]),
    Scale2x:   () => applyPreset([[2,0],[0,2]]),
    'Rotate 90°': () => applyPreset([[0,-1],[1,0]]),
    ShearX:    () => applyPreset([[1,1],[0,1]]),
    Reflect:   () => applyPreset([[1,0],[0,-1]]),
    Singular:  () => applyPreset([[1,2],[2,4]]),
  };
  presets.add(presetObj, 'Identity');
  presets.add(presetObj, 'Scale2x');
  presets.add(presetObj, 'Rotate 90°');
  presets.add(presetObj, 'ShearX');
  presets.add(presetObj, 'Reflect');
  presets.add(presetObj, 'Singular');
  presets.open();

  const vecFolder = gui.addFolder('User Vector (optional)');
  const readVec = () => {
    const vx = gui2dModel.vx, vy = gui2dModel.vy;
    const hasVec = Math.abs(vx) > 1e-12 || Math.abs(vy) > 1e-12;
    viz2d?.setUserVector(hasVec ? [vx, vy] : null);
  };
  vecFolder.add(gui2dModel, 'vx', -5, 5, 0.01).name('vx').onChange(readVec);
  vecFolder.add(gui2dModel, 'vy', -5, 5, 0.01).name('vy').onChange(readVec);
  vecFolder.open();
}

function build3dGui() {
  if (gui) { gui.destroy(); }
  gui = new GUI({ container: guiContainer, title: 'Matrix (3×3)' });

  const read = (animate: boolean) => {
    mat3[0] = [gui3dModel.a, gui3dModel.b, gui3dModel.c];
    mat3[1] = [gui3dModel.d, gui3dModel.e, gui3dModel.f];
    mat3[2] = [gui3dModel.g, gui3dModel.h, gui3dModel.i];
    viz3d?.update(mat3, animate);
    updateDerived();
  };

  const live   = () => read(false);
  const finish = () => read(true);

  const row0 = gui.addFolder('Row 1');
  buildSlider(row0, gui3dModel, 'a', 'a', live, finish);
  buildSlider(row0, gui3dModel, 'b', 'b', live, finish);
  buildSlider(row0, gui3dModel, 'c', 'c', live, finish);
  row0.open();

  const row1 = gui.addFolder('Row 2');
  buildSlider(row1, gui3dModel, 'd', 'd', live, finish);
  buildSlider(row1, gui3dModel, 'e', 'e', live, finish);
  buildSlider(row1, gui3dModel, 'f', 'f', live, finish);
  row1.open();

  const row2 = gui.addFolder('Row 3');
  buildSlider(row2, gui3dModel, 'g', 'g', live, finish);
  buildSlider(row2, gui3dModel, 'h', 'h', live, finish);
  buildSlider(row2, gui3dModel, 'i', 'i', live, finish);
  row2.open();

  const presets = gui.addFolder('Presets');
  const applyPreset = (m: number[][]) => {
    [gui3dModel.a, gui3dModel.b, gui3dModel.c] = m[0];
    [gui3dModel.d, gui3dModel.e, gui3dModel.f] = m[1];
    [gui3dModel.g, gui3dModel.h, gui3dModel.i] = m[2];
    gui!.controllersRecursive().forEach(c => c.updateDisplay());
    finish();
  };
  const I3 = [[1,0,0],[0,1,0],[0,0,1]];
  const presetObj = {
    Identity: () => applyPreset(I3),
    Scale2x:  () => applyPreset([[2,0,0],[0,2,0],[0,0,2]]),
    ShearXY:  () => applyPreset([[1,1,0],[0,1,0],[0,0,1]]),
    'Rotate Z 90°': () => applyPreset([[0,-1,0],[1,0,0],[0,0,1]]),
    Singular: () => applyPreset([[1,2,3],[4,5,6],[7,8,9]]),
    Squish:   () => applyPreset([[1,0,0],[0,1,0],[0,0,0]]),
  };
  presets.add(presetObj, 'Identity');
  presets.add(presetObj, 'Scale2x');
  presets.add(presetObj, 'ShearXY');
  presets.add(presetObj, 'Rotate Z 90°');
  presets.add(presetObj, 'Singular');
  presets.add(presetObj, 'Squish');
  presets.open();

  const vecFolder = gui.addFolder('User Vector (optional)');
  const readVec = () => {
    const { vx, vy, vz } = gui3dModel;
    const hasVec = Math.abs(vx) > 1e-12 || Math.abs(vy) > 1e-12 || Math.abs(vz) > 1e-12;
    viz3d?.setUserVector(hasVec ? [vx, vy, vz] : null);
  };
  vecFolder.add(gui3dModel, 'vx', -5, 5, 0.01).name('vx').onChange(readVec);
  vecFolder.add(gui3dModel, 'vy', -5, 5, 0.01).name('vy').onChange(readVec);
  vecFolder.add(gui3dModel, 'vz', -5, 5, 0.01).name('vz').onChange(readVec);
  vecFolder.open();
}

// ─── Mode switching ───────────────────────────────────────────────────────────
function switchTo(newMode: Mode) {
  if (newMode === mode && (viz2d || viz3d)) return;
  mode = newMode;

  if (viz2d) { viz2d.dispose(); viz2d.renderer.domElement.remove(); viz2d = null; }
  if (viz3d) { viz3d.dispose(); viz3d.renderer.domElement.remove(); viz3d = null; }

  if (mode === '2D') {
    viz2d = new Visualizer2D(viewport);
    // Reset to identity
    Object.assign(gui2dModel, { a:1, b:0, c:0, d:1 });
    mat2[0] = [1,0]; mat2[1] = [0,1];
    viz2d.update(mat2, false);
    build2dGui();
  } else {
    viz3d = new Visualizer3D(viewport);
    Object.assign(gui3dModel, { a:1,b:0,c:0, d:0,e:1,f:0, g:0,h:0,i:1 });
    mat3[0] = [1,0,0]; mat3[1] = [0,1,0]; mat3[2] = [0,0,1];
    viz3d.update(mat3, false);
    build3dGui();
  }

  updateDerived();
}

// ─── Top-level mode toggle GUI ────────────────────────────────────────────────
function buildModeGui() {
  // We prepend a tiny GUI at top of gui-container
  const modeGui = new GUI({ container: guiContainer, title: 'Mode' });
  const modeObj = { mode: '2D' };
  modeGui.add(modeObj, 'mode', ['2D', '3D']).name('Dimension').onChange((v: string) => {
    switchTo(v as Mode);
  });
}

// ─── Animation loop ──────────────────────────────────────────────────────────
function loop(now: number) {
  requestAnimationFrame(loop);
  if (mode === '2D' && viz2d) viz2d.tick(now);
  if (mode === '3D' && viz3d) viz3d.tick(now);
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
buildModeGui();
switchTo('2D');
requestAnimationFrame(loop);
