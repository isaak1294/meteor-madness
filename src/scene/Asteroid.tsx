// src/scene/Asteroid.tsx
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Trail } from '@react-three/drei'
import { useEffect, useState, useRef, useMemo } from 'react'
import { useSimStore } from '../state/useSimStore'
import { latLonToVector3, simplePathAtTime } from '../lib/kinematics'

const VISUAL_SCALE = 0.2 // <-- 1/5 size

const isFiniteVec3 = (v: THREE.Vector3) =>
  Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)

export default function Asteroid() {
  // sim state
  const time = useSimStore(s => s.time)
  const duration = useSimStore(s => s.duration)
  const size = useSimStore(s => s.size)
  const speed = useSimStore(s => s.speed)
  const approach = useSimStore(s => s.approachAngle)
  const mitigation = useSimStore(s => s.mitigation)
  const mitigationPower = useSimStore(s => s.mitigationPower)
  const leadTime = useSimStore(s => s.leadTime)
  const running = useSimStore(s => s.running)

  // target
  const targetLat = useSimStore(s => s.targetLat)
  const targetLon = useSimStore(s => s.targetLon)
  const useTargetImpact = useSimStore(s => s.useTargetImpact)
  const setImpactLatLon = useSimStore(s => s.setImpactLatLon)

  const { isShaking, shakeIntensity } = useSimStore(s => ({
    isShaking: s.isShaking,
    shakeIntensity: s.shakeIntensity
  }))

  // asset
  const [asteroidTexture, setAsteroidTexture] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    const loader = new THREE.TextureLoader()
    loader.load('/meteor.jpg', (texture) => {
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      setAsteroidTexture(texture)
    })
  }, [])

  // refs
  const groupRef = useRef<THREE.Group>(null!)
  const coreRef = useRef<THREE.Mesh>(null!)
  const glowRef = useRef<THREE.Mesh>(null!)
  const lightRef = useRef<THREE.PointLight>(null!)

  // shock shell
  const shockRef = useRef<THREE.Mesh>(null!)
  const shockMatRef = useRef<THREE.ShaderMaterial>(null!)

  // crater refs
  const craterGroupRef = useRef<THREE.Group>(null!)
  const craterMeshRef = useRef<THREE.Mesh>(null!)

  const { camera } = useThree()

  // easing for flame visibility near atmosphere
  const flameFactorRef = useRef(0)

  // final impact lat/lon (sticky once known)
  const impactLatRef = useRef<number | null>(null)
  const impactLonRef = useRef<number | null>(null)

  // ---------- SHADERS ----------
  const commonNoise = `
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f*f*(3.0-2.0*f);
      return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    float fbm(vec2 p){
      float v = 0.0;
      float a = 0.5;
      for(int i=0; i<5; i++){ v += a * noise(p); p *= 2.0; a *= 0.5; }
      return v;
    }
  `

  const shockMaterial = useMemo(() => {
    const v = `
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main(){
        vNormal = normalize(normalMatrix * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `
    const f = `
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      uniform float u_time;
      uniform float u_intensity;
      uniform vec3  u_camPos;
      uniform vec3 u_hot, u_mid, u_cool;
      ${commonNoise}
      void main(){
        vec3 V = normalize(u_camPos - vWorldPos);
        float fres = pow(1.0 - max(dot(normalize(vNormal), V), 0.0), 3.0);
        float front = clamp(vNormal.z * 0.5 + 0.5, 0.0, 1.0);
        float t = u_time * (1.2 + 1.6*u_intensity);
        vec2 flow = vec2(vNormal.x*2.0, vNormal.y*2.0 - t);
        float n = fbm(flow);
        float body = mix(0.3, 1.0, front) * (0.7 + 0.3*n);
        float alpha = (0.25 + 0.75*fres) * body * (0.75 + 0.25*u_intensity);
        vec3 col = mix(u_mid, u_hot, front);
        col = mix(col, u_cool, fres*0.6);
        col *= (1.0 + 0.7*u_intensity);
        gl_FragColor = vec4(col, alpha);
      }
    `
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        u_time: { value: 0 },
        u_intensity: { value: 0 },
        u_camPos: { value: new THREE.Vector3() },
        u_hot: { value: new THREE.Color('#fff2b0') },
        u_mid: { value: new THREE.Color('#ff7a2a') },
        u_cool: { value: new THREE.Color('#ff3200') },
      },
      vertexShader: v,
      fragmentShader: f,
    })
  }, [])

  useEffect(() => { shockMatRef.current = shockMaterial }, [shockMaterial])

  useFrame((_state, dt) => {
    // path & pose
    const { impactLat, impactLon } = simplePathAtTime({
      time, duration, approachAngleDeg: approach, leadTime,
      mitigation, mitigationPower, targetLat, targetLon,
      lockToTarget: useTargetImpact,
    })
    setImpactLatLon(impactLat, impactLon)

    // remember final impact for crater placement
    impactLatRef.current = impactLat
    impactLonRef.current = impactLon

    const end = latLonToVector3(impactLat, impactLon, 1.02)
    const n = end.clone().normalize()
    let t = new THREE.Vector3().crossVectors(n, new THREE.Vector3(0, 1, 0))
    if (t.lengthSq() < 1e-6) t = new THREE.Vector3().crossVectors(n, new THREE.Vector3(1, 0, 0))
    t.normalize()
    const b = new THREE.Vector3().crossVectors(n, t).normalize()
    const theta = THREE.MathUtils.degToRad(approach)
    const dir = t.clone().multiplyScalar(Math.cos(theta)).addScaledVector(b, Math.sin(theta)).normalize()
    const start = n.clone().multiplyScalar(3.2).addScaledVector(dir, 1.0)
    const mid = n.clone().multiplyScalar(2.2).addScaledVector(dir, 0.5)
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end)

    const tNorm = Math.min(1, Math.max(0, time / duration))
    const pos = curve.getPoint(tNorm)

    // Impact flag
    const impacted = time >= duration

    // Update asteroid transform only while in-flight
    if (!impacted && groupRef.current) {
      groupRef.current.position.copy(pos)

      let tan = curve.getTangent(tNorm)
      if (!isFiniteVec3(tan) || tan.lengthSq() === 0) tan.set(0, 0, 1)
      tan.normalize()
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan)
      groupRef.current.quaternion.copy(q)
    }

    // spin only while visible
    if (!impacted && coreRef.current) {
      coreRef.current.rotation.x += dt * 1.2
      coreRef.current.rotation.y += dt * 0.8
    }

    // ---- VISUAL SCALING (1/5 size) ----
    const sizeScale = (size / 120) * VISUAL_SCALE

    // heat/lighting (zero after impact)
    const r = pos.length()
    const heat = impacted ? 0 : THREE.MathUtils.clamp(1 - (r - 1.0) / 0.5, 0, 1)
    const speedNorm = THREE.MathUtils.clamp((speed - 5) / 65, 0, 1)
    const baseGlowScale = sizeScale
    const heatGlowScale = 1 + THREE.MathUtils.lerp(0.05, 0.35, heat)
    const glowScale = baseGlowScale * heatGlowScale

    if (glowRef.current) {
      glowRef.current.visible = !impacted
      if (!impacted) {
        glowRef.current.scale.setScalar(glowScale)
        const mat = glowRef.current.material as THREE.MeshBasicMaterial
        mat.opacity = THREE.MathUtils.lerp(0.0, 0.9, heat * (0.6 + speedNorm * 0.4))
      }
    }
    if (lightRef.current) {
      lightRef.current.visible = !impacted
      if (!impacted) {
        lightRef.current.intensity = THREE.MathUtils.lerp(0.0, 10.0, heat)
        lightRef.current.distance = THREE.MathUtils.lerp(0.0, 3.5, heat)
      }
    }

    // atmosphere gating + easing (shock only)
    const beforeImpact = time < duration
    const inAtmosphere = heat > 0.02
    const growRate = 1.2 + 1.8 * heat
    const decayRate = 2.0
    const target = (!impacted && beforeImpact && inAtmosphere) ? 1 : 0
    const f = flameFactorRef.current
    const rate = target > f ? growRate : decayRate
    flameFactorRef.current = THREE.MathUtils.clamp(f + (target - f) * (1 - Math.exp(-rate * dt)), 0, 1)
    const flameFactor = flameFactorRef.current

    // intensity for shock shell
    const physIntensity = THREE.MathUtils.clamp(0.45 * speedNorm + 0.65 * heat, 0, 1)
    const visIntensity = physIntensity * flameFactor

    // shock shell update (scaled via sizeScale)
    if (shockMatRef.current && shockRef.current) {
      shockRef.current.visible = !impacted && flameFactor > 0.01
      if (shockRef.current.visible) {
        shockMatRef.current.uniforms.u_time.value += dt
        shockMatRef.current.uniforms.u_intensity.value = visIntensity
          ; (shockMatRef.current.uniforms.u_camPos.value as THREE.Vector3).copy(camera.position)
        const wrap = 0.11 * sizeScale * (0.85 + 0.45 * flameFactor) * (1.0 + 0.3 * heat)
        shockRef.current.scale.setScalar(wrap / 0.11)
      }
    }

    // Keep shake even after impact
    if (isShaking && shakeIntensity > 0) {
      const shake = shakeIntensity * 0.02
      camera.position.x += (Math.random() - 0.5) * shake
      camera.position.y += (Math.random() - 0.5) * shake
    }

    // ---- CRATER SIZE (red circle) scaled 1/5 ----
    const asteroidRadius = 0.06 * sizeScale

    if (craterGroupRef.current) {
      if (impacted && impactLatRef.current != null && impactLonRef.current != null) {
        const hit = latLonToVector3(impactLatRef.current, impactLonRef.current, 1.001) // just above surface
        const nrm = hit.clone().normalize()
        craterGroupRef.current.position.copy(hit)

        // orient crater plane so its +Z faces outward (align with normal)
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm)
        craterGroupRef.current.quaternion.copy(quat)

        craterGroupRef.current.visible = true
        craterGroupRef.current.scale.setScalar(asteroidRadius) // 1/5 size via sizeScale
      } else {
        craterGroupRef.current.visible = false
      }
    }

    // Hide the entire asteroid group once impacted
    if (groupRef.current) {
      groupRef.current.visible = !impacted
    }
  })

  return (
    <>
      {/* Asteroid and trail (hidden after impact) */}
      <group ref={groupRef}>
        {/* history trail only when running; width scales with meteor size (1/5) */}
        {running && (
          <Trail
            width={0.12 * (size / 120) * VISUAL_SCALE}
            length={9}
            color="#ffd9a6"
            attenuation={(t) => t}
          >
            <group>
              <pointLight ref={lightRef} color={'#ffb07a'} intensity={0} distance={0} />
              <mesh ref={coreRef} castShadow>
                {/* core radius 1/5 */}
                <icosahedronGeometry args={[0.06 * (size / 120) * VISUAL_SCALE, 2]} />
                <meshStandardMaterial
                  map={asteroidTexture || undefined}
                  color={asteroidTexture ? '#ffffff' : '#6a6a6a'}
                  roughness={0.95}
                  metalness={0.0}
                  bumpMap={asteroidTexture || undefined}
                  bumpScale={0.005}
                />
              </mesh>
              {/* glow shell auto-scales in frame via sizeScale; base geo can stay the same */}
              <mesh ref={glowRef}>
                <sphereGeometry args={[0.09, 32, 32]} />
                <meshBasicMaterial
                  color={'#ff8a00'}
                  transparent
                  opacity={0.0}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
            </group>
          </Trail>
        )}

        {/* shock shell only (no cone) */}
        <mesh ref={shockRef}>
          <sphereGeometry args={[0.11, 32, 32]} />
          <primitive object={shockMaterial} attach="material" />
        </mesh>
      </group>

      {/* Crater marker: red disc sized to asteroid contact area (1/5) */}
      <group ref={craterGroupRef} visible={false}>
        <mesh ref={craterMeshRef}>
          <circleGeometry args={[1, 64]} />
          <meshBasicMaterial
            color="#ff0000"
            transparent
            opacity={0.85}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh>
          <ringGeometry args={[1.0, 1.15, 64]} />
          <meshBasicMaterial
            color="#ff4444"
            transparent
            opacity={0.4}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </>
  )
}
