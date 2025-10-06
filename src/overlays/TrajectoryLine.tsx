import { useMemo } from 'react'
import { useSimStore } from '../state/useSimStore'
import { latLonToVector3 } from '../lib/kinematics'
import * as THREE from 'three'

export default function TrajectoryLine() {
  const { 
    time, 
    duration, 
    approach, 
    targetLat,
    targetLon
  } = useSimStore(s => ({
    time: s.time,
    duration: s.duration,
    approach: s.approachAngle,
    targetLat: s.targetLat,
    targetLon: s.targetLon
  }))

  const trajectoryPoints = useMemo(() => {
    const points: THREE.Vector3[] = []
    const segments = 50
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      
      // Use the user-selected target location
      const impactLat = targetLat
      const impactLon = targetLon
      
      // Create trajectory points
      const startDistance = 4.0
      const startAngle = (approach - 45) * Math.PI / 180
      const start = new THREE.Vector3(
        startDistance * Math.cos(startAngle),
        startDistance * Math.sin(startAngle) * 0.3,
        startDistance * Math.sin(startAngle) * 0.7
      )
      
      const end = latLonToVector3(impactLat, impactLon, 1.01)
      
      // Create control points for realistic orbital trajectory
      const controlPoints = []
      controlPoints.push(start)
      
      // Early control point
      const t1 = 0.3
      const earlyPoint = start.clone().lerp(end, t1)
      const earlyDistance = earlyPoint.length()
      const minOrbitalDistance = 1.8
      if (earlyDistance < minOrbitalDistance) {
        const direction = earlyPoint.clone().normalize()
        earlyPoint.copy(direction.multiplyScalar(minOrbitalDistance))
      }
      controlPoints.push(earlyPoint)
      
      // Midpoint
      let midPoint = start.clone().add(end).multiplyScalar(0.5)
      const distanceFromEarth = midPoint.length()
      if (distanceFromEarth < minOrbitalDistance) {
        const direction = midPoint.clone().normalize()
        midPoint.copy(direction.multiplyScalar(minOrbitalDistance))
      }
      
      const angleRad = (approach - 45) * Math.PI / 180
      const orbitalVariation = Math.sin(angleRad) * 0.4
      const trajectoryDirection = end.clone().sub(start).normalize()
      const perpendicular = new THREE.Vector3(-trajectoryDirection.z, 0, trajectoryDirection.x).normalize()
      midPoint.add(perpendicular.multiplyScalar(orbitalVariation))
      
      const verticalVariation = Math.cos(angleRad) * 0.2
      midPoint.y += verticalVariation
      
      controlPoints.push(midPoint)
      
      // Late control point
      const t2 = 0.7
      const latePoint = start.clone().lerp(end, t2)
      const lateDistance = latePoint.length()
      if (lateDistance < minOrbitalDistance) {
        const direction = latePoint.clone().normalize()
        latePoint.copy(direction.multiplyScalar(minOrbitalDistance))
      }
      controlPoints.push(latePoint)
      
      controlPoints.push(end)
      
      // Create curve and sample points
      const curve = new THREE.CatmullRomCurve3(controlPoints, false, 'catmullrom', 0.1)
      const curvePoint = curve.getPoint(t)
      points.push(curvePoint)
    }
    
    return points
  }, [time, duration, approach, targetLat, targetLon])

  if (trajectoryPoints.length === 0) return null

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={trajectoryPoints.length}
          array={new Float32Array(trajectoryPoints.flatMap(p => [p.x, p.y, p.z]))}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial 
        color="#66e0ff" 
        transparent 
        opacity={0.6} 
        linewidth={2}
        depthTest={false}
      />
    </line>
  )
}
