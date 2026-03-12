import React, { useRef, useEffect } from 'react'

interface Props {
  values: number[]
}

const Waveform: React.FC<Props> = ({ values }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    const display = values.slice(-150)
    if (display.length < 2) return

    const min = Math.min(...display)
    const max = Math.max(...display)
    const range = max - min || 1

    const pts = display.map((v, i) => ({
      x: (i / (display.length - 1)) * W,
      y: H - ((v - min) / range) * (H - 16) - 8
    }))

    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, 'rgba(255,105,180,0.4)')
    grad.addColorStop(1, 'rgba(255,20,147,0.0)')

    ctx.beginPath()
    ctx.moveTo(pts[0].x, H)
    pts.forEach((p) => ctx.lineTo(p.x, p.y))
    ctx.lineTo(pts[pts.length - 1].x, H)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) {
      const cp = {
        x: (pts[i - 1].x + pts[i].x) / 2,
        y: (pts[i - 1].y + pts[i].y) / 2
      }
      ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, cp.x, cp.y)
    }
    ctx.strokeStyle = '#FF69B4'
    ctx.lineWidth = 2.5
    ctx.stroke()
  }, [values])

  return (
    <div className="glass-card" style={{ padding: '1rem' }}>
      <p style={{ color: '#FF69B4', fontWeight: 700, margin: '0 0 8px 0', fontSize: '0.9rem' }}>
        📈 Live PPG Waveform
      </p>
      <canvas ref={canvasRef} width={600} height={110} style={{ width: '100%', height: 110, display: 'block' }} />
    </div>
  )
}

export default Waveform

