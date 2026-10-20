# Face to Heightmap 3D

A React application that captures your face through the webcam and creates a interactive 3D heightmap visualization using Three.js and React Three Fiber.

## Features

- Real-time webcam capture
- Face detection using face-api.js
- Automatic face masking and background removal
- 3D wireframe visualization
- Mobile-friendly 3D controls (rotate, pinch to zoom, relief depth, reset view)

## Technologies Used

- React
- TypeScript
- Vite
- Three.js
- React Three Fiber
- face-api.js

## Getting Started

### Prerequisites

- Node.js 24 LTS
- npm or yarn
- A webcam
- A modern browser with WebGL support

### Installation

1. Clone the repository:
```bash
git clone https://github.com/pbojinov/heightmap-face.git
cd heightmap-face
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to the localhost URL printed by Vite

## How to Use

1. Choose **Use camera** or **Upload a photo**. Photos stay on your device.
2. For the camera, center your face in the guide and tap the shutter. The camera turns off as soon as the frame is captured. **Back** cancels the camera.
3. The result replaces the camera with a full-height 3D viewer. Drag to rotate, pinch or scroll to zoom, and adjust **Relief depth**.
4. Use **Reset view**, **Retake**, or **Change photo** to keep exploring. If a new photo has no face, the previous result remains available.

## Building for Production

To create a production build:

```bash
npm run build
```

The built files will be in the `dist` directory.

## License

MIT

## Acknowledgments

- face-api.js for face detection
- Three.js and React Three Fiber for 3D rendering
- React and Vite for the development environment

## Cloudflare static deployment

Local checkout: `/Users/petar/dev/heightmap-face`. Use Node 24 LTS.

```sh
npm ci
npm run build
python3 -m http.server 4175 --bind 127.0.0.1 --directory dist
```

The `dist/` folder contains only public browser assets. Deploy it as the Cloudflare Worker `heightmap-face` in the existing account, with custom domain `https://heightmap-face.petarbojinov.com`. The `wrangler.jsonc` configuration is ready for `npx wrangler deploy` after Wrangler authentication. Domains remain managed in the Cloudflare dashboard so deployments do not replace their settings.

Embed in a blog post:

```html
<iframe
  src="https://heightmap-face.petarbojinov.com/"
  title="Face height map"
  loading="lazy"
  style="width: 100%; height: 640px; border: 0;"
  allow="camera; fullscreen"
></iframe>
```

Add a normal link to the demo as an alternative for readers who prefer a separate tab.

Camera access starts only after a reader clicks “Use camera” or “Retake”. It requests video only, stops tracks after capture, cancellation, errors, or unmount, and processes snapshots locally. Meshes are capped at 256 pixels on their longest side. Face-detection models ship in `public/models/`. The embed must delegate `camera` permission; any parent Permissions-Policy must also permit this origin.

### Mobile compatibility fix

Face inference now uses the TensorFlow CPU backend; only 3D rendering uses WebGL. Models initialize once, the detector uses input size 224, video playback starts explicitly, and Capture remains disabled until a frame is ready. Users can choose a photo when camera access is blocked. The result starts at an angle so the height is visible. Images are processed locally in the browser.

Verified the unmodified production build with no-face recovery followed by a successful portrait upload at 390×844 CSS pixels. A local camera-input fixture also verifies denied permission, video-frame readiness, successful capture, retake cancellation, and automatic camera shutdown without accessing a physical webcam. Physical phone camera permission behavior still needs a device check.

### Mobile portrait flow

The app uses separate start, capture, processing, and result screens within the available viewport. There is no raw file picker, grayscale debug preview, or live camera below the result. The mesh crops to a rounded head mask and omits triangles outside that mask, rather than rendering a flat rectangular background. Rendering runs on demand.

Run `npm test` for mask and geometry invariants. Browser checks cover portrait upload, no-face recovery, depth adjustment, reset view, denied camera access, controlled video capture, retake, and cancel.
