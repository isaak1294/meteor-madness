import { useSimStore } from '../state/useSimStore'
import { MapContainer, TileLayer, Circle, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import { assessPopulationDensity, estimateCasualties, type DensityAssessment, type CasualtyEstimate, type TsunamiRisk, type TerrainKind } from '../lib/casualty'

interface ImpactMapProps {
  onClose: () => void
}

// Component to center the map on impact location
function MapCenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lon], 13)
  }, [lat, lon, map])
  return null
}

export default function ImpactMap({ onClose }: ImpactMapProps) {
  const { impactLat, impactLon, readouts, setShowImpactMap, pause, size: asteroidSizeFromStore } = useSimStore(s => ({
    impactLat: s.impactLat,
    impactLon: s.impactLon,
    readouts: s.readouts,
    setShowImpactMap: s.setShowImpactMap,
    pause: s.pause,
    size: s.size
  }))

  const handleClose = () => {
    // Set time to just before impact to prevent re-triggering
    const setTime = useSimStore.getState().setTime
    const duration = useSimStore.getState().duration
    setTime(duration - 0.1) // Set to 0.1 seconds before impact
    setShowImpactMap(false)
    onClose()
  }

  const handleReturnToSimulation = () => {
    // Reset the simulation completely when returning (includes shake state)
    const reset = useSimStore.getState().reset
    reset()
    onClose()
  }

  const { craterKm, energyTNT, speed, size } = readouts

  // Calculate impact zone sizes based on meteorite properties
  // Using scientific formulas for impact effects
  const craterDiameterKm = craterKm
  const blastRadiusKm = craterDiameterKm * 2.5  // Blast radius (thermal effects)
  const seismicRadiusKm = craterDiameterKm * 15  // Seismic effects radius
  
  // Leaflet uses meters for circle radius, so convert km to meters
  const craterRadiusM = (craterDiameterKm / 2) * 1000
  const blastRadiusM = blastRadiusKm * 1000
  const seismicRadiusM = seismicRadiusKm * 1000

  // Environmental effects state
  const [elevation, setElevation] = useState<number | null>(null)
  const [terrainType, setTerrainType] = useState<string>('Unknown')
  const [tsunamiRisk, setTsunamiRisk] = useState<string>('Calculating...')
  const [environmentalEffects, setEnvironmentalEffects] = useState<string[]>([])
  
  // Population impact state
  const [densityAssessment, setDensityAssessment] = useState<DensityAssessment | null>(null)
  const [casualtyEstimate, setCasualtyEstimate] = useState<CasualtyEstimate | null>(null)
  const [earthquakeMagnitude, setEarthquakeMagnitude] = useState<number>(0)

  // Fetch elevation data
  useEffect(() => {
    const fetchElevation = async () => {
      try {
        const response = await fetch(
          `https://api.open-elevation.com/api/v1/lookup?locations=${impactLat},${impactLon}`
        )
        const data = await response.json()
        if (data.results && data.results[0]) {
          const elev = data.results[0].elevation
          setElevation(elev)
          analyzeEnvironmentalEffects(elev)
        }
      } catch (error) {
        console.error('Failed to fetch elevation:', error)
        setElevation(null)
        setTerrainType('Data unavailable')
        setTsunamiRisk('Unable to determine')
      }
    }
    
    fetchElevation()
  }, [impactLat, impactLon])

  // Calculate casualties when we have the necessary data
  useEffect(() => {
    const calculateCasualties = async () => {
      if (elevation === null || tsunamiRisk === 'Calculating...' || tsunamiRisk === 'Unable to determine') {
        return
      }

      try {
        // Determine terrain type from elevation
        let terrain: TerrainKind = 'Unknown'
        if (elevation < 0) terrain = 'Ocean/Sea'
        else if (elevation < 10) terrain = 'Coastal/Low-lying'
        else if (elevation < 100) terrain = 'Plains/Valley'
        else if (elevation < 500) terrain = 'Hills/Plateau'
        else terrain = 'Mountains'

        // Assess population density
        const density = await assessPopulationDensity(impactLat, impactLon, terrain)
        setDensityAssessment(density)
        
        // Calculate earthquake magnitude
        const magnitude = 4 + Math.log10(energyTNT)
        setEarthquakeMagnitude(magnitude)
        
        // Check if seismic zone touches land
        const isOceanImpact = terrain === 'Ocean/Sea'
        
        if (isOceanImpact) {
          // For ocean impacts, check if seismic zone could reach land
          // If impact is in deep ocean far from any coastline, casualties = 0
          const isDeepOcean = elevation < -1000
          const isSmallSeismicZone = seismicRadiusKm < 100
          
          if (isDeepOcean || isSmallSeismicZone) {
            // Seismic zone doesn't reach land - hard code to 0 casualties
            setCasualtyEstimate({
              density,
              areaKm2: Math.PI * Math.pow(craterKm / 2 + 0.6 * blastRadiusKm, 2),
              fatalityRate: 0,
              casualties: 0
            })
          } else {
            // Seismic zone might reach land - calculate casualties
            const casualties = estimateCasualties({
              energyTNT,
              craterKm,
              blastRadiusKm,
              densityPkm2: density.densityPkm2,
              tsunamiRisk: tsunamiRisk.includes('EXTREME') ? 'EXTREME' :
                          tsunamiRisk.includes('HIGH') ? 'HIGH' :
                          tsunamiRisk.includes('MODERATE') ? 'MODERATE' :
                          tsunamiRisk.includes('LOW') ? 'LOW' : 'NEGLIGIBLE'
            })
            setCasualtyEstimate(casualties)
          }
        } else {
          // Land impact - calculate casualties normally
          const casualties = estimateCasualties({
            energyTNT,
            craterKm,
            blastRadiusKm,
            densityPkm2: density.densityPkm2,
            tsunamiRisk: tsunamiRisk.includes('EXTREME') ? 'EXTREME' :
                        tsunamiRisk.includes('HIGH') ? 'HIGH' :
                        tsunamiRisk.includes('MODERATE') ? 'MODERATE' :
                        tsunamiRisk.includes('LOW') ? 'LOW' : 'NEGLIGIBLE'
          })
          setCasualtyEstimate(casualties)
        }
      } catch (error) {
        console.error('Failed to calculate casualties:', error)
      }
    }
    
    calculateCasualties()
  }, [impactLat, impactLon, energyTNT, craterKm, blastRadiusKm, elevation, tsunamiRisk])

    const analyzeEnvironmentalEffects = (elev: number): TerrainKind => {
    const effects: string[] = []
    let terrain: TerrainKind = 'Unknown'
    let tsunamiRiskValue: string = 'Calculating...'
    
    // Determine terrain type
    if (elev < 0) {
      terrain = 'Ocean/Sea'
      setTerrainType('Ocean/Sea')
      
      // Ocean impact - high tsunami risk
      const waterDepth = Math.abs(elev)
      if (energyTNT > 100) {
        tsunamiRiskValue = 'EXTREME'
        setTsunamiRisk('EXTREME - Mega-tsunami expected')
        effects.push(`Mega-tsunami with waves up to ${(energyTNT * 0.5).toFixed(0)}m high`)
        effects.push(`Coastal devastation within ${(craterKm * 50).toFixed(0)} km`)
        effects.push('Widespread flooding of low-lying areas')
      } else if (energyTNT > 10) {
        tsunamiRiskValue = 'HIGH'
        setTsunamiRisk('HIGH - Major tsunami likely')
        effects.push(`Major tsunami waves up to ${(energyTNT * 0.3).toFixed(0)}m`)
        effects.push('Significant coastal damage expected')
      } else {
        tsunamiRiskValue = 'MODERATE'
        setTsunamiRisk('MODERATE - Local tsunami possible')
        effects.push('Local tsunami waves possible')
      }
      effects.push('Massive water displacement')
      effects.push('Marine ecosystem destruction')
      
    } else if (elev < 10) {
      terrain = 'Coastal/Low-lying'
      setTerrainType('Coastal/Low-lying')
      tsunamiRiskValue = 'MODERATE'
      setTsunamiRisk('MODERATE - Vulnerable to flooding')
      effects.push('Severe flooding from displaced water')
      effects.push('Storm surge-like effects')
      effects.push('Groundwater contamination')
      
    } else if (elev < 100) {
      terrain = 'Plains/Valley'
      setTerrainType('Plains/Valley')
      tsunamiRiskValue = 'LOW'
      setTsunamiRisk('LOW - Inland location')
      effects.push('Widespread ground shaking')
      effects.push('Dust cloud affecting air quality')
      effects.push('Potential river/lake displacement')
      
    } else if (elev < 500) {
      terrain = 'Hills/Plateau'
      setTerrainType('Hills/Plateau')
      tsunamiRiskValue = 'LOW'
      setTsunamiRisk('VERY LOW - Elevated terrain')
      effects.push('Seismic landslides possible')
      effects.push('Regional atmospheric disturbance')
      
    } else {
      terrain = 'Mountains'
      setTerrainType('Mountains')
      tsunamiRiskValue = 'NEGLIGIBLE'
      setTsunamiRisk('NEGLIGIBLE - Mountainous terrain')
      effects.push('Avalanches and rockslides')
      effects.push('Valley flooding from melted ice')
    }
    
    // Add energy-based effects
    if (energyTNT > 1000) {
      effects.push('Global climate impact (nuclear winter)')
      effects.push('Mass extinction event likely')
    } else if (energyTNT > 100) {
      effects.push('Regional climate disruption')
      effects.push('Crop failure in surrounding regions')
    } else if (energyTNT > 10) {
      effects.push('Local weather pattern disruption')
      effects.push('Agricultural damage in impact zone')
    }
    
    // Note: Earthquake magnitude is now displayed separately in the main stats
    setEnvironmentalEffects(effects)
    return terrain
  }

  return (
    <div className="impact-map-overlay">
      <div className="impact-map-container">
        <div className="impact-map-header">
          <h2>Impact Analysis Report</h2>
          <button className="close-btn" onClick={handleClose}>×</button>
        </div>
        
        <div className="impact-map-content">
          <div className="map-section">
            <h3>Impact Location</h3>
            <div className="map-container">
              <MapContainer
                center={[impactLat, impactLon]}
                zoom={13}
                style={{ width: '100%', height: '100%', borderRadius: '8px' }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                <MapCenter lat={impactLat} lon={impactLon} />
                
                {/* Seismic effects zone (outermost) - orange dashed */}
                <Circle
                  center={[impactLat, impactLon]}
                  radius={seismicRadiusM}
                  pathOptions={{
                    color: '#ff6b35',
                    fillColor: 'transparent',
                    fillOpacity: 0,
                    weight: 3,
                    dashArray: '10, 5',
                    opacity: 0.7
                  }}
                />
                
                {/* Blast/thermal zone - orange filled */}
                <Circle
                  center={[impactLat, impactLon]}
                  radius={blastRadiusM}
                  pathOptions={{
                    color: 'rgba(255, 107, 53, 0.6)',
                    fillColor: 'rgba(255, 107, 53, 0.2)',
                    fillOpacity: 0.3,
                    weight: 2,
                    opacity: 0.8
                  }}
                />
                
                {/* Main crater - dark red */}
                <Circle
                  center={[impactLat, impactLon]}
                  radius={craterRadiusM}
                  pathOptions={{
                    color: '#8b0000',
                    fillColor: 'rgba(139, 0, 0, 0.8)',
                    fillOpacity: 0.7,
                    weight: 3,
                    opacity: 0.9
                  }}
                />
              </MapContainer>
            </div>
            
            <div className="coordinates">
              <div>Latitude: {impactLat.toFixed(2)}°</div>
              <div>Longitude: {impactLon.toFixed(2)}°</div>
            </div>
          </div>

          <div className="impact-stats">
            <h3>Impact Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-label">Crater Diameter</div>
                <div className="stat-value">{craterKm.toFixed(2)} km</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Energy Release</div>
                <div className="stat-value">{energyTNT.toFixed(2)} Mt TNT</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Impact Speed</div>
                <div className="stat-value">{speed.toFixed(1)} km/s</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Asteroid Size</div>
                <div className="stat-value">{size.toFixed(0)} m</div>
            </div>
          </div>

            <div className="impact-legend" style={{ marginTop: '24px' }}>
              <h4>Impact Zones</h4>
              <div className="legend-items">
                <div className="legend-item">
                  <div className="legend-color crater"></div>
                  <span>Crater: {craterDiameterKm.toFixed(1)} km diameter</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color blast"></div>
                  <span>Blast Zone: {blastRadiusKm.toFixed(1)} km radius</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color seismic"></div>
                  <span>Seismic Zone: {seismicRadiusKm.toFixed(1)} km radius</span>
                </div>
                  </div>
                </div>

            {/* Environmental Effects Section */}
            <div className="impact-legend" style={{ marginTop: '24px' }}>
              <h4>Environmental Analysis</h4>
              <div className="stats-grid" style={{ marginBottom: '12px' }}>
                <div className="stat-item">
                  <div className="stat-label">Elevation</div>
                  <div className="stat-value">
                    {elevation !== null ? `${elevation.toFixed(0)} m` : 'Loading...'}
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-label">Terrain Type</div>
                  <div className="stat-value" style={{ fontSize: '16px' }}>
                    {terrainType}
                  </div>
                </div>
                  </div>
              
              <div className="stat-item" style={{ marginBottom: '12px' }}>
                <div className="stat-label">Tsunami Risk</div>
                <div className="stat-value" style={{ 
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: tsunamiRisk.includes('EXTREME') ? '#ff0000' : 
                         tsunamiRisk.includes('HIGH') ? '#ff6b6b' : 
                         tsunamiRisk.includes('MODERATE') ? '#ffa500' : 
                         tsunamiRisk.includes('LOW') ? '#ffeb3b' : '#66ff66'
                }}>
                  {tsunamiRisk}
                </div>
                  </div>

              <div className="stat-item" style={{ marginBottom: '12px' }}>
                <div className="stat-label">Earthquake Magnitude</div>
                <div className="stat-value" style={{ 
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: earthquakeMagnitude >= 8 ? '#ff0000' : 
                         earthquakeMagnitude >= 7 ? '#ff6b6b' : 
                         earthquakeMagnitude >= 6 ? '#ffa500' : 
                         earthquakeMagnitude >= 5 ? '#ffeb3b' : '#66ff66'
                }}>
                  {earthquakeMagnitude > 0 ? `Magnitude ${earthquakeMagnitude.toFixed(1)}` : 'Calculating...'}
                </div>
              </div>

              <h4 style={{ fontSize: '18px', marginTop: '16px', marginBottom: '8px' }}>
                Secondary Effects
              </h4>
              <div style={{ 
                fontSize: '16px', 
                lineHeight: '1.6',
                color: 'var(--text)',
                opacity: 0.9
              }}>
                {environmentalEffects.length > 0 ? (
                  <ul style={{ 
                    margin: 0, 
                    paddingLeft: '20px',
                    listStyleType: '• '
                  }}>
                    {environmentalEffects.map((effect, idx) => (
                      <li key={idx} style={{ marginBottom: '6px' }}>{effect}</li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ opacity: 0.6 }}>Analyzing environmental impact...</div>
                )}
                  </div>
                </div>

            {/* Population Impact Section */}
            <div className="impact-legend" style={{ marginTop: '24px' }}>
              <h4>Population Impact Analysis</h4>
              
              {casualtyEstimate ? (
                <>
                  <div className="stat-item" style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'rgba(255, 0, 0, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 0, 0, 0.3)' }}>
                    <div className="stat-label" style={{ color: '#ff4444', fontWeight: 'bold' }}>Estimated Casualties</div>
                    <div className="stat-value" style={{ fontSize: '24px', color: '#ff0000', fontWeight: 'bold' }}>
                      {casualtyEstimate.casualties.toLocaleString()} people
                    </div>
                  </div>

                  <div className="stats-grid" style={{ marginBottom: '12px' }}>
                <div className="stat-item">
                      <div className="stat-label">Population Density</div>
                      <div className="stat-value">
                        {densityAssessment ? `${Math.round(densityAssessment.densityPkm2)} people/km²` : 'Loading...'}
                  </div>
                </div>
                <div className="stat-item">
                      <div className="stat-label">Area Type</div>
                      <div className="stat-value" style={{ fontSize: '16px' }}>
                        {densityAssessment ? densityAssessment.category : 'Unknown'}
                </div>
                    </div>
                  </div>

                  <div className="stats-grid" style={{ marginBottom: '12px' }}>
                    <div className="stat-item">
                      <div className="stat-label">Affected Area</div>
                      <div className="stat-value">
                        {casualtyEstimate.areaKm2.toFixed(0)} km²
                      </div>
                    </div>
                  <div className="stat-item">
                      <div className="stat-label">Fatality Rate</div>
                      <div className="stat-value">
                        {(casualtyEstimate.fatalityRate * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {densityAssessment?.note && (
                    <div style={{
                      marginTop: '12px',
                      padding: '8px 12px',
                      backgroundColor: 'rgba(102, 224, 255, 0.1)',
                      borderRadius: '6px',
                      border: '1px solid rgba(102, 224, 255, 0.3)',
                      fontSize: '14px',
                      color: '#66e0ff'
                    }}>
                      <strong>Data Source:</strong> {densityAssessment.source} {densityAssessment.note && `- ${densityAssessment.note}`}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  opacity: 0.6, 
                  padding: '20px',
                  fontSize: '16px'
                }}>
                  Calculating population impact...
                  </div>
                )}
            </div>
          </div>

        </div>

        <div className="impact-map-footer">
          <button className="cta" onClick={handleClose}>Continue Simulation</button>
          <button className="cta" onClick={handleReturnToSimulation} style={{marginLeft: '12px', background: 'linear-gradient(180deg, rgba(102, 224, 255, 0.2), rgba(102, 224, 255, 0.1))', borderColor: '#66e0ff'}}>Start New Simulation</button>
        </div>
      </div>
    </div>
  )
}
