import { useState, useEffect } from 'react'
import { Grid3X3, Maximize2, Minimize2, LayoutGrid, LayoutTemplate, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import * as api from '../services/api'
import { initSocket, onAIEvent } from '../services/socket'
import { useAuth } from '../contexts/AuthContext'
import type { Camera, AIEvent } from '../types'
import FlvPlayer from '../components/FlvPlayer'
import CameraTile from '../components/CameraTile'
import LiveStats from '../components/LiveStats'
import EventSidebar from '../components/EventSidebar'
import AIConfigModal from '../components/AIConfigModal'

type GridSize = 1 | 4 | 9 | 16

export default function LiveView() {
    const [cameras, setCameras] = useState<Camera[]>([])
    const [events, setEvents] = useState<AIEvent[]>([])
    const [loading, setLoading] = useState(true)
    const [gridSize, setGridSize] = useState<GridSize>(4)
    const [fullscreenCamera, setFullscreenCamera] = useState<Camera | null>(null)
    const [aiConfigCamera, setAiConfigCamera] = useState<Camera | null>(null)
    const [showSidebar, setShowSidebar] = useState(true)
    const { token } = useAuth()
    const navigate = useNavigate()

    useEffect(() => {
        loadCameras()
        loadRecentEvents()
    }, [])

    // WebSocket Connection
    useEffect(() => {
        if (!token) return

        initSocket(token)

        const unsubscribe = onAIEvent((event) => {
            setEvents((prev) => [event, ...prev.slice(0, 49)]) // Keep last 50
        })

        return () => {
            unsubscribe()
        }
    }, [token])

    const loadCameras = async () => {
        try {
            const data = await api.listCameras()
            setCameras(data)
        } catch (err) {
            console.error('Failed to load cameras:', err)
        } finally {
            setLoading(false)
        }
    }

    const loadRecentEvents = async () => {
        try {
            // Fetch last 10 events for initial state
            const result = await api.listAIEvents({ limit: 10 })
            setEvents(result.data)
        } catch (err) {
            console.error('Failed to load recent events:', err)
        }
    }

    const gridCols = {
        1: 'grid-cols-1',
        4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2',
        9: 'grid-cols-1 md:grid-cols-3',
        16: 'grid-cols-2 md:grid-cols-4',
    }

    // Fullscreen render
    if (fullscreenCamera) {
        return (
            <div className="fixed inset-0 bg-black z-50 flex flex-col">
                <div className="absolute top-4 right-4 z-10 flex gap-2">
                    <button
                        onClick={() => setFullscreenCamera(null)}
                        className="p-2 bg-stone-900/80 hover:bg-stone-800 rounded-lg text-white backdrop-blur border border-white/10"
                    >
                        <Minimize2 className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 relative">
                    <FlvPlayer
                        src={`${api.getFlvUrl(fullscreenCamera.id)}?token=${localStorage.getItem('vms_token')}&_t=${Date.now()}`}
                        className="w-full h-full"
                        autoPlay
                        muted={false}
                        controls
                    />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent">
                    <h3 className="text-2xl font-bold text-white">{fullscreenCamera.name}</h3>
                    <p className="text-stone-300 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        LIVE FEED • {fullscreenCamera.location}
                    </p>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-techno-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-stone-500 animate-pulse">Initializing Command Center...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full flex overflow-hidden -m-6">
            {/* Left Panel: Main Content */}
            <div className="flex-1 flex flex-col p-6 min-w-0 overflow-y-auto custom-scrollbar transition-all duration-300">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <LayoutTemplate className="w-6 h-6 text-techno-500" />
                            Live Command Center
                        </h1>
                        <p className="text-sm text-stone-400 mt-1">Real-time surveillance & threat monitoring</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="bg-stone-900 rounded-xl p-1 border border-stone-800 flex items-center gap-1 shadow-lg">
                            {([1, 4, 9, 16] as GridSize[]).map((size) => (
                                <button
                                    key={size}
                                    onClick={() => setGridSize(size)}
                                    className={`p-2 rounded-lg transition-all ${gridSize === size
                                        ? 'bg-techno-600 text-white shadow-md'
                                        : 'text-stone-500 hover:text-stone-300 hover:bg-stone-800'
                                        }`}
                                    title={`${size} View`}
                                >
                                    {size === 1 ? <Maximize2 className="w-4 h-4" /> :
                                        size === 4 ? <LayoutGrid className="w-4 h-4" /> :
                                            <Grid3X3 className="w-4 h-4" />
                                    }
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setShowSidebar(!showSidebar)}
                            className={`p-3 rounded-xl border transition-all ${showSidebar
                                ? 'bg-techno-600 border-techno-500 text-white'
                                : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-white'}`}
                            title={showSidebar ? "Hide Feed" : "Show Feed"}
                        >
                            {showSidebar ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                <LiveStats cameras={cameras} recentEvents={events} />

                {/* Camera Grid with Glassmorphism */}
                <div className="flex-1 bg-stone-900/30 border border-stone-800/50 rounded-2xl p-4 backdrop-blur-sm min-h-[500px] flex flex-col">
                    {cameras.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                            <Grid3X3 className="w-16 h-16 text-stone-700 mb-4" />
                            <h3 className="text-xl font-medium text-stone-400">System Offline</h3>
                            <p className="text-stone-600">No active cameras detected in the network.</p>
                        </div>
                    ) : (
                        <div className={`grid ${gridCols[gridSize]} gap-4 flex-1 ${gridSize === 1 ? 'place-content-center max-w-5xl mx-auto w-full' : 'content-start'}`}>
                            {cameras.slice(0, gridSize).map((camera) => (
                                <CameraTile
                                    key={camera.id}
                                    camera={camera}
                                    latestEvent={events.find(e => e.camera_id === camera.id)}
                                    onFullscreen={() => setFullscreenCamera(camera)}
                                    onAIConfig={(camera) => setAiConfigCamera(camera)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel: Event Feed (Collapsible) */}
            <div className={`transition-all duration-300 ease-in-out border-l border-stone-800 bg-stone-900 overflow-hidden ${showSidebar ? 'w-80 opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-full border-l-0'}`}>
                <div className="h-full w-80"> {/* Fixed width container to prevent squash during transition */}
                    <EventSidebar
                        events={events}
                        onEventClick={(event) => navigate(`/playback?event_id=${event.id}&camera_id=${event.camera_id}`)}
                    />
                </div>
            </div>

            {/* AI Config Modal */}
            {aiConfigCamera && (
                <AIConfigModal
                    camera={aiConfigCamera}
                    isOpen={!!aiConfigCamera}
                    onClose={() => setAiConfigCamera(null)}
                    onSave={() => loadCameras()}
                />
            )}
        </div>
    )
}
