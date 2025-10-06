// src/components/MitigationPanel.tsx
import React from 'react';
import { STRATEGY_INFO, Strategy } from '../lib/mitigation';
import { useMitigationStore } from '../stores/mitigationStore';

const section: React.CSSProperties = { marginTop: 16 };
const row: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center' };
const label: React.CSSProperties = { width: 160, fontWeight: 600, fontSize: 13, opacity: 0.9 };
const val: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

function StrategyCards() {
  const strategy = useMitigationStore((s) => s.strategy);
  const setStrategy = useMitigationStore((s) => s.setStrategy);

  const Card = ({ id }: { id: Strategy }) => {
    const info = STRATEGY_INFO[id];
    const active = strategy === id;
    return (
      <button
        onClick={() => setStrategy(id)}
        style={{
          border: active ? '2px solid #0ea5e9' : '1px solid #333',
          borderRadius: 10,
          padding: 12,
          textAlign: 'left',
          background: active ? 'rgba(14,165,233,0.08)' : 'transparent',
          cursor: 'pointer',
          width: '100%',
        }}
      >
        <div style={{ fontWeight: 700 }}>{info.title}</div>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
          Lead time: {info.leadTimeHint} • Δv: {info.deltaVHint}
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>{info.riskNotes}</div>
      </button>
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <Card id="kinetic" />
      <Card id="tractor" />
      <Card id="nuclear" />
      <Card id="civil" />
    </div>
  );
}

function LeadTimeAndSummary() {
  const lead = useMitigationStore((s) => s.leadTime_days);
  const setLead = useMitigationStore((s) => s.setLeadTime);
  const deltaV = useMitigationStore((s) => s.deltaV_ms);
  const shiftKm = useMitigationStore((s) => s.shiftKm);

  return (
    <div style={section}>
      <div style={row}>
        <div style={label}>Lead time</div>
        <input
          type="range"
          min={1}
          max={3650}
          step={1}
          value={lead}
          onChange={(e) => setLead(parseInt(e.target.value, 10))}
          style={{ flex: 1 }}
        />
        <div style={val}>{lead} days</div>
      </div>

      <div style={{ ...row, marginTop: 8 }}>
        <div style={label}>Δv (derived)</div>
        <div style={val}>{deltaV.toFixed(5)} m/s</div>
      </div>

      <div style={{ ...row, marginTop: 4 }}>
        <div style={label}>Along-track shift</div>
        <div style={val}>{shiftKm.toFixed(1)} km</div>
      </div>
    </div>
  );
}

function KineticControls() {
  const { beta, m_sc_kg, v_rel_ms } = useMitigationStore((s) => s.kinetic);
  const update = useMitigationStore((s) => s.updateKinetic);
  return (
    <div style={section}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Kinetic parameters</div>
      <div style={row}>
        <div style={label}>β (1–5)</div>
        <input
          type="range"
          min={1}
          max={5}
          step={0.1}
          value={beta}
          onChange={(e) => update({ beta: parseFloat(e.target.value) })}
          style={{ flex: 1 }}
        />
        <div style={val}>{beta.toFixed(1)}</div>
      </div>
      <div style={{ ...row, marginTop: 8 }}>
        <div style={label}>Spacecraft mass (kg)</div>
        <input
          type="number"
          value={m_sc_kg}
          onChange={(e) => update({ m_sc_kg: Number(e.target.value) })}
          style={{ flex: 1 }}
        />
      </div>
      <div style={{ ...row, marginTop: 8 }}>
        <div style={label}>Relative velocity (m/s)</div>
        <input
          type="number"
          value={v_rel_ms}
          onChange={(e) => update({ v_rel_ms: Number(e.target.value) })}
          style={{ flex: 1 }}
        />
      </div>
    </div>
  );
}

function TractorControls() {
  const { thrust_N, duration_days } = useMitigationStore((s) => s.tractor);
  const update = useMitigationStore((s) => s.updateTractor);
  return (
    <div style={section}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Gravity tractor parameters</div>
      <div style={row}>
        <div style={label}>Thrust (N)</div>
        <input
          type="number"
          value={thrust_N}
          onChange={(e) => update({ thrust_N: Number(e.target.value) })}
          style={{ flex: 1 }}
        />
      </div>
      <div style={{ ...row, marginTop: 8 }}>
        <div style={label}>Duration (days)</div>
        <input
          type="number"
          value={duration_days}
          onChange={(e) => update({ duration_days: Number(e.target.value) })}
          style={{ flex: 1 }}
        />
      </div>
    </div>
  );
}

function NuclearControls() {
  const { assumedDeltaV_ms } = useMitigationStore((s) => s.nuclear);
  const update = useMitigationStore((s) => s.updateNuclear);
  return (
    <div style={section}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Nuclear standoff (illustrative)</div>
      <div style={row}>
        <div style={label}>Assumed Δv (m/s)</div>
        <input
          type="number"
          value={assumedDeltaV_ms}
          onChange={(e) => update({ assumedDeltaV_ms: Number(e.target.value) })}
          style={{ flex: 1 }}
        />
      </div>
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
        Educational slider — map yield/standoff → Δv later if you want.
      </div>
    </div>
  );
}

function CivilControls() {
  return (
    <div style={section}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Civil protection</div>
      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Shows evacuation/shelter overlays and countdown. No deflection applied.
      </div>
    </div>
  );
}

export default function MitigationPanel() {
  const strategy = useMitigationStore((s) => s.strategy);

  return (
    <div style={{ padding: 12, color: '#e5e7eb' }}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Mitigation</div>

      <StrategyCards />
      <LeadTimeAndSummary />

      {strategy === 'kinetic' && <KineticControls />}
      {strategy === 'tractor' && <TractorControls />}
      {strategy === 'nuclear' && <NuclearControls />}
      {strategy === 'civil' && <CivilControls />}

      <div style={{ marginTop: 16, fontSize: 12, opacity: 0.65 }}>
        Your 3D scene can read <code>shiftKm</code> and <code>strategy</code> from the store to draw the
        “after” marker/overlays.
      </div>
    </div>
  );
}
