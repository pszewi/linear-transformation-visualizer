import * as THREE from 'three';
import {
  applyMatrix2,
  eigenvalues2,
  eigenvector2,
  lerpMatrix,
} from './math.js';

const GRID_RANGE = 5;
const ANIM_DURATION = 500; // ms

// ─── Colour palette ──────────────────────────────────────────────────────────
const COL_GRID_ORIG  = 0xbbbbcc;
const COL_GRID_TRANS = 0x1a5fc8;
const COL_E1_BEFORE  = 0xcc8888;
const COL_E1_AFTER   = 0xdd1111;
const COL_E2_BEFORE  = 0x88cc88;
const COL_E2_AFTER   = 0x11aa11;
const COL_EIGEN      = 0xcc9900;
const COL_USER_VEC   = 0x4488ff;
const COL_USER_IMG   = 0x44ccff;

// ─── Helper — build a sprite label ──────────────────────────────────────────
function makeTextSprite(text: string, color = '#ffffff'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.font = 'bold 40px sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 32, 32);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.5, 0.5, 1);
  return sprite;
}

// ─── Helper — small number sprite for tick labels ────────────────────────────
function makeTickLabel(n: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 64);
  ctx.font = 'bold 44px sans-serif';
  ctx.fillStyle = '#111111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), 64, 32);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.48, 0.24, 1);
  return sprite;
}

// ─── Helper — tick mark segments along both axes ─────────────────────────────
function buildTickGeometry2D(ticks: number[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const s = 0.1;
  for (const t of ticks) {
    positions.push(t, -s, 0,  t, s, 0);   // x-axis tick
    positions.push(-s, t, 0,  s, t, 0);   // y-axis tick
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

const TICK_POSITIONS_2D = [-4, -3, -2, -1, 1, 2, 3, 4];

// ─── Helper — build grid line geometry ──────────────────────────────────────
function buildGridGeometry(
  matrix: number[][],
  range: number
): THREE.BufferGeometry {
  const positions: number[] = [];

  const push = (x0: number, y0: number, x1: number, y1: number) => {
    const [tx0, ty0] = applyMatrix2([x0, y0], matrix);
    const [tx1, ty1] = applyMatrix2([x1, y1], matrix);
    positions.push(tx0, ty0, 0, tx1, ty1, 0);
  };

  for (let i = -range; i <= range; i++) {
    push(i, -range, i, range);   // vertical lines
    push(-range, i, range, i);   // horizontal lines
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

// ─── Helper — build the original (identity) grid lines ──────────────────────
function buildOrigGridGeometry(range: number): THREE.BufferGeometry {
  const positions: number[] = [];
  for (let i = -range; i <= range; i++) {
    positions.push(i, -range, -0.001, i, range, -0.001);
    positions.push(-range, i, -0.001, range, i, -0.001);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

// ─── Helper — axis line (dashed appearance via segments) ────────────────────
function buildAxisGeometry(
  dir: [number, number],
  length = GRID_RANGE
): THREE.BufferGeometry {
  const positions: number[] = [];
  const steps = 20;
  for (let i = 0; i < steps; i++) {
    if (i % 2 === 0) {
      positions.push(
        (dir[0] * i * length) / steps, (dir[1] * i * length) / steps, 0,
        (dir[0] * (i + 0.8) * length) / steps, (dir[1] * (i + 0.8) * length) / steps, 0
      );
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

// ─── Helper — ArrowHelper wrapper (always 2D z=0) ────────────────────────────
function makeArrow(
  from: [number, number],
  to: [number, number],
  color: number
): THREE.ArrowHelper {
  const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], 0);
  const len = dir.length();
  if (len < 1e-9) {
    dir.set(1, 0, 0);
    return new THREE.ArrowHelper(dir, new THREE.Vector3(from[0], from[1], 0), 0, color, 0, 0);
  }
  dir.normalize();
  const origin = new THREE.Vector3(from[0], from[1], 0);
  const headLen = Math.min(0.25, len * 0.3);
  const headWidth = headLen * 0.6;
  return new THREE.ArrowHelper(dir, origin, len, color, headLen, headWidth);
}

// ─── Helper — eigen line through origin ─────────────────────────────────────
function buildEigenLineGeo(
  v: THREE.Vector2,
  range = GRID_RANGE
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        -v.x * range, -v.y * range, 0,
         v.x * range,  v.y * range, 0,
      ],
      3
    )
  );
  return geo;
}

// ─── Visualizer2D ────────────────────────────────────────────────────────────
export class Visualizer2D {
  readonly renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  // scene objects
  private origGrid!: THREE.LineSegments;
  private transGrid!: THREE.LineSegments;
  private e1Before!: THREE.ArrowHelper;
  private e2Before!: THREE.ArrowHelper;
  private e1After!: THREE.ArrowHelper;
  private e2After!: THREE.ArrowHelper;
  private e1Dashed!: THREE.LineSegments;
  private e2Dashed!: THREE.LineSegments;
  private eigenLines: THREE.LineSegments[] = [];
  private userArrow: THREE.ArrowHelper | null = null;
  private userImageArrow: THREE.ArrowHelper | null = null;

  // animation state
  private fromMatrix: number[][] = [[1,0],[0,1]];
  private toMatrix:   number[][] = [[1,0],[0,1]];
  private currentMatrix: number[][] = [[1,0],[0,1]];
  private animStart = -1;
  private animating = false;

  // user vector
  private userVec: [number, number] | null = null;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0xffffff);

    this.scene = new THREE.Scene();

    const w = container.clientWidth;
    const h = container.clientHeight;
    const asp = w / h;
    const size = 6;
    this.camera = new THREE.OrthographicCamera(
      -size * asp, size * asp, size, -size, 0.1, 100
    );
    this.camera.position.set(0, 0, 10);
    this.camera.lookAt(0, 0, 0);

    this.renderer.setSize(w, h);
    container.appendChild(this.renderer.domElement);

    this._buildScene();

    window.addEventListener('resize', () => this._onResize(container));
  }

  private _onResize(container: HTMLElement) {
    const w = container.clientWidth;
    const h = container.clientHeight;
    const asp = w / h;
    const size = 6;
    this.camera.left = -size * asp;
    this.camera.right = size * asp;
    this.camera.top = size;
    this.camera.bottom = -size;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private _buildScene() {
    // original grid
    const origGeo = buildOrigGridGeometry(GRID_RANGE);
    this.origGrid = new THREE.LineSegments(
      origGeo,
      new THREE.LineBasicMaterial({ color: COL_GRID_ORIG, transparent: true, opacity: 0.35 })
    );
    this.scene.add(this.origGrid);

    // transformed grid (starts as identity)
    const transGeo = buildGridGeometry([[1,0],[0,1]], GRID_RANGE);
    this.transGrid = new THREE.LineSegments(
      transGeo,
      new THREE.LineBasicMaterial({ color: COL_GRID_TRANS, transparent: true, opacity: 0.6 })
    );
    this.scene.add(this.transGrid);

    // before basis vectors (dashed-ish)
    this.e1Dashed = new THREE.LineSegments(
      buildAxisGeometry([1, 0]),
      new THREE.LineBasicMaterial({ color: COL_E1_BEFORE, transparent: true, opacity: 0.5 })
    );
    this.e2Dashed = new THREE.LineSegments(
      buildAxisGeometry([0, 1]),
      new THREE.LineBasicMaterial({ color: COL_E2_BEFORE, transparent: true, opacity: 0.5 })
    );
    this.scene.add(this.e1Dashed, this.e2Dashed);

    // after basis vectors
    this.e1Before = makeArrow([0,0], [1,0], COL_E1_BEFORE);
    this.e2Before = makeArrow([0,0], [0,1], COL_E2_BEFORE);
    this.e1After  = makeArrow([0,0], [1,0], COL_E1_AFTER);
    this.e2After  = makeArrow([0,0], [0,1], COL_E2_AFTER);
    this.scene.add(this.e1Before, this.e2Before, this.e1After, this.e2After);

    // axis labels
    const lx = makeTextSprite('x', '#cc2222'); lx.position.set(6.3, 0, 0);
    const ly = makeTextSprite('y', '#22aa22'); ly.position.set(0, 6.3, 0);
    this.scene.add(lx, ly);

    // tick marks
    const tickGeo = buildTickGeometry2D(TICK_POSITIONS_2D);
    this.scene.add(new THREE.LineSegments(
      tickGeo,
      new THREE.LineBasicMaterial({ color: 0x444444 })
    ));

    // tick number sprites
    for (const t of TICK_POSITIONS_2D) {
      const xLbl = makeTickLabel(t); xLbl.position.set(t, -0.28, 0);
      const yLbl = makeTickLabel(t); yLbl.position.set(-0.38, t, 0);
      this.scene.add(xLbl, yLbl);
    }
  }

  /** Set/clear the optional user vector. */
  setUserVector(v: [number, number] | null) {
    this.userVec = v;
    this._refreshUserVector(this.currentMatrix);
  }

  private _refreshUserVector(mat: number[][]) {
    if (this.userArrow) { this.scene.remove(this.userArrow); this.userArrow = null; }
    if (this.userImageArrow) { this.scene.remove(this.userImageArrow); this.userImageArrow = null; }

    if (!this.userVec) return;
    const uv = this.userVec;
    const img = applyMatrix2(uv, mat);

    this.userArrow = makeArrow([0,0], uv, COL_USER_VEC);
    this.userImageArrow = makeArrow([0,0], img, COL_USER_IMG);
    this.scene.add(this.userArrow, this.userImageArrow);
  }

  private _applyMatrix(mat: number[][]) {
    this.currentMatrix = mat;

    // transformed grid
    this.transGrid.geometry.dispose();
    this.transGrid.geometry = buildGridGeometry(mat, GRID_RANGE);

    // basis vector images
    const e1img = applyMatrix2([1,0], mat);
    const e2img = applyMatrix2([0,1], mat);

    this.scene.remove(this.e1After, this.e2After);
    this.e1After = makeArrow([0,0], e1img, COL_E1_AFTER);
    this.e2After = makeArrow([0,0], e2img, COL_E2_AFTER);
    this.scene.add(this.e1After, this.e2After);

    // eigenvectors
    for (const l of this.eigenLines) this.scene.remove(l);
    this.eigenLines = [];

    const evs = eigenvalues2(mat);
    for (const ev of evs) {
      if (Math.abs(ev.imag) < 1e-8) {
        const vec = eigenvector2(mat, ev.real);
        if (vec) {
          const geo = buildEigenLineGeo(vec);
          const line = new THREE.LineSegments(
            geo,
            new THREE.LineBasicMaterial({ color: COL_EIGEN, transparent: true, opacity: 0.7 })
          );
          this.eigenLines.push(line);
          this.scene.add(line);
        }
      }
    }

    this._refreshUserVector(mat);
  }

  /** Call with animate=true for typed-in values, false for slider drag. */
  update(matrix: number[][], animate: boolean) {
    if (animate) {
      this.fromMatrix = this.currentMatrix.map(r => [...r]);
      this.toMatrix   = matrix.map(r => [...r]);
      this.animStart  = performance.now();
      this.animating  = true;
    } else {
      this.animating = false;
      this._applyMatrix(matrix);
    }
  }

  /** Called each frame by the main animation loop. */
  tick(now: number) {
    if (this.animating) {
      const t = Math.min((now - this.animStart) / ANIM_DURATION, 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease in-out quad
      const mat = lerpMatrix(this.fromMatrix, this.toMatrix, eased);
      this._applyMatrix(mat);
      if (t >= 1) this.animating = false;
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
  }
}
