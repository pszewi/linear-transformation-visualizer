# Linear Transformation Visualizer

Hi Claude! I would like you to made a version of Desmos, that is specifically designed for work with matrices. 
Here is my idea: 

## Idea
A local, browser-based interactive tool — similar in spirit to Desmos 3D — that
visualizes the geometric effect of a linear transformation defined by a
user-supplied matrix. The user enters matrix entries (via sliders or input
fields), and the tool renders in real time how that transformation acts on a
standard basis, a unit grid/cube, and arbitrary vectors in 2D or 3D space. 
For reference you can check www.desmos.com/3d (this however does not accept matrices).

## Requirements

### Core
- Accept a matrix and render the corresponding linear transformation:
  - 2×2 matrices → 2D view (orthographic camera, xy-plane).
  - 3×3 matrices → 3D view (perspective camera, orbit controls).
  - Reject any matrix that is not 2×2 or 3×3 with a clear error message.
- Toggle between 2D and 3D mode; switching resets the matrix to the
  appropriate identity.
- Render the following simultaneously:
  - The **standard basis vectors** (before and after transformation), color-coded.
  - A **unit grid** (2D) or **unit cube wireframe** (3D) and its image under the
    transformation.
  - Optionally, a user-defined vector and its image.
- Matrix entries are editable via both numeric input fields and draggable
  sliders (range: at least [-5, 5], step 0.1).
- All visual updates happen in real time as the user drags a slider (no
  "apply" button).

### Derived quantities (display in a side panel)
- Determinant of the matrix.
- Eigenvalues (and eigenvectors, shown as lines/arrows in the scene if real).
- Rank.
- Whether the transformation is invertible.

### Performance & deployment
- Must run fully locally on a laptop: no backend, no network requests, no
  heavy dependencies.
- Target 60 fps for continuous slider interaction on a mid-range laptop.
- Single `npm install && npm run dev` to start.

### UX
- Clean, minimal UI. Dark background for the viewport, light side panel for
  controls.
- Axis labels (x, y, z) always visible.
- Smooth animated transition (lerp/slerp) when the matrix changes by a large
  discrete step (e.g., pasting a new matrix), but instant update on slider drag.

## Tech Stack
- **Vite** + **TypeScript** (vanilla — no React/Vue/Angular).
- **Three.js** for all rendering (both 2D and 3D modes).
- **lil-gui** for the control panel (sliders, inputs, toggles).
- **OrbitControls** (from three/examples) for 3D camera interaction.
- No other runtime dependencies.
