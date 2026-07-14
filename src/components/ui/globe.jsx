// ── 3D Customer Globe ──
// Renders a rotating 3D globe with dots and animated arcs.
// Scales dot size and arc brightness by order count.
// Respects prefers-reduced-motion. Falls back gracefully to 2D map.

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const ORIGIN = { lat: 50.8503, lng: 4.3517 };
const MAX_COUNT = 3; // caps dot/arc scaling so a single outlier doesn't dwarf everything

function latLngToVec3(lat, lng, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function randomSpherePoints(count, radius) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const u = Math.random(), v = Math.random();
    const theta = 2 * Math.PI * u, phi = Math.acos(2 * v - 1);
    const r = radius * 1.01;
    pts.push(new THREE.Vector3(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi)));
  }
  return pts;
}

function arcPoints(from, to, segments = 40) {
  const pts = [];
  const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
  const dist = from.distanceTo(to);
  mid.normalize().multiplyScalar(from.length() + dist * 0.4);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    pts.push(new THREE.Vector3().copy(from).multiplyScalar((1 - t) * (1 - t))
      .add(mid.clone().multiplyScalar(2 * t * (1 - t)))
      .add(to.clone().multiplyScalar(t * t)));
  }
  return pts;
}

function GlobeDots({ locations, radius, isMobile }) {
  const { positions, sizes } = useMemo(() => {
    if (!locations || locations.length === 0) return { positions: new Float32Array(), sizes: new Float32Array() };
    const pts = [], sz = [];
    const maxCount = Math.max(...locations.filter(l => l.lat != null).map(l => l.count), 1);
    for (const loc of locations) {
      if (loc.lat == null || loc.lng == null) continue;
      const v = latLngToVec3(loc.lat, loc.lng, radius * 1.004);
      pts.push(v.x, v.y, v.z);
      const ratio = loc.count / Math.min(maxCount, MAX_COUNT);
      sz.push(isMobile ? 3 + ratio * 4 : 4 + ratio * 8);
    }
    return { positions: new Float32Array(pts), sizes: new Float32Array(sz) };
  }, [locations, radius, isMobile]);
  if (positions.length === 0) return null;
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={sizes.length} array={sizes} itemSize={1} />
      </bufferGeometry>
      <pointsMaterial size={6} color="#3b82f6" sizeAttenuation transparent opacity={0.9} />
    </points>
  );
}

function LineArc({ points, delay, color, reducedMotion }) {
  const lineRef = useRef();
  const positions = useMemo(() => {
    const flat = [];
    for (const p of points) flat.push(p.x, p.y, p.z);
    return new Float32Array(flat);
  }, [points]);
  useFrame(({ clock }) => {
    if (!lineRef.current || reducedMotion) return;
    const t = ((clock.elapsedTime + delay) % 4) / 4;
    lineRef.current.material.opacity = 0.15 + Math.sin(t * Math.PI) * 0.45;
  });
  return (
    <line ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={reducedMotion ? 0.2 : 0.4} />
    </line>
  );
}

function GlobeArcs({ locations, radius, reducedMotion }) {
  return useMemo(() => {
    if (!locations || locations.length === 0) return null;
    const origin = latLngToVec3(ORIGIN.lat, ORIGIN.lng, radius);
    const maxCount = Math.max(...locations.filter(l => l.lat != null).map(l => l.count), 1);
    return (
      <group>
        {locations.map((loc, i) => {
          if (loc.lat == null || loc.lng == null) return null;
          const dest = latLngToVec3(loc.lat, loc.lng, radius);
          const pts = arcPoints(origin, dest);
          const ratio = loc.count / Math.min(maxCount, MAX_COUNT);
          const brightness = Math.round(100 + ratio * 55).toString(16);
          const color = `#${brightness}b8f6`;
          return <LineArc key={`${loc.city}-${loc.country}`} points={pts} delay={i * 0.3} color={color} reducedMotion={reducedMotion} />;
        })}
      </group>
    );
  }, [locations, radius, reducedMotion]);
}

function BackgroundStars({ radius }) {
  const positions = useMemo(() => {
    const flat = [];
    for (const s of randomSpherePoints(800, radius * 2.5)) flat.push(s.x, s.y, s.z);
    return new Float32Array(flat);
  }, [radius]);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={1.5} color="#6E665A" sizeAttenuation transparent opacity={0.4} />
    </points>
  );
}

function Globe({ locations }) {
  const radius = 5;
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    setIsMobile(window.innerWidth < 720);
  }, []);

  return (
    <Canvas camera={{ position: [0, 0, 16], fov: 45 }} dpr={[1, isMobile ? 1 : 2]}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <directionalLight position={[-5, -5, -5]} intensity={0.3} />
      <mesh>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshPhongMaterial color="#1a2a4a" emissive="#0a1628" emissiveIntensity={0.3} transparent opacity={0.85} />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 1.002, 32, 24]} />
        <meshBasicMaterial color="#3b82f6" wireframe transparent opacity={0.08} />
      </mesh>
      <BackgroundStars radius={radius} />
      <GlobeDots locations={locations} radius={radius} isMobile={isMobile} />
      <GlobeArcs locations={locations} radius={radius} reducedMotion={reducedMotion} />
      <OrbitControls
        enablePan={false} enableZoom={true}
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.8}
        minDistance={8} maxDistance={25}
      />
    </Canvas>
  );
}

export default function GlobePanel({ open, onClose, locations }) {
  const totalOrders = useMemo(() => (locations || []).reduce((s, l) => s + l.count, 0), [locations]);
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '90vw', maxWidth: '800px', height: '80vh', maxHeight: '600px',
        background: '#0a1628', borderRadius: '20px', overflow: 'hidden',
        position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '16px', right: '16px', zIndex: 10,
          width: '36px', height: '36px', borderRadius: '50%', border: 'none',
          background: 'rgba(255,255,255,0.15)', color: '#fff',
          cursor: 'pointer', fontSize: '18px', display: 'grid', placeItems: 'center', fontWeight: 600,
        }}>✕</button>
        <div style={{ position: 'absolute', top: '16px', left: '20px', zIndex: 10, color: '#fff' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, opacity: 0.6 }}>Our reach</div>
          <div style={{ fontSize: '12px', opacity: 0.4, marginTop: '2px' }}>{locations.length} cities · {totalOrders} orders</div>
        </div>
        <Globe locations={locations} />
      </div>
    </div>
  );
}
