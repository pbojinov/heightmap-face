# Face to Heightmap 3D

A React application that captures your face through the webcam and creates a real-time 3D heightmap visualization using Three.js and React Three Fiber.

## Features

- Real-time webcam capture
- Face detection using face-api.js
- Automatic face masking and background removal
- 3D wireframe visualization
- Interactive 3D controls (rotate, zoom, pan)

## Technologies Used

- React
- TypeScript
- Vite
- Three.js
- React Three Fiber
- face-api.js

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A webcam
- A modern browser with WebGL support

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/heightmap-face.git
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

4. Open your browser and navigate to `http://localhost:3000`

## How to Use

1. Grant camera permissions when prompted
2. Position your face in the camera view
3. Click the "Capture Image" button
4. The application will:
   - Detect your face
   - Create a mask around your head and hair
   - Generate a 3D wireframe visualization
5. Interact with the 3D model:
   - Left click and drag to rotate
   - Right click and drag to pan
   - Scroll to zoom

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

Camera access starts only after a reader clicks “Try with my camera”. It requests video only, stops tracks when stopped or unmounted, and processes snapshots locally. Meshes are capped at 256 pixels on their longest side. Face-detection models ship in `public/models/`. The embed must delegate `camera` permission; any parent Permissions-Policy must also permit this origin.
