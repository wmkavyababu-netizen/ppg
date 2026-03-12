import React from 'react'
import useCamera from './hooks/useCamera'
import usePpgCapture, { PpgFeatures } from './hooks/usePpgCapture'
import FingerIndicator from './components/FingerIndicator'
import ProgressRing from './components/ProgressRing'
import Waveform from './components/Waveform'

const featureRows = (f: PpgFeatures) => [
  { icon: '❤️', label: 'Heart Rate', value: `${f.heartRate} bpm` },
  { icon: '📊', label: 'HRV (RMSSD)', value: `${f.hrv} ms` },
  { icon: '📏', label: 'Peak-to-Peak', value: `${f.peakToPeak} ms` },
  { icon: '⏱️', label: 'Pulse Width', value: `${f.pulseWidth} ms` },
  { icon: '⬆️', label: 'Rise Time', value: `${f.riseTime} ms` },
  { icon: '📈', label: 'Pulse Amplitude', value: `${f.pulseAmplitude}%` },
  { icon: '🔍', label: 'Dicrotic Notch', value: f.dicrotricNotch.toFixed(2) },
  { icon: '📐', label: 'Stiffness Index', value: `${f.stiffnessIndex} m/s` },
  { icon: '↩️', label: 'Reflection Index', value: `${f.reflectionIndex}%` },
  { icon: '✅', label: 'Signal Quality', value: f.signalQuality }
]

export default function App() {
  const { redValue, fingerState, stream, error, startCamera, stopCamera } = useCamera()
  const {
    capturedFrames,
    isCapturing,
    isPaused,
    progress,
    currentHr,
    features,
    isProcessing,
    isDone,
    startCapture,
    resetCapture
  } = usePpgCapture(redValue, fingerState)

  const handleStop = () => {
    stopCamera()
    resetCapture()
  }

  const handleNewMeasurement = () => {
    resetCapture()
  }

  return (
    <div style={{ minHeight: '100vh', padding: '1.5rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1
          style={{
            fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
            fontWeight: 900,
            background: 'linear-gradient(135deg, #FF69B4, #FF1493)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0
          }}
        >
          💗 Real-Time PPG Monitor
        </h1>
        <p style={{ color: '#888', marginTop: 6, fontSize: '0.9rem' }}>
          Camera-based photoplethysmography — no wearable needed
        </p>
      </div>

      {error && (
        <div
          style={{
            background: '#ff000022',
            border: '1px solid #ff4444',
            borderRadius: '1rem',
            padding: '1rem',
            marginBottom: '1rem',
            color: '#ff8888',
            textAlign: 'center'
          }}
        >
          ⚠️ {error}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.5rem',
          maxWidth: 1100,
          margin: '0 auto'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <FingerIndicator redValue={redValue} fingerState={fingerState} />

          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!stream ? (
              <button className="neon-button" onClick={startCamera} style={{ width: '100%' }}>
                📷 Start Camera
              </button>
            ) : (
              <>
                {!isCapturing && !isDone && !isProcessing && (
                  <button
                    className="neon-button"
                    onClick={startCapture}
                    disabled={fingerState !== 'good'}
                    style={{ width: '100%' }}
                  >
                    {fingerState === 'good' ? '▶ Start Measurement' : '👆 Place finger first'}
                  </button>
                )}

                {isCapturing && (
                  <button
                    className="neon-button"
                    onClick={handleStop}
                    style={{ width: '100%', background: 'linear-gradient(135deg, #ff4444, #cc0000)' }}
                  >
                    ⏹ Stop
                  </button>
                )}

                {isDone && (
                  <button className="neon-button" onClick={handleNewMeasurement} style={{ width: '100%' }}>
                    🔄 New Measurement
                  </button>
                )}
              </>
            )}

            {isPaused && isCapturing && (
              <div
                style={{
                  background: '#ffaa0022',
                  border: '1px solid #ffaa00',
                  borderRadius: '0.75rem',
                  padding: '0.75rem',
                  color: '#ffaa00',
                  textAlign: 'center',
                  fontSize: '0.9rem'
                }}
              >
                ⏸ Paused — place finger back to resume
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {(isCapturing || isDone || isProcessing) && (
            <div
              className="glass-card"
              style={{ alignItems: 'center', display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <ProgressRing progress={progress} frames={capturedFrames.length} currentHr={currentHr} />
            </div>
          )}

          {isCapturing && <Waveform values={capturedFrames} />}

          {isProcessing && (
            <div className="glass-card" style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚙️</div>
              <p style={{ color: '#FF69B4', fontWeight: 700, margin: 0 }}>Analysing PPG signal…</p>
              <p style={{ color: '#888', fontSize: '0.85rem', marginTop: 6 }}>
                Applying bandpass filter · detecting peaks · computing features
              </p>
            </div>
          )}

          {isDone && features && (
            <div className="glass-card">
              <h3 style={{ color: '#FF69B4', fontWeight: 800, margin: '0 0 1rem 0' }}>
                📋 Measurement Results
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {featureRows(features).map((row) => (
                  <div
                    key={row.label}
                    style={{
                      background: 'rgba(255,105,180,0.08)',
                      border: '1px solid rgba(255,105,180,0.2)',
                      borderRadius: '0.75rem',
                      padding: '0.75rem'
                    }}
                  >
                    <div style={{ fontSize: '1.3rem', marginBottom: 2 }}>{row.icon}</div>
                    <div style={{ fontSize: '0.75rem', color: '#aaa' }}>{row.label}</div>
                    <div style={{ fontWeight: 800, color: 'white', fontSize: '1.05rem' }}>{row.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!stream && !error && (
            <div className="glass-card" style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>💗</div>
              <p style={{ color: '#FF69B4', fontWeight: 700 }}>Press "Start Camera" to begin</p>
              <p style={{ color: '#666', fontSize: '0.85rem' }}>
                Uses your rear camera + flash to detect blood flow through your fingertip
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

