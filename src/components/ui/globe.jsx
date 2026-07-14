// ── Aceternity-style 3D Globe (three-globe) — Upgraded ──
//
// Additions over the previous version:
//  1. Bloom post-processing — arcs/beacons actually glow now
//  2. Vertical glowing beams at each city + pulsing ring
//  3. Cinematic camera dolly-in on open
//  4. Hover tooltips on city beacons
//  5. Nebula-style radial gradient background
//  6. Land dots tinted by latitude (cool poles, warm equator)
//  7. Bright pulse traveling along each arc ("shipment in transit")
//
// Dependency: npm install @react-three/postprocessing postprocessing

import { useEffect, useRef, useState, useMemo } from 'react';
import { Color, Scene, Fog, PerspectiveCamera, Vector3, Quaternion } from 'three';
import ThreeGlobe from 'three-globe';
import { useThree, Canvas, extend, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import landDotsRaw from '../../data/land-dots.json';

extend({ ThreeGlobe: ThreeGlobe });

const RING_PROPAGATION_SPEED = 3;
const aspect = 1.2;
const cameraZ = 300;
const ORIGIN = { lat: 50.8503, lng: 4.3517 };
const COLORS = ['#06b6d4', '#3b82f6', '#6366f1'];

function genRandomNumbers(min, max, count) {
  const arr = [];
  while (arr.length < count) {
    const r = Math.floor(Math.random() * (max - min)) + min;
    if (arr.indexOf(r) === -1) arr.push(r);
  }
  return arr;
}

function latLngToVec3(lat, lng, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

// Land dots tinted by latitude
function LandDots({ dataInput, radius }) {
  const { positions, colors } = useMemo(() => {
    if (!dataInput || !dataInput.length) {
      return { positions: new Float32Array([0, 0, 0]), colors: new Float32Array([0, 0, 0]) };
    }
    const pos = new Float32Array(dataInput.length);
    const col = new Float32Array(dataInput.length);
    const poleColor = new Color('#bcd6f5');
    const equatorColor = new Color('#e8ddc8');

    for (let i = 0; i < dataInput.length; i += 3) {
      pos[i] = dataInput[i];
      pos[i + 1] = dataInput[i + 1];
      pos[i + 2] = dataInput[i + 2];
      const latFactor = Math.min(1, Math.abs(dataInput[i + 1]) / radius);
      const c = equatorColor.clone().lerp(poleColor, latFactor);
      col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
    }
    return { positions: pos, colors: col };
  }, [dataInput, radius]);

  if (positions.length <= 3) return null;

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={colors.length / 3} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.35} vertexColors sizeAttenuation transparent opacity={0.75} />
    </points>
  );
}

// Glowing vertical beam + pulsing ring + hover target at each city
function CityBeacons({ data, radius, onHover }) {
  const ringRefs = useRef([]);
  const beamRefs = useRef([]);

  const cities = useMemo(() => {
    if (!data || !data.length) return [];
    const seen = new Map();
    for (const d of data) {
      const key = `${d.endLat}-${d.endLng}`;
      if (!seen.has(key)) seen.set(key, { lat: d.endLat, lng: d.endLng, city: d.city, count: d.count });
    }
    return [...seen.values()];
  }, [data]);

  const positions = useMemo(
    () => cities.map(c => latLngToVec3(c.lat, c.lng, radius * 1.005)),
    [cities, radius]
  );

  const beamHeight = radius * 0.35;
  const up = useMemo(() => new Vector3(0, 1, 0), []);
  const beamTransforms = useMemo(
    () => positions.map(pos => {
      const outward = pos.clone().normalize();
      const beamPos = pos.clone().add(outward.clone().multiplyScalar(beamHeight / 2));
      const quaternion = new Quaternion().setFromUnitVectors(up, outward);
      return { beamPos, quaternion };
    }),
    [positions, beamHeight, up]
  );

  useFrame(({ clock }) => {
    ringRefs.current.forEach((ref, i) => {
      if (!ref) return;
      const t = (clock.elapsedTime + i * 0.8) % 3;
      const s = 1 + Math.sin(t * Math.PI) * 2.5;
      ref.scale.setScalar(s);
      ref.material.opacity = Math.max(0, 1 - t / 3);
    });
    beamRefs.current.forEach((ref, i) => {
      if (!ref) return;
      const t = (clock.elapsedTime * 0.6 + i * 0.4) % 2;
      ref.material.opacity = 0.25 + Math.sin(t * Math.PI) * 0.25;
    });
  });

  if (!positions.length) return null;

  return (
    <group>
      {positions.map((pos, i) => {
        const { beamPos, quaternion } = beamTransforms[i];
        return (
          <group key={i}>
            <mesh ref={el => ringRefs.current[i] = el} position={pos}>
              <ringGeometry args={[0.2, 0.35, 32]} />
              <meshBasicMaterial color="#60a5fa" transparent opacity={0.7} side={2} />
            </mesh>
            <mesh
              ref={el => beamRefs.current[i] = el}
              position={beamPos} quaternion={quaternion}
              onPointerOver={(e) => { e.stopPropagation(); onHover(cities[i]); }}
              onPointerOut={(e) => { e.stopPropagation(); onHover(null); }}
            >
              <cylinderGeometry args={[0.04, 0.09, beamHeight, 8, 1, true]} />
              <meshBasicMaterial color="#60a5fa" transparent opacity={0.4} depthWrite={false} />
            </mesh>
            <mesh
              position={pos}
              onPointerOver={(e) => { e.stopPropagation(); onHover(cities[i]); }}
              onPointerOut={(e) => { e.stopPropagation(); onHover(null); }}
            >
              <sphereGeometry args={[0.14, 12, 12]} />
              <meshBasicMaterial color="#93c5fd" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// Arc pulse — a bright traveling bead on each arc line
function ArcPulse({ data, radius }) {
  const groupRef = useRef();
  const meshRef = useRef();

  const arcs = useMemo(() => {
    if (!data) return [];
    return data.map(d => ({
      from: latLngToVec3(d.startLat, d.startLng, radius),
      to: latLngToVec3(d.endLat, d.endLng, radius),
      color: d.color,
    }));
  }, [data, radius]);

  useFrame(({ clock }) => {
    if (!meshRef.current || !arcs.length) return;
    const idx = Math.floor((clock.elapsedTime * 0.3) % arcs.length);
    const arc = arcs[idx];
    const mid = new Vector3().addVectors(arc.from, arc.to).multiplyScalar(0.5);
    const dist = arc.from.distanceTo(arc.to);
    mid.normalize().multiplyScalar(radius + dist * 0.4);
    const t = (clock.elapsedTime * 0.5 + idx * 0.2) % 1;
    const p = new Vector3()
      .copy(arc.from).multiplyScalar((1 - t) * (1 - t))
      .add(mid.clone().multiplyScalar(2 * t * (1 - t)))
      .add(arc.to.clone().multiplyScalar(t * t));
    meshRef.current.position.copy(p);
    meshRef.current.material.color.set(arc.color);
  });

  if (!arcs.length) return null;

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshBasicMaterial color="#93c5fd" />
      </mesh>
    </group>
  );
}

export function Globe({ globeConfig, data, onHoverCity }) {
  const globeRef = useRef(null);
  const groupRef = useRef();
  const [isInitialized, setIsInitialized] = useState(false);

  const landData = useMemo(() => {
    const flat = [];
    for (const d of landDotsRaw) flat.push(d[0], d[1], d[2]);
    return flat;
  }, []);

  const defaultProps = {
    pointSize: 1, atmosphereColor: '#ffffff', showAtmosphere: true,
    atmosphereAltitude: 0.1, polygonColor: 'rgba(255,255,255,0.7)',
    globeColor: '#1d072e', emissive: '#000000', emissiveIntensity: 0.1,
    shininess: 0.9, arcTime: 2000, arcLength: 0.9, rings: 1, maxRings: 3,
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
    material.color = new Color('#041a3a');
    material.emissive = new Color('#0a2a5a');
    material.emissiveIntensity = 0.25;
    material.shininess = 0.2;
  }, [isInitialized]);

  useEffect(() => {
    if (!globeRef.current || !isInitialized || !data) return;

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
      .arcStroke(() => 0.28)
      .arcDashLength(defaultProps.arcLength)
      .arcDashInitialGap(e => e.order * 1)
      .arcDashGap(15)
      .arcDashAnimateTime(() => defaultProps.arcTime);

    globeRef.current.pointsData([]);
    globeRef.current.ringsData([]);
  }, [isInitialized, data, defaultProps]);

  useEffect(() => {
    if (!globeRef.current || !isInitialized || !data) return;
    const interval = setInterval(() => {
      if (!globeRef.current) return;
      const nums = genRandomNumbers(0, data.length, Math.floor((data.length * 4) / 5));
      const ringsData = data.filter((d, i) => nums.includes(i))
        .map(d => ({ lat: d.startLat, lng: d.startLng, color: '#60a5fa' }));
      globeRef.current.ringsData(ringsData);
    }, 2000);
    return () => clearInterval(interval);
  }, [isInitialized, data]);

  return (
    <group ref={groupRef}>
      <LandDots dataInput={landData} radius={5.01} />
      <CityBeacons data={data} radius={5.01} onHover={onHoverCity} />
      <ArcPulse data={data} radius={5.01} />
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

function CinematicIntro({ targetZ }) {
  const { camera } = useThree();
  const startedAt = useRef(null);
  useFrame((state) => {
    if (startedAt.current === null) startedAt.current = state.clock.elapsedTime;
    const t = Math.min(1, (state.clock.elapsedTime - startedAt.current) / 1.8);
    const eased = 1 - Math.pow(1 - t, 3);
    camera.position.z = (targetZ * 2.2) + (targetZ - targetZ * 2.2) * eased;
  });
  return null;
}

export function World({ globeConfig, data, onHoverCity }) {
  const scene = useMemo(() => {
    const s = new Scene();
    s.fog = new Fog(0x0a0000, 400, 2000);
    return s;
  }, []);

  return (
    <Canvas scene={scene} camera={new PerspectiveCamera(50, aspect, 180, 1800)} gl={{ antialias: true, alpha: false }}>
      <WebGLRendererConfig />
      <CinematicIntro targetZ={cameraZ} />
      <ambientLight color="#606090" intensity={0.8} />
      <directionalLight color="#ffffff" position={new Vector3(-400, 100, 400)} intensity={0.6} />
      <directionalLight color="#ffffff" position={new Vector3(400, -100, -400)} intensity={0.4} />
      <pointLight color="#ffffff" position={new Vector3(200, 200, 200)} intensity={0.5} />
      <Globe globeConfig={globeConfig} data={data} onHoverCity={onHoverCity} />
      <OrbitControls enablePan={false} enableZoom={false} minDistance={cameraZ} maxDistance={cameraZ}
        autoRotateSpeed={1} autoRotate={true} minPolarAngle={Math.PI / 3.5} maxPolarAngle={Math.PI - Math.PI / 3} />
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.9} luminanceThreshold={0.15} luminanceSmoothing={0.9} mipmapBlur radius={0.6} />
      </EffectComposer>
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
    arcs.push({
      order: 1, startLat: ORIGIN.lat, startLng: ORIGIN.lng,
      endLat: loc.lat, endLng: loc.lng,
      arcAlt: 0.25 + ratio * 0.55, color,
      city: loc.city, count: loc.count,
    });
  }
  return arcs;
}

export default function GlobePanel({ open, onClose, locations }) {
  const [mounted, setMounted] = useState(false);
  const [hoveredCity, setHoveredCity] = useState(null);

  useEffect(() => {
    if (open) setMounted(true);
    else { const t = setTimeout(() => setMounted(false), 500); return () => clearTimeout(t); }
  }, [open]);

  const globeConfig = useMemo(() => ({
    pointSize: 4, globeColor: '#021532', showAtmosphere: true, atmosphereColor: '#60a5fa',
    atmosphereAltitude: 0.12, emissive: '#021532', emissiveIntensity: 0.05, shininess: 0.6,
    polygonColor: 'rgba(255,255,255,0.7)', ambientLight: '#38bdf8', directionalLeftLight: '#ffffff',
    directionalTopLight: '#ffffff', pointLight: '#ffffff', arcTime: 2000, arcLength: 0.9,
    rings: 1, maxRings: 3, autoRotate: true, autoRotateSpeed: 0.5,
  }), []);

  const data = useMemo(() => (locations ? buildArcs(locations) : []), [locations]);
  const totalOrders = useMemo(() => (locations || []).reduce((s, l) => s + l.count, 0), [locations]);

  if (!mounted) return null;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 45%, rgba(10,20,50,0.75), rgba(0,0,0,0.85) 70%)',
      backdropFilter: 'blur(4px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '90vw', maxWidth: '1000px', height: '85vh', maxHeight: '700px',
        position: 'relative', overflow: 'hidden', borderRadius: '20px',
        background: 'radial-gradient(ellipse at 50% 30%, #0a1830 0%, #000 75%)',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '16px', right: '16px', zIndex: 10,
          width: '36px', height: '36px', borderRadius: '50%', border: 'none',
          background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer',
          fontSize: '18px', display: 'grid', placeItems: 'center', fontWeight: 600,
        }}>✕</button>

        <div style={{ position: 'absolute', top: '16px', left: '20px', zIndex: 10, color: '#fff' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, opacity: 0.9 }}>Our reach</div>
          <div style={{ fontSize: '13px', opacity: 0.5, marginTop: '2px' }}>
            {locations.length} cities · {totalOrders} orders · Brussels
          </div>
        </div>

        {hoveredCity && (
          <div style={{
            position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
            zIndex: 10, background: 'rgba(10,20,40,0.9)', border: '1px solid rgba(96,165,250,0.4)',
            borderRadius: '10px', padding: '8px 16px', color: '#fff', fontSize: '13px',
            display: 'flex', gap: '8px', alignItems: 'center', pointerEvents: 'none',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }} />
            <strong>{hoveredCity.city || 'Unknown city'}</strong>
            <span style={{ opacity: 0.6 }}>· {hoveredCity.count} order{hoveredCity.count === 1 ? '' : 's'}</span>
          </div>
        )}

        {open && <World globeConfig={globeConfig} data={data} onHoverCity={setHoveredCity} />}
      </div>
    </div>
  );
}
