import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import * as faceapi from 'face-api.js';
import './App.css';

let modelLoad: Promise<void> | undefined;
function loadFaceModels() {
  if (!modelLoad) {
    modelLoad = (async () => {
      // The old WebGL inference backend stalls on some browsers. The mesh
      // still uses WebGL; run the small, one-shot face detection on the CPU.
      await faceapi.tf.setBackend('cpu');
      await faceapi.tf.ready();
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
      ]);
    })().catch(error => { modelLoad = undefined; throw error; });
  }
  return modelLoad;
}


const App: React.FC = () => {
  const [imageData, setImageData] = useState<string | null>(null);
  const [heightMap, setHeightMap] = useState<Float32Array | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [modelsFailed, setModelsFailed] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let active = true;
    loadFaceModels().then(() => {
      if (active) setModelsLoaded(true);
    }).catch(() => {
      if (active) {
        setModelsFailed(true);
        setError('Face detection could not load. Reload this page to try again.');
      }
    });
    return () => { active = false; };
  }, []);

  const stopCamera = () => {
    cameraRequestRef.current += 1;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setVideoReady(false);
    setCameraStarting(false);
  };

  useEffect(() => () => {
    cameraRequestRef.current += 1;
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  const startCamera = async () => {
    const request = ++cameraRequestRef.current;
    setCameraStarting(true);
    setVideoReady(false);
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera is unavailable');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      if (request !== cameraRequestRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      if (request === cameraRequestRef.current) {
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setCameraActive(false);
        setVideoReady(false);
        setError('Camera unavailable. Open this demo in Safari or Chrome and allow camera access, or choose a photo below.');
      }
    } finally {
      if (request === cameraRequestRef.current) setCameraStarting(false);
    }
  };

  const processImage = async (source: CanvasImageSource, sourceWidth: number, sourceHeight: number) => {
    if (!canvasRef.current || !faceCanvasRef.current) return;
    if (!modelsLoaded) {
      console.error('Models not loaded yet');
      setError('Face detection models are still loading. Please wait.');
      return;
    }

    const canvas = canvasRef.current;
    const faceCanvas = faceCanvasRef.current;
    const context = canvas.getContext('2d');
    const faceContext = faceCanvas.getContext('2d');

    if (!context || !faceContext) {
      console.error('Failed to get canvas contexts');
      return;
    }

    if (!sourceWidth || !sourceHeight) {
      setError('Wait for the camera preview before capturing.');
      return;
    }
    setCapturing(true);
    setError(null);
    // Let the browser paint the processing state before CPU inference begins.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    try {
      // Bound mesh resolution so camera dimensions cannot overwhelm a phone GPU.
      const scale = Math.min(1, 256 / Math.max(sourceWidth, sourceHeight));
      // Set canvas dimensions
      canvas.width = Math.max(2, Math.round(sourceWidth * scale));
      canvas.height = Math.max(2, Math.round(sourceHeight * scale));
      faceCanvas.width = canvas.width;
      faceCanvas.height = canvas.height;

      // Draw video frame to canvas
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      
      // Detect face
      const detections = await faceapi.detectSingleFace(
        canvas,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 })
      ).withFaceLandmarks();

      if (!detections) {
        setError('No face detected. Try a clear, well-lit portrait or center your face in the camera.');
        return;
      }

      
      // Clear face canvas
      faceContext.clearRect(0, 0, faceCanvas.width, faceCanvas.height);
      
      // Create face mask
      faceContext.fillStyle = 'white';
      faceContext.beginPath();
      
      // Get face landmarks
      const landmarks = detections.landmarks;
      
      // Get all the points we need for a complete face mask
      const jawLine = landmarks.getJawOutline();
      const leftEyebrow = landmarks.getLeftEyeBrow();
      const rightEyebrow = landmarks.getRightEyeBrow();
      
      // Calculate face dimensions and center
      const faceBox = detections.detection.box;
      const centerX = faceBox.x + faceBox.width / 2;
      const centerY = faceBox.y + faceBox.height / 2;
      
      // Calculate extended head bounds (making it about 40% larger than the detected face)
      const scaleX = 1.4;
      const scaleY = 1.6; // More vertical extension for hair
      const extendedWidth = faceBox.width * scaleX;
      const extendedHeight = faceBox.height * scaleY;
      const topY = faceBox.y - (extendedHeight - faceBox.height);
      
      // Create extended head shape
      faceContext.moveTo(faceBox.x - extendedWidth * 0.2, centerY); // Start left of face
      
      // Draw left side curve
      faceContext.quadraticCurveTo(
        faceBox.x - extendedWidth * 0.1,
        topY - extendedHeight * 0.1, // Control point
        centerX,
        topY - extendedHeight * 0.2 // Top of head
      );
      
      // Draw right side curve
      faceContext.quadraticCurveTo(
        faceBox.x + faceBox.width + extendedWidth * 0.1,
        topY - extendedHeight * 0.1, // Control point
        faceBox.x + faceBox.width + extendedWidth * 0.2,
        centerY // Right side
      );
      
      // Connect to jaw
      faceContext.quadraticCurveTo(
        faceBox.x + faceBox.width + extendedWidth * 0.1,
        faceBox.y + faceBox.height + extendedHeight * 0.1,
        jawLine[jawLine.length - 1].x,
        jawLine[jawLine.length - 1].y
      );
      
      // Draw jaw line
      for (let i = jawLine.length - 2; i >= 0; i--) {
        faceContext.lineTo(jawLine[i].x, jawLine[i].y);
      }
      
      // Close the path back to start
      faceContext.quadraticCurveTo(
        faceBox.x - extendedWidth * 0.1,
        faceBox.y + faceBox.height + extendedHeight * 0.1,
        faceBox.x - extendedWidth * 0.2,
        centerY
      );
      
      // Fill and close the path
      faceContext.closePath();
      faceContext.fill();

      // Convert to grayscale and apply mask
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const faceData = faceContext.getImageData(0, 0, faceCanvas.width, faceCanvas.height);
      const data = imageData.data;
      const faceMask = faceData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        // Only process pixels where face mask is white
        if (faceMask[i] === 255) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          data[i] = avg;     // R
          data[i + 1] = avg; // G
          data[i + 2] = avg; // B
        } else {
          // Set background to black
          data[i] = 0;     // R
          data[i + 1] = 0; // G
          data[i + 2] = 0; // B
        }
      }
      
      context.putImageData(imageData, 0, 0);
      
      // Create heightmap data
      const heightMapData = new Float32Array(canvas.width * canvas.height);
      for (let i = 0; i < data.length; i += 4) {
        heightMapData[i / 4] = data[i] / 255; // Normalize to 0-1
      }
      
      setHeightMap(heightMapData);
      setImageData(canvas.toDataURL());
      setError(null);
    } catch (error) {
      console.error('Error during image capture:', error);
      setError('An error occurred during image capture. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  const captureImage = async () => {
    const video = videoRef.current;
    if (!video || !videoReady || video.readyState < 2) {
      setError('Wait for the camera preview before capturing.');
      return;
    }
    await processImage(video, video.videoWidth, video.videoHeight);
  };

  const choosePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      await processImage(image, image.naturalWidth, image.naturalHeight);
    } catch {
      setError('That photo could not be opened. Try a JPEG or PNG image.');
    } finally {
      URL.revokeObjectURL(url);
      input.value = '';
    }
  };

  return (
    <div className="App">
      <header>
        <h1>Face → height map</h1>
        <p>Turn a camera snapshot or photo into a 3D wireframe.</p>
        <p className="privacy-note">Images are processed in your browser and are not uploaded.</p>
      </header>
      <div className="camera-container">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-label="Camera preview"
          hidden={!cameraActive}
          onLoadedData={event => setVideoReady(Boolean(streamRef.current && event.currentTarget.videoWidth && event.currentTarget.readyState >= 2))}
          onCanPlay={event => setVideoReady(Boolean(streamRef.current && event.currentTarget.videoWidth))}
        />
        <div className="camera-actions">
          {cameraActive ? <>
            <button onClick={captureImage} disabled={!modelsLoaded || !videoReady || capturing}>{capturing ? 'Processing…' : videoReady ? 'Capture image' : 'Waiting for camera…'}</button>
            <button onClick={stopCamera}>Stop camera</button>
          </> : <button onClick={startCamera} disabled={cameraStarting || capturing}>{cameraStarting ? 'Starting camera…' : 'Try with my camera'}</button>}
        </div>
        <label className="photo-picker">Or choose a photo
          <input type="file" accept="image/*" onChange={choosePhoto} disabled={!modelsLoaded || capturing} />
        </label>
        <p role="status">{capturing ? 'Building your height map…' : modelsLoaded ? 'Face detection ready' : modelsFailed ? 'Face detection unavailable' : 'Loading face detection…'}</p>
        {error && <div role="alert" className="error-message">{error}</div>}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <canvas ref={faceCanvasRef} style={{ display: 'none' }} />
      </div>
      
      {imageData && <img className="capture-preview" src={imageData} alt="Grayscale face capture used for the height map" />}
      {heightMap && (
        <section className="result" aria-label="3D height map result">
          <p>Drag on the model to rotate · Pinch to zoom</p>
          <div className="three-container">
          <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 14] }} fallback={<p>Open this demo in Safari or Chrome to view 3D.</p>}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />
            <HeightMapMesh heightMap={heightMap} width={canvasRef.current?.width || 0} height={canvasRef.current?.height || 0} />
            <OrbitControls />
          </Canvas>
          </div>
        </section>
      )}
    </div>
  );
};

const HeightMapMesh: React.FC<{ heightMap: Float32Array; width: number; height: number }> = ({ heightMap, width, height }) => {
  const geometry = useRef<THREE.PlaneGeometry>(null);
  
  useEffect(() => {
    if (!geometry.current) return;
    
    const vertices = geometry.current.attributes.position.array;
    
    // Update vertices based on heightmap
    for (let i = 0; i < vertices.length; i += 3) {
      const x = Math.floor((i / 3) % width);
      const y = Math.floor((i / 3) / width);
      const heightValue = heightMap[y * width + x] || 0;
      
      // Ensure the height value is a valid number
      vertices[i + 2] = isNaN(heightValue) ? 0 : heightValue * 2;
    }
    
    // Update the geometry
    geometry.current.attributes.position.needsUpdate = true;
    geometry.current.computeVertexNormals();
    geometry.current.computeBoundingSphere();
  }, [heightMap, width, height]);
  
  return (
    <mesh rotation={[-0.12, -0.5, 0]}>
      <planeGeometry
        ref={geometry}
        args={[10, 10 * height / width, width - 1, height - 1]}
      />
      <meshBasicMaterial
        color="#00ff00"
        wireframe={true}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

export default App; 