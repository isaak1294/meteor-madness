// src/lib/casualty.ts
export type DensityAssessment = {
    densityPkm2: number          // people / km²
    category: 'city' | 'suburb' | 'town' | 'neighbourhood' | 'village' | 'hamlet' | 'rural' | 'coast' | 'unknown'
    source: 'overpass' | 'terrain-fallback'
    note?: string
}

export type CasualtyEstimate = {
    density: DensityAssessment
    areaKm2: number
    fatalityRate: number
    casualties: number
}

export type TsunamiRisk = 'EXTREME' | 'HIGH' | 'MODERATE' | 'LOW' | 'NEGLIGIBLE' | 'Unable to determine'
export type TerrainKind = 'Ocean/Sea' | 'Coastal/Low-lying' | 'Plains/Valley' | 'Hills/Plateau' | 'Mountains' | 'Unknown'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const roundSig = (n: number) => {
    if (!Number.isFinite(n) || n <= 0) return 0
    const e = Math.floor(Math.log10(n))
    const m = n / Math.pow(10, e)
    const sig = m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10
    return sig * Math.pow(10, e)
}

const PLACE_DENSITY: Record<string, number> = {
    city: 5000,          // ppl/km²
    suburb: 2500,
    neighbourhood: 3000,
    town: 1500,
    village: 400,
    hamlet: 80
}

const TERRAIN_DENSITY: Record<TerrainKind, number> = {
    'Ocean/Sea': 0,
    'Coastal/Low-lying': 800,
    'Plains/Valley': 150,
    'Hills/Plateau': 90,
    'Mountains': 40,
    'Unknown': 150
}

/**
 * Try to infer a local population density using OSM "place" features.
 * Falls back to terrain-based default if Overpass is unavailable.
 */
export async function assessPopulationDensity(lat: number, lon: number, terrain: TerrainKind): Promise<DensityAssessment> {
    try {
        const q = `
      [out:json][timeout:20];
      (
        node(around:15000, ${lat}, ${lon})["place"~"city|town|village|hamlet|suburb|neighbourhood"];
        way(around:15000, ${lat}, ${lon})["place"~"city|town|village|hamlet|suburb|neighbourhood"];
        relation(around:15000, ${lat}, ${lon})["place"~"city|town|village|hamlet|suburb|neighbourhood"];
      );
      out tags center 20;
    `.trim()
        const r = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: q
        })
        const data = await r.json()
        const els = (data?.elements ?? []) as Array<{ tags?: Record<string, string> }>

        let bestCat: DensityAssessment['category'] | null = null
        for (const el of els) {
            const place = el.tags?.place
            if (!place) continue
            if (place in PLACE_DENSITY) {
                // prefer the densest class we see
                if (!bestCat) bestCat = place as any
                else {
                    const A = PLACE_DENSITY[bestCat] ?? 0
                    const B = PLACE_DENSITY[place] ?? 0
                    if (B > A) bestCat = place as any
                }
            }
        }
        if (bestCat) {
            return { densityPkm2: PLACE_DENSITY[bestCat], category: bestCat, source: 'overpass' }
        }

        // No explicit place found → fallback by terrain
        const fallback = TERRAIN_DENSITY[terrain] ?? 150
        return { densityPkm2: fallback, category: terrain === 'Coastal/Low-lying' ? 'coast' : 'rural', source: 'terrain-fallback', note: 'No OSM place nearby' }
    } catch {
        const fallback = TERRAIN_DENSITY[terrain] ?? 150
        return { densityPkm2: fallback, category: terrain === 'Coastal/Low-lying' ? 'coast' : 'rural', source: 'terrain-fallback', note: 'Overpass unavailable' }
    }
}

/**
 * Crude casualty model:
 * - Effective affected radius Re = (craterRadius + 0.6 * blastRadius)
 * - Area A = π Re²
 * - Fatality rate f = clamp( 0.08 + 0.12*log10(E_Mt) + tsunamiAdj, 0.03..0.9 )
 */
export function estimateCasualties(params: {
    energyTNT: number
    craterKm: number
    blastRadiusKm: number
    densityPkm2: number
    tsunamiRisk: TsunamiRisk
}): CasualtyEstimate {
    const { energyTNT, craterKm, blastRadiusKm, densityPkm2, tsunamiRisk } = params

    const craterR = Math.max(0, craterKm / 2)
    const Re = Math.max(0.1, craterR + 0.6 * Math.max(0, blastRadiusKm))
    const areaKm2 = Math.PI * Re * Re

    const baseF = clamp(0.08 + 0.12 * Math.log10(Math.max(1e-6, energyTNT)), 0.03, 0.75)
    const adj = tsunamiRisk === 'EXTREME' ? 0.20
        : tsunamiRisk === 'HIGH' ? 0.12
            : tsunamiRisk === 'MODERATE' ? 0.06
                : tsunamiRisk === 'LOW' ? 0.02
                    : 0.0
    const fatalityRate = clamp(baseF + adj, 0.03, 0.9)

    const casualtiesRaw = densityPkm2 * areaKm2 * fatalityRate
    const casualties = roundSig(casualtiesRaw)

    return {
        density: { densityPkm2, category: 'unknown', source: 'overpass' },
        areaKm2,
        fatalityRate,
        casualties
    }
}

/** Build a multiple-choice casualty question with explanations */
export function buildCasualtyQuestion(args: {
    casualties: number
    areaKm2: number
    fatalityRate: number
    density: DensityAssessment
}) {
    const { casualties, areaKm2, fatalityRate, density } = args

    // If we can't compute, ask about which factor matters most
    if (!Number.isFinite(casualties) || casualties <= 0) {
        const choices = ['Impact energy', 'Population density', 'Local terrain/elevation', 'All of the above']
        const explanations = [
            'Energy sets the scale but alone does not determine casualties.',
            'Density matters a lot, but not alone.',
            'Terrain shapes effects (e.g., tsunami), but not alone.',
            'Correct — casualties depend on energy, density, AND terrain together.'
        ]
        return {
            q: 'Which factors primarily determine the death toll from an impact?',
            choices,
            explanations,
            answer: 3
        }
    }

    // Generate unique options around the estimate
    const c = Math.max(1, Math.round(casualties))
    const uniques = new Set<number>()
    const add = (v: number) => {
        let x = Math.max(1, Math.round(v))
        while (uniques.has(x)) x += Math.max(1, Math.round(x * 0.03))
        uniques.add(x)
    }
    add(c)                 // correct
    add(c * 0.45)
    add(c * 0.75)
    add(c * 1.6)

    const arr = Array.from(uniques).slice(0, 4)
    // Make compact labels (e.g., 12k, 1.2M)
    const fmt = (n: number) =>
        n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
            : n >= 1_000 ? `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
                : `${n}`

    const optionsRaw = arr.map(n => `~${fmt(n)} people`)
    const correctIdxRaw = arr.indexOf(c)

    // Explanations aligned to options
    const explanationsRaw = arr.map((n, i) => {
        if (i === correctIdxRaw) {
            return `Matches ~${fmt(c)} based on area ≈ ${areaKm2.toFixed(0)} km², fatality rate ≈ ${(fatalityRate * 100).toFixed(0)}%, and density ≈ ${Math.round(density.densityPkm2)} ppl/km² (${density.source === 'overpass' ? density.category : 'fallback'}).`
        }
        const diff = Math.abs(n - c)
        return n < c
            ? `Undershoots by roughly ${fmt(diff)} — too low for this density and affected area.`
            : `Overshoots by roughly ${fmt(diff)} — too high for this density and affected area.`
    })

    // Shuffle once
    const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5)
    const choices = order.map(i => optionsRaw[i])
    const explanations = order.map(i => explanationsRaw[i])
    const answer = order.indexOf(correctIdxRaw)

    return {
        q: 'Approximate death toll for this impact (population-density aware):',
        choices,
        explanations,
        answer
    }
}
