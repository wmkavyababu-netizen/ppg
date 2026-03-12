import React from 'react'

interface Props {
  progress: number
  frames: number
  currentHr: number | null
}

const SIZE = 200
const STROKE = 14
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const ProgressRing: React.FC<Props> = ({ progress, frames, currentHr }) => {
  const offset = CIRCUMFERENCE - (progress / 100) * CIRCUMFERENCE
  const seconds = Math.round((frames / 60) * 10) / 10

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={SIZE} height={SIZE} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="pgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF69B4" />
            <stop offset="100%" stopColor="#FF1493" />
          </linearGradient>
        </defs>

        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#FFB6C1"
          strokeWidth={STROKE}
          opacity={0.2}
        />

        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="url(#pgGrad)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          style={{ transition: 'stroke-dashoffset 0.2s ease' }}
        />

        <text
          x={SIZE / 2}
          y={SIZE / 2 - 22}
          textAnchor="middle"
          fill="#FF69B4"
          fontSize="13"
          fontWeight="700"
        >
          {frames} / 1800
        </text>
        <text x={SIZE / 2} y={SIZE / 2} textAnchor="middle" fill="#aaa" fontSize="12">
          {seconds}s / 30.0s
        </text>

        {currentHr != null && (
          <>
            <text
              x={SIZE / 2}
              y={SIZE / 2 + 24}
              textAnchor="middle"
              fill="white"
              fontSize="22"
              fontWeight="800"
              className="pulse-ring"
            >
              {currentHr}
            </text>
            <text x={SIZE / 2} y={SIZE / 2 + 40} textAnchor="middle" fill="#FF69B4" fontSize="11">
              bpm (live)
            </text>
          </>
        )}
      </svg>
      <p style={{ color: '#888', fontSize: '0.8rem', margin: 0 }}>{Math.round(progress)}% complete</p>
    </div>
  )
}

export default ProgressRing

