// src/modes/QuizMode.tsx
import { useEffect, useState } from 'react'
import { useSimStore } from '../state/useSimStore'
import { assessTsunami, buildTsunamiQuestion } from '../lib/tsunami'
import { assessPopulationDensity, estimateCasualties, buildCasualtyQuestion } from '../lib/casualty'
import { buildThermalQuestion, buildSeismicQuestion, buildEnergyClassQuestion } from '../lib/dynamics'

type Q = { q: string; choices: string[]; explanations: string[]; answer: number }

const STATIC_QUESTIONS: Q[] = [
    {
        q: 'What is the approximate radius of Earth?',
        choices: ['1,000 km', '6,371 km', '12,742 km', '25,000 km'],
        explanations: [
            'Too small — Earth’s radius is much larger.',
            'Correct — Earth’s mean radius is about 6,371 km.',
            'That’s close to the DIAMETER (~12,742 km), not the radius.',
            'Too large — even the diameter isn’t this big.'
        ],
        answer: 1
    }
]

// helpers
const shuffle = <T,>(a: T[]) => a.map(x => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map(([, x]) => x)
const pickRandom = <T,>(arr: T[], n: number) => shuffle(arr).slice(0, Math.max(0, Math.min(n, arr.length)))

export default function QuizMode() {
    const resumeFromQuiz = useSimStore(s => s.resumeFromQuiz)

    // snapshot values at mount so the quiz doesn't reshuffle if state changes
    const { impactLat, impactLon, energyTNT, craterKm } = useSimStore(s => ({
        impactLat: s.impactLat,
        impactLon: s.impactLon,
        energyTNT: s.readouts.energyTNT,
        craterKm: s.readouts.craterKm
    }))

    const [questions, setQuestions] = useState<Q[] | null>(null)
    const [picked, setPicked] = useState<number[]>([])
    const [submitted, setSubmitted] = useState(false)

    // Build the question pool once, then pick 3 at random and freeze it
    useEffect(() => {
        let alive = true
            ; (async () => {
                try {
                    // 1) Terrain/tsunami
                    const tsu = await assessTsunami(impactLat, impactLon, energyTNT, craterKm)
                    const qTsu = buildTsunamiQuestion(tsu)

                    // 2) Density → casualties
                    const dens = await assessPopulationDensity(impactLat, impactLon, tsu.terrain)
                    const blastRadiusKm = craterKm * 2.5
                    const cas = estimateCasualties({
                        energyTNT,
                        craterKm,
                        blastRadiusKm,
                        densityPkm2: dens.densityPkm2,
                        tsunamiRisk: tsu.risk
                    })
                    cas.density = dens
                    const qCas = buildCasualtyQuestion(cas)

                    // 3) Pure local dynamics (no network)
                    const qThermal = buildThermalQuestion(energyTNT)
                    const qSeismic = buildSeismicQuestion(energyTNT)
                    const qEnergy = buildEnergyClassQuestion(energyTNT)

                    const pool: Q[] = [
                        STATIC_QUESTIONS[0],
                        qTsu,
                        qCas,
                        qThermal,
                        qSeismic,
                        qEnergy
                    ]

                    const chosen = pickRandom(pool, 3)

                    if (!alive) return
                    setQuestions(chosen)
                    setPicked(Array(chosen.length).fill(-1))
                } catch {
                    if (!alive) return
                    // Very safe minimal fallbacks
                    const fallback: Q[] = [
                        STATIC_QUESTIONS[0],
                        {
                            q: 'Which factor most increases expected casualties?',
                            choices: ['Impact energy', 'Population density', 'Local terrain/elevation', 'All of the above'],
                            explanations: [
                                'Energy matters but not alone.',
                                'Density matters but not alone.',
                                'Terrain matters but not alone.',
                                'Correct — all contribute significantly.'
                            ],
                            answer: 3
                        },
                        buildEnergyClassQuestion(energyTNT)
                    ]
                    const chosen = pickRandom(fallback, 3)
                    setQuestions(chosen)
                    setPicked(Array(chosen.length).fill(-1))
                }
            })()
        return () => { alive = false }
        // run once per quiz instance (on mount)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const correctCount = submitted && questions
        ? picked.filter((p, i) => p === questions[i].answer).length
        : 0

    // Loading panel
    if (!questions) {
        return (
            <div
                style={{
                    position: 'fixed', inset: 0,
                    display: 'grid', placeItems: 'center',
                    background: 'rgba(0,0,0,.55)', zIndex: 1000, padding: 16
                }}
            >
                <div className="panel" style={{ width: 'min(520px, 94vw)', padding: 16, textAlign: 'center' }}>
                    Preparing quiz…
                </div>
            </div>
        )
    }

    return (
        <div
            style={{
                position: 'fixed', inset: 0,
                display: 'grid', placeItems: 'center',
                background: 'rgba(0,0,0,.55)', zIndex: 1000,
                padding: 16
            }}
        >
            <div
                className="panel"
                style={{
                    width: 'min(560px, 94vw)',
                    maxHeight: '85vh',
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
            >
                <div style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>Trivia Checkpoint</div>
                    <div style={{ opacity: .8 }}>Answer the 3 questions below to resume the simulation.</div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', paddingRight: 6, display: 'grid', gap: 12 }}>
                    {questions.map((q, qi) => {
                        const userPick = picked[qi]
                        const isCorrect = submitted && userPick === q.answer
                        const showFeedback = submitted && q.explanations?.length === q.choices.length
                        return (
                            <div key={qi} style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: 10 }}>
                                <div style={{ marginBottom: 8, fontWeight: 600 }}>
                                    {qi + 1}. {q.q}
                                </div>

                                <div style={{ display: 'grid', gap: 6 }}>
                                    {q.choices.map((c, ci) => {
                                        const selected = picked[qi] === ci
                                        const correct = submitted && ci === q.answer
                                        const wrong = submitted && selected && ci !== q.answer
                                        return (
                                            <button
                                                key={ci}
                                                onClick={() => {
                                                    if (submitted) return
                                                    setPicked(prev => { const copy = [...prev]; copy[qi] = ci; return copy })
                                                }}
                                                style={{
                                                    textAlign: 'left',
                                                    padding: '8px 10px',
                                                    borderRadius: 8,
                                                    border: '1px solid rgba(255,255,255,.12)',
                                                    background: selected ? 'rgba(102,224,255,.12)' : 'rgba(255,255,255,.04)',
                                                    color: '#e7edf7',
                                                    outline: correct ? '2px solid #5cf28a' : wrong ? '2px solid #ff6a6a' : 'none',
                                                    cursor: submitted ? 'default' : 'pointer'
                                                }}
                                            >
                                                {c}
                                            </button>
                                        )
                                    })}
                                </div>

                                {showFeedback && (
                                    <div
                                        style={{
                                            marginTop: 10,
                                            padding: '8px 10px',
                                            borderRadius: 8,
                                            background: isCorrect ? 'rgba(92, 242, 138, 0.08)' : 'rgba(255, 106, 106, 0.08)',
                                            border: `1px solid ${isCorrect ? 'rgba(92, 242, 138, 0.35)' : 'rgba(255, 106, 106, 0.35)'}`
                                        }}
                                    >
                                        <div style={{ fontWeight: 700, marginBottom: 4 }}>
                                            {isCorrect ? '✅ Correct' : '❌ Incorrect'}
                                        </div>
                                        <div style={{ opacity: .95 }}>
                                            {q.explanations[q.answer]}
                                        </div>
                                        {!isCorrect && userPick >= 0 && (
                                            <div style={{ opacity: .7, marginTop: 6 }}>
                                                Your choice: “{q.choices[userPick]}”
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                    {!submitted ? (
                        <button
                            className="btn"
                            onClick={() => setSubmitted(true)}
                            disabled={picked.includes(-1)}
                            style={{ opacity: picked.includes(-1) ? 0.6 : 1 }}
                        >
                            Submit
                        </button>
                    ) : (
                        <>
                            <div style={{ alignSelf: 'center', marginRight: 'auto', opacity: .9 }}>
                                Score: {correctCount} / {questions.length}
                            </div>
                            <button
                                className="btn"
                                onClick={() => { setSubmitted(false); setPicked(Array(questions.length).fill(-1)) }}
                            >
                                Retry
                            </button>
                            <button
                                className="btn"
                                onClick={() => { resumeFromQuiz() }}
                                style={{ outline: '2px solid #66e0ff' }}
                            >
                                Resume Impact
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
