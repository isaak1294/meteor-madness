import { create } from 'zustand'
import { simplePathAtTime } from '../lib/kinematics'
import { ProcessedAsteroidInfo } from '../Fetching/fetchNasa'

/** Public types used elsewhere */
export type Mitigation = 'kinetic' | 'tractor' | 'laser'
export type Mode = 'scenario' | 'defend' | 'story' | 'quiz' | 'learn'

type AsteroidPreset = {
  id: string
  name: string
  size: number
  speed: number
  density: number
}

/** Simple energy model (not physically strict) */
function estimateEnergyMtTNT(size_m: number, density: number, speed_kms: number) {
  const r = size_m / 2
  const vol = (4 / 3) * Math.PI * r * r * r
  const mass = density * vol // kg
  const v = speed_kms * 1000 // m/s
  const joules = 0.5 * mass * v * v
  return joules / 4.184e15 // megatons TNT
}

type Readouts = {
  speed: number
  size: number
  density: number
  eta: number
  energyTNT: number
  craterKm: number
}

type SimState = {
  time: number
  duration: number
  running: boolean

  useTargetImpact: boolean

  size: number
  speed: number
  density: number
  approachAngle: number

  mitigation: Mitigation
  mitigationPower: number
  leadTime: number

  impactLat: number
  impactLon: number

  // User-selected target location
  targetLat: number
  targetLon: number

  blastKm: number
  seismicKm: number
  tsunamiKm: number

  quizVisible: boolean
  quizStopT: number
  learnVisible: boolean

  mode: Mode
  presets: AsteroidPreset[]
  selectedPresetId: string

  // derived display info
  readouts: Readouts

  // impact map state
  hasImpacted: boolean
  showImpactMap: boolean

  // impact shake state
  isShaking: boolean
  shakeIntensity: number
  shakeStartTime: number
  hasShaken: boolean // Track if shake has occurred this simulation

  // NASA asteroid data
  nasaAsteroidData: ProcessedAsteroidInfo | null
  useNasaData: boolean

  /* Core actions */
  tick: (dt: number) => void
  start: () => void
  pause: () => void
  reset: () => void
  selectPreset: (id: string) => void
  setImpactLatLon: (lat: number, lon: number) => void
  setTargetLatLon: (lat: number, lon: number) => void
  hit: () => void
  setMode: (m: Mode) => void
  openQuiz: () => void
  closeQuiz: () => void
  resumeFromQuiz: () => void
  openLearn: () => void
  closeLearn: () => void

  /* setters */
  setRunning: (v: boolean) => void
  setTime: (v: number) => void
  setDuration: (v: number) => void
  setSize: (v: number) => void
  setSpeed: (v: number) => void
  setDensity: (v: number) => void
  setApproachAngle: (v: number) => void
  setNasaAsteroidData: (data: ProcessedAsteroidInfo | null) => void
  setUseNasaData: (use: boolean) => void
  clearNasaData: () => void
  setMitigation: (v: Mitigation) => void
  setMitigationPower: (v: number) => void
  setLeadTime: (v: number) => void
  setShowImpactMap: (v: boolean) => void
  showImpactAnalysis: () => void
  startImpactShake: () => void
  clearTargetImpact: () => void

  /* legacy */
  toggleRun: () => void
  setParam: (
    key:
      | 'size' | 'speed' | 'density' | 'approachAngle'
      | 'mitigationPower' | 'leadTime' | 'duration' | 'time' | 'mitigation',
    value: number | Mitigation
  ) => void
}

export const useSimStore = create<SimState>((set, get) => {
  const recalcHazards = (
    n?: Partial<Pick<SimState, 'size' | 'speed' | 'density'>>
  ) => {
    const size = n?.size ?? get().size
    const speed = n?.speed ?? get().speed
    const density = n?.density ?? get().density
    const E = estimateEnergyMtTNT(size, density, speed)
    const blastKm = 80 + E * 5
    const seismicKm = 40 + E * 2
    const tsunamiKm = 120 + E * 6
    const craterKm = Math.cbrt(E) * 1.2
    const readouts: Readouts = {
      speed,
      size,
      density,
      eta: get().duration - get().time,
      energyTNT: E,
      craterKm,
    }
    set({ blastKm, seismicKm, tsunamiKm, readouts })
  }

  const base = {
    time: 0,
    duration: 10,
    running: false,
    size: 120,
    speed: 18,
    density: 3000,
    approachAngle: 35,
    mitigation: 'kinetic' as Mitigation,
    mitigationPower: 0.5,
    leadTime: 15,
    impactLat: 10,
    impactLon: 70,
    targetLat: 40,
    targetLon: -100,
    blastKm: 0,
    seismicKm: 0,
    tsunamiKm: 0,
    quizStopT: 0.96,
    mode: 'scenario' as Mode,
    presets: [
      { id: 'tiny', name: 'Tiny (40 m, 15 km/s)', size: 40, speed: 15, density: 2500 },
      { id: 'small', name: 'Small (120 m, 18 km/s)', size: 120, speed: 18, density: 3000 },
      { id: 'med', name: 'Medium (350 m, 25 km/s)', size: 350, speed: 25, density: 3000 },
      { id: 'large', name: 'Large (800 m, 28 km/s)', size: 800, speed: 28, density: 3200 },
      { id: 'iron', name: 'Iron (200 m, 30 km/s)', size: 200, speed: 30, density: 7800 },
    ],
    selectedPresetId: 'small',
    readouts: { speed: 0, size: 0, density: 0, eta: 0, energyTNT: 0, craterKm: 0 },
    hasImpacted: false,
    showImpactMap: false,
    isShaking: false,
    shakeIntensity: 0,
    shakeStartTime: 0,
    hasShaken: false,
    useTargetImpact: false,
    nasaAsteroidData: null,
    useNasaData: false,
    learnVisible: false,
  }


  // Calculate initial impact position
  const initialImpact = simplePathAtTime({
    time: base.duration,
    duration: base.duration,
    approachAngleDeg: base.approachAngle,
    leadTime: base.leadTime,
    mitigation: base.mitigation,
    mitigationPower: base.mitigationPower
  })
  base.impactLat = initialImpact.impactLat
  base.impactLon = initialImpact.impactLon

  set(base)
  recalcHazards()

  return {
    ...get(),

    tick: (dt) => {
      const st = get()
      const {
        running, time, duration, showImpactMap,
        isShaking, shakeStartTime, quizVisible, mode
      } = st

      if (!running || showImpactMap || quizVisible) return

      const dtSafe = Number.isFinite(dt) ? dt : 0
      const durSafe = Number.isFinite(duration) && duration > 0 ? duration : 10
      const timeSafe = Number.isFinite(time) ? time : 0

      let t = Math.min(durSafe, timeSafe + dtSafe)

      // === QUIZ: open only on crossing stop point (no permanent clamp) ===
      if (mode === 'quiz') {
        const raw = get().quizStopT
        const stopFrac = Number.isFinite(raw) ? Math.min(0.999, Math.max(0, raw)) : 0.96
        const stopAt = stopFrac * durSafe

        // open once when crossing from below -> at the stop point
        if (!quizVisible && timeSafe < stopAt && t >= stopAt) {
          set({ time: stopAt, running: false, quizVisible: true })
          // keep your hazard/readout recompute if needed
          const recalc = (st as any).recalcHazards || (() => { })
          recalc()
          return
        }
      }

      const newHasImpacted = t >= durSafe

      let newShakeState = {}
      // Only shake once per simulation - if hasShaken is true, don't shake again
      if (newHasImpacted && !st.hasImpacted && !st.hasShaken) {
        newShakeState = { isShaking: true, shakeIntensity: 1.0, shakeStartTime: performance.now(), hasShaken: true }
      } else if (isShaking) {
        const elapsed = (performance.now() - shakeStartTime) / 1000
        const total = 3.0
        newShakeState = elapsed >= total
          ? { isShaking: false, shakeIntensity: 0 }
          : { shakeIntensity: Math.max(0, 1 - (elapsed / total) ** 2) }
      }

      set({ time: t, hasImpacted: newHasImpacted, ...newShakeState })
      // recalcHazards()
    },



    start: () => {
      const { showImpactMap, quizVisible } = get();
      if (showImpactMap || quizVisible) return;
      set({ running: true });
    },
    pause: () => {
      const { showImpactMap } = get()
      // Don't allow pausing if impact map is showing
      if (showImpactMap) return
      set({ running: false })
    },
    reset: () => set({ running: false, time: 0, hasImpacted: false, showImpactMap: false, quizVisible: false, isShaking: false, shakeIntensity: 0, hasShaken: false }),

    selectPreset: (id) => {
      const p = get().presets.find(p => p.id === id)
      if (!p) return
      set({
        selectedPresetId: id,
        size: p.size,
        speed: p.speed,
        density: p.density,
        // Reset shake state for new asteroid
        hasShaken: false,
        isShaking: false,
        shakeIntensity: 0,
        hasImpacted: false,
        time: 0
      })
      recalcHazards({ size: p.size, speed: p.speed, density: p.density })
    },

    setImpactLatLon: (lat, lon) => set({ impactLat: lat, impactLon: lon }),
    setTargetLatLon: (lat, lon) => set({
      targetLat: lat,
      targetLon: lon,
      useTargetImpact: true,
    }),
    clearTargetImpact: () => set({ useTargetImpact: false }),
    hit: () => set({ time: 0, running: true }),
    setMode: (m) => set({ mode: m }),

    setRunning: (v) => set({ running: v }),
    setTime: (v) => {
      const d = get().duration
      const vv = Number.isFinite(v) ? v : 0
      set({ time: Math.max(0, Math.min(Number.isFinite(d) ? d : 10, vv)) })
    },
    setDuration: (v) => set({ duration: Math.max(0.1, Number.isFinite(v) ? v : 10) }),

    setSize: (v) => { set({ size: v }); recalcHazards({ size: v }) },
    setSpeed: (v) => { set({ speed: v }); recalcHazards({ speed: v }) },
    setDensity: (v) => { set({ density: v }); recalcHazards({ density: v }) },
    setApproachAngle: (v) => set({ approachAngle: v }),
    setNasaAsteroidData: (data) => {
      set({ nasaAsteroidData: data })
      if (data) {
        // Update simulation parameters with real NASA data
        const rawSize = (data.size.meters.min + data.size.meters.max) / 2
        const sizeInMeters = Math.max(10, Math.min(1000, rawSize)) // Clamp size to reasonable range
        const speedInKmS = Math.max(5, Math.min(100, data.speed.kmPerSecond || 20)) // Clamp speed
        const approachAngle = Math.max(0, Math.min(90, data.orbital.inclinationDegrees || 45)) // Clamp angle

        set({
          size: sizeInMeters,
          speed: speedInKmS,
          approachAngle: approachAngle,
          useNasaData: true,
          // Reset shake state for new asteroid
          hasShaken: false,
          isShaking: false,
          shakeIntensity: 0,
          hasImpacted: false,
          time: 0
        })
        recalcHazards({ size: sizeInMeters, speed: speedInKmS })
      }
    },
    setUseNasaData: (use) => set({ useNasaData: use }),
    clearNasaData: () => {
      set({ nasaAsteroidData: null, useNasaData: false })
      // Reset to default values
      const defaultSize = 120
      const defaultSpeed = 25
      const defaultAngle = 45
      set({
        size: defaultSize,
        speed: defaultSpeed,
        approachAngle: defaultAngle
      })
      recalcHazards({ size: defaultSize, speed: defaultSpeed })
    },
    setMitigation: (v) => set({ mitigation: v }),
    setMitigationPower: (v) => set({ mitigationPower: v }),
    setLeadTime: (v) => set({ leadTime: v }),
    setShowImpactMap: (v) => set({ showImpactMap: v }),
    showImpactAnalysis: () => set({ showImpactMap: true }),
    startImpactShake: () => set({
      isShaking: true,
      shakeIntensity: 1.0,
      shakeStartTime: performance.now()
    }),

    resumeFromQuiz: () => set((st) => ({
      quizVisible: false,
      running: true,
    })),
    openLearn: () => set({ learnVisible: true }),
    closeLearn: () => set({ learnVisible: false }),

    toggleRun: () => {
      const { running, showImpactMap, quizVisible } = get();
      if (showImpactMap || quizVisible) return;
      set({ running: !running });
    },

    setParam: (key, value) => {
      switch (key) {
        case 'mitigation': get().setMitigation(value as Mitigation); break
        case 'size': get().setSize(value as number); break
        case 'speed': get().setSpeed(value as number); break
        case 'density': get().setDensity(value as number); break
        case 'approachAngle': get().setApproachAngle(value as number); break
        case 'mitigationPower': get().setMitigationPower(value as number); break
        case 'leadTime': get().setLeadTime(value as number); break
        case 'duration': get().setDuration(value as number); break
        case 'time': get().setTime(value as number); break
        default: break
      }
    },
  }
})
