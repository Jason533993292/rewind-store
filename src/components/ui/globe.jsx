// ── Aceternity-style 3D Globe (three-globe) ──
// Dark globe with country outlines as dots, stars, animated arcs,
// customer dots with light-blue popup beams.

import { useEffect, useRef, useState, useMemo } from 'react';
import { Color, Scene, Fog, PerspectiveCamera, Vector3, PointsMaterial, BufferGeometry, Float32BufferAttribute, Points } from 'three';
import ThreeGlobe from 'three-globe';
import { useThree, Canvas, extend, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import landDotsRaw from '../../data/land-dots.json';

extend({ ThreeGlobe: ThreeGlobe });

const RING_PROPAGATION_SPEED = 3;
const aspect = 1.2;
const cameraZ = 300;
const ORIGIN = { lat: 50.8503, lng: 4.3517 };
const COLORS = ['#06b6d4', '#3b82f6', '#6366f1'];

function hexToRgb(hex) {
  const shorthand = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthand, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

function genRandomNumbers(min, max, count) {
  const arr = [];
  while (arr.length < count) {
    const r = Math.floor(Math.random() * (max - min)) + min;
    if (arr.indexOf(r) === -1) arr.push(r);
  }
  return arr;
}

function Starfield({ radius, count = 1200 }) {
  const positions = useMemo(() => {
    const pts = [];
    for (let i = 0; i < count; i++) {
      const u = Math.random(), v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = radius * (1.5 + Math.random() * 1.5);
      pts.push(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
    }
    return new Float32Array(pts);
  }, [radius, count]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.3} color="#ffffff" sizeAttenuation transparent opacity={0.6} />
    </points>
  );
}

function LandDots({ dataInput }) {
  const positions = useMemo(() => {
    if (!dataInput || !dataInput.length) return new Float32Array([0, 0, 0]);
    return new Float32Array(dataInput);
  }, [dataInput]);

  if (positions.length <= 3) return null;

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.15} color="#888888" sizeAttenuation transparent opacity={0.5} />
    </points>
  );
}

// Pulsing light-blue beam ring effect on customer dots
function CustomerRings({ data, radius }) {
  const ringRefs = useRef([]);

  const positions = useMemo(() => {
    if (!data || !data.length) return [];
    return data.map(d => {
      const phi = (90 - d.endLat) * (Math.PI / 180);
      const theta = (d.endLng + 180) * (Math.PI / 180);
      const r = radius * 1.005;
      return new Vector3(
        -r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta),
      );
    });
  }, [data, radius]);

  useFrame(({ clock }) => {
    ringRefs.current.forEach((ref, i) => {
      if (!ref) return;
      const t = (clock.elapsedTime + i * 0.8) % 3;
      const s = 1 + Math.sin(t * Math.PI) * 2.5;
      ref.scale.setScalar(s);
      ref.material.opacity = Math.max(0, 1 - t / 3);
    });
  });

  if (!positions.length) return null;

  return (
    <group>
      {positions.map((pos, i) => (
        <mesh ref={el => ringRefs.current[i] = el} key={i} position={pos}>
          <ringGeometry args={[0.2, 0.35, 32]} />
          <meshBasicMaterial color="#60a5fa" transparent opacity={0.7} side={2} />
        </mesh>
      ))}
    </group>
  );
}

export function Globe({ globeConfig, data }) {
  const globeRef = useRef(null);
  const groupRef = useRef();
  const [isInitialized, setIsInitialized] = useState(false);

  const landData = useMemo(() => {
    // Pre-sampled land dots — already computed in land-dots.json
    const flat = [];
    for (const d of landDotsRaw) {
      flat.push(d[0], d[1], d[2]);
    }
    return flat;
  }, []);

  const defaultProps = {
    pointSize: 1,
    atmosphereColor: '#ffffff',
    showAtmosphere: true,
    atmosphereAltitude: 0.1,
    polygonColor: 'rgba(255,255,255,0.7)',
    globeColor: '#1d072e',
    emissive: '#000000',
    emissiveIntensity: 0.1,
    shininess: 0.9,
    arcTime: 2000,
    arcLength: 0.9,
    rings: 1,
    maxRings: 3,
    ...globeConfig,
  };

  useEffect(() => {
    if (!globeRef.current && groupRef.current) {
      globeRef.current = new ThreeGlobe();
      groupRef.current.add(globeRef.current);
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!globeRef.current || !isInitialized) return;
    const material = globeRef.current.globeMaterial();
    material.color = new Color(globeConfig.globeColor || '#1d072e');
    material.emissive = new Color(globeConfig.emissive || '#000000');
    material.emissiveIntensity = globeConfig.emissiveIntensity || 0.1;
    material.shininess = globeConfig.shininess || 0.9;
  }, [isInitialized, globeConfig.globeColor, globeConfig.emissive, globeConfig.emissiveIntensity, globeConfig.shininess]);

  useEffect(() => {
    if (!globeRef.current || !isInitialized || !data) return;

    const points = [];
    for (const arc of data) {
      points.push({ size: 3, order: arc.order, color: '#60a5fa', lat: arc.startLat, lng: arc.startLng });
      points.push({ size: 3, order: arc.order, color: '#60a5fa', lat: arc.endLat, lng: arc.endLng });
    }
    const filtered = points.filter((v, i, a) => a.findIndex(v2 => v2.lat === v.lat && v2.lng === v.lng) === i);

    globeRef.current
      .hexPolygonsData([])
      .showAtmosphere(defaultProps.showAtmosphere)
      .atmosphereColor(defaultProps.atmosphereColor)
      .atmosphereAltitude(defaultProps.atmosphereAltitude);

    globeRef.current
      .arcsData(data)
      .arcStartLat(d => d.startLat)
      .arcStartLng(d => d.startLng)
      .arcEndLat(d => d.endLat)
      .arcEndLng(d => d.endLng)
      .arcColor(e => e.color)
      .arcAltitude(e => e.arcAlt)
      .arcStroke(() => 0.2)
      .arcDashLength(defaultProps.arcLength)
      .arcDashInitialGap(e => e.order * 1)
      .arcDashGap(15)
      .arcDashAnimateTime(() => defaultProps.arcTime);

    globeRef.current
      .pointsData(filtered)
      .pointColor(e => e.color)
      .pointsMerge(true)
      .pointAltitude(0.0)
      .pointRadius(2);

    globeRef.current
      .ringsData([])
      .ringColor(() => '#60a5fa')
      .ringMaxRadius(defaultProps.maxRings)
      .ringPropagationSpeed(RING_PROPAGATION_SPEED)
      .ringRepeatPeriod((defaultProps.arcTime * defaultProps.arcLength) / defaultProps.rings);
  }, [isInitialized, data, defaultProps]);

  useEffect(() => {
    if (!globeRef.current || !isInitialized || !data) return;
    const interval = setInterval(() => {
      if (!globeRef.current) return;
      const nums = genRandomNumbers(0, data.length, Math.floor((data.length * 4) / 5));
      const ringsData = data.filter((d, i) => nums.includes(i)).map(d => ({ lat: d.startLat, lng: d.startLng, color: '#60a5fa' }));
      globeRef.current.ringsData(ringsData);
    }, 2000);
    return () => clearInterval(interval);
  }, [isInitialized, data]);

  return (
    <group ref={groupRef}>
      <LandDots dataInput={landData} />
      <CustomerRings data={data} radius={5.01} />
    </group>
  );
}

function WebGLRendererConfig() {
  const { gl, size } = useThree();
  useEffect(() => {
    gl.setPixelRatio(window.devicePixelRatio);
    gl.setSize(size.width, size.height);
    gl.setClearColor(0x000000, 0);
  }, [gl, size]);
  return null;
}

export function World({ globeConfig, data }) {
  const scene = useMemo(() => {
    const s = new Scene();
    s.fog = new Fog(0x0a0000, 400, 2000);
    return s;
  }, []);

  return (
    <Canvas scene={scene} camera={new PerspectiveCamera(50, aspect, 180, 1800)} gl={{ antialias: true, alpha: false }}>
      <WebGLRendererConfig />
      <ambientLight color={globeConfig.ambientLight} intensity={0.6} />
      <directionalLight color={globeConfig.directionalLeftLight} position={new Vector3(-400, 100, 400)} />
      <directionalLight color={globeConfig.directionalTopLight} position={new Vector3(-200, 500, 200)} />
      <pointLight color={globeConfig.pointLight} position={new Vector3(-200, 500, 200)} intensity={0.8} />
      <Starfield radius={15} count={1200} />
      <Globe globeConfig={globeConfig} data={data} />
      <OrbitControls enablePan={false} enableZoom={false} minDistance={cameraZ} maxDistance={cameraZ}
        autoRotateSpeed={1} autoRotate={true} minPolarAngle={Math.PI / 3.5} maxPolarAngle={Math.PI - Math.PI / 3} />
    </Canvas>
  );
}

function buildArcs(locations) {
  const arcs = [];
  const maxCount = Math.max(...locations.map(l => l.count), 1);
  for (const loc of locations) {
    if (loc.lat == null || loc.lng == null) continue;
    const ratio = Math.min(loc.count / maxCount, 1);
    const color = COLORS[Math.floor(ratio * (COLORS.length - 1))];
    arcs.push({ order: 1, startLat: ORIGIN.lat, startLng: ORIGIN.lng, endLat: loc.lat, endLng: loc.lng, arcAlt: 0.25 + ratio * 0.55, color });
  }
  return arcs;
}

export default function GlobePanel({ open, onClose, locations }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) setMounted(true);
    else { const t = setTimeout(() => setMounted(false), 500); return () => clearTimeout(t); }
  }, [open]);

  const globeConfig = useMemo(() => ({
    pointSize: 4, globeColor: '#021532', showAtmosphere: true, atmosphereColor: '#60a5fa',
    atmosphereAltitude: 0.12, emissive: '#021532', emissiveIntensity: 0.05, shininess: 0.6,
    polygonColor: 'rgba(255,255,255,0.7)', ambientLight: '#38bdf8', directionalLeftLight: '#ffffff',
    directionalTopLight: '#ffffff', pointLight: '#ffffff', arcTime: 2000, arcLength: 0.9, rings: 1, maxRings: 3,
    autoRotate: true, autoRotateSpeed: 0.5,
  }), []);

  const data = useMemo(() => (locations ? buildArcs(locations) : []), [locations]);
  const totalOrders = useMemo(() => (locations || []).reduce((s, l) => s + l.count, 0), [locations]);

  if (!mounted) return null;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '90vw', maxWidth: '1000px', height: '85vh', maxHeight: '700px', position: 'relative', overflow: 'hidden', borderRadius: '20px', background: '#000' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10, width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', fontSize: '18px', display: 'grid', placeItems: 'center', fontWeight: 600 }}>✕</button>
        <div style={{ position: 'absolute', top: '16px', left: '20px', zIndex: 10, color: '#fff' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, opacity: 0.9 }}>Our reach</div>
          <div style={{ fontSize: '13px', opacity: 0.5, marginTop: '2px' }}>{locations.length} cities · {totalOrders} orders · Brussels</div>
        </div>
        {open && <World globeConfig={globeConfig} data={data} />}
      </div>
    </div>
  );
}
