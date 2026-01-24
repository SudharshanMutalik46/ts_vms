import { useState, useEffect, useMemo } from 'react'
import { Activity, Search, Camera as CameraIcon, History, Play, Pause, Settings } from 'lucide-react'
import * as api from '../services/api'
import type { Camera, AIEvent } from '../types'
import FlvPlayer from '../components/FlvPlayer'
import AIConfigModal from '../components/AIConfigModal'

export default function AIConfigurationPage() {
    const [cameras, setCameras] = useState<Camera[]>([])
    const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [events, setEvents] = useState<AIEvent[]>([])
    const [loading, setLoading] = useState(true)
    const [showConfigModal, setShowConfigModal] = useState(false)
    const [processing, setProcessing] = useState(false)

    const [cameraFeatures, setCameraFeatures] = useState<Record<string, string[]>>({})

    // Simple mapping for display
    const FEATURE_NAMES: Record<string, string> = {
        'PEOPLE_COUNTING': 'People Counting',
        'MOTION': 'Motion Detection',
        'LINE_CROSSING': 'Line Crossing',
        'INTRUSION': 'Intrusion Detection',
        'ILLEGAL_PARKING': 'Illegal Parking',
        'FACE_RECOGNITION': 'Face Recognition',
        'FIRE_SMOKE': 'Fire Detection',
        'TRAFFIC_VIOLATION': 'Traffic Violation',
        'CRIMINAL_ACTIVITY': 'Criminal Activity'
    }

    // Initial Load
    useEffect(() => {
        loadCameras()
    }, [])

    // Poll events for selected camera
    useEffect(() => {
        if (!selectedCamera) return

        // Start stream to ensure it's available
        api.startStream(selectedCamera.id).catch(console.error)

        const fetchEvents = async () => {
            try {
                // Get events from start of day
                const today = new Date()
                today.setHours(0, 0, 0, 0)

                const result = await api.listAIEvents({
                    camera_id: selectedCamera.id,
                    start_time: today.toISOString(),
                    limit: 1000 // Reasonable limit for daily events
                })
                setEvents(result.data || [])
            } catch (err) {
                console.error('Failed to load monitor events', err)
            }
        }

        fetchEvents()
        const interval = setInterval(fetchEvents, 3000)
        return () => clearInterval(interval)
    }, [selectedCamera])

    const loadCameras = async () => {
        try {
            setLoading(true)
            const data = await api.listCameras()
            setCameras(data)

            // Fetch features for all cameras
            const featureMap: Record<string, string[]> = {}
            await Promise.all(data.map(async (cam) => {
                try {
                    const features = await api.getCameraFeatures(cam.id)
                    featureMap[cam.id] = features.map((f: any) => f.feature_code || f.code)
                } catch (e) {
                    featureMap[cam.id] = []
                }
            }))
            setCameraFeatures(featureMap)

            if (data.length > 0) {
                // Update selected camera if it exists in new data (to refresh status)
                if (selectedCamera) {
                    const updated = data.find(c => c.id === selectedCamera.id)
                    if (updated) setSelectedCamera(updated)
                } else {
                    setSelectedCamera(data[0])
                }
            }
        } finally {
            setLoading(false)
        }
    }

    const toggleAI = async (enabled: boolean) => {
        if (!selectedCamera) return
        setProcessing(true)
        try {
            await api.updateCamera(selectedCamera.id, { ai_enabled: enabled })
            // Refresh local state
            const updated = { ...selectedCamera, ai_enabled: enabled }
            setSelectedCamera(updated)
            setCameras(prev => prev.map(c => c.id === updated.id ? updated : c))
        } catch (err) {
            console.error('Failed to toggle AI', err)
        } finally {
            setProcessing(false)
        }
    }

    const filteredCameras = cameras.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const stats = useMemo(() => {
        let inCount = 0
        let outCount = 0

        events.forEach(e => {
            // Handle various event_type formats:
            // - 'LINE_CROSSING' with metadata.direction
            // - 'person_line_crossing_a_to_b' (direction in type name)
            const eventType = (e.event_type || '').toLowerCase()

            if (eventType.includes('line_crossing') || eventType.includes('crossing')) {
                // Check if direction is in event_type itself
                if (eventType.includes('a_to_b')) {
                    inCount++
                } else if (eventType.includes('b_to_a')) {
                    outCount++
                } else {
                    // Fallback to metadata
                    const meta = e.metadata as any
                    const direction = (meta?.direction || meta?.details || '').toUpperCase()
                    if (direction.includes('IN') || direction.includes('A_TO_B')) inCount++
                    else if (direction.includes('OUT') || direction.includes('B_TO_A')) outCount++
                }
            }
        })

        return { in: inCount, out: outCount }
    }, [events])

    if (loading && cameras.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-2 border-techno-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="h-full flex overflow-hidden bg-stone-950">
            {/* Sidebar - Camera List */}
            <div className="w-72 border-r border-stone-800 flex flex-col bg-stone-900/30">
                <div className="p-4 border-b border-stone-800">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-techno-500" />
                        AI Monitor
                    </h2>
                    <div className="mt-4 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                        <input
                            type="text"
                            placeholder="Search cameras..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-stone-800 border-none rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:ring-1 focus:ring-techno-500"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {filteredCameras.map(cam => {
                        const features = cameraFeatures[cam.id] || []
                        const hasFeatures = features.length > 0

                        return (
                            <button
                                key={cam.id}
                                onClick={() => setSelectedCamera(cam)}
                                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${selectedCamera?.id === cam.id
                                    ? 'bg-techno-900/20 text-white border border-techno-500/20'
                                    : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
                                    }`}
                            >
                                <CameraIcon className={`w-4 h-4 ${cam.status === 'ONLINE' ? 'text-green-500' : 'text-stone-600'}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{cam.name}</div>
                                    <div className={`text-xs truncate ${hasFeatures ? 'text-green-400' : 'opacity-60'}`}>
                                        {hasFeatures
                                            ? features.map(f => FEATURE_NAMES[f] || f).join(', ')
                                            : 'AI Disabled'}
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Main Content - Monitor */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {selectedCamera ? (
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                                    {selectedCamera.name}
                                    {selectedCamera.ai_enabled ? (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-medium">Running</span>
                                    ) : (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-stone-800 text-stone-400 border border-stone-700 font-medium">Paused</span>
                                    )}
                                </h1>
                                <div className="flex items-center gap-3 mt-1">
                                    <p className="text-stone-400 text-sm">Real-time AI Analysis</p>
                                    {(events.length > 0 && (events[0].metadata as any)?.perf) && (
                                        <>
                                            <span className="text-stone-700">|</span>
                                            <div className="flex items-center gap-1.5 text-xs font-medium text-techno-400 bg-techno-900/10 px-2 py-1 rounded border border-techno-500/20">
                                                <Activity className="w-3.5 h-3.5" />
                                                <span>NVIDIA GPU</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs font-mono text-white bg-stone-800 px-2 py-1 rounded border border-stone-700">
                                                <span>{(events[0].metadata as any).perf.fps} FPS</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs font-mono text-green-400 bg-green-900/10 px-2 py-1 rounded border border-green-500/20">
                                                <span>{Math.round((events[0].metadata as any).perf.infer_ms || 0)}ms</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* Controls */}
                                <div className="flex items-center gap-1 bg-stone-900 p-1 rounded-lg border border-stone-800">
                                    <button
                                        onClick={() => toggleAI(true)}
                                        disabled={processing || selectedCamera.ai_enabled}
                                        className={`p-2 rounded-md transition-all ${selectedCamera.ai_enabled
                                            ? 'bg-techno-600 text-white shadow-lg shadow-techno-900/50'
                                            : 'text-stone-400 hover:text-white hover:bg-stone-800'}`}
                                        title="Start AI"
                                    >
                                        <Play className="w-4 h-4 fill-current" />
                                    </button>
                                    <button
                                        onClick={() => toggleAI(false)}
                                        disabled={processing || !selectedCamera.ai_enabled}
                                        className={`p-2 rounded-md transition-all ${!selectedCamera.ai_enabled
                                            ? 'bg-stone-700 text-white'
                                            : 'text-stone-400 hover:text-white hover:bg-stone-800'}`}
                                        title="Stop AI"
                                    >
                                        <Pause className="w-4 h-4 fill-current" />
                                    </button>
                                </div>

                                <button
                                    onClick={() => setShowConfigModal(true)}
                                    className="p-2.5 bg-stone-900 rounded-lg border border-stone-800 text-stone-400 hover:text-white hover:border-stone-600 transition-all flex items-center gap-2"
                                >
                                    <Settings className="w-4 h-4" />
                                    Edit
                                </button>

                                <div className="h-8 w-px bg-stone-800 mx-2" />

                                <div className="px-3 py-1 bg-stone-800 rounded-full border border-stone-700 text-xs font-mono text-stone-300">
                                    {events.length} Events Today
                                </div>
                            </div>
                        </div>

                        {/* Video & Stats Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                            {/* Video Player */}
                            <div className="lg:col-span-3 aspect-video bg-black rounded-xl overflow-hidden relative shadow-2xl border border-stone-800 group">
                                <FlvPlayer
                                    src={`${api.getFlvUrl(selectedCamera.id)}?token=${localStorage.getItem('vms_token')}`}
                                    className="w-full h-full object-contain"
                                    isLive={true}
                                />

                                {/* ROI Overlay */}
                                {selectedCamera.roi_points && selectedCamera.roi_points.length === 2 && (
                                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                                        <defs>
                                            <marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
                                                <path d="M0,0 L10,5 L0,10" fill="none" stroke="#22c55e" strokeWidth="2" />
                                            </marker>
                                        </defs>
                                        {/* Main Line */}
                                        <line
                                            x1={`${selectedCamera.roi_points[0].x * 100}%`}
                                            y1={`${selectedCamera.roi_points[0].y * 100}%`}
                                            x2={`${selectedCamera.roi_points[1].x * 100}%`}
                                            y2={`${selectedCamera.roi_points[1].y * 100}%`}
                                            stroke="rgba(34, 197, 94, 0.8)"
                                            strokeWidth="3"
                                            strokeDasharray="5,5"
                                        />
                                        {/* Point A */}
                                        <circle
                                            cx={`${selectedCamera.roi_points[0].x * 100}%`}
                                            cy={`${selectedCamera.roi_points[0].y * 100}%`}
                                            r="4"
                                            fill="#22c55e"
                                        />
                                        <text x={`${selectedCamera.roi_points[0].x * 100}%`} y={`${selectedCamera.roi_points[0].y * 100}%`} dx="10" dy="5" fill="white" fontSize="12" fontWeight="bold">A</text>

                                        {/* Point B */}
                                        <circle
                                            cx={`${selectedCamera.roi_points[1].x * 100}%`}
                                            cy={`${selectedCamera.roi_points[1].y * 100}%`}
                                            r="4"
                                            fill="#ef4444"
                                        />
                                        <text x={`${selectedCamera.roi_points[1].x * 100}%`} y={`${selectedCamera.roi_points[1].y * 100}%`} dx="10" dy="5" fill="white" fontSize="12" fontWeight="bold">B</text>
                                    </svg>
                                )}

                                {/* Detection Bounding Boxes */}
                                {events.length > 0 && (
                                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                                        {(() => {
                                            const latestEvent = events[0]
                                            console.log('DEBUG: Latest Event:', latestEvent); // DEBUG LOG

                                            // Check if event is recent (< 60 seconds to avoid very stale boxes, but allow for clock skew)
                                            const timeDiff = new Date().getTime() - new Date(latestEvent.event_time).getTime();
                                            console.log('DEBUG: Time Diff:', timeDiff, 'ms'); // DEBUG LOG

                                            if (timeDiff > 60000) {
                                                console.log('DEBUG: Event stale, skipping render'); // DEBUG LOG
                                                return null
                                            }

                                            let meta = latestEvent.metadata as any
                                            console.log('DEBUG: Raw Metadata:', meta, typeof meta); // DEBUG LOG

                                            // Handle string metadata (common issue)
                                            if (typeof meta === 'string') {
                                                try {
                                                    meta = JSON.parse(meta);
                                                    console.log('DEBUG: Parsed Metadata:', meta);
                                                } catch (e) {
                                                    console.error('DEBUG: Failed to parse metadata JSON:', e);
                                                    return null;
                                                }
                                            }

                                            const detections = meta?.objects || meta?.detections || []

                                            // Handle single detection or simple bbox at root if exists
                                            if (meta?.bbox || meta?.box || meta?.rect) {
                                                detections.push({ label: latestEvent.event_type, box: meta.bbox || meta.box || meta.rect })
                                            }

                                            return detections.map((det: any, idx: number) => {
                                                const label = (det.label || det.class || 'unknown').toLowerCase()
                                                if (!label.includes('person') && !label.includes('human')) return null

                                                // Support [x, y, w, h] (normalized 0-1)
                                                // or {x, y, w, h} or {xmin, ymin, xmax, ymax}
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

                                                return (
                                                    <g key={idx}>
                                                        <rect
                                                            x={`${x * 100}%`}
                                                            y={`${y * 100}%`}
                                                            width={`${w * 100}%`}
                                                            height={`${h * 100}%`}
                                                            fill="none"
                                                            stroke="#22c55e"
                                                            strokeWidth="3"
                                                            className="animate-in fade-in duration-200"
                                                        />
                                                        <text
                                                            x={`${x * 100}%`}
                                                            y={`${(y * 100) - 2}%`}
                                                            fill="#22c55e"
                                                            fontSize="14"
                                                            fontWeight="bold"
                                                            className="drop-shadow-md"
                                                        >
                                                            Person {Math.round((det.confidence || latestEvent.confidence) * 100)}%
                                                        </text>
                                                    </g>
                                                )
                                            })
                                        })()}
                                    </svg>
                                )}

                                {/* Live Indicator Badge */}
                                <div className="absolute top-4 left-4 flex gap-2">
                                    <div className="bg-black/60 backdrop-blur px-2 py-1 rounded border border-white/10 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                        <span className="text-xs font-bold text-white uppercase">Live</span>
                                    </div>
                                    {selectedCamera.ai_enabled && (
                                        <div className="bg-black/60 backdrop-blur px-2 py-1 rounded border border-white/10 flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse delay-75" />
                                            <span className="text-xs font-bold text-white uppercase tracking-wider">AI Running</span>
                                        </div>
                                    )}
                                </div>

                                {/* Overlay Stats */}
                                <div className="absolute top-4 right-4 flex flex-col gap-2 pointer-events-none">
                                    <div className="bg-black/70 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10 flex items-center justify-between min-w-[120px]">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            <span className="text-sm font-bold text-green-400">IN</span>
                                        </div>
                                        <span className="text-xl font-mono font-bold text-white">{stats.in}</span>
                                    </div>
                                    <div className="bg-black/70 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10 flex items-center justify-between min-w-[120px]">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                            <span className="text-sm font-bold text-red-400">OUT</span>
                                        </div>
                                        <span className="text-xl font-mono font-bold text-white">{stats.out}</span>
                                    </div>
                                    <div className="bg-black/70 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10 flex items-center justify-between min-w-[120px]">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                            <span className="text-sm font-bold text-blue-400">TOTAL</span>
                                        </div>
                                        <span className="text-xl font-mono font-bold text-white">{stats.in + stats.out}</span>
                                    </div>
                                </div>


                            </div>

                            {/* Side Panel / Event Feed */}
                            <div className="bg-stone-900/50 border border-stone-800 rounded-xl flex flex-col h-full lg:h-auto overflow-hidden">
                                <div className="p-4 border-b border-stone-800 bg-stone-900 flex justify-between items-center">
                                    <h3 className="font-bold text-white flex items-center gap-2">
                                        <History className="w-4 h-4 text-techno-400" />
                                        Activity Log
                                    </h3>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                    {events.length === 0 ? (
                                        <div className="text-center text-stone-500 py-8 text-sm">No events today</div>
                                    ) : (
                                        events.slice(0, 10).map(evt => (
                                            <div key={evt.id} className="bg-stone-950 p-3 rounded border border-stone-800 flex items-start gap-3">
                                                <div className={`mt-1 w-1.5 h-1.5 rounded-full ${evt.event_type.includes('LINE') ? 'bg-blue-500' : 'bg-amber-500'}`} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-stone-200">
                                                        {(() => {
                                                            const type = evt.event_type.toLowerCase()
                                                            if (type.includes('line_crossing')) {
                                                                if (type.includes('a_to_b')) return 'Line Crossing (A → B)'
                                                                if (type.includes('b_to_a')) return 'Line Crossing (B → A)'
                                                                return 'Line Crossing'
                                                            }
                                                            if (type.includes('presence') || type.includes('dwell')) return 'Loitering Alert'
                                                            if (type.includes('intrusion')) return 'Intrusion Detected'
                                                            // Fallback: Replace underscores with spaces and title case
                                                            return evt.event_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                                                        })()}
                                                        {(evt.metadata as any)?.details && (
                                                            <span className="ml-2 text-xs px-1.5 py-0.5 bg-stone-800 rounded text-stone-400">
                                                                {(evt.metadata as any).details}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-stone-500 mt-1">
                                                        {new Date(evt.event_time).toLocaleTimeString()}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-stone-500">
                        Select a camera to view monitor
                    </div>
                )}
            </div>

            {selectedCamera && (
                <AIConfigModal
                    camera={selectedCamera}
                    isOpen={showConfigModal}
                    onClose={() => setShowConfigModal(false)}
                    onSave={() => loadCameras()}
                />
            )}
        </div>
    )
}
