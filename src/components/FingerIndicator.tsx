import React from 'react'
import { FingerState } from '../hooks/useCamera'

interface Props {
  redValue: number
  fingerState: FingerState
}

const stateConfig: Record<
  FingerState,
  { emoji: string; label: string; color: string }
> = {
  none: { emoji: '🔴', label: 'No finger detected', color: '#ff4444' },
  adjust: { emoji: '🟡', label: 'Adjust — cover flash completely', color: '#ffaa00' },
  good: { emoji: '🟢', label: 'Perfect! Hold steady', color: '#44ff88' }
}

const steps = [
  { num: '①', text: 'Place index finger on rear camera' },
  { num: '②', text: 'Cover the flash LED completely' },
  { num: '③', text: 'Rest phone on a flat surface' },
  { num: '④', text: 'Hold very still for 30 seconds' }
]

const FingerIndicator: React.FC<Props> = ({ redValue, fingerState }) => {
  const cfg = stateConfig[fingerState]

  return (
    <div className="glass-card flex flex-col gap-4">
      <h2 style={{ color: '#FF69B4', fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>
        📡 Finger Detection
      </h2>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: '0.85rem', color: '#aaa' }}>Red Channel</span>
          <span style={{ fontWeight: 700, color: cfg.color }}>{redValue} / 255</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 99, height: 8 }}>
          <div
            style={{
              width: `${(redValue / 255) * 100}%`,
              height: '100%',
              borderRadius: 99,
              background: `linear-gradient(90deg, #FF69B4, ${cfg.color})`,
              transition: 'width 0.1s ease'
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0.75rem 1rem',
          borderRadius: '0.75rem',
          background: `${cfg.color}22`,
          border: `1px solid ${cfg.color}55`
        }}
      >
        <span style={{ fontSize: '1.4rem' }}>{cfg.emoji}</span>
        <span style={{ fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
      </div>

      <div>
        <p style={{ color: '#888', fontSize: '0.8rem', margin: '0 0 8px 0' }}>
          PLACEMENT GUIDE
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {steps.map((s) => (
            <div key={s.num} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: '#FF69B4', fontWeight: 700, minWidth: 20 }}>{s.num}</span>
              <span style={{ fontSize: '0.9rem', color: '#ccc' }}>{s.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default FingerIndicator

