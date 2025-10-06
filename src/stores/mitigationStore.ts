// src/stores/mitigationStore.ts
import { create } from 'zustand';
import {
  Strategy,
  alongTrackShiftKm,
  deltaVFromKinetic,
  deltaVFromTractor,
} from '../lib/mitigation';

type KineticParams = { beta: number; m_sc_kg: number; v_rel_ms: number };
type TractorParams = { thrust_N: number; duration_days: number };
type NuclearParams = { assumedDeltaV_ms: number };

type MitigationState = {
  strategy: Strategy;
  leadTime_days: number;
  asteroidMass_kg: number;

  kinetic: KineticParams;
  tractor: TractorParams;
  nuclear: NuclearParams;
  civil: Record<string, never>;

  deltaV_ms: number;
  shiftKm: number;

  setStrategy: (s: Strategy) => void;
  setLeadTime: (days: number) => void;
  setAsteroidMass: (kg: number) => void;

  updateKinetic: (p: Partial<KineticParams>) => void;
  updateTractor: (p: Partial<TractorParams>) => void;
  updateNuclear: (p: Partial<NuclearParams>) => void;

  recompute: () => void;
};

export const useMitigationStore = create<MitigationState>((set, get) => ({
  strategy: 'kinetic',
  leadTime_days: 365, // default 1 year
  asteroidMass_kg: 1e12, // replace with your asteroid selection result

  kinetic: { beta: 3, m_sc_kg: 1000, v_rel_ms: 6000 },
  tractor: { thrust_N: 0.2, duration_days: 730 },
  nuclear: { assumedDeltaV_ms: 0.05 },
  civil: {},

  deltaV_ms: 0,
  shiftKm: 0,

  setStrategy: (s) => {
    set({ strategy: s });
    get().recompute();
  },
  setLeadTime: (days) => {
    set({ leadTime_days: days });
    get().recompute();
  },
  setAsteroidMass: (kg) => {
    set({ asteroidMass_kg: kg });
    get().recompute();
  },

  updateKinetic: (p) => {
    set({ kinetic: { ...get().kinetic, ...p } });
    get().recompute();
  },
  updateTractor: (p) => {
    set({ tractor: { ...get().tractor, ...p } });
    get().recompute();
  },
  updateNuclear: (p) => {
    set({ nuclear: { ...get().nuclear, ...p } });
    get().recompute();
  },

  recompute: () => {
    const { strategy, leadTime_days, asteroidMass_kg, kinetic, tractor, nuclear } = get();
    let deltaV_ms = 0;

    if (strategy === 'kinetic') {
      deltaV_ms = deltaVFromKinetic({
        beta: kinetic.beta,
        m_sc_kg: kinetic.m_sc_kg,
        v_rel_ms: kinetic.v_rel_ms,
        m_ast_kg: asteroidMass_kg,
      });
    } else if (strategy === 'tractor') {
      deltaV_ms = deltaVFromTractor({
        thrust_N: tractor.thrust_N,
        duration_days: tractor.duration_days,
        m_ast_kg: asteroidMass_kg,
      });
    } else if (strategy === 'nuclear') {
      deltaV_ms = nuclear.assumedDeltaV_ms;
    } else {
      deltaV_ms = 0; // civil
    }

    set({ deltaV_ms, shiftKm: alongTrackShiftKm(deltaV_ms, leadTime_days) });
  },
}));
