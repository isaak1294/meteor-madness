import { useSimStore } from '../state/useSimStore'

interface LaunchPointConfirmationProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  lat: number
  lon: number
}

export default function LaunchPointConfirmation({ 
  isOpen, 
  onClose, 
  onConfirm, 
  lat, 
  lon 
}: LaunchPointConfirmationProps) {
  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  const handleCancel = () => {
    onClose()
  }

  return (
    <div className="launch-confirmation-overlay">
      <div className="launch-confirmation-container">
        <div className="launch-confirmation-header">
          <h3>🚀 Set Launch Point</h3>
          <button className="close-btn" onClick={handleCancel}>×</button>
        </div>
        
        <div className="launch-confirmation-content">
          <p>You've selected a new launch point for the meteor.</p>
          
          <div className="coordinates-display">
            <div className="coordinate-item">
              <span className="coordinate-label">Latitude:</span>
              <span className="coordinate-value">{lat.toFixed(3)}°</span>
            </div>
            <div className="coordinate-item">
              <span className="coordinate-label">Longitude:</span>
              <span className="coordinate-value">{lon.toFixed(3)}°</span>
            </div>
          </div>
          
          <p className="confirmation-question">
            Do you want to set this as the new launch location?
          </p>
        </div>

        <div className="launch-confirmation-footer">
          <button className="btn-cancel" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn-confirm" onClick={handleConfirm}>
            Set Launch Point
          </button>
        </div>
      </div>
    </div>
  )
}
