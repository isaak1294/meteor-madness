// src/lib/dynamics.ts
export type Q = { q: string; choices: string[]; explanations: string[]; answer: number }

// ---------- helpers ----------
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const uniqInts = (vals: number[]) => {
    const s = new Set<number>()
    const out: number[] = []
    for (let v of vals) {
        let x = Math.max(1, Math.round(v))
        while (s.has(x)) x += Math.max(1, Math.round(x * 0.03))
        s.add(x)
        out.push(x)
    }
    return out
}
const shuffleIdx = (n: number) => Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - 0.5)

// ---------- 1) Thermal / fireball radius ----------
/**
 * Crude 3rd-degree burn radius (km) ~ k * E^(1/3)
 * k tuned for gameplay: 3.0 gives ~3 km at 1 Mt, ~14 km at 1000 Mt
 */
export function buildThermalQuestion(energyTNT: number) {
    const k = 3.0
    const r = clamp(k * Math.cbrt(Math.max(energyTNT, 0)), 1, 200) // km

    const vals = uniqInts([r, r * 0.55, r * 0.8, r * 1.6])
    const correctRaw = vals[0]
    const optionsRaw = vals.map(v => `~${v} km radius for severe thermal burns`)
    const explanationsRaw = vals.map((v, i) => {
        if (i === 0) return `Scales as E^(1/3); with ${energyTNT.toFixed(2)} Mt, the severe-burn radius is ~${Math.round(r)} km.`
        const diff = Math.abs(v - Math.round(r))
        return v < r ? `Undershoots by ~${diff} km — too small for this energy.` : `Overshoots by ~${diff} km — too large for this energy.`
    })

    const order = shuffleIdx(4)
    const choices = order.map(i => optionsRaw[i])
    const explanations = order.map(i => explanationsRaw[i])
    const answer = order.indexOf(vals.indexOf(correctRaw))

    return {
        q: 'Approximate radius of severe thermal burns from this impact:',
        choices,
        explanations,
        answer
    } as Q
}

// ---------- 2) Seismic magnitude equivalent ----------
/**
 * Simple mapping: M ≈ 4 + log10(E_Mt) (same as your map pane)
 */
export function buildSeismicQuestion(energyTNT: number) {
    const M = 4 + Math.log10(Math.max(energyTNT, 1e-6))
    const center = Number(M.toFixed(1))

    const candidates = [
        center,
        center - 0.6,
        center + 0.4,
        center - 0.2
    ].map(v => Number(v.toFixed(1)))

    // guarantee uniqueness
    const unique = Array.from(new Set(candidates))
    while (unique.length < 4) unique.push(Number((center + (Math.random() * 1.2 - 0.6)).toFixed(1)))

    const correct = unique[0]
    const optionsRaw = unique.map(v => `Magnitude ${v.toFixed(1)}`)
    const explanationsRaw = unique.map(v => {
        if (v === correct) return `Using M ≈ 4 + log10(E_Mt) with E=${energyTNT.toFixed(2)} Mt ⇒ M≈${center.toFixed(1)}.`
        const diff = Math.abs(v - center).toFixed(1)
        return `Off by ~${diff} magnitude units from the E→M estimate.`
    })

    const order = shuffleIdx(4)
    const choices = order.map(i => optionsRaw[i])
    const explanations = order.map(i => explanationsRaw[i])
    const answer = order.indexOf(unique.indexOf(correct))

    return {
        q: 'Earthquake magnitude equivalent of this impact (order-of-magnitude):',
        choices,
        explanations,
        answer
    } as Q
}

// ---------- 3) Energy class ----------
/**
 * Classify impact by energy bracket (gamey but intuitive).
 */
export function buildEnergyClassQuestion(energyTNT: number) {
    const classes = [
        { label: 'City-killer (< 1 Mt)', ok: (e: number) => e < 1 },
        { label: 'Regional (1–100 Mt)', ok: (e: number) => e >= 1 && e < 100 },
        { label: 'Continental (100–1000 Mt)', ok: (e: number) => e >= 100 && e < 1000 },
        { label: 'Global (> 1000 Mt)', ok: (e: number) => e >= 1000 },
    ]
    const answer = classes.findIndex(c => c.ok(energyTNT))
    const choices = classes.map(c => c.label)
    const explanations = classes.map((c, i) => i === answer
        ? `At ${energyTNT.toFixed(2)} Mt, this fits the “${c.label}” bracket.`
        : `Does not match ${energyTNT.toFixed(2)} Mt.`)

    return {
        q: 'Which category best describes the impact energy?',
        choices,
        explanations,
        answer: Math.max(0, answer)
    } as Q
}
