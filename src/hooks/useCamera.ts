import { useState, useRef, useEffect, useCallback } from 'react'

export type FingerState = 'none' | 'adjust' | 'good'

type CameraResult = {
  redValue: number
  fingerState: FingerState
  stream: MediaStream | null
  error: string | null
  isReady: boolean
  startCamera: () => Promise<void>
  stopCamera: () => void
}

const useCamera = (): CameraResult => {
  const [redValue, setRedValue] = useState(0)
  const [fingerState, setFingerState] = useState<FingerState>('none')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  const rafRef = useRef<number | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null

    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }
    videoRef.current = null

    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
    }
    setStream(null)
    setRedValue(0)
    setFingerState('none')
    setIsReady(false)
  }, [stream])

  const startCamera = useCallback(async () => {
    setError(null)
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 60 }
        }
      })

      // Try to enable torch/flash (fail silently if unsupported)
      const track = mediaStream.getVideoTracks()[0]
      try {
        const caps = track.getCapabilities?.() as unknown as { torch?: boolean }
        if (caps?.torch) {
          await track.applyConstraints({ advanced: [{ torch: true }] } as MediaTrackConstraints)
        }
      } catch {
        // ignore
      }

      const video = document.createElement('video')
      video.srcObject = mediaStream
      video.playsInline = true
      video.muted = true
      await video.play()
      videoRef.current = video

      const canvas = document.createElement('canvas')
      canvasRef.current = canvas

      setStream(mediaStream)
      setIsReady(true)

      const processFrame = () => {
        const vid = videoRef.current
        const cvs = canvasRef.current
        if (!vid || !cvs || vid.readyState < 2) {
          rafRef.current = requestAnimationFrame(processFrame)
          return
        }

        const ctx = cvs.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
          rafRef.current = requestAnimationFrame(processFrame)
          return
        }

        const W = vid.videoWidth
        const H = vid.videoHeight
        if (!W || !H) {
          rafRef.current = requestAnimationFrame(processFrame)
          return
        }

        cvs.width = W
        cvs.height = H
        ctx.drawImage(vid, 0, 0)

        // Sample center 100x100 region
        const size = 100
        const cx = Math.floor(W / 2)
        const cy = Math.floor(H / 2)
        const x = Math.max(0, Math.min(W - size, Math.floor(cx - size / 2)))
        const y = Math.max(0, Math.min(H - size, Math.floor(cy - size / 2)))
        const imageData = ctx.getImageData(x, y, size, size)

        let redSum = 0
        let greenSum = 0
        const pixels = imageData.data.length / 4

        for (let i = 0; i < imageData.data.length; i += 4) {
          redSum += imageData.data[i]
          greenSum += imageData.data[i + 1]
        }

        const avgRed = redSum / pixels
        const avgGreen = greenSum / pixels

        const redRounded = Math.round(avgRed)
        setRedValue(redRounded)

        // Heuristic: finger on camera = high red, high red/green ratio.
        const ratio = avgRed / (avgGreen + 1)
        if (avgRed < 60) {
          setFingerState('none')
        } else if (avgRed < 175 || ratio < 1.8) {
          setFingerState('adjust')
        } else {
          setFingerState('good')
        }

        rafRef.current = requestAnimationFrame(processFrame)
      }

      rafRef.current = requestAnimationFrame(processFrame)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera access denied or unavailable'
      setError(msg)
    }
  }, [])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  return { redValue, fingerState, stream, error, isReady, startCamera, stopCamera }
}

export default useCamera

