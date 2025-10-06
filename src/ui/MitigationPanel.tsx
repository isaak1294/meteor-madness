import { useSimStore, Mitigation } from '../state/useSimStore'

export default function MitigationPanel(){
  const mitigation = useSimStore(s=>s.mitigation)
  const mitigationPower = useSimStore(s=>s.mitigationPower)
  const leadTime = useSimStore(s=>s.leadTime)

  const setMitigation       = useSimStore(s=>s.setMitigation)
  const setMitigationPower  = useSimStore(s=>s.setMitigationPower)
  const setLeadTime         = useSimStore(s=>s.setLeadTime)

  const setMit = (m: Mitigation) => setMitigation(m)

  return (
    <div className="panel mitigation-panel">
      <div className="badge">Mitigation</div>

      <div style={{display:'grid', gap:8, gridTemplateColumns:'1fr 1fr 1fr', marginTop:8}}>
        <button className={'cta ' + (mitigation==='kinetic' ? 'active' : '')} onClick={()=>setMit('kinetic')}>Kinetic</button>
        <button className={'cta ' + (mitigation==='tractor' ? 'active' : '')} onClick={()=>setMit('tractor')}>Gravity Tractor</button>
        <button className={'cta ' + (mitigation==='laser'   ? 'active' : '')} onClick={()=>setMit('laser')}>Laser Ablation</button>
      </div>

      <div className="row" style={{marginTop:10}}>
        <span className="label">Power</span>
        <span className="value">{mitigationPower.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={0} max={1} step={0.01}
        value={mitigationPower}
        onChange={(e)=>setMitigationPower(Number(e.target.value))}
      />

      <div className="row">
        <span className="label">Lead Time (s)</span>
        <span className="value">{leadTime.toFixed(0)}</span>
      </div>
      <input
        type="range"
        min={0} max={60} step={1}
        value={leadTime}
        onChange={(e)=>setLeadTime(Number(e.target.value))}
      />

      <div className="legend small">
        <span>Δv nudge</span><span>Orbit tug</span><span>Beam ablation</span>
      </div>
    </div>
  )
}
