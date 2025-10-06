// src/tabs/Mitigation.tsx  (use your real file/path)
import React, { useEffect } from 'react';
import MitigationPanel from '../components/MitigationPanel';
import { useMitigationStore } from '../stores/mitigationStore';

export default function Mitigation() {
  const setAsteroidMass = useMitigationStore((s) => s.setAsteroidMass);
  const recompute = useMitigationStore((s) => s.recompute);

  useEffect(() => {
    // TODO: replace with real asteroid mass from your selection UI:
    // mass = density * (π/6) * D^3
    setAsteroidMass(1.2e12);
    recompute();
  }, [setAsteroidMass, recompute]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', height: '100%' }}>
      <div style={{ borderRight: '1px solid #222', overflow: 'auto' }}>
        <MitigationPanel />
      </div>

      {/* Keep your R3F canvas/scene on the right */}
      <div style={{ position: 'relative' }}>
        {/* <GlobeCanvas /> or whatever you already render */}
      </div>
    </div>
  );
}
