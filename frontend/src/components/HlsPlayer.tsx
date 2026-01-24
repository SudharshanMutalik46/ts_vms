import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface HlsPlayerProps {
    src: string
    className?: string
    autoPlay?: boolean
    muted?: boolean
    controls?: boolean
}

export default function HlsPlayer({
    src,
    className = '',
    autoPlay = true,
    muted = true,
    controls = false,
}: HlsPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const hlsRef = useRef<Hls | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const video = videoRef.current
        if (!video || !src) return

        setError(null)
        setLoading(true)

        // Cleanup previous instance
        if (hlsRef.current) {
            hlsRef.current.destroy()
            hlsRef.current = null
        }

        if (Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 30,
                // Zero-Latency Tuning (Relaxed slightly for stability)
                liveSyncDurationCount: 2.0,
                liveMaxLatencyDurationCount: 4,
                maxLiveSyncPlaybackRate: 1.5,
                enableSoftwareAES: false,
                fragLoadingTimeOut: 20000,
                manifestLoadingTimeOut: 20000,
                manifestLoadingMaxRetry: 10,
                manifestLoadingRetryDelay: 1000,
            })

            hlsRef.current = hls

            hls.loadSource(src)
            hls.attachMedia(video)

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                setLoading(false)
                if (autoPlay) {
                    video.play().catch(() => {
                        // Autoplay blocked
                    })
                }
            })

            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            // Smart Retry: If stream just started, it might return 404 for a few seconds
                            console.log('[HLS] Network error (likely stream starting)... retrying');
                            hls.startLoad();
                            break
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.log('[HLS] Media error... recovering');
                            hls.recoverMediaError()
                            break
                        default:
                            setError('Stream failed')
                            break
                    }
                }
            })

            return () => {
                hls.destroy()
            }
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            video.src = src
            video.addEventListener('loadedmetadata', () => {
                setLoading(false)
                if (autoPlay) {
                    video.play().catch(() => { })
                }
            })
            video.addEventListener('error', () => {
                setError('Failed to load stream')
                setLoading(false)
            })
        } else {
            setError('HLS not supported')
            setLoading(false)
        }
    }, [src, autoPlay])

    const retry = () => {
        if (hlsRef.current) {
            setError(null)
            setLoading(true)
            hlsRef.current.loadSource(src)
        }
    }

    return (
        <div className={`relative bg-black ${className}`}>
            <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay={autoPlay}
                muted={muted}
                controls={controls}
                playsInline
            />

            {/* Loading Overlay */}
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="w-6 h-6 text-techno-500 animate-spin" />
                        <span className="text-xs text-techno-500 font-mono">CONNECTING...</span>
                    </div>
                </div>
            )}

            {/* Error Overlay */}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                    <div className="flex flex-col items-center gap-3 text-center p-4">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                        <span className="text-sm text-red-400">{error}</span>
                        <button
                            onClick={retry}
                            className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 rounded text-xs text-white"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
