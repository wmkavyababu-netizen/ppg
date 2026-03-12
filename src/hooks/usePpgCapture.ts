import { useState, useEffect, useRef, useCallback } from 'react'
import { FingerState } from './useCamera'

export interface PpgFeatures {
  heartRate: number
  hrv: number
  peakToPeak: number
  pulseWidth: number
  riseTime: number
  pulseAmplitude: number
  dicrotricNotch: number
  stiffnessIndex: number
  reflectionIndex: number
  signalQuality: string
}

const TARGET_FRAMES = 1800 // 30 seconds at 60fps
const SAMPLE_RATE = 60 // fps

// ─── Digital Bandpass Filter (0.5–4 Hz = 30–240 BPM) ───────────────────────
// RBJ biquad bandpass (constant skirt gain, peak gain = Q)
function makeBandpassFilter(sampleRate: number) {
  const lowHz = 0.5
  const highHz = 4.0
  const fc = Math.sqrt(lowHz * highHz)
  const bw = highHz - lowHz
  const Q = fc / bw

  const w0 = (2 * Math.PI * fc) / sampleRate
  const cosw0 = Math.cos(w0)
  const sinw0 = Math.sin(w0)
  const alpha = sinw0 / (2 * Q)

  const b0 = alpha
  const b1 = 0
  const b2 = -alpha
  const a0 = 1 + alpha
  const a1 = -2 * cosw0
  const a2 = 1 - alpha

  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0

  return (x0: number): number => {
    const y0 =
      (b0 / a0) * x0 +
      (b1 / a0) * x1 +
      (b2 / a0) * x2 -
      (a1 / a0) * y1 -
      (a2 / a0) * y2
    x2 = x1
    x1 = x0
    y2 = y1
    y1 = y0
    return y0
  }
}

function movingAverage(data: number[], windowSize: number): number[] {
  const out = new Array<number>(data.length)
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    sum += data[i]
    if (i >= windowSize) sum -= data[i - windowSize]
    const denom = Math.min(i + 1, windowSize)
    out[i] = sum / denom
  }
  return out
}

function meanStd(data: number[]): { mean: number; std: number } {
  if (data.length === 0) return { mean: 0, std: 0 }
  const m = data.reduce((a, b) => a + b, 0) / data.length
  let v = 0
  for (const x of data) v += (x - m) * (x - m)
  v /= data.length
  return { mean: m, std: Math.sqrt(v) }
}

function detectPeaks(signal: number[], minDistance: number): number[] {
  if (signal.length === 0) return []
  const { mean, std } = meanStd(signal)
  const threshold = mean + 0.3 * std // adaptive threshold

  const peaks: number[] = []
  for (let i = minDistance; i < signal.length - minDistance; i++) {
    if (signal[i] < threshold) continue
    let isPeak = true
    const start = Math.max(0, i - minDistance)
    const end = Math.min(signal.length - 1, i + minDistance)
    for (let j = start; j <= end; j++) {
      if (j !== i && signal[j] >= signal[i]) {
        isPeak = false
        break
      }
    }
    if (isPeak) peaks.push(i)
  }
  return peaks
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function computeFeatures(rawFrames: number[]): PpgFeatures {
  const filter = makeBandpassFilter(SAMPLE_RATE)
  const filtered = rawFrames.map((v) => filter(v))

  // Detrend: subtract moving average (2s window)
  const trend = movingAverage(filtered, 120)
  const detrended = filtered.map((v, i) => v - trend[i])

  // Min peak distance = 60fps / 3 Hz (max 180 BPM) = 20 samples
  const minPeakDist = Math.floor(SAMPLE_RATE / 3)
  const peaks = detectPeaks(detrended, minPeakDist)

  const rrIntervalsMs = peaks
    .slice(1)
    .map((p, i) => ((p - peaks[i]) / SAMPLE_RATE) * 1000)
    .filter((rr) => rr > 250 && rr < 2000)

  const avgRR =
    rrIntervalsMs.length > 0 ? rrIntervalsMs.reduce((a, b) => a + b, 0) / rrIntervalsMs.length : 0
  const heartRate = avgRR > 0 ? Math.round(60000 / avgRR) : 0

  // HRV (RMSSD)
  let rmssd = 0
  if (rrIntervalsMs.length > 1) {
    let sumSq = 0
    for (let i = 1; i < rrIntervalsMs.length; i++) {
      const d = rrIntervalsMs[i] - rrIntervalsMs[i - 1]
      sumSq += d * d
    }
    rmssd = Math.round(Math.sqrt(sumSq / (rrIntervalsMs.length - 1)))
  }

  const peakToPeak = avgRR > 0 ? Math.round(avgRR) : 0

  // Pulse Width at half-amplitude (on detrended trace)
  let pulseWidthTotal = 0
  let pwCount = 0
  for (const peakIdx of peaks) {
    const peakVal = detrended[peakIdx]
    if (!Number.isFinite(peakVal) || peakVal <= 0) continue
    const halfAmp = peakVal / 2
    let left = peakIdx
    let right = peakIdx
    while (left > 0 && detrended[left] > halfAmp) left--
    while (right < detrended.length - 1 && detrended[right] > halfAmp) right++
    pulseWidthTotal += ((right - left) / SAMPLE_RATE) * 1000
    pwCount++
  }
  const pulseWidth = pwCount > 0 ? Math.round(pulseWidthTotal / pwCount) : 0

  // Rise Time (foot to peak): 10% of peak amplitude
  let riseTimeTotal = 0
  let rtCount = 0
  for (const peakIdx of peaks) {
    const peakVal = detrended[peakIdx]
    if (!Number.isFinite(peakVal) || peakVal <= 0) continue
    const footThr = peakVal * 0.1
    let i = peakIdx
    while (i > 0 && detrended[i] > footThr) i--
    riseTimeTotal += ((peakIdx - i) / SAMPLE_RATE) * 1000
    rtCount++
  }
  const riseTime = rtCount > 0 ? Math.round(riseTimeTotal / rtCount) : 0

  // Pulse Amplitude as normalized range (% of 8-bit channel range)
  const sigMax = Math.max(...detrended)
  const sigMin = Math.min(...detrended)
  const pulseAmplitude = Math.round(((sigMax - sigMin) / 255) * 100)

  // Dicrotic Notch position (ratio within beat) from peak -> next peak segment
  let notchRatioTotal = 0
  let notchCount = 0
  for (let k = 0; k < peaks.length - 1; k++) {
    const peakIdx = peaks[k]
    const nextPeak = peaks[k + 1]
    const segment = detrended.slice(peakIdx, nextPeak)
    if (segment.length < 10) continue

    let notchIdx = -1
    let minVal = Number.POSITIVE_INFINITY
    const start = Math.floor(segment.length * 0.3)
    const end = Math.floor(segment.length * 0.8)
    for (let i = start; i < end; i++) {
      if (segment[i] < minVal) {
        minVal = segment[i]
        notchIdx = i
      }
    }
    if (notchIdx >= 0) {
      notchRatioTotal += notchIdx / segment.length
      notchCount++
    }
  }
  const dicrotricNotch = notchCount > 0 ? Math.round((notchRatioTotal / notchCount) * 100) / 100 : 0

  // Stiffness Index proxy using pulse width: SI ≈ height / ΔT
  const stiffnessIndex = pulseWidth > 0 ? Math.round((1.75 / (pulseWidth / 1000)) * 10) / 10 : 0

  // Reflection Index (secondary peak / systolic peak) in mid-segment
  let reflectionTotal = 0
  let reflectionCount = 0
  for (let k = 0; k < peaks.length - 1; k++) {
    const peakIdx = peaks[k]
    const nextPeak = peaks[k + 1]
    const segment = detrended.slice(peakIdx, nextPeak)
    if (segment.length < 10) continue

    const systolicAmp = detrended[peakIdx]
    if (!Number.isFinite(systolicAmp) || systolicAmp <= 0) continue

    const midStart = Math.floor(segment.length * 0.3)
    const midEnd = Math.floor(segment.length * 0.8)
    let dicroticAmp = 0
    let maxMid = Number.NEGATIVE_INFINITY
    for (let i = Math.max(1, midStart); i < midEnd - 1; i++) {
      if (segment[i] > segment[i - 1] && segment[i] > segment[i + 1] && segment[i] > maxMid) {
        maxMid = segment[i]
        dicroticAmp = segment[i]
      }
    }
    reflectionTotal += dicroticAmp / systolicAmp
    reflectionCount++
  }
  const reflectionIndex = reflectionCount > 0 ? Math.round((reflectionTotal / reflectionCount) * 100) : 0

  // Signal Quality from RR interval coefficient of variation (std/mean)
  const rrStats = meanStd(rrIntervalsMs)
  const rrCv = rrStats.mean > 0 ? rrStats.std / rrStats.mean : 1
  const signalQuality =
    rrIntervalsMs.length < 5
      ? 'Poor'
      : rrCv < 0.1
        ? 'Excellent'
        : rrCv < 0.2
          ? 'Good'
          : rrCv < 0.35
            ? 'Fair'
            : 'Poor'

  return {
    heartRate: clamp(heartRate || 0, 30, 220),
    hrv: Math.max(0, rmssd),
    peakToPeak: Math.max(0, peakToPeak),
    pulseWidth: Math.max(0, pulseWidth),
    riseTime: Math.max(0, riseTime),
    pulseAmplitude: clamp(pulseAmplitude, 0, 100),
    dicrotricNotch: clamp(dicrotricNotch, 0, 1),
    stiffnessIndex: Math.max(0, stiffnessIndex),
    reflectionIndex: clamp(reflectionIndex, 0, 100),
    signalQuality
  }
}

function estimateHrRealTime(frames: number[]): number | null {
  if (frames.length < 120) return null // need at least ~2 seconds

  const filter = makeBandpassFilter(SAMPLE_RATE)
  const filtered = frames.map((v) => filter(v))
  const trend = movingAverage(filtered, 60)
  const detrended = filtered.map((v, i) => v - trend[i])

  const peaks = detectPeaks(detrended, Math.floor(SAMPLE_RATE / 3))
  if (peaks.length < 2) return null

  const intervalsSec = peaks.slice(1).map((p, i) => (p - peaks[i]) / SAMPLE_RATE)
  const avgInterval = intervalsSec.reduce((a, b) => a + b, 0) / intervalsSec.length
  if (!Number.isFinite(avgInterval) || avgInterval <= 0) return null

  const hr = Math.round(60 / avgInterval)
  return hr >= 30 && hr <= 220 ? hr : null
}

const usePpgCapture = (redValue: number, fingerState: FingerState) => {
  const [capturedFrames, setCapturedFrames] = useState<number[]>([])
  const [isCapturing, setIsCapturing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [currentHr, setCurrentHr] = useState<number | null>(null)
  const [features, setFeatures] = useState<PpgFeatures | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDone, setIsDone] = useState(false)

  const framesRef = useRef<number[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const processingRafRef = useRef<number | null>(null)

  const startCapture = useCallback(() => {
    framesRef.current = []
    setCapturedFrames([])
    setIsCapturing(true)
    setIsPaused(false)
    setFeatures(null)
    setIsDone(false)
    setCurrentHr(null)
    setIsProcessing(false)
  }, [])

  const resetCapture = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
    if (processingRafRef.current != null) cancelAnimationFrame(processingRafRef.current)
    processingRafRef.current = null

    framesRef.current = []
    setCapturedFrames([])
    setIsCapturing(false)
    setIsPaused(false)
    setCurrentHr(null)
    setFeatures(null)
    setIsProcessing(false)
    setIsDone(false)
  }, [])

  // Auto-pause/resume when finger is removed/returned
  useEffect(() => {
    if (isCapturing && fingerState !== 'good') setIsPaused(true)
    if (isCapturing && isPaused && fingerState === 'good') setIsPaused(false)
  }, [fingerState, isCapturing, isPaused])

  // Frame capture loop
  useEffect(() => {
    if (!isCapturing || isPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
      return
    }

    intervalRef.current = setInterval(() => {
      if (framesRef.current.length >= TARGET_FRAMES) return

      framesRef.current.push(redValue)
      const snapshot = framesRef.current.slice()
      setCapturedFrames(snapshot)

      // Real-time HR: update every 30 frames using last 300 frames (5 seconds)
      if (snapshot.length % 30 === 0) {
        const recent = snapshot.slice(-300)
        setCurrentHr(estimateHrRealTime(recent))
      }

      // Done?
      if (framesRef.current.length >= TARGET_FRAMES) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        intervalRef.current = null

        setIsCapturing(false)
        setIsProcessing(true)

        // Let the UI paint the spinner, then compute (no fake delays).
        processingRafRef.current = requestAnimationFrame(() => {
          const result = computeFeatures(framesRef.current)
          setFeatures(result)
          setIsProcessing(false)
          setIsDone(true)
          processingRafRef.current = null
        })
      }
    }, 1000 / SAMPLE_RATE)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [isCapturing, isPaused, redValue])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (processingRafRef.current != null) cancelAnimationFrame(processingRafRef.current)
    }
  }, [])

  const progress = (capturedFrames.length / TARGET_FRAMES) * 100

  return {
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
  }
}

export default usePpgCapture

