import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import * as faceapi from 'face-api.js';
import { createMeshIndices, heightMapFromRgba, type HeightMapData } from './heightmap';
import './App.css';

let modelLoad: Promise<void> | undefined;
function loadFaceModels() {
  if (!modelLoad) {
    modelLoad = (async () => {
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

function Icon({ name }: { name: 'camera' | 'upload' | 'back' | 'reset' | 'lock' }) {
  const paths = {
    camera: ['M8 5 9.5 3h5L16 5h4v15H4V5h4Z', 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'],
    upload: ['M12 16V3m-4 4 4-4 4 4', 'M4 14v6h16v-6'],
    back: ['m14 6-6 6 6 6'],
    reset: ['M4 10a8 8 0 1 1 1 7', 'M4 4v6h6'],
    lock: ['M6 10h12v10H6Z', 'M8 10V7a4 4 0 0 1 8 0v3'],
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name].map(d => <path key={d} d={d} />)}</svg>;
}

function PortraitGlyph() {
  return <svg className="portrait-glyph" viewBox="0 0 220 240" fill="none" aria-hidden="true">
    <defs><radialGradient id="portrait-glow"><stop stopColor="#b8f0d3" stopOpacity=".18"/><stop offset="1" stopColor="#b8f0d3" stopOpacity="0"/></radialGradient></defs>
    <circle cx="110" cy="120" r="110" fill="url(#portrait-glow)" stroke="none" />
    <g stroke="currentColor" strokeWidth=".9">
      <path d="M110 25C65 25 48 57 52 111c3 50 21 85 58 104 37-19 55-54 58-104 4-54-13-86-58-86Z"/>
      <path d="M110 25c-25 23-39 64-34 106 3 39 15 65 34 84M110 25c25 23 39 64 34 106-3 39-15 65-34 84M110 25v190"/>
      <path d="M61 62c30-12 67-12 98 0M53 87c35-11 79-11 114 0M52 113c35-6 81-6 116 0M57 140c32 4 74 4 106 0M66 165c27 8 61 8 88 0M82 190c17 6 39 6 56 0"/>
      <path d="m58 71 104 85M52 100l98 73M63 153l100-79M72 179l95-76M92 205l72-77" opacity=".45"/>
      <path d="m110 87-13 42 23 3-10-45M88 153q22 10 44-1" opacity=".8"/>
    </g>
  </svg>;
}

function App() {
  const [view, setView] = useState<'start' | 'camera' | 'result'>('start');
  const [portrait, setPortrait] = useState<HeightMapData | null>(null);
  const [depth, setDepth] = useState(1.8);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelsFailed, setModelsFailed] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef(0);
  const busyRef = useRef(false);
  const controlsRef = useRef<React.ElementRef<typeof OrbitControls>>(null);

  useEffect(() => {
    let active = true;
    loadFaceModels().then(() => { if (active) setModelsLoaded(true); }).catch(() => {
      if (active) {
        setModelsFailed(true);
        setError('Could not prepare the portrait tool. Reload to try again.');
      }
    });
    return () => { active = false; };
  }, []);

  const stopCamera = () => {
    requestRef.current++;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setCameraStarting(false);
    setVideoReady(false);
  };

  useEffect(() => () => {
    requestRef.current++;
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  const startCamera = async () => {
    const request = ++requestRef.current;
    setView('camera');
    setCameraStarting(true);
    setVideoReady(false);
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera unavailable');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 840 } }, audio: false,
      });
      if (request !== requestRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
    } catch {
      if (request === requestRef.current) {
        stopCamera();
        setView(portrait ? 'result' : 'start');
        setError('Camera access is unavailable. You can upload a portrait instead.');
      }
    } finally {
      if (request === requestRef.current) setCameraStarting(false);
    }
  };

  const cancelCamera = () => {
    stopCamera();
    setView(portrait ? 'result' : 'start');
    setError(null);
  };

  const processImage = async (source: CanvasImageSource, sourceWidth: number, sourceHeight: number) => {
    if (busyRef.current) return;
    if (!modelsLoaded) { setError('Still getting ready. Try again in a moment.'); return; }
    if (!sourceWidth || !sourceHeight) { setError('Wait for the camera preview, then try again.'); return; }
    busyRef.current = true;
    setCapturing(true);
    setError(null);
    try {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 256 / Math.max(sourceWidth, sourceHeight));
      canvas.width = Math.max(2, Math.round(sourceWidth * scale));
      canvas.height = Math.max(2, Math.round(sourceHeight * scale));
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Image processing unavailable');
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      // Freeze the image first, then release the camera immediately.
      stopCamera();
      await new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
      const detection = await faceapi.detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 })).withFaceLandmarks();
      if (!detection) throw new Error('No face found. Try a brighter, front-facing portrait.');

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = canvas.width; maskCanvas.height = canvas.height;
      const maskContext = maskCanvas.getContext('2d');
      if (!maskContext) throw new Error('Image processing unavailable');
      const box = detection.detection.box;
      const jaw = detection.landmarks.getJawOutline();
      const left = Math.max(0, box.x - box.width * .06);
      const right = Math.min(canvas.width, box.x + box.width * 1.06);
      const top = Math.max(0, box.y - box.height * .12);
      const bottom = Math.min(canvas.height, Math.max(...jaw.map(point => point.y)) + 2);
      const center = box.x + box.width / 2;
      maskContext.fillStyle = 'white';
      maskContext.beginPath();
      maskContext.moveTo(jaw[0].x, jaw[0].y);
      jaw.slice(1).forEach(point => maskContext.lineTo(point.x, point.y));
      maskContext.quadraticCurveTo(right, top, center, top);
      maskContext.quadraticCurveTo(left, top, jaw[0].x, jaw[0].y);
      maskContext.closePath(); maskContext.fill();
      const cropX = Math.floor(left), cropY = Math.floor(top);
      const cropWidth = Math.max(2, Math.min(canvas.width - cropX, Math.ceil(right) - cropX));
      const cropHeight = Math.max(2, Math.min(canvas.height - cropY, Math.ceil(bottom) - cropY));
      const pixels = context.getImageData(cropX, cropY, cropWidth, cropHeight);
      const maskPixels = maskContext.getImageData(cropX, cropY, cropWidth, cropHeight);
      for (let i = 0; i < pixels.data.length; i += 4) pixels.data[i + 3] = maskPixels.data[i + 3];
      setPortrait(heightMapFromRgba(pixels.data, cropWidth, cropHeight));
      setDepth(1.8);
      setView('result');
    } catch (cause) {
      setView(portrait ? 'result' : 'start');
      setError(cause instanceof Error ? cause.message : 'Something went wrong. Try another portrait.');
    } finally {
      stopCamera();
      busyRef.current = false;
      setCapturing(false);
    }
  };

  const captureImage = async () => {
    const video = videoRef.current;
    if (!video || !videoReady || video.readyState < 2) return;
    await processImage(video, video.videoWidth, video.videoHeight);
  };

  const choosePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || busyRef.current) return;
    setCapturing(true);
    setError(null);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = url; await image.decode();
      await processImage(image, image.naturalWidth, image.naturalHeight);
    } catch {
      setError('That photo could not be opened. Try a JPEG or PNG.');
      setCapturing(false);
    } finally { URL.revokeObjectURL(url); input.value = ''; }
  };

  const openPhoto = () => fileRef.current?.click();
  const readyFrame = (event: React.SyntheticEvent<HTMLVideoElement>) => setVideoReady(Boolean(streamRef.current && event.currentTarget.videoWidth && event.currentTarget.readyState >= 2));

  return <div className={'app-shell view-' + view}>
    <header className="app-header">
      {view === 'camera' && !capturing ? <button className="icon-button back-button" onClick={cancelCamera} aria-label="Back"><Icon name="back" /></button> : <span className="brand-mark" aria-hidden="true"><i/><i/><i/><i/></span>}
      <span className="brand">HEIGHTMAP <span>/ FACE</span></span>
      <span className="private-badge"><Icon name="lock" /> Private</span>
    </header>

    <main className="stage" aria-busy={capturing}>
      {view === 'start' && !capturing && <section className="start-view">
        <PortraitGlyph />
        <p className="eyebrow">A PORTRAIT EXPERIMENT</p>
        <h1>Your portrait,<br/>in another dimension.</h1>
        <p className="intro-copy">Turn light and shadow into a<br className="wide-break"/> landscape you can explore.</p>
      </section>}

      <section className="camera-view" hidden={view !== 'camera' || capturing} aria-label="Camera">
        <video ref={videoRef} autoPlay playsInline muted hidden={!cameraActive} aria-label="Camera preview" onLoadedData={readyFrame} onCanPlay={readyFrame} />
        {!cameraActive && <div className="camera-placeholder"><Icon name="camera"/><p>{cameraStarting ? 'Opening your camera…' : 'Getting the preview ready…'}</p></div>}
        {cameraActive && <div className="camera-guide" aria-hidden="true"/>}
        <div className="camera-caption"><span>TAKE A PORTRAIT</span><p>Center your face in the frame.</p></div>
      </section>

      {view === 'result' && portrait && !capturing && <section className="result-view" aria-label="3D portrait result">
        <div className="viewer-label"><span className="live-dot"/> YOUR 3D PORTRAIT</div>
        <h1 className="sr-only">Your 3D portrait</h1>
        <Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ position: [0, 0, 14], fov: 45 }} fallback={<p className="viewer-fallback">Open in Safari or Chrome to explore your portrait.</p>}>
          <PortraitMesh portrait={portrait} depth={depth}/>
          <OrbitControls ref={controlsRef} enableDamping={false} enablePan={false} minDistance={7} maxDistance={28}/>
        </Canvas>
        <button className="icon-button reset-button" onClick={() => controlsRef.current?.reset()} aria-label="Reset view"><Icon name="reset"/></button>
        <p className="viewer-hint">Drag to rotate <span>·</span> Pinch to explore</p>
      </section>}

      {capturing && <section className="processing-view" role="status"><div className="processing-orbit"/><h1>Finding your dimension.</h1><p>Creating your portrait…</p></section>}
    </main>

    <footer className="app-footer">
      {error && <div className="error-message" role="alert">{error}{modelsFailed && <button onClick={() => window.location.reload()}>Reload</button>}</div>}
      {view === 'start' && !capturing && <>
        <button className="button button-primary" onClick={startCamera} disabled={cameraStarting || modelsFailed}><Icon name="camera"/> Use camera</button>
        <button className="button button-secondary" onClick={openPhoto} disabled={!modelsLoaded}><Icon name="upload"/> Upload a photo</button>
        <p className="privacy-copy">Your photos stay on your device.</p>
      </>}
      {view === 'camera' && !capturing && <div className="capture-controls">
        <button className="photo-shortcut" onClick={openPhoto} disabled={!modelsLoaded} aria-label="Upload a photo"><Icon name="upload"/><span>Photo</span></button>
        <button className="shutter" onClick={captureImage} disabled={!modelsLoaded || !videoReady} aria-label="Capture portrait"><span/></button>
        <span className="capture-note">{!modelsLoaded ? 'Preparing…' : !videoReady ? 'One moment…' : 'Capture'}</span>
      </div>}
      {view === 'result' && !capturing && <>
        <label className="depth-control"><span>Relief depth</span><input type="range" aria-label="Relief depth" min="0.6" max="3" step="0.1" value={depth} onChange={event => setDepth(Number(event.target.value))}/><output>{depth.toFixed(1)}×</output></label>
        <div className="result-actions"><button className="button button-primary" onClick={startCamera}><Icon name="camera"/> Retake</button><button className="button button-secondary" onClick={openPhoto}><Icon name="upload"/> Change photo</button></div>
      </>}
      {capturing && <p className="privacy-copy">Processing on your device.</p>}
      {!modelsLoaded && !modelsFailed && !capturing && view === 'start' && <span className="sr-only" role="status">Preparing the portrait tool</span>}
    </footer>
    <input ref={fileRef} className="sr-only" type="file" accept="image/*" onChange={choosePhoto} aria-label="Portrait photo" tabIndex={-1} aria-hidden="true" disabled={!modelsLoaded || capturing}/>
  </div>;
}

function PortraitMesh({ portrait, depth }: { portrait: HeightMapData; depth: number }) {
  const { invalidate } = useThree();
  const geometry = useMemo(() => {
    const value = new THREE.PlaneGeometry(6, 6 * portrait.height / portrait.width, portrait.width - 1, portrait.height - 1);
    value.setIndex(createMeshIndices(portrait.mask, portrait.width, portrait.height));
    return value;
  }, [portrait]);
  useEffect(() => {
    const positions = geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < portrait.heights.length; i++) positions[i * 3 + 2] = (portrait.heights[i] - .5) * depth;
    geometry.attributes.position.needsUpdate = true;
    geometry.computeBoundingSphere();
    invalidate();
  }, [geometry, portrait, depth, invalidate]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} rotation={[-0.08, -.35, 0]}><meshBasicMaterial color="#b4f1d0" wireframe side={THREE.DoubleSide} toneMapped={false}/></mesh>;
}

export default App;
