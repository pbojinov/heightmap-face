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