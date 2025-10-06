import React, { useEffect, useState } from 'react';
import {
  preloadAsteroidListOnLoad,
  getAsteroidInfoById,
  type AsteroidListItem,
  type ProcessedAsteroidInfo
} from '../Fetching/fetchNasa';
import { useSimStore } from '../state/useSimStore';

export default function AsteroidViewer() {
  const [list, setList] = useState<AsteroidListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>(''); // no auto-select
  const [info, setInfo] = useState<ProcessedAsteroidInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [activeTab, setActiveTab] = useState<'simple' | 'technical'>('simple');

  // Connect to simulation store
  const setNasaAsteroidData = useSimStore(s => s.setNasaAsteroidData);
  const useNasaData = useSimStore(s => s.useNasaData);
  const clearNasaData = useSimStore(s => s.clearNasaData);

  // Preload asteroid list on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const items = await preloadAsteroidListOnLoad();
        if (!cancelled) {
          const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
          setList(sorted);
        }
      } catch (err) {
        console.error('Failed to preload:', err);
        if (!cancelled) setError('Failed to load asteroid list.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch details when user clicks "Search"
  const onSearch = async () => {
    if (!selectedId) return;
    try {
      setLoading(true);
      setError(null);
      const details = await getAsteroidInfoById(selectedId);
      setInfo(details);
    } catch (err) {
      console.error('Failed to fetch details:', err);
      setError('Failed to fetch asteroid details.');
    } finally {
      setLoading(false);
    }
  };

  // Apply button handler
  const onApply = () => {
    if (info) {
      setNasaAsteroidData(info);
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 1500);
    }
  };

  return (
    <div
      className="Nasa Asteriod data nasa-panel"
      style={{
        pointerEvents: 'auto',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
      onMouseEnter={(e) => e.stopPropagation()}
      onMouseLeave={(e) => e.stopPropagation()}
    >
      {/* Fixed Header */}
      <div style={{ flexShrink: 0, marginBottom: 12 }}>
        <h2 style={{ margin: '0 0 12px 0' }}>Today's Asteroid Near Earth</h2>

        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 6 }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={loading || list.length === 0}
            size={1}
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.96)',
              color: '#000000',
              border: '1px solid rgba(255,255,255,.08)',
              pointerEvents: 'auto',
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <option value="" disabled>
              {loading ? 'Loading…' : list.length ? 'Select an asteroid…' : 'No asteroids found'}
            </option>
            {list.map((item) => (
              <option key={item.id} value={item.id} title={item.name}>
                {item.name}
              </option>
            ))}
          </select>

          <button
            className="btn"
            onClick={onSearch}
            disabled={loading || !selectedId}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {loading ? 'Loading...' : 'Search'}
          </button>
        </div>

        {error && (
          <div style={{ color: '#ff8585', marginBottom: 8, fontSize: 20 }}>
            {error}
          </div>
        )}
      </div>

      {/* Scrollable Content + Tabs */}
      {info && (
        <div
          className="nasa-asteroid-data"
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 8,
            background: 'rgba(255,255,255,.03)',
            border: '1px solid rgba(255,255,255,.06)',
            color: '#e7edf7',
            fontSize: 15,
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingBottom: 16,
            pointerEvents: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.3) transparent',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Tabs header (sticky) */}
          <div
            role="tablist"
            aria-label="Asteroid info tabs"
            style={{
              display: 'flex',
              gap: 8,
              position: 'sticky',
              top: 0,
              background: 'linear-gradient(180deg, rgba(11,15,26,0.9), rgba(11,15,26,0.65))',
              paddingTop: 6,
              paddingBottom: 6,
              zIndex: 1,
              backdropFilter: 'blur(6px) saturate(120%)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              role="tab"
              aria-selected={activeTab === 'simple'}
              onClick={() => setActiveTab('simple')}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background:
                  activeTab === 'simple'
                    ? 'rgba(102,224,255,0.2)'
                    : 'rgba(255,255,255,0.06)',
                color: 'var(--text)',
                fontWeight: 700,
                cursor: 'pointer',
                outline: activeTab === 'simple' ? '2px solid var(--accent)' : 'none',
              }}
            >
              Simple
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'technical'}
              onClick={() => setActiveTab('technical')}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background:
                  activeTab === 'technical'
                    ? 'rgba(102,224,255,0.2)'
                    : 'rgba(255,255,255,0.06)',
                color: 'var(--text)',
                fontWeight: 700,
                cursor: 'pointer',
                outline: activeTab === 'technical' ? '2px solid var(--accent)' : 'none',
              }}
            >
              Technical
            </button>
          </div>

          {/* Tab panels */}
          {activeTab === 'simple' && (
            <div role="tabpanel" aria-label="Simple view">
              <div style={{ fontSize: 25, fontWeight: 600, marginBottom: 8 }}>
                Asteroid Name: {info.basicInfo.name}
              </div>
    
            
              <div style={{ fontWeight: 600, marginTop: 12, marginBottom: 4 , color:'#66ff66'}}>Q: Potentially Hazardous to earth?</div>
              <div style={{ marginBottom: 40 }}>
               {info.basicInfo.isPotentiallyHazardous ? 'Yes' : 'No'}
              </div>

              <div style={{ fontWeight: 600, marginTop: 12, marginBottom: 4 , color:'#66ff66'}}>Q: How big is it?</div>
              <div style={{ marginBottom: 40 }}>
                The biggest part of it have a diameter of {info.size.kilometers.max} km !
              </div>

              <div style={{ fontWeight: 600, marginTop: 12, marginBottom: 4 ,color:'#66ff66'}}>Q: How fast is it going?</div>
              <div style={{ marginBottom: 40 }}>km/s: {info.speed.kmPerSecond ?? 'N/A'}</div>

              <div style={{ fontWeight: 600, marginTop: 12, marginBottom: 4 ,color:'#66ff66'}}>Q: How close is it today?</div>
              <div style={{ marginBottom: 40 }}>It is {info.closeApproach.missDistanceKm ?? 'N/A'} km !</div>

              <div style={{ fontWeight: 600, marginTop: 12, marginBottom: 4 ,color:'#66ff66'}}>Q: Is it going to hit us ?</div>
              <div style={{
                marginBottom: 4,
            
              }}>
                Risk Level: {info.impactRisk.riskLevel}
              </div>
              {info.impactRisk.probability !== null && (
                <div style={{ fontSize: 15, marginBottom: 4 }}>
                  Probability: {(info.impactRisk.probability * 100).toFixed(6)}%
                </div>
              )}

              <div style={{ fontWeight: 600, marginTop: 12, marginBottom: 4, color:'#66ff66' }}>Q: When will it approach next time?</div>
              {info.impactRisk.nextCloseApproach.date && (
                <div style={{ fontSize: 15, marginBottom: 4 }}>
                  Next time: {info.impactRisk.nextCloseApproach.date}
                </div>
              )}
              {info.impactRisk.yearsUntilNextApproach && (
                <div style={{ fontSize: 15, marginBottom: 4 }}>
                  In: {info.impactRisk.yearsUntilNextApproach} years
                </div>
              )}
              {info.impactRisk.nextCloseApproach.missDistanceKm && (
                <div style={{ fontSize: 15, marginBottom: 8 }}>
                  How close are we: {info.impactRisk.nextCloseApproach.missDistanceKm.toFixed(0)} km
                </div>
              )}
              <div style={{ marginBottom: 12 }}>
                Detailed information link: <a href={info.basicInfo.nasaJplUrl} target="_blank" rel="noreferrer" style={{ color: '#6ab7ff' }}>
                  NASA JPL Link
                </a>
              </div>
            </div>
          )}

          {activeTab === 'technical' && (
            <div role="tabpanel" aria-label="Technical view">
              <div style={{ fontSize: 25, fontWeight: 600, marginBottom: 8 }}>
                Asteroid Name: {info.basicInfo.name}
              </div>
              <div style={{ marginBottom: 4 }}>
                Absolute Magnitude: {info.basicInfo.absoluteMagnitude}
              </div>
              <div style={{ marginBottom: 4 }}>
                Potentially Hazardous to earth: {info.basicInfo.isPotentiallyHazardous ? 'Yes' : 'No'}
              </div>

              <div style={{ fontSize: 20 , fontWeight: 600, marginTop: 12, marginBottom: 4 }}>
                Diameter of Asteroid
              </div>
              <div style={{ marginBottom: 4 }}>
                Min: {info.size.kilometers.min} km | Max: {info.size.kilometers.max} km | Avg: {info.size.kilometers.avg} km
              </div>

              <div style={{ fontSize: 20, fontWeight: 600, marginTop: 12, marginBottom: 4 }}>Speed of the Asteroid</div>
              <div style={{ marginBottom: 4 }}>km/s: {info.speed.kmPerSecond ?? 'N/A'}</div>
              <div style={{ marginBottom: 4 }}>km/h: {info.speed.kmPerHour ?? 'N/A'}</div>
              <div style={{ marginBottom: 4 }}>mph: {info.speed.milesPerHour ?? 'N/A'}</div>

              <div style={{ fontSize: 20, fontWeight: 600, marginTop: 12, marginBottom: 4 }}>Close Approach</div>
              <div style={{ marginBottom: 4 }}>Date: {info.closeApproach.date ?? 'N/A'}</div>
              <div style={{ marginBottom: 8 }}>Miss Distance: {info.closeApproach.missDistanceKm ?? 'N/A'} km</div>

              <div style={{ fontSize: 20, fontWeight: 600, marginTop: 12, marginBottom: 4 }}>Orbital Elements</div>
              <div style={{ fontSize: 15, marginBottom: 4 }}>
                Semi-Major Axis: {info.orbital.semiMajorAxisAU ?? 'N/A'} AU
              </div>
              <div style={{ fontSize: 15, marginBottom: 4 }}>
                Eccentricity: {info.orbital.eccentricity ?? 'N/A'}
              </div>
              <div style={{ fontSize: 15, marginBottom: 4 }}>
                Orbital Period: {info.orbital.orbitalPeriodDays ?? 'N/A'} days
              </div>
              <div style={{ fontSize: 15, marginBottom: 4 }}>
                Perihelion: {info.orbital.perihelionDistanceAU ?? 'N/A'} AU
              </div>
              <div style={{ fontSize: 15, marginBottom: 8 }}>
                Aphelion: {info.orbital.aphelionDistanceAU ?? 'N/A'} AU
              </div>

              <div style={{ fontSize: 20, fontWeight: 600, marginTop: 12, marginBottom: 4 }}>Impact Risk Assessment</div>
              <div style={{
                marginBottom: 4,
                color: info.impactRisk.riskLevel === 'HIGH' ? '#ff6b6b' :
                       info.impactRisk.riskLevel === 'MEDIUM' ? '#ffa500' :
                       info.impactRisk.riskLevel === 'LOW' ? '#66ff66' : '#999'
              }}>
                Risk Level: {info.impactRisk.riskLevel}
              </div>
              {info.impactRisk.probability !== null && (
                <div style={{ fontSize: 15, marginBottom: 4 }}>
                  Impact Probability: {(info.impactRisk.probability * 100).toFixed(6)}%
                </div>
              )}
              {info.impactRisk.nextCloseApproach.date && (
                <div style={{ fontSize: 15, marginBottom: 4 }}>
                  Next Approach: {info.impactRisk.nextCloseApproach.date}
                </div>
              )}
              {info.impactRisk.yearsUntilNextApproach && (
                <div style={{ fontSize: 15, marginBottom: 4 }}>
                  In: {info.impactRisk.yearsUntilNextApproach} years
                </div>
              )}
              {info.impactRisk.nextCloseApproach.missDistanceKm && (
                <div style={{ fontSize: 15, marginBottom: 8 }}>
                  Next Miss Distance: {info.impactRisk.nextCloseApproach.missDistanceKm.toFixed(0)} km
                </div>
              )}
              <div style={{ marginBottom: 12 }}>
                Detailed information link: <a href={info.basicInfo.nasaJplUrl} target="_blank" rel="noreferrer" style={{ color: '#6ab7ff' }}>
                  NASA JPL Link
                </a>
              </div>
            </div>
          )}

          {/* Apply Parameters inside scrollable content */}
          <div
            style={{
              position: 'relative',
              paddingTop: 8,
              marginTop: 4,
              borderTop: '1px dashed rgba(255,255,255,0.12)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onApply}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'linear-gradient(135deg, #66e0ff, #4dd4ff)',
                border: '1px solid #66e0ff',
                borderRadius: 8,
                color: '#000',
                fontWeight: 700,
                cursor: info ? 'pointer' : 'not-allowed',
                fontSize: 15,
                opacity: info ? 1 : 0.6,
              }}
              disabled={!info}
            >
              {activeTab === 'simple'
                ? 'Apply Parameters'
                : 'Apply Parameters'}
            </button>
          </div>
        </div>
      )}

      {/* Success Message */}
      {showSuccessMessage && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -500%)',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            color: '#ffffff',
            padding: '15 30px',
            borderRadius: '12px',
            border: '2px solid #66e0ff',
            fontSize: '18px',
            fontWeight: '600',
            zIndex: 1000,
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(102, 224, 255, 0.3)',
            backdropFilter: 'blur(10px)',
            pointerEvents: 'none',
          }}
        >
          Parameters Applied Successfully!
          <div style={{ fontSize: '14px', marginTop: '8px', opacity: 0.8 }}>
            Simulation now uses real NASA data
          </div>
        </div>
      )}
    </div>
  );
}