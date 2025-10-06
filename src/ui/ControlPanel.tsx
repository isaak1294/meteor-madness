// src/ui/ControlPanel.tsx
import { useEffect, useMemo } from 'react'
import { useSimStore } from '../state/useSimStore'

const sv = (n: number | undefined | null, fallback = 0) =>
  Number.isFinite(n as number) ? (n as number) : fallback

export default function ControlPanel() {
  const s = useSimStore()

  // rAF loop
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      useSimStore.getState().tick(dt)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  // labels (safe)
  const durationNum = sv(s.duration, 10)
  const timeNum = sv(s.time, 0)
  const durationLabel = useMemo(() => durationNum.toFixed(0), [durationNum])
  const timeLabel = useMemo(() => timeNum.toFixed(1), [timeNum])

  // lock everything except Start/Pause, Reset, and Impact Analysis
  // also lock while quizVisible so the user can’t change values mid-quiz
  const locked = s.running || s.quizVisible
  const dim = locked ? 0.5 : 1

  return (
    <div 
      className="panel control" 
      style={{ 
        pointerEvents: 'auto',
        zIndex: 10
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Preset picker */}
      <div style={{ marginBottom: 12 }}>
        <select
          value={s.selectedPresetId}
          onChange={(e) => s.selectPreset(e.target.value)}
          disabled={locked}
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(255,255,255,.06)',
            color: '#e7edf7',
            border: '1px solid rgba(255,255,255,.08)',
            opacity: dim
          }}
        >
          {s.presets.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Start/Pause + Reset — always enabled */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className="btn" onClick={() => s.toggleRun()}>
          {s.running ? 'Pause' : 'Launch'}
        </button>
        <button className="btn" onClick={() => s.reset()}>
          Reset
        </button>
      </div>

      {/* Impact Analysis — always enabled */}
      <div style={{ marginBottom: 12 }}>
        <button
          className="cta"
          onClick={() => s.showImpactAnalysis()}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: 'linear-gradient(180deg, rgba(102, 224, 255, 0.15), rgba(102, 224, 255, 0.05))',
            borderColor: '#66e0ff',
            fontSize: '14px',
            fontWeight: '600',
            opacity: 1
          }}
        >
          Show Impact Analysis
        </button>
      </div>

      {/* Size */}
      <div className="row"><span className="label">Asteroid Size (m)</span><span className="value">{sv(s.size, 120).toFixed(0)}</span></div>
      <input
        type="range"
        min={10}
        max={1000}
        step={1}
        value={sv(s.size, 120)}
        onChange={e => s.setSize(+e.target.value)}
        disabled={locked}
        style={{ opacity: dim }}
      />

      {/* Speed */}
      <div className="row"><span className="label">Speed (km/s)</span><span className="value">{sv(s.speed, 18).toFixed(1)}</span></div>
      <input
        type="range"
        min={5}
        max={70}
        step={0.1}
        value={sv(s.speed, 18)}
        onChange={e => s.setSpeed(+e.target.value)}
        disabled={locked}
        style={{ opacity: dim }}
      />

      {/* Approach Angle */}
      <div className="row"><span className="label">Approach Angle (°)</span><span className="value">{sv(s.approachAngle, 35).toFixed(0)}</span></div>
      <input
        type="range"
        min={5}
        max={85}
        step={1}
        value={sv(s.approachAngle, 35)}
        onChange={e => s.setApproachAngle(+e.target.value)}
        disabled={locked}
        style={{ opacity: dim }}
      />

      {/* Density */}
      <div className="row"><span className="label">Density (kg/m³)</span><span className="value">{sv(s.density, 3000).toFixed(0)}</span></div>
      <input
        type="range"
        min={500}
        max={7000}
        step={100}
        value={sv(s.density, 3000)}
        onChange={e => s.setDensity(+e.target.value)}
        disabled={locked}
        style={{ opacity: dim }}
      />

      {/* Time scrubber */}
      <div className="row"><span className="label">Time</span><span className="value">{timeLabel} / {durationLabel}s</span></div>
      <input
        type="range"
        min={0}
        max={Math.max(0.1, durationNum)}
        step={0.1}
        value={Math.min(timeNum, durationNum)}
        onChange={(e) => s.setTime(+e.target.value)}
        disabled={locked}
        style={{ opacity: dim }}
      />
    </div>
  )
}
