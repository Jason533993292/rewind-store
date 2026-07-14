// ── 3D Customer Globe ──
// Renders a rotating 3D globe with dots for customer cities
// and animated arcs from Brussels to each city.
// Click anywhere outside the globe to close.

import React, { useRef, useMemo, useCallback, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// Warehouse (Brussels)
const ORIGIN = { lat: 50.8503, lng: 4.3517 };

function latLngToVec3(lat, lng, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

// Generate evenly-spaced points on the sphere surface (stars background)
function randomSpherePoints(count, radius) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = radius * 1.01;
    pts.push(new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi),
    ));
  }
  return pts;
}

// Generate arc points between two 3D positions
function arcPoints(from, to, segments = 40) {
  const pts = [];
  const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
  const dist = from.distanceTo(to);
  mid.normalize().multiplyScalar(from.length() + dist * 0.4);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = new THREE.Vector3()
      .copy(from).multiplyScalar((1 - t) * (1 - t))
      .add(mid.clone().multiplyScalar(2 * t * (1 - t)))
      .add(to.clone().multiplyScalar(t * t));
    pts.push(p);
  }
  return pts;
}

function GlobeDots({ locations, radius }) {
  const dotsRef = useRef();
  const positions = useMemo(() => {
    if (!locations || locations.length === 0) return new Float32Array();
    const pts = [];
    for (const loc of locations) {
      if (loc.lat == null || loc.lng == null) continue;
      const v = latLngToVec3(loc.lat, loc.lng, radius * 1.004);
      pts.push(v.x, v.y, v.z);
    }
    return new Float32Array(pts);
  }, [locations, radius]);

  if (positions.length === 0) return null;

  return (
    <points ref={dotsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={8} color="#3b82f6" sizeAttenuation transparent opacity={0.9} />
    </points>
  );
}

function GlobeArcs({ locations, radius, startColor, endColor }) {
  const groupRef = useRef();
  const [hovered, setHovered] = useState(null);

  return useMemo(() => {
    if (!locations || locations.length === 0) return null;
    const origin = latLngToVec3(ORIGIN.lat, ORIGIN.lng, radius);

    return (
      <group ref={groupRef}>
        {locations.map((loc, i) => {
          if (loc.lat == null || loc.lng == null) return null;
          const dest = latLngToVec3(loc.lat, loc.lng, radius);
          const pts = arcPoints(origin, dest);
          const key = `${loc.city}-${loc.country}`;

          return (
            <LineArc key={key} points={pts} delay={i * 0.3} color="#3b82f6" />
          );
        })}
      </group>
    );
  }, [locations, radius]);
}

function LineArc({ points, delay, color }) {
  const lineRef = useRef();

  const positions = useMemo(() => {
    const flat = [];
    for (const p of points) flat.push(p.x, p.y, p.z);
    return new Float32Array(flat);
  }, [points]);

  useFrame(({ clock }) => {
    if (!lineRef.current) return;
    const t = ((clock.elapsedTime + delay) % 4) / 4; // 4 second cycle
    const idx = Math.floor(t * (points.length - 1));
    // Fade based on position along arc
    const opacity = 0.15 + Math.sin(t * Math.PI) * 0.45;
    lineRef.current.material.opacity = opacity;
  });

  return (
    <line ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={0.4} linewidth={1} />
    </line>
  );
}

function BackgroundStars({ radius }) {
  const stars = useMemo(() => randomSpherePoints(800, radius * 2.5), [radius]);
  const positions = useMemo(() => {
    const flat = [];
    for (const s of stars) flat.push(s.x, s.y, s.z);
    return new Float32Array(flat);
  }, [stars]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={1.5} color="#6E665A" sizeAttenuation transparent opacity={0.4} />
    </points>
  );
}

function Globe({ locations }) {
  const radius = 5;

  return (
    <Canvas camera={{ position: [0, 0, 16], fov: 45 }} dpr={[1, 2]}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <directionalLight position={[-5, -5, -5]} intensity={0.3} />

      {/* The sphere */}
      <mesh>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshPhongMaterial
          color="#1a2a4a"
          emissive="#0a1628"
          emissiveIntensity={0.3}
          transparent
          opacity={0.85}
          wireframe={false}
        />
      </mesh>

      {/* Wireframe overlay for country-like grid */}
      <mesh>
        <sphereGeometry args={[radius * 1.002, 32, 24]} />
        <meshBasicMaterial color="#3b82f6" wireframe transparent opacity={0.08} />
      </mesh>

      <BackgroundStars radius={radius} />
      <GlobeDots locations={locations} radius={radius} />
      <GlobeArcs locations={locations} radius={radius} />

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        autoRotate
        autoRotateSpeed={0.8}
        minDistance={8}
        maxDistance={25}
      />
    </Canvas>
  );
}

// ── Panel wrapper ──
export default function GlobePanel({ open, onClose, locations }) {
  const totalOrders = useMemo(
    () => (locations || []).reduce((s, l) => s + l.count, 0),
    [locations]
  );

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
          cursor: 'pointer', fontSize: '18px', display: 'grid', placeItems: 'center',
          fontWeight: 600,
        }}>✕</button>

        <div style={{ position: 'absolute', top: '16px', left: '20px', zIndex: 10, color: '#fff' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, opacity: 0.6 }}>Our reach</div>
          <div style={{ fontSize: '12px', opacity: 0.4, marginTop: '2px' }}>
            {locations.length} cities · {totalOrders} orders
          </div>
        </div>

        <Globe locations={locations} />
      </div>
    </div>
  );
}
