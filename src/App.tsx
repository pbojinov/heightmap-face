import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import * as faceapi from 'face-api.js';
import './App.css';

const App: React.FC = () => {
  const [imageData, setImageData] = useState<string | null>(null);
  const [heightMap, setHeightMap] = useState<Float32Array | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Load face-api models
    const loadModels = async () => {
      try {
        console.log('Loading face detection models...');
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        console.log('TinyFaceDetector loaded');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        console.log('FaceLandmark68Net loaded');
        setModelsLoaded(true);
        console.log('All models loaded successfully');
      } catch (error) {
        console.error('Error loading face detection models:', error);
        setError('Failed to load face detection models. Please check the console for details.');
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            console.log('Camera stream started');
          }
        })
        .catch(err => {
          console.error('Error accessing camera:', err);
          setError('Failed to access camera. Please ensure you have granted camera permissions.');
        });
    }
  }, []);

  const captureImage = async () => {
    console.log('Starting image capture...');
    if (!videoRef.current || !canvasRef.current || !faceCanvasRef.current) {
      console.error('Missing required refs');
      return;
    }
    if (!modelsLoaded) {
      console.error('Models not loaded yet');
      setError('Face detection models are still loading. Please wait.');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const faceCanvas = faceCanvasRef.current;
    const context = canvas.getContext('2d');
    const faceContext = faceCanvas.getContext('2d');

    if (!context || !faceContext) {
      console.error('Failed to get canvas contexts');
      return;
    }

    try {
      // Set canvas dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      faceCanvas.width = video.videoWidth;
      faceCanvas.height = video.videoHeight;
      console.log('Canvas dimensions set:', { width: canvas.width, height: canvas.height });

      // Draw video frame to canvas
      context.drawImage(video, 0, 0);
      console.log('Video frame drawn to canvas');
      
      // Detect face
      console.log('Starting face detection...');
      const detections = await faceapi.detectSingleFace(
        canvas,
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks();

      if (!detections) {
        console.log('No face detected');
        setError('No face detected. Please ensure your face is visible in the camera.');
        return;
      }

      console.log('Face detected:', detections);
      
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
      console.log('Complete head mask created');

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
      console.log('Image processed and masked');
      
      // Create heightmap data
      const heightMapData = new Float32Array(canvas.width * canvas.height);
      for (let i = 0; i < data.length; i += 4) {
        heightMapData[i / 4] = data[i] / 255; // Normalize to 0-1
      }
      
      setHeightMap(heightMapData);
      setImageData(canvas.toDataURL());
      setError(null);
      console.log('Heightmap created and state updated');
    } catch (error) {
      console.error('Error during image capture:', error);
      setError('An error occurred during image capture. Please check the console for details.');
    }
  };

  return (
    <div className="App">
      <div className="camera-container">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '640px', height: '480px' }}
        />
        <button onClick={captureImage}>Capture Image</button>
        {error && <div className="error-message">{error}</div>}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <canvas ref={faceCanvasRef} style={{ display: 'none' }} />
      </div>
      
      {heightMap && (
        <div className="three-container">
          <Canvas camera={{ position: [0, 0, 5] }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />
            <HeightMapMesh heightMap={heightMap} width={canvasRef.current?.width || 0} height={canvasRef.current?.height || 0} />
            <OrbitControls />
          </Canvas>
        </div>
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
    <mesh>
      <planeGeometry
        ref={geometry}
        args={[10, 10, width - 1, height - 1]}
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