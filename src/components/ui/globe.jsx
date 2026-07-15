// ── Aceternity-style 3D Globe (three-globe) — Final ──
//
// Continent dots are sampled from the GeoJSON polygon data, so they
// perfectly align with the country border lines drawn by CountryBorders.

import { useEffect, useRef, useState, useMemo } from 'react';
import { Color, Fog, Vector3, Quaternion } from 'three';
import ThreeGlobe from 'three-globe';
import { useThree, Canvas, extend, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import countries from '../../data/countries.json';

extend({ ThreeGlobe: ThreeGlobe });

const aspect = 1.2;
const cameraZ = 300;
const ORIGIN = { lat: 50.8503, lng: 4.3517 };
const COLORS = ['#c8d6e5', '#8395a7', '#576574'];
const LAND_DOT_COUNT = 6000;
const LAND_CHECK_SAMPLES = 80000;

function latLngToVec3(lat, lng, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (90 - lng) * (Math.PI / 180);
  return new Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

// Ray-casting point-in-polygon test for a single ring
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Check if a point is inside a GeoJSON feature (handles Polygon and MultiPolygon with holes)
function pointInFeature(lng, lat, feature) {
  const geom = feature.geometry;
  if (!geom) return false;
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  for (const poly of polys) {
    const outerRing = poly[0];
    if (!outerRing || outerRing.length < 3) continue;
    if (!pointInRing(lng, lat, outerRing)) continue;
    // Check holes (inner rings)
    let inHole = false;
    for (let h = 1; h < poly.length; h++) {
      if (pointInRing(lng, lat, poly[h])) { inHole = true; break; }
    }
    if (!inHole) return true;
  }
  return false;
}

// Sample random points inside all country polygons
function sampleLandPoints(count, checkSamples, radius) {
  const pts = [];
  const features = countries.features;
  // Compute global bounding box
  let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
  for (const f of features) {
    const geom = f.geometry;
    if (!geom) continue;
    const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
    for (const poly of polys) {
      for (const ring of poly) {
        for (const coord of ring) {
          const [lng, lat] = coord;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
      }
    }
  }

  // Rejection sampling: generate random points, keep ones inside any country
  let attempts = 0;
  while (pts.length < count && attempts < checkSamples) {
    attempts++;
    const lng = minLng + Math.random() * (maxLng - minLng);
    const lat = minLat + Math.random() * (maxLat - minLat);
    for (const feature of features) {
      if (pointInFeature(lng, lat, feature)) {
        const v = latLngToVec3(lat, lng, radius * 1.002);
        pts.push(v.x, v.y, v.z);
        break;
      }
    }
  }
  return new Float32Array(pts);
}

function Starfield({ radius, count = 3000 }) {
  const groupRef = useRef();
  const speeds = useMemo(() => Array.from({ length: 3 }, () => 0.2 + Math.random() * 0.4), []);

  const layers = useMemo(() => {
    return [0, 1, 2].map(layer => {
      const pts = [];
      const c = Math.floor(count / 3);
      for (let i = 0; i < c; i++) {
        const u = Math.random(), v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const r = radius * (1.2 + Math.random() * 1.8 + layer * 0.6);
        pts.push(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
      }
      return new Float32Array(pts);
    });
  }, [radius, count]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      const t = clock.elapsedTime * speeds[i];
      child.material.opacity = 0.5 + Math.sin(t) * 0.4;
      const s = 0.6 + Math.sin(t * 0.7 + 1) * 0.3;
      child.material.size = Math.max(0.2, s);
    });
  });

  return (
    <group ref={groupRef}>
      {layers.map((positions, i) => (
        <points key={i}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial
            size={0.8} color="#ffffff" sizeAttenuation transparent opacity={0.7}
          />
        </points>
      ))}
    </group>
  );
}

// Continent fill — dots sampled from GeoJSON, perfectly aligned with borders
function LandDots({ radius }) {
  const positions = useMemo(() => sampleLandPoints(LAND_DOT_COUNT, LAND_CHECK_SAMPLES, radius), [radius]);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.7} color="#d0dce8" sizeAttenuation transparent opacity={0.8} depthTest={true} />
    </points>
  );
}

// Country border lines from GeoJSON polygon edges
function CountryBorders({ radius }) {
  const lines = useMemo(() => {
    const allLines = [];
    const R = radius;
    for (const feature of countries.features) {
      const geom = feature.geometry;
      if (!geom) continue;
      const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
      for (const poly of polys) {
        for (const ring of poly) {
          if (ring.length < 3) continue;
          const pts = [];
          for (const coord of ring) {
            const [lng, lat] = coord;
            const phi = (90 - lat) * (Math.PI / 180);
            const theta = (90 - lng) * (Math.PI / 180);
            pts.push(
              R * Math.sin(phi) * Math.cos(theta),
              R * Math.cos(phi),
              R * Math.sin(phi) * Math.sin(theta),
            );
          }
          allLines.push(new Float32Array(pts));
        }
      }
    }
    return allLines;
  }, [radius]);

  return (
    <group>
      {lines.map((pts, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={pts.length / 3} array={pts} itemSize={3} />
          </bufferGeometry>
          <lineBasicMaterial color="#5a6a7a" transparent opacity={0.4} />
        </line>
      ))}
    </group>
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
              <ringGeometry args={[0.3, 0.5, 32]} />
              <meshBasicMaterial color="#c8d6e5" transparent opacity={1.0} side={2} />
            </mesh>
            <mesh
              ref={el => beamRefs.current[i] = el}
              position={beamPos} quaternion={quaternion}
              onPointerOver={(e) => { e.stopPropagation(); onHover(cities[i]); }}
              onPointerOut={(e) => { e.stopPropagation(); onHover(null); }}
            >
              <cylinderGeometry args={[0.1, 0.2, beamHeight, 8, 1, true]} />
              <meshBasicMaterial color="#c8d6e5" transparent opacity={1.0} depthWrite={false} />
            </mesh>
            <mesh
              position={pos}
              onPointerOver={(e) => { e.stopPropagation(); onHover(cities[i]); }}
              onPointerOut={(e) => { e.stopPropagation(); onHover(null); }}
            >
              <sphereGeometry args={[0.8, 20, 20]} />
              <meshBasicMaterial color="#e2e8f0" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export function Globe({ globeConfig, data, onHoverCity }) {
  const globeRef = useRef(null);
  const groupRef = useRef();
  const [isInitialized, setIsInitialized] = useState(false);

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

    // Country borders are rendered via R3F CountryBorders/LandDots below
    // — no hex polygon setup needed from three-globe.

    try {
      globeRef.current
        .arcsData(data)
        .arcStartLat(d => d.startLat)
        .arcStartLng(d => d.startLng)
        .arcEndLat(d => d.endLat)
        .arcEndLng(d => d.endLng)
        .arcColor(e => e.color)
        .arcAltitudeAutoScale(0.35)
        .arcStroke(() => 0.28)
        .arcDashLength(defaultProps.arcLength)
        .arcDashInitialGap(e => e.order * 1)
        .arcDashGap(15)
        .arcDashAnimateTime(() => defaultProps.arcTime);
    } catch (err) {
      console.error('[Globe] Failed to set arcs data:', err);
    }

    globeRef.current.pointsData([]);
    globeRef.current.ringsData([]);
  }, [isInitialized, data, defaultProps]);

  return (
    <group ref={groupRef}>
      <LandDots radius={100} />
      <CountryBorders radius={100} />
      <CityBeacons data={data} radius={100} onHover={onHoverCity} />
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

function ZoomHandler() {
  const { camera } = useThree();

  useEffect(() => {
    const handler = (e) => {
      const dir = new Vector3().copy(camera.position);
      const dist = dir.length();
      const newDist = Math.max(104, Math.min(600, dist - dist * 0.2 * e.detail));
      dir.normalize().multiplyScalar(newDist);
      camera.position.copy(dir);
    };
    window.addEventListener('globe-zoom', handler);
    return () => window.removeEventListener('globe-zoom', handler);
  }, [camera]);

  return null;
}

export function World({ globeConfig, data, onHoverCity }) {
  return (
    <Canvas
      camera={{ position: [0, 0, cameraZ], fov: 50, aspect, near: 1, far: 1800 }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ scene }) => { scene.fog = new Fog(0x0a0000, 400, 2000); }}>
      <WebGLRendererConfig />
      <ZoomHandler />
      <ambientLight color="#606090" intensity={0.8} />
      <directionalLight color="#ffffff" position={new Vector3(-400, 100, 400)} intensity={0.6} />
      <directionalLight color="#ffffff" position={new Vector3(400, -100, -400)} intensity={0.4} />
      <pointLight color="#ffffff" position={new Vector3(200, 200, 200)} intensity={0.5} />
      <Globe globeConfig={globeConfig} data={data} onHoverCity={onHoverCity} />
      <Starfield radius={cameraZ} count={3000} />
      <OrbitControls makeDefault enablePan={false} enableZoom={true} zoomSpeed={0.8}
        minDistance={104} maxDistance={600}
        enableRotate={true} rotateSpeed={0.8}
        enableDamping dampingFactor={0.08} />
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.2} luminanceThreshold={0.3} luminanceSmoothing={0.9} mipmapBlur radius={0.3} />
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
      color, city: loc.city, count: loc.count,
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
    pointSize: 4, globeColor: '#021532', showAtmosphere: false,
    atmosphereColor: '#3b82f6', atmosphereAltitude: 0.01,
    emissive: '#021532', emissiveIntensity: 0.05, shininess: 0.6,
    polygonColor: 'transparent', ambientLight: '#38bdf8',
    directionalLeftLight: '#ffffff', directionalTopLight: '#ffffff',
    pointLight: '#ffffff', arcTime: 2000, arcLength: 0.9,
    rings: 1, maxRings: 3, autoRotate: false, autoRotateSpeed: 0,
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

        <div style={{
          position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)',
          zIndex: 10, display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          <button onClick={() => window.dispatchEvent(new CustomEvent('globe-zoom', { detail: 1 }))} style={{
            width: '40px', height: '40px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer',
            fontSize: '22px', display: 'grid', placeItems: 'center', fontWeight: 400, lineHeight: 1,
            backdropFilter: 'blur(4px)', userSelect: 'none',
          }}>+</button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('globe-zoom', { detail: -1 }))} style={{
            width: '40px', height: '40px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer',
            fontSize: '22px', display: 'grid', placeItems: 'center', fontWeight: 400, lineHeight: 1,
            backdropFilter: 'blur(4px)', userSelect: 'none',
          }}>−</button>
        </div>

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
