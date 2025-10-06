import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { useSimStore } from '../state/useSimStore'

export default function CameraRig(){
  const { camera } = useThree()
  const target = useRef(new THREE.Vector3(0,0,0))
  const getAsteroidPos = () => {
    // We don’t have a global ref, but we know the asteroid group lives at:
    // position length ~ [0..~3]. We’ll infer a target distance by time progress:
    const t = useSimStore.getState().time / useSimStore.getState().duration
    // Start far, end near Earth surface
    const far = 3.2, near = 1.6
    const desiredDistance = THREE.MathUtils.lerp(far, near, t)
    return { desiredDistance }
  }

  useFrame((_s, dt) => {
    // Gentle orbit around Earth for a nice angle
    const t = performance.now() * 0.00008
    const orbitAz = Math.sin(t) * 0.6
    const orbitEl = 0.25 + Math.sin(t * 0.7) * 0.1

    const { desiredDistance } = getAsteroidPos()
    const dist = THREE.MathUtils.damp(camera.position.length(), desiredDistance, 2.5, dt)

    // Convert spherical to Cartesian
    const x = dist * Math.cos(orbitEl) * Math.cos(orbitAz)
    const y = dist * Math.sin(orbitEl)
    const z = dist * Math.cos(orbitEl) * Math.sin(orbitAz)

    camera.position.x = THREE.MathUtils.damp(camera.position.x, x, 3, dt)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, y, 3, dt)
    camera.position.z = THREE.MathUtils.damp(camera.position.z, z, 3, dt)

    // Always look at Earth center for context
    camera.lookAt(target.current)
  })

  return null
}
