import * as THREE from 'three'
import { Mitigation } from '../state/useSimStore'

export function latLonToVector3(lat: number, lon: number, radius = 1) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  const x = - (radius * Math.sin(phi) * Math.cos(theta))
  const z = (radius * Math.sin(phi) * Math.sin(theta))
  const y = (radius * Math.cos(phi))
  return new THREE.Vector3(x, y, z)
}

export function vector3ToLatLon(vector: THREE.Vector3) {
  const x = vector.x
  const y = vector.y
  const z = vector.z

  // Convert 3D coordinates to spherical coordinates
  const radius = Math.sqrt(x * x + y * y + z * z)
  const lat = 90 - (Math.acos(y / radius) * 180 / Math.PI)
  const lon = (Math.atan2(z, -x) * 180 / Math.PI) - 180

  return { lat, lon }
}

export function simplePathAtTime({
  time,
  duration,
  approachAngleDeg,
  leadTime,
  mitigation,
  mitigationPower,
  targetLat,
  targetLon,
  lockToTarget = false, // <— NEW: only lock when you explicitly ask to
}: {
  time: number;
  duration: number;
  approachAngleDeg: number;
  leadTime: number;
  mitigation: Mitigation;
  mitigationPower: number;
  targetLat?: number;
  targetLon?: number;
  lockToTarget?: boolean;
}) {
  const eta = Math.max(0, duration - time);

  // If we’re locking to a user-selected target, short-circuit here.
  if (
    lockToTarget &&
    Number.isFinite(targetLat) &&
    Number.isFinite(targetLon)
  ) {
    return { impactLat: targetLat as number, impactLon: targetLon as number, eta };
  }

  // ---- Original drifting solution (unchanged) ----
  const baseLat = 40;
  const baseLon = -100;

  let driftLat = 0;
  let driftLon = 0;

  // Apply mitigation nudges in the final lead window.
  const apply = time > (duration - Math.max(1, leadTime));
  if (apply) {
    const tNorm = (time - (duration - leadTime)) / Math.max(1, leadTime);
    const power = mitigationPower * tNorm;
    if (mitigation === 'kinetic') { driftLat += power * 5; driftLon += power * 8; }
    if (mitigation === 'tractor') { driftLat += power * 3; driftLon += power * 3; }
    if (mitigation === 'laser') { driftLat += power * 7; driftLon += power * 2; }
  }

  const angleBias = (approachAngleDeg - 45) / 90;
  const impactLat = baseLat + driftLat + angleBias * (time / duration) * 10;
  const impactLon = baseLon + driftLon + (time / duration) * 20;

  return { impactLat, impactLon, eta };
}
