import { useEffect, useRef, useState } from 'react'
import mpegts from 'mpegts.js'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface FlvPlayerProps {
    src: string
    className?: string
    autoPlay?: boolean
    muted?: boolean
    controls?: boolean
    isLive?: boolean
}

export default function FlvPlayer({
    src,
    className = '',
    autoPlay = true,
    muted = true,
    controls = false,
}: FlvPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const playerRef = useRef<mpegts.Player | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const video = videoRef.current
        if (!video || !src) return

        setError(null)
        setLoading(true)

        // Safe cleanup helper
        const safeDestroy = (player: mpegts.Player | null) => {
            if (!player) return
            try {
                player.destroy()
            } catch (err) {
                console.warn('[FLV] Destroy error (harmless):', err)
            }
        }

        // Cleanup existing instance if any
        if (playerRef.current) {
            safeDestroy(playerRef.current)
            playerRef.current = null
        }

        if (mpegts.getFeatureList().mseLivePlayback) {
            const player = mpegts.createPlayer({
                type: 'flv',
                isLive: true,
                url: src,
                hasAudio: false,
            }, {
                enableStashBuffer: false,
                liveBufferLatencyChasing: true,
                liveBufferLatencyMaxLatency: 2, // Revert to original
                liveBufferLatencyMinRemain: 0.2
            })

            playerRef.current = player

            // Error handling before attaching
            player.on(mpegts.Events.ERROR, (type, details) => {
                console.error('[FLV] Error:', type, details)
                if (type === mpegts.ErrorTypes.NETWORK_ERROR) {
                    // Optional: Limit retries?
                    console.log('[FLV] Network error, retrying...')
                } else {
                    setError('Stream error')
                    setLoading(false)
                }
            })

            player.attachMediaElement(video)
            player.load()

            // For live streams, LOADING_COMPLETE might not fire or means "stream ended".
            // We should stop loading when we have media info or first frame
            player.on(mpegts.Events.MEDIA_INFO, () => {
                setLoading(false)
            })

            // Robust Autoplay Handling
            if (autoPlay) {
                const playPromise = video.play()
                if (playPromise !== undefined) {
                    playPromise.catch((error) => {
                        console.warn('[FLV] Autoplay blocked:', error)
                        // Fallback: Try playing muted
                        video.muted = true
                        video.play().catch(e => {
                            console.error('[FLV] Muted autoplay also failed:', e)
                            setLoading(false) // Force loading off so user can see controls
                        })
                    })
                }
            }

            return () => {
                safeDestroy(player)
                if (playerRef.current === player) {
                    playerRef.current = null
                }
            }
        } else {
            setError('FLV not supported in this browser')
            setLoading(false)
        }
    }, [src, autoPlay])

    const retry = () => {
        if (playerRef.current) {
            setError(null)
            setLoading(true)
            playerRef.current.load()
            playerRef.current.play()
        }
    }

    return (
        <div className={`relative bg-black ${className}`}>
            <video
                ref={videoRef}
                className="w-full h-full object-contain"
                style={{ objectFit: 'contain' }}
                autoPlay={autoPlay}
                muted={muted}
                controls={controls}
                playsInline
                onCanPlay={() => setLoading(false)}
                onLoadedData={() => setLoading(false)}
            />

            {/* Loading Overlay */}
            {loading && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="w-6 h-6 text-techno-500 animate-spin" />
                        <span className="text-xs text-techno-500 font-mono">LIVE CONNECT...</span>
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
