import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  applyMatrix3,
  eigenvalues3,
  eigenvector3,
  lerpMatrix,
} from './math.js';

const ANIM_DURATION = 500;

// ─── Colour palette ──────────────────────────────────────────────────────────
const COL_CUBE_ORIG  = 0xbbbbcc;
const COL_CUBE_TRANS = 0x1a5fc8;
const COL_E1_BEFORE  = 0xcc8888;
const COL_E1_AFTER   = 0xdd1111;
const COL_E2_BEFORE  = 0x88cc88;
const COL_E2_AFTER   = 0x11aa11;
const COL_E3_BEFORE  = 0x8888cc;
const COL_E3_AFTER   = 0x1111dd;
const COL_EIGEN      = 0xcc9900;
const COL_USER_VEC   = 0x4488ff;
const COL_USER_IMG   = 0x44ccff;

// ─── Sprite label ────────────────────────────────────────────────────────────
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
  sprite.scale.set(0.4, 0.4, 1);
  return sprite;
}

// ─── Arrow helper ────────────────────────────────────────────────────────────
function makeArrow(
  from: [number,number,number],
  to: [number,number,number],
  color: number
): THREE.ArrowHelper {
  const dir = new THREE.Vector3(
    to[0] - from[0], to[1] - from[1], to[2] - from[2]
  );
  const len = dir.length();
  if (len < 1e-9) {
    dir.set(1, 0, 0);
    return new THREE.ArrowHelper(dir, new THREE.Vector3(...from), 0, color, 0, 0);
  }
  dir.normalize();
  const origin = new THREE.Vector3(...from);
  const headLen = Math.min(0.2, len * 0.25);
  return new THREE.ArrowHelper(dir, origin, len, color, headLen, headLen * 0.6);
}

// ─── Unit cube wireframe ─────────────────────────────────────────────────────
// Corners at all combinations of 0/1 in each axis.
const CUBE_EDGES: [number,number][] = [
  [0,1],[1,3],[3,2],[2,0],
  [4,5],[5,7],[7,6],[6,4],
  [0,4],[1,5],[2,6],[3,7],
];
const CUBE_CORNERS: [number,number,number][] = [
  [0,0,0],[1,0,0],[0,1,0],[1,1,0],
  [0,0,1],[1,0,1],[0,1,1],[1,1,1],
];

function buildCubeGeometry(matrix: number[][]): THREE.BufferGeometry {
  const positions: number[] = [];
  const corners = CUBE_CORNERS.map(c => applyMatrix3(c, matrix));
  for (const [a, b] of CUBE_EDGES) {
    positions.push(...corners[a], ...corners[b]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

function buildOrigCubeGeometry(): THREE.BufferGeometry {
  return buildCubeGeometry([[1,0,0],[0,1,0],[0,0,1]]);
}

// ─── Eigen line ──────────────────────────────────────────────────────────────
function buildEigenLineGeo3(
  v: THREE.Vector3,
  range = 4
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        -v.x * range, -v.y * range, -v.z * range,
         v.x * range,  v.y * range,  v.z * range,
      ],
      3
    )
  );
  return geo;
}

// ─── Visualizer3D ────────────────────────────────────────────────────────────
export class Visualizer3D {
  readonly renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;

  private origCube!: THREE.LineSegments;
  private transCube!: THREE.LineSegments;

  private e1Before!: THREE.ArrowHelper;
  private e2Before!: THREE.ArrowHelper;
  private e3Before!: THREE.ArrowHelper;
  private e1After!: THREE.ArrowHelper;
  private e2After!: THREE.ArrowHelper;
  private e3After!: THREE.ArrowHelper;

  private eigenLines: THREE.LineSegments[] = [];
  private userArrow: THREE.ArrowHelper | null = null;
  private userImageArrow: THREE.ArrowHelper | null = null;

  private fromMatrix: number[][] = [[1,0,0],[0,1,0],[0,0,1]];
  private toMatrix:   number[][] = [[1,0,0],[0,1,0],[0,0,1]];
  private currentMatrix: number[][] = [[1,0,0],[0,1,0],[0,0,1]];
  private animStart = -1;
  private animating = false;

  private userVec: [number,number,number] | null = null;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0xffffff);

    this.scene = new THREE.Scene();

    const w = container.clientWidth;
    const h = container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200);
    this.camera.position.set(4, 3, 5);
    this.camera.lookAt(0.5, 0.5, 0.5);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0.5, 0.5, 0.5);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    this.renderer.setSize(w, h);
    container.appendChild(this.renderer.domElement);

    this._buildScene();

    window.addEventListener('resize', () => this._onResize(container));
  }

  private _onResize(container: HTMLElement) {
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private _buildScene() {
    // Ambient + directional light (for future mesh objects)
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dl = new THREE.DirectionalLight(0xffffff, 0.8);
    dl.position.set(5, 8, 6);
    this.scene.add(dl);

    // original cube
    this.origCube = new THREE.LineSegments(
      buildOrigCubeGeometry(),
      new THREE.LineBasicMaterial({ color: COL_CUBE_ORIG, transparent: true, opacity: 0.4 })
    );
    this.scene.add(this.origCube);

    // transformed cube
    this.transCube = new THREE.LineSegments(
      buildCubeGeometry([[1,0,0],[0,1,0],[0,0,1]]),
      new THREE.LineBasicMaterial({ color: COL_CUBE_TRANS, transparent: true, opacity: 0.8 })
    );
    this.scene.add(this.transCube);

    // before basis vectors
    this.e1Before = makeArrow([0,0,0],[1,0,0], COL_E1_BEFORE);
    this.e2Before = makeArrow([0,0,0],[0,1,0], COL_E2_BEFORE);
    this.e3Before = makeArrow([0,0,0],[0,0,1], COL_E3_BEFORE);
    this.scene.add(this.e1Before, this.e2Before, this.e3Before);

    // after basis vectors (start at identity)
    this.e1After = makeArrow([0,0,0],[1,0,0], COL_E1_AFTER);
    this.e2After = makeArrow([0,0,0],[0,1,0], COL_E2_AFTER);
    this.e3After = makeArrow([0,0,0],[0,0,1], COL_E3_AFTER);
    this.scene.add(this.e1After, this.e2After, this.e3After);

    // axis labels
    const lx = makeTextSprite('x', '#cc2222'); lx.position.set(1.6, 0, 0);
    const ly = makeTextSprite('y', '#22aa22'); ly.position.set(0, 1.6, 0);
    const lz = makeTextSprite('z', '#2222cc'); lz.position.set(0, 0, 1.6);
    this.scene.add(lx, ly, lz);
  }

  setUserVector(v: [number,number,number] | null) {
    this.userVec = v;
    this._refreshUserVector(this.currentMatrix);
  }

  private _refreshUserVector(mat: number[][]) {
    if (this.userArrow) { this.scene.remove(this.userArrow); this.userArrow = null; }
    if (this.userImageArrow) { this.scene.remove(this.userImageArrow); this.userImageArrow = null; }
    if (!this.userVec) return;
    const uv = this.userVec;
    const img = applyMatrix3(uv, mat);
    this.userArrow      = makeArrow([0,0,0], uv,  COL_USER_VEC);
    this.userImageArrow = makeArrow([0,0,0], img, COL_USER_IMG);
    this.scene.add(this.userArrow, this.userImageArrow);
  }

  private _applyMatrix(mat: number[][]) {
    this.currentMatrix = mat;

    this.transCube.geometry.dispose();
    this.transCube.geometry = buildCubeGeometry(mat);

    const e1img = applyMatrix3([1,0,0], mat);
    const e2img = applyMatrix3([0,1,0], mat);
    const e3img = applyMatrix3([0,0,1], mat);

    this.scene.remove(this.e1After, this.e2After, this.e3After);
    this.e1After = makeArrow([0,0,0], e1img, COL_E1_AFTER);
    this.e2After = makeArrow([0,0,0], e2img, COL_E2_AFTER);
    this.e3After = makeArrow([0,0,0], e3img, COL_E3_AFTER);
    this.scene.add(this.e1After, this.e2After, this.e3After);

    for (const l of this.eigenLines) this.scene.remove(l);
    this.eigenLines = [];

    const evs = eigenvalues3(mat);
    for (const ev of evs) {
      if (Math.abs(ev.imag) < 1e-8) {
        const vec = eigenvector3(mat, ev.real);
        if (vec) {
          const geo = buildEigenLineGeo3(vec);
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

  tick(now: number) {
    this.controls.update();

    if (this.animating) {
      const t = Math.min((now - this.animStart) / ANIM_DURATION, 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const mat = lerpMatrix(this.fromMatrix, this.toMatrix, eased);
      this._applyMatrix(mat);
      if (t >= 1) this.animating = false;
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.controls.dispose();
    this.renderer.dispose();
  }
}
