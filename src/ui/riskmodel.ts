import { useSimStore } from "../state/useSimStore";


export const FIXED_TARGET = {
  name: 'Victoria, BC (city center)',
  lat: 48.4284,
  lon: -123.3656,
};

// Haversine distance (km)
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(a)));
  return R * c;
}

export type HazardInputs = {
  impactLat: number;
  impactLon: number;
  blastKm: number;
  seismicKm: number;
  tsunamiKm: number;
  approachAngleDeg?: number;
  // Optional environment hints (unused for now since target is fixed inland)
  targetElevationM?: number;
  targetIsCoastal?: boolean;
};

export type HazardBreakdown = {
  distanceKm: number;
  blastRisk: number;
  seismicRisk: number;
  tsunamiRisk: number;
  dominantHazard: 'blast' | 'seismic' | 'tsunami' | 'none';
  killProbability: number;
  isLethal: boolean;
  rationale: string;
};

function sigmoidFalloff(distanceKm: number, innerKm: number, outerKm: number): number {
  if (outerKm <= innerKm) return distanceKm <= innerKm ? 1 : 0;
  if (distanceKm <= innerKm) return 1;
  const t = Math.min(1, Math.max(0, (distanceKm - innerKm) / (outerKm - innerKm)));
  const s = 1 - (3 * t * t - 2 * t * t * t); // smoothstep invert
  return Math.max(0, Math.min(1, s));
}

function seismicAngleModifier(angleDeg?: number): number {
  if (angleDeg == null) return 1;
  if (angleDeg < 20) return 0.85;
  if (angleDeg < 35) return 0.93;
  return 1;
}

function tsunamiCoastalModifier(isCoastal?: boolean): number {
  return isCoastal ? 1 : 0.15;
}

function tsunamiElevationModifier(elevationM?: number): number {
  if (elevationM == null) return 1;
  if (elevationM >= 50) return 0.25;
  if (elevationM >= 20) return 0.5;
  return 1;
}

export function assessLethality(inputs: HazardInputs, targetLat: number, targetLon: number): HazardBreakdown {
  const {
    impactLat, impactLon, blastKm, seismicKm, tsunamiKm,
    approachAngleDeg, targetElevationM, targetIsCoastal,
  } = inputs;

  const distanceKm = haversineKm(impactLat, impactLon, targetLat, targetLon);

  const blastInner = Math.max(1, 0.45 * blastKm);
  const blastOuter = blastKm;
  const seismicInner = Math.max(1, 0.45 * seismicKm);
  const seismicOuter = seismicKm;
  const tsunamiInner = Math.max(1, 0.45 * tsunamiKm);
  const tsunamiOuter = tsunamiKm;

  let blastRisk = sigmoidFalloff(distanceKm, blastInner, blastOuter);
  let seismicRisk = sigmoidFalloff(distanceKm, seismicInner, seismicOuter);
  let tsunamiRisk = sigmoidFalloff(distanceKm, tsunamiInner, tsunamiOuter);

  seismicRisk *= seismicAngleModifier(approachAngleDeg);
  tsunamiRisk *= tsunamiCoastalModifier(targetIsCoastal);
  tsunamiRisk *= tsunamiElevationModifier(targetElevationM);

  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
  blastRisk = clamp01(blastRisk);
  seismicRisk = clamp01(seismicRisk);
  tsunamiRisk = clamp01(tsunamiRisk);

  const surviveAll = (1 - blastRisk) * (1 - seismicRisk) * (1 - tsunamiRisk);
  const killProbability = clamp01(1 - surviveAll);

  let dominantHazard: 'blast' | 'seismic' | 'tsunami' | 'none' = 'none';
  const maxRisk = Math.max(blastRisk, seismicRisk, tsunamiRisk);
  if (maxRisk > 0) {
    dominantHazard = maxRisk === blastRisk ? 'blast' : maxRisk === seismicRisk ? 'seismic' : 'tsunami';
  }

  const isLethal = killProbability >= 0.5;
  const rationale = isLethal
    ? `High fatality risk due to ${dominantHazard} at ${distanceKm.toFixed(1)} km from impact.`
    : `Sub-lethal at ${distanceKm.toFixed(1)} km; estimated kill probability ${(killProbability * 100).toFixed(0)}%.`;

  return {
    distanceKm: Number(distanceKm.toFixed(2)),
    blastRisk: Number(blastRisk.toFixed(2)),
    seismicRisk: Number(seismicRisk.toFixed(2)),
    tsunamiRisk: Number(tsunamiRisk.toFixed(2)),
    dominantHazard,
    killProbability: Number(killProbability.toFixed(2)),
    isLethal,
    rationale,
  };
}

// Assess the fixed Victoria point using current sim state
export function assessFixedTarget(): HazardBreakdown {
  const s = useSimStore.getState();
  return assessLethality(
    {
      impactLat: s.impactLat,
      impactLon: s.impactLon,
      blastKm: s.blastKm,
      seismicKm: s.seismicKm,
      tsunamiKm: s.tsunamiKm,
      approachAngleDeg: s.approachAngle,
      // Since Victoria is coastal but has varied elevation, you can tune:
      // targetIsCoastal: true,
      // targetElevationM: 15,
    },
    FIXED_TARGET.lat,
    FIXED_TARGET.lon
  );
}
