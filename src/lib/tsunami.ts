// src/lib/tsunami.ts
export type TsunamiAssessment = {
    elevation: number | null
    terrain: 'Ocean/Sea' | 'Coastal/Low-lying' | 'Plains/Valley' | 'Hills/Plateau' | 'Mountains' | 'Unknown'
    risk: 'EXTREME' | 'HIGH' | 'MODERATE' | 'LOW' | 'NEGLIGIBLE' | 'Unable to determine'
    waveDeepM: number | null
    waveCoastM: number | null
    notes: string[]
}

/**
 * Very simplified terrain-aware tsunami estimate.
 * - Ocean impact: estimate deep-water wave amplitude from impact energy + depth,
 *   then apply a crude shoaling factor to approximate near-coast height.
 * - Coastal/low-lying land: local surge/flooding driven by displacement & shallow water.
 * - Inland: negligible tsunami risk.
 *
 * All numbers are back-of-envelope and intentionally conservative/simple for a game.
 */
export async function assessTsunami(
    lat: number,
    lon: number,
    energyTNT: number,  // megatons TNT
    craterKm: number
): Promise<TsunamiAssessment> {
    let elevation: number | null = null
    try {
        const r = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lon}`)
        const data = await r.json()
        elevation = (data?.results?.[0]?.elevation ?? null)
    } catch {
        elevation = null
    }

    // Terrain classification (matches your ImpactMap buckets)
    const terrain: TsunamiAssessment['terrain'] =
        elevation == null ? 'Unknown'
            : elevation < 0 ? 'Ocean/Sea'
                : elevation < 10 ? 'Coastal/Low-lying'
                    : elevation < 100 ? 'Plains/Valley'
                        : elevation < 500 ? 'Hills/Plateau'
                            : 'Mountains'

    // Bail out if we can't determine elevation
    if (elevation == null) {
        return {
            elevation,
            terrain,
            risk: 'Unable to determine',
            waveDeepM: null,
            waveCoastM: null,
            notes: ['Elevation service unavailable']
        }
    }

    const notes: string[] = []
    let waveDeepM: number | null = null
    let waveCoastM: number | null = null

    // Helpers
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
    const cbrtE = Math.cbrt(Math.max(energyTNT, 0)) // energy scaling knob

    if (terrain === 'Ocean/Sea') {
        // Ocean impact → use water depth (positive meters)
        const depth = Math.abs(elevation) // elevation is negative under sea level
        const depthCap = clamp(depth, 200, 6000) // ignore ultra-shallow / ultra-deep extremes

        // Deep-water wave amplitude (very rough): scale with E^(1/3) and sqrt(depth)
        // Tuned for gameplay, not research accuracy.
        waveDeepM = 0.6 * cbrtE * Math.sqrt(depthCap / 4000)

        // Shoaling from deep (~4000m) to continental shelf (~50m)
        // Green's law style: A ∝ h^(-1/4) => multiply by (h_deep / h_coast)^(1/4)
        const hDeep = 4000
        const hCoast = 50
        const shoal = Math.pow(hDeep / hCoast, 0.25)
        waveCoastM = waveDeepM * shoal

        // Cap to keep things in sane interactive ranges
        waveCoastM = clamp(waveCoastM, 1, 120)
        notes.push(`Ocean impact (depth ≈ ${depth.toFixed(0)} m)`)
    } else if (terrain === 'Coastal/Low-lying') {
        // Land impact right at the coast → surge-like flooding from displacement
        // Use a gentler scaling vs ocean case.
        waveDeepM = 0
        waveCoastM = clamp(0.35 * cbrtE + 0.1 * craterKm, 0.5, 30)
        notes.push('Coastal land impact: surge & local inundation likely')
    } else {
        // Inland: tsunami negligible (rivers/lakes may slosh but not oceanic tsunami)
        waveDeepM = 0
        waveCoastM = 0
    }

    // Risk label from coastal height estimate
    const risk: TsunamiAssessment['risk'] =
        waveCoastM == null ? 'Unable to determine'
            : waveCoastM > 50 ? 'EXTREME'
                : waveCoastM > 15 ? 'HIGH'
                    : waveCoastM > 5 ? 'MODERATE'
                        : waveCoastM > 1 ? 'LOW'
                            : 'NEGLIGIBLE'

    return { elevation, terrain, risk, waveDeepM, waveCoastM, notes }
}

/** Build a dynamic multiple-choice question WITH explanations */
export function buildTsunamiQuestion(a: TsunamiAssessment) {
    // If we can't compute a coastal height OR it's < 1 m, use a risk-only question
    if (a.waveCoastM == null || a.waveCoastM < 1) {
        const levels = ['NEGLIGIBLE', 'LOW', 'MODERATE', 'HIGH', 'EXTREME'] as const
        const answerIdx = a.risk === 'Unable to determine'
            ? 0 // we'll insert "Unable to determine" first below
            : Math.max(0, levels.indexOf(a.risk as any))

        const choices = a.risk === 'Unable to determine'
            ? ['Unable to determine', 'LOW', 'MODERATE', 'HIGH']
            : [...levels]

        const explanations = choices.map((c) => {
            if (c === 'Unable to determine') {
                return 'Elevation/terrain data was unavailable, so a terrain-aware tsunami estimate could not be made.'
            }
            return c === a.risk
                ? `Terrain classification is "${a.terrain}" with the current impact energy, which yields a ${a.risk.toLowerCase()} tsunami risk at the coast.`
                : `This risk level does not match the computed terrain-aware estimate for the current impact location.`
        })

        return {
            q: 'Based on this impact location and terrain, what is the tsunami risk?',
            choices,
            explanations,
            answer: answerIdx
        }
    }

    // Numeric-height question with guaranteed-unique choices
    const clampH = (v: number) => Math.max(1, Math.min(200, Math.round(v)))
    const target = clampH(a.waveCoastM)

    // generate three distractors around the target and ensure uniqueness
    const unique = new Set<number>()
    const add = (v: number) => {
        let x = clampH(v)
        while (unique.has(x)) x += 1
        unique.add(x)
    }
    add(target)
    add(target * 0.55)
    add(target * 0.8)
    add(target * 1.6)

    const heights = Array.from(unique) // 4 unique ints; includes target

    // Build options/explanations with the same risk label for comparability
    const options = heights.map(h => `${a.risk} risk with ~${h} m coastal waves`)
    const correctIndexRaw = heights.indexOf(target)

    const explanationsRaw = heights.map((h, i) => {
        if (i === correctIndexRaw) {
            return `Using the current energy and "${a.terrain}" terrain, the deep-water wave is transformed by shoaling near the coast, yielding ~${target} m.`
        }
        const diff = Math.abs(h - target)
        if (h < target) return `Undershoots the terrain-aware estimate by about ${diff} m — too low for this energy/terrain.`
        return `Overshoots the terrain-aware estimate by about ${diff} m — too high for this energy/terrain.`
    })

    // Shuffle once so the correct answer isn't always in the same position
    const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5)
    const choices = order.map(i => options[i])
    const explanations = order.map(i => explanationsRaw[i])
    const answer = order.indexOf(correctIndexRaw)

    return {
        q: 'Given this impact location and terrain, what is the best estimate for coastal tsunami height?',
        choices,
        explanations,
        answer
    }
}

