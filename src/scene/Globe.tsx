// src/scene/Globe.tsx
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useEffect, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useSimStore } from '../state/useSimStore'
import { vector3ToLatLon } from '../lib/kinematics'

export default function Globe() {
  const gRef = useRef<THREE.Mesh>(null!)
  const [map, setMap] = useState<THREE.Texture | null>(null)
  const [spec, setSpec] = useState<THREE.Texture | null>(null)

  const setTargetLatLon = useSimStore(s => s.setTargetLatLon)

  // lock picking while running, during quiz/impact map, or after impact
  const running = useSimStore(s => s.running)
  const quizVisible = useSimStore(s => s.quizVisible)
  const showImpactMap = useSimStore(s => s.showImpactMap)
  const hasImpacted = useSimStore(s => s.hasImpacted)

  const impactPickingLocked = running || quizVisible || showImpactMap || hasImpacted

  const { raycaster, camera, pointer } = useThree()

  // Try local textures first; if missing, fall back to CDN.
  useEffect(() => {
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')

    const loadWithFallback = (
      localUrl: string,
      cdnUrl: string,
      onLoad: (t: THREE.Texture | null) => void
    ) => {
      loader.load(
        localUrl,
        (t) => { t.colorSpace = THREE.SRGBColorSpace; onLoad(t) },
        undefined,
        () => {
          loader.load(
            cdnUrl,
            (t2) => { t2.colorSpace = THREE.SRGBColorSpace; onLoad(t2) },
            undefined,
            () => onLoad(null)
          )
        }
      )
    }

    loadWithFallback(
      '/earth_base.jpg',
      'https://cdn.jsdelivr.net/npm/three-globe@2.30.0/example/img/earth-blue-marble.jpg',
      (t) => setMap(t)
    )
    loadWithFallback(
      '/earth_spec.jpg',
      'https://cdn.jsdelivr.net/npm/three-globe@2.30.0/example/img/earth-night.jpg',
      (t) => setSpec(t)
    )
  }, [])

  const handleGlobeClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()

    // hard lock: ignore any attempt to change impact when sim is active or blocked
    if (impactPickingLocked) return

    // R3F already gives us the hit point in world coords
    // Convert to globe-local unit vector for stable lat/lon
    const localOnUnit = event.object.worldToLocal(event.point.clone()).normalize()

    const { lat, lon } = vector3ToLatLon(localOnUnit)

    setTargetLatLon(lat, lon)

    // Debug
    // console.log(`Target set to: ${lat.toFixed(2)}°, ${lon.toFixed(2)}°`)
  }

  const material = map
    ? (
      <meshPhongMaterial
        map={map || undefined}
        specularMap={spec || undefined}
        shininess={30}
        specular={new THREE.Color('#66aaff')}
        emissive={new THREE.Color('#224466')}
        emissiveIntensity={0.35}
      />
    )
    : (
      <meshStandardMaterial color="#2b6cff" metalness={0.1} roughness={0.6} />
    )

  return (
    <>
      <color attach="background" args={['#02050b']} />

      {/* --- Lighting Setup --- */}
      <ambientLight intensity={3} />
      <directionalLight position={[5, 3, 5]} intensity={3} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <directionalLight position={[-4, -2, -4]} intensity={0.5} color="#4477ff" />
      <pointLight position={[0, 0, -6]} intensity={0.3} color="#88ccff" />

      {/* --- Earth mesh --- */}
      <mesh
        ref={gRef}
        castShadow
        receiveShadow
        // disable handler entirely when locked (extra safety)
        onClick={impactPickingLocked ? undefined : handleGlobeClick}
      >
        <sphereGeometry args={[1, 128, 128]} />
        {material}
      </mesh>

      {/* Thin atmosphere shell */}
      <mesh scale={1.02}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial color="#66ccff" transparent opacity={0.15} side={THREE.BackSide} />
      </mesh>

      {/* Controls (camera only; impact picking is locked separately) */}
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={1.6}
        maxDistance={10}
        rotateSpeed={0.6}
      />
    </>
  )
}
