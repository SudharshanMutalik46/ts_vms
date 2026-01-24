import { Maximize2, Volume2, VolumeX, AlertCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { Camera } from '../types'
// HLS deprecated for now, using FLV
// import HlsPlayer from './HlsPlayer'
import FlvPlayer from './FlvPlayer'
import * as api from '../services/api'

interface CameraTileProps {
    camera: any
    onFullscreen?: () => void
    onEdit?: (camera: any) => void
    onAIConfig?: (camera: any) => void
    latestEvent?: any
}

export default function CameraTile({ camera, onFullscreen, onEdit, onAIConfig, latestEvent }: CameraTileProps) {
    const [isStreaming, setIsStreaming] = useState(false)
    const [streamUrl, setStreamUrl] = useState<string | null>(null)
    const [muted, setMuted] = useState(true)
    const [showControls, setShowControls] = useState(false)

    const isOnline = camera.status === 'ONLINE' || camera.status === 'RECORDING'

    const handleStartStream = async () => {
        // FLV approach: Just set the URL, the player handles the connection
        // No need to explicitly "start" a background job on the server heavily
        // The endpoint /preview.flv spawns on demand.
        const token = localStorage.getItem('vms_token');

        // Use Query Param for auth to be safe and simple for video streams.
        setStreamUrl(`${api.getFlvUrl(camera.id)}?token=${token}`)
        setIsStreaming(true)
    }

    useEffect(() => {
        if (isOnline && !isStreaming) {
            handleStartStream()
        } else if (!isOnline && isStreaming) {
            setIsStreaming(false)
            setStreamUrl(null)
        }
    }, [camera.id, isOnline, isStreaming])

    return (
        <div
            className="relative bg-stone-900 border border-stone-800 rounded-xl overflow-hidden group hover:border-techno-600/50 transition-colors"
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(false)}
        >
            {/* Video Player or Placeholder */}
            <div className="aspect-video relative">
                {isOnline && isStreaming && streamUrl ? (
                    <FlvPlayer
                        src={streamUrl}
                        className="w-full h-full"
                        autoPlay
                        muted={muted}
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-stone-600">
                        <div className="text-center">
                            <AlertCircle className="w-8 h-8 text-stone-600 mx-auto mb-2" />
                            <span className="text-sm text-stone-500">Offline</span>
                        </div>
                    </div>
                )}

                {/* Detection Bounding Boxes */}
                {latestEvent && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                        {(() => {
                            // Check if event is recent (< 60 seconds to avoid very stale boxes)
                            if (new Date().getTime() - new Date(latestEvent.event_time).getTime() > 60000) return null

                            // 1. Parse Metadata
                            let meta = latestEvent.metadata as any
                            if (typeof meta === 'string') {
                                try { meta = JSON.parse(meta); } catch (e) { console.error(e); return null; }
                            }
                            const detections = meta?.detections || meta?.objects || []

                            // Handle single detection
                            if (meta?.bbox || meta?.box || meta?.rect) {
                                detections.push({ label: latestEvent.event_type, box: meta.bbox || meta.box || meta.rect })
                            }

                            // 2. Render Boxes
                            return detections.map((det: any, idx: number) => {
                                const label = (det.label || det.class || 'unknown').toLowerCase()
                                if (!label.includes('person') && !label.includes('human') && !label.includes('car')) return null

                                let x, y, w, h
                                const b = det.box || det.bbox || det.rect

                                if (Array.isArray(b)) {
                                    if (b.length === 4) { [x, y, w, h] = b }
                                } else if (b) {
                                    x = b.x || b.xmin
                                    y = b.y || b.ymin
                                    w = b.w || (b.xmax - b.xmin)
                                    h = b.h || (b.ymax - b.ymin)
                                }

                                if (x === undefined || y === undefined || w === undefined || h === undefined) return null

                                const labelText = `${det.label || 'Person'} ${Math.round((det.confidence || latestEvent.confidence) * 100)}%`

                                // Estimation of text width for background (approx 6px per char + padding)
                                const textWidth = labelText.length * 6 + 10

                                return (
                                    <g key={idx}>
                                        {/* Box */}
                                        <rect
                                            x={`${x * 100}%`}
                                            y={`${y * 100}%`}
                                            width={`${w * 100}%`}
                                            height={`${h * 100}%`}
                                            fill="none"
                                            stroke="#22c55e"
                                            strokeWidth="2"
                                            className="animate-in fade-in duration-200"
                                        />

                                        {/* Label Background */}
                                        <rect
                                            x={`${x * 100}%`}
                                            y={`${y * 100}%`}
                                            width={textWidth}
                                            height="16"
                                            fill="#22c55e"
                                        />

                                        {/* Label Text */}
                                        <text
                                            x={`${x * 100}%`}
                                            y={`${y * 100}%`}
                                            dx="4"
                                            dy="12"
                                            fill="white"
                                            fontSize="10"
                                            fontWeight="bold"
                                            className="drop-shadow-sm"
                                        >
                                            {labelText}
                                        </text>
                                    </g>
                                )
                            })
                        })()}
                    </svg>
                )}

                {/* Status Badge */}
                <div className="absolute top-2 left-2 flex items-center gap-2">
                    <span
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold backdrop-blur ${camera.status === 'RECORDING'
                            ? 'bg-red-500/80 text-white'
                            : isOnline
                                ? 'bg-green-500/80 text-white'
                                : 'bg-stone-700/80 text-stone-300'
                            }`}
                    >
                        <span
                            className={`w-1.5 h-1.5 rounded-full ${camera.status === 'RECORDING'
                                ? 'bg-white animate-pulse'
                                : isOnline
                                    ? 'bg-white'
                                    : 'bg-stone-400'
                                }`}
                        />
                        {camera.status}
                    </span>
                </div>

                {/* AI Badge */}
                {camera.ai_enabled && (
                    <div className="absolute top-2 right-2">
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-purple-500/80 text-white backdrop-blur">
                            AI
                        </span>
                    </div>
                )}

                {/* Controls Overlay */}
                <div
                    className={`absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'
                        }`}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setMuted(!muted)}
                                className="p-1.5 hover:bg-white/20 rounded text-white/80 hover:text-white transition-colors"
                            >
                                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            </button>
                            {/* AI Config Trigger */}
                            {onAIConfig && (
                                <button
                                    onClick={() => onAIConfig(camera)}
                                    className="p-1.5 hover:bg-white/20 rounded text-white/80 hover:text-techno-400 transition-colors"
                                    title="Configure AI"
                                >
                                    <div className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px] font-bold">
                                        AI
                                    </div>
                                </button>
                            )}
                        </div>
                        <button
                            onClick={onFullscreen}
                            className="p-1.5 hover:bg-white/20 rounded text-white/80 hover:text-white transition-colors"
                        >
                            <Maximize2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Camera Info */}
            <div className="p-3 bg-stone-900 border-t border-stone-800">
                <h4 className="font-medium text-white text-sm truncate">{camera.name}</h4>
                <p className="text-xs text-stone-500 truncate">{camera.location}</p>
            </div>
        </div >
    )
}
